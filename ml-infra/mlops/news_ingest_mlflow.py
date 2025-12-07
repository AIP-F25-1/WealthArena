"""
ASX News Ingestion with MLflow Tracking and Prometheus Metrics
Integrates Alpha Vantage news scraping into the MLOps platform
"""

import os, csv, json, re, time, requests, socket
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# MLflow
import mlflow

# Prometheus
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# ------------ Prometheus Metrics ------------
NEWS_INGEST_RUNS = Counter(
    'wealtharena_news_ingest_runs_total',
    'Total news ingestion runs',
    ['status']
)

NEWS_INGEST_ERRORS = Counter(
    'wealtharena_news_ingest_errors_total',
    'Total news ingestion errors',
    ['error_type']
)

NEWS_INGEST_TIME = Histogram(
    'wealtharena_news_ingest_duration_seconds',
    'Time spent ingesting news data'
)

NEWS_STORIES_COLLECTED = Gauge(
    'wealtharena_news_stories_collected',
    'Number of news stories collected in last run'
)

NEWS_ASX_MATCHES = Gauge(
    'wealtharena_news_asx_matches',
    'Number of ASX-matched stories in last run'
)

NEWS_TICKERS_MENTIONED = Gauge(
    'wealtharena_news_tickers_mentioned',
    'Number of unique tickers mentioned in last run'
)

# ------------ Paths & Config ------------
BASE_DIR = Path("../data/newsData")
ENV_FILE_AV = BASE_DIR / "alphavantageCred.env"
OUT_DIR = BASE_DIR
OUT_DIR.mkdir(parents=True, exist_ok=True)

ASX_CSV_PATH = BASE_DIR / "ASX_Listed_Companies.csv"

TOPICS = (
    "financial_markets",
    "mergers_and_acquisitions",
    "economy_monetary",
)
LOOKBACK_HOURS = 48
REQ_PAUSE_SEC = 13

KEYWORDS_L = [
    " asx", "asx:", "asx200", "asx 200", "s&p/asx", "s&p asx",
    "australia", "australian", "sydney", "aussie", "aud",
    "australian securities exchange"
]

FALLBACK_MIN = 5
FALLBACK_SAMPLE = 15


# ------------ CSV → ASX symbol map ------------
def load_asx_symbols_from_csv(csv_path: Path):
    """Load ASX symbols from CSV file"""
    if not csv_path.exists():
        raise FileNotFoundError(f"ASX list CSV not found: {csv_path}")

    def norm(s: str) -> str:
        return re.sub(r"\s+", " ", s.strip().lower())

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        headers = [norm(h) for h in (reader.fieldnames or [])]

        def find_col(cands):
            for c in cands:
                if c in headers:
                    return c
            return None

        h_code     = find_col({"asx code", "asx_code", "code", "ticker"})
        h_company  = find_col({"company name", "company", "company_name"})
        h_industry = find_col({"gics industry group", "gics", "industry", "gics industry"})

        if not h_code:
            raise ValueError("Could not find 'ASX code' column in the CSV header.")

        symbols_ax = set()
        sym_info = {}

        f.seek(0)
        reader = csv.DictReader(f)
        for row in reader:
            row_n = {norm(k): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
            code = (row_n.get(h_code) or "").upper().replace(".", "")
            if not code:
                continue
            if not re.fullmatch(r"[A-Z0-9]{1,6}", code):
                continue
            sym_ax = f"{code}.AX"
            symbols_ax.add(sym_ax)
            sym_info[sym_ax] = {
                "code": code,
                "company": row_n.get(h_company) if h_company else None,
                "industry": row_n.get(h_industry) if h_industry else None,
            }

    return symbols_ax, sym_info


# ------------ Alpha Vantage helpers ------------
def fetch_news_av(api_key: str, *, topics: str, time_from: str, limit: int = 1000, sort: str = "LATEST"):
    """Fetch news from Alpha Vantage API"""
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "NEWS_SENTIMENT",
        "topics": topics,
        "time_from": time_from,
        "limit": str(limit),
        "sort": sort,
        "apikey": api_key,
    }
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, dict):
        return []
    return data.get("feed", [])


