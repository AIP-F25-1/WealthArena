import os, csv, json, re, time, requests
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Azure
from azure.storage.blob import BlobServiceClient, ContentSettings

# ------------ Paths & Config ------------
BASE_DIR = Path("newsData")
ENV_FILE_AV = BASE_DIR / "alphavantageCred.env"
ENV_FILE_AZ = BASE_DIR / "azureCred.env"
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
    text_l = f"{item.get('title','')} {item.get('summary','')}".lower()
    return any(kw in text_l for kw in KEYWORDS_L)


def match_tickers(item: dict, symbols_ax: set[str]) -> list[str]:
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


# ------------ Azure (ENV-ONLY) helpers ------------
def get_blob_service_client_from_env() -> BlobServiceClient:
    """
    Build BlobServiceClient using only env-provided secrets.
    Supported:
      (A) AZURE_STORAGE_CONNECTION_STRING
      (B) AZURE_STORAGE_ACCOUNT + AZURE_STORAGE_SAS
      (C) AZURE_STORAGE_ACCOUNT + AZURE_STORAGE_KEY
    """
    conn = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if conn:
        print("🔑 Using connection string for Azure Storage auth")
        return BlobServiceClient.from_connection_string(conn)

    account = os.getenv("AZURE_STORAGE_ACCOUNT")
    if not account:
        raise RuntimeError(
            "No Azure auth found. Provide either "
            "AZURE_STORAGE_CONNECTION_STRING, or "
            "AZURE_STORAGE_ACCOUNT + (AZURE_STORAGE_SAS | AZURE_STORAGE_KEY)."
        )

    base_url = f"https://{account}.blob.core.windows.net"
    sas = os.getenv("AZURE_STORAGE_SAS")
    key = os.getenv("AZURE_STORAGE_KEY")

    if sas:
        # SAS should be the query string WITHOUT leading '?'
        url = f"{base_url}?{sas.lstrip('?')}"
        print("🧩 Using Account + SAS for Azure Storage auth")
        return BlobServiceClient(account_url=url)
    if key:
        print("🧰 Using Account + Key for Azure Storage auth")
        return BlobServiceClient(account_url=base_url, credential=key)

    raise RuntimeError(
        "AZURE_STORAGE_ACCOUNT provided but neither AZURE_STORAGE_SAS nor AZURE_STORAGE_KEY set."
    )


def ensure_container(svc: BlobServiceClient, name: str):
    try:
        svc.create_container(name)
        print(f"📦 Created container: {name}")
    except Exception:
        # likely already exists
        pass


def upload_file(svc, container: str, blob_path: str, local_path: Path, content_type: str):
    from azure.core.exceptions import ResourceExistsError
    with local_path.open("rb") as f:
        try:
            svc.get_container_client(container).upload_blob(
                name=blob_path, data=f, overwrite=True,
                content_settings=ContentSettings(content_type=content_type),
            )
        except ResourceExistsError:
            pass
    print(f"☁️  Uploaded to: {container}/{blob_path}")


def main():
    # Load envs
    load_dotenv(ENV_FILE_AV)
    load_dotenv(ENV_FILE_AZ)

    api_key = os.getenv("ALPHAVANTAGE_API_KEY")
    if not api_key:
        raise RuntimeError("Missing ALPHAVANTAGE_API_KEY in alphavantageCred.env")

    symbols_ax, sym_info = load_asx_symbols_from_csv(ASX_CSV_PATH)
    print(f"Loaded {len(symbols_ax)} ASX symbols from CSV")

    now = datetime.now(timezone.utc)
    time_from = (now - timedelta(hours=LOOKBACK_HOURS)).strftime("%Y%m%dT%H%M")

    raw_items = []
    for topic in TOPICS:
        try:
            feed = fetch_news_av(api_key, topics=topic, time_from=time_from, limit=1000, sort="LATEST")
            for it in feed:
                it["_topic"] = topic
            raw_items.extend(feed)
        except Exception as e:
            print(f"[WARN] Failed topic {topic}: {e}")
        time.sleep(REQ_PAUSE_SEC)

    print(f"Fetched {len(raw_items)} total items across topics={TOPICS}")

    enriched = []
    for it in raw_items:
        matched = match_tickers(it, symbols_ax)
        if matched or is_asx_broad(it):
            it["_matched_tickers"] = matched
            enriched.append(it)

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

    print(f"✅ ASX-enriched stories: {len(enriched)} → {out_jsonl.name}")

    # Fallback sample
    if len(enriched) < FALLBACK_MIN and raw_items:
        debug_jsonl = OUT_DIR / f"alphaVantage_asx_broad_UNFILTERED_SAMPLE_{stamp}.jsonl"
        with debug_jsonl.open("w", encoding="utf-8") as f:
            for it in raw_items[:FALLBACK_SAMPLE]:
                it["_ingested_at_utc"] = now.isoformat(timespec="seconds")
                it["_source"] = "alpha_vantage_news_unfiltered_sample"
                f.write(json.dumps(it, ensure_ascii=False) + "\n")
        print(f"ℹ️ Few matches in window. Saved {FALLBACK_SAMPLE}-item sample → {debug_jsonl.name}")

    # ---------- Optional Azure upload ----------
    if (os.getenv("AZURE_UPLOAD") or "").lower() == "true":
        container = os.getenv("AZURE_STORAGE_CONTAINER", "raw")
        svc = get_blob_service_client_from_env()
        ensure_container(svc, container)

        prefix = f"alpha_vantage_asx/year={now.year}/month={now.month:02d}/day={now.day:02d}/"
        upload_file(svc, container, prefix + out_jsonl.name, out_jsonl, "application/json")
        # also upload fallback if created
        debug_path = OUT_DIR / f"alphaVantage_asx_broad_UNFILTERED_SAMPLE_{stamp}.jsonl"
        if debug_path.exists():
            upload_file(svc, container, prefix + debug_path.name, debug_path, "application/json")
    else:
        print("🛑 AZURE_UPLOAD not enabled; skipping upload.")


if __name__ == "__main__":
    main()
