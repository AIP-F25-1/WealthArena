"""
ASX News Ingestion DEMO - Without API Key Required
Generates mock news data to demonstrate MLflow integration
"""

import os, json, time, socket, random
from pathlib import Path
from datetime import datetime, timezone, timedelta

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
OUT_DIR = BASE_DIR
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Demo ASX companies
DEMO_TICKERS = [
    ("CBA.AX", "Commonwealth Bank of Australia", "Banks"),
    ("BHP.AX", "BHP Group", "Materials"),
    ("CSL.AX", "CSL Limited", "Health Care"),
    ("NAB.AX", "National Australia Bank", "Banks"),
    ("WBC.AX", "Westpac Banking Corporation", "Banks"),
    ("ANZ.AX", "ANZ Banking Group", "Banks"),
    ("WES.AX", "Wesfarmers", "Retailing"),
    ("MQG.AX", "Macquarie Group", "Diversified Financials"),
    ("RIO.AX", "Rio Tinto", "Materials"),
    ("TLS.AX", "Telstra Corporation", "Telecommunication Services"),
]

# Demo news templates
NEWS_TEMPLATES = [
    {
        "title": "{company} reports strong quarterly earnings, shares rise {percent}%",
        "summary": "{company} has announced better than expected earnings for Q{quarter}, with revenue up {percent}% year-over-year. The ASX{ticker_short} stock gained {percent}% in early trading.",
        "sentiment": 0.7
    },
    {
        "title": "ASX 200 gains as {company} leads banking sector higher",
        "summary": "The Australian Securities Exchange rose today with {company} among the top performers in the financial sector.",
        "sentiment": 0.6
    },
    {
        "title": "{company} announces major expansion plans for Australian market",
        "summary": "{company} unveiled plans to expand operations across Australia, investing ${amount}M in new infrastructure and creating {jobs} jobs.",
        "sentiment": 0.8
    },
    {
        "title": "Market watch: {company} faces headwinds as sector struggles",
        "summary": "Shares of {company} fell {percent}% today amid broader sector concerns and regulatory scrutiny.",
        "sentiment": -0.4
    },
    {
        "title": "{company} partners with tech firms to drive digital transformation",
        "summary": "{company} announced strategic partnerships aimed at modernizing its digital infrastructure and improving customer experience.",
        "sentiment": 0.5
    },
]


def generate_mock_news():
    """Generate mock news articles for demo purposes"""
    now = datetime.now(timezone.utc)
    articles = []
    
    # Generate 20-30 mock articles
    num_articles = random.randint(20, 30)
    
    for i in range(num_articles):
        # Pick random ticker
        ticker, company, industry = random.choice(DEMO_TICKERS)
        ticker_short = ticker.replace(".AX", "")
        
        # Pick random template
        template = random.choice(NEWS_TEMPLATES)
        
        # Fill in template
        title = template["title"].format(
            company=company,
            ticker_short=ticker_short,
            percent=round(random.uniform(1, 8), 1),
            quarter=random.randint(1, 4),
            amount=random.randint(50, 500),
            jobs=random.randint(100, 1000)
        )
        
        summary = template["summary"].format(
            company=company,
            ticker_short=ticker_short,
            percent=round(random.uniform(1, 8), 1),
            quarter=random.randint(1, 4),
            amount=random.randint(50, 500),
            jobs=random.randint(100, 1000)
        )
        
        # Create article
        article = {
            "title": title,
            "summary": summary,
            "source": random.choice(["Reuters", "Bloomberg", "AFR", "The Australian", "SMH"]),
            "time_published": (now - timedelta(hours=random.randint(0, 48))).isoformat(timespec="seconds"),
            "overall_sentiment_score": template["sentiment"] + random.uniform(-0.2, 0.2),
            "ticker_sentiment": [
                {
                    "ticker": f"ASX:{ticker_short}",
                    "relevance_score": round(random.uniform(0.7, 1.0), 2),
                    "ticker_sentiment_score": template["sentiment"] + random.uniform(-0.1, 0.1)
                }
            ],
            "_matched_tickers": [ticker],
            "_matched_companies": [
                {
                    "ticker": ticker,
                    "company": company,
                    "industry": industry
                }
            ],
            "_topic": random.choice(["financial_markets", "mergers_and_acquisitions", "economy_monetary"]),
            "_ingested_at_utc": now.isoformat(timespec="seconds"),
            "_source": "demo_mock_news"
        }
        
        articles.append(article)
    
    return articles