def is_asx_broad(item: dict) -> bool:
    """Check if news item is broadly related to ASX"""
    text_l = f"{item.get('title','')} {item.get('summary','')}".lower()
    return any(kw in text_l for kw in KEYWORDS_L)


def match_tickers(item: dict, symbols_ax: set[str]) -> list[str]:
    """Extract ASX tickers mentioned in news item"""
    matches = set()

    for ts in item.get("ticker_sentiment", []) or []:
        t = (ts.get("ticker") or "").upper().strip()
        m = re.match(r"ASX:([A-Z0-9]{1,6})\b", t)
        if m:
            sym_ax = f"{m.group(1)}.AX"
            if sym_ax in symbols_ax:
                matches.add(sym_ax)

    text_u = f"{item.get('title','')} {item.get('summary','')}".upper()
    for m in re.finditer(r"\b([A-Z0-9]{1,6}\.AX)\b", text_u):
        cand = m.group(1)
        if cand in symbols_ax:
            matches.add(cand)

    return sorted(matches)


@NEWS_INGEST_TIME.time()
def run_news_ingestion():
    """Main news ingestion function with MLflow tracking"""
    
    # Load environment variables
    load_dotenv(ENV_FILE_AV)
    
    api_key = os.getenv("ALPHAVANTAGE_API_KEY")
    if not api_key:
        NEWS_INGEST_ERRORS.labels(error_type='missing_api_key').inc()
        raise RuntimeError("Missing ALPHAVANTAGE_API_KEY in alphavantageCred.env")

    # Load ASX symbols
    symbols_ax, sym_info = load_asx_symbols_from_csv(ASX_CSV_PATH)
    print(f"Loaded {len(symbols_ax)} ASX symbols from CSV")

    now = datetime.now(timezone.utc)
    time_from = (now - timedelta(hours=LOOKBACK_HOURS)).strftime("%Y%m%dT%H%M")

    # Start MLflow run
    with mlflow.start_run(run_name=f"asx_news_ingest_{now.strftime('%Y%m%d_%H%M%S')}"):
        
        # Log parameters
        mlflow.log_param("topics", ",".join(TOPICS))
        mlflow.log_param("lookback_hours", LOOKBACK_HOURS)
        mlflow.log_param("asx_symbols_count", len(symbols_ax))
        mlflow.log_param("time_from", time_from)
        mlflow.set_tag("component", "news_ingestion")
        mlflow.set_tag("data_source", "alpha_vantage")
        
        start_time = time.time()
        
        # Fetch news from each topic
        raw_items = []
        for topic in TOPICS:
            try:
                feed = fetch_news_av(api_key, topics=topic, time_from=time_from, limit=1000, sort="LATEST")
                for it in feed:
                    it["_topic"] = topic
                raw_items.extend(feed)
                mlflow.log_metric(f"stories_from_{topic}", len(feed))
            except Exception as e:
                print(f"[WARN] Failed topic {topic}: {e}")
                NEWS_INGEST_ERRORS.labels(error_type='api_error').inc()
                mlflow.log_param(f"error_{topic}", str(e))
            time.sleep(REQ_PAUSE_SEC)

        print(f"Fetched {len(raw_items)} total items across topics={TOPICS}")
        
        # Enrich with ASX ticker matching
        enriched = []
        all_tickers = set()
        for it in raw_items:
            matched = match_tickers(it, symbols_ax)
            if matched or is_asx_broad(it):
                it["_matched_tickers"] = matched
                all_tickers.update(matched)
                enriched.append(it)

        # Save to file
        stamp = now.strftime("%Y%m%d_%H%M%S")
        out_jsonl = OUT_DIR / f"alphaVantage_asx_broad_news_tagged_{stamp}.jsonl"
        
        with out_jsonl.open("w", encoding="utf-8") as f:
            for it in enriched:
                it["_ingested_at_utc"] = now.isoformat(timespec="seconds")
                it["_source"] = "alpha_vantage_news_sentiment"
                if it.get("_matched_tickers"):
                    it["_matched_companies"] = [
                        {
                            "ticker": t,
                            "company": sym_info.get(t, {}).get("company"),
                            "industry": sym_info.get(t, {}).get("industry"),
                        }
                        for t in it["_matched_tickers"]
                    ]
                f.write(json.dumps(it, ensure_ascii=False) + "\n")

        elapsed = time.time() - start_time
        
        # Log metrics to MLflow
        mlflow.log_metric("total_stories_fetched", len(raw_items))
        mlflow.log_metric("asx_matched_stories", len(enriched))
        mlflow.log_metric("unique_tickers_mentioned", len(all_tickers))
        mlflow.log_metric("elapsed_seconds", elapsed)
        mlflow.log_metric("match_rate", len(enriched) / len(raw_items) if raw_items else 0)
        
        # Log artifact
        mlflow.log_artifact(str(out_jsonl), artifact_path="news_data")
        
        # Update Prometheus metrics
        NEWS_STORIES_COLLECTED.set(len(raw_items))
        NEWS_ASX_MATCHES.set(len(enriched))
        NEWS_TICKERS_MENTIONED.set(len(all_tickers))
        NEWS_INGEST_RUNS.labels(status='success').inc()
        
        print(f"[OK] ASX-enriched stories: {len(enriched)} → {out_jsonl.name}")
        print(f"[OK] Unique tickers mentioned: {len(all_tickers)}")
        print(f"[OK] Elapsed time: {elapsed:.2f}s")
        
        # Fallback sample for debugging
        if len(enriched) < FALLBACK_MIN and raw_items:
            debug_jsonl = OUT_DIR / f"alphaVantage_asx_broad_UNFILTERED_SAMPLE_{stamp}.jsonl"
            with debug_jsonl.open("w", encoding="utf-8") as f:
                for it in raw_items[:FALLBACK_SAMPLE]:
                    it["_ingested_at_utc"] = now.isoformat(timespec="seconds")
                    it["_source"] = "alpha_vantage_news_unfiltered_sample"
                    f.write(json.dumps(it, ensure_ascii=False) + "\n")
            print(f"[INFO] Few matches in window. Saved {FALLBACK_SAMPLE}-item sample → {debug_jsonl.name}")
            mlflow.log_artifact(str(debug_jsonl), artifact_path="news_data_debug")