@NEWS_INGEST_TIME.time()
def run_news_ingestion():
    """Demo news ingestion function with MLflow tracking"""
    
    now = datetime.now(timezone.utc)
    
    # Start MLflow run
    with mlflow.start_run(run_name=f"asx_news_ingest_demo_{now.strftime('%Y%m%d_%H%M%S')}"):
        
        # Log parameters
        mlflow.log_param("topics", "financial_markets,mergers_and_acquisitions,economy_monetary")
        mlflow.log_param("lookback_hours", 48)
        mlflow.log_param("asx_symbols_count", len(DEMO_TICKERS))
        mlflow.log_param("data_source", "mock_demo")
        mlflow.set_tag("component", "news_ingestion")
        mlflow.set_tag("data_source", "demo")
        mlflow.set_tag("demo", "true")
        
        start_time = time.time()
        
        print("[DEMO] Generating mock news articles...")
        
        # Generate mock news
        articles = generate_mock_news()
        raw_count = len(articles)
        
        # All articles are "matched" in demo
        enriched = articles
        
        # Count unique tickers
        all_tickers = set()
        for article in enriched:
            all_tickers.update(article.get("_matched_tickers", []))
        
        # Save to file
        stamp = now.strftime("%Y%m%d_%H%M%S")
        out_jsonl = OUT_DIR / f"demo_asx_news_{stamp}.jsonl"
        
        with out_jsonl.open("w", encoding="utf-8") as f:
            for article in enriched:
                f.write(json.dumps(article, ensure_ascii=False) + "\n")
        
        elapsed = time.time() - start_time
        
        # Log metrics to MLflow
        mlflow.log_metric("total_stories_fetched", raw_count)
        mlflow.log_metric("asx_matched_stories", len(enriched))
        mlflow.log_metric("unique_tickers_mentioned", len(all_tickers))
        mlflow.log_metric("elapsed_seconds", elapsed)
        mlflow.log_metric("match_rate", len(enriched) / raw_count if raw_count else 0)
        
        # Log artifact
        mlflow.log_artifact(str(out_jsonl), artifact_path="news_data")
        
        # Update Prometheus metrics
        NEWS_STORIES_COLLECTED.set(raw_count)
        NEWS_ASX_MATCHES.set(len(enriched))
        NEWS_TICKERS_MENTIONED.set(len(all_tickers))
        NEWS_INGEST_RUNS.labels(status='success').inc()
        
        print(f"\n[OK] Generated {len(enriched)} mock news articles")
        print(f"[OK] Unique tickers mentioned: {len(all_tickers)}")
        print(f"[OK] Tickers: {', '.join(sorted(all_tickers)[:5])}...")
        print(f"[OK] Elapsed time: {elapsed:.2f}s")
        print(f"[OK] Data saved to: {out_jsonl.name}")
        print(f"\n[MLflow] Run tracked in experiment: asx_news_ingestion")
        print(f"[MLflow] View at: http://localhost:5000")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="ASX News Ingestion DEMO with MLflow")
    parser.add_argument("--port", type=int, default=8004, help="Prometheus metrics port")
    parser.add_argument("--interval-hours", type=int, default=24, help="Hours between ingestion runs")
    parser.add_argument("--run-once", action="store_true", help="Run once and exit")
    args = parser.parse_args()
    
    # Start Prometheus metrics server
    start_http_server(args.port)
    hostname = socket.gethostname()
    print(f"\n{'='*60}")
    print(f"  ASX News Ingestion DEMO")
    print(f"{'='*60}")
    print(f"[metrics] News ingestion metrics at http://localhost:{args.port}/metrics (host={hostname})")
    print(f"[demo] Running in DEMO mode - generating mock news data")
    print(f"[demo] No API key required")
    print(f"{'='*60}\n")
    
    # Set MLflow experiment
    mlflow.set_experiment("asx_news_ingestion")
    
    if args.run_once:
        try:
            run_news_ingestion()
            print(f"\n[SUCCESS] Demo completed! Check MLflow at http://localhost:5000")
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
                print(f"\n[INFO] Next ingestion in {args.interval_hours} hours...")
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