def main():
    """Main entry point with continuous operation"""
    import argparse
    
    parser = argparse.ArgumentParser(description="ASX News Ingestion with MLflow")
    parser.add_argument("--port", type=int, default=8004, help="Prometheus metrics port")
    parser.add_argument("--interval-hours", type=int, default=24, help="Hours between ingestion runs")
    parser.add_argument("--run-once", action="store_true", help="Run once and exit")
    args = parser.parse_args()
    
    # Start Prometheus metrics server
    start_http_server(args.port)
    hostname = socket.gethostname()
    print(f"[metrics] News ingestion metrics at http://localhost:{args.port}/metrics (host={hostname})")
    
    # Set MLflow experiment
    mlflow.set_experiment("asx_news_ingestion")
    
    if args.run_once:
        try:
            run_news_ingestion()
        except Exception as e:
            print(f"[ERROR] News ingestion failed: {e}")
            NEWS_INGEST_ERRORS.labels(error_type='ingestion_error').inc()
            NEWS_INGEST_RUNS.labels(status='failure').inc()
            raise
    else:
        # Continuous operation
        interval_seconds = args.interval_hours * 3600
        print(f"[INFO] Running news ingestion every {args.interval_hours} hours")
        
        while True:
            try:
                run_news_ingestion()
                print(f"[INFO] Next ingestion in {args.interval_hours} hours...")
                time.sleep(interval_seconds)
            except KeyboardInterrupt:
                print("\n[INFO] Shutting down news ingestion service...")
                break
            except Exception as e:
                print(f"[ERROR] News ingestion failed: {e}")
                NEWS_INGEST_ERRORS.labels(error_type='ingestion_error').inc()
                NEWS_INGEST_RUNS.labels(status='failure').inc()
                print(f"[INFO] Retrying in 1 hour...")
                time.sleep(3600)


if __name__ == "__main__":
    main()

