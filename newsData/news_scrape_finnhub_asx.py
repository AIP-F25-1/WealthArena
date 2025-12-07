import os, csv, json, re, requests
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient, ContentSettings

# ------------ Paths & Config ------------
BASE_DIR = Path("newsData")
ENV_FILE_FINNHUB = BASE_DIR / "finnhubCred.env"
ENV_FILE_AZURE   = BASE_DIR / "azureCred.env"
OUT_DIR = BASE_DIR
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Put the CSV wherever you like; update this path accordingly
ASX_CSV_PATH = BASE_DIR / "ASX_Listed_Companies.csv"

CATEGORIES = ("general", "merger", "forex")
KEYWORDS_L = [
    " asx", "asx:", "asx200", "asx 200", "s&p/asx", "s&p asx",
    "australia", "australian", "sydney", "aussie", "aud",
    "australian securities exchange"
]

# If fewer than this are matched, also save a small unfiltered sample to inspect
FALLBACK_MIN = 5
FALLBACK_SAMPLE = 15


# ------------ Azure Helpers ------------
def get_blob_service_client() -> BlobServiceClient:
    conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    account  = os.getenv("AZURE_STORAGE_ACCOUNT")
    if conn_str:
        print("🔑 Using connection string for Azure Storage auth")
        return BlobServiceClient.from_connection_string(conn_str)
    if not account:
        raise RuntimeError("AZURE_STORAGE_ACCOUNT must be set for AAD method.")
    print("🔐 Using Azure AD (DefaultAzureCredential) for auth")
    url  = f"https://{account}.blob.core.windows.net"
    cred = DefaultAzureCredential(exclude_interactive_browser_credential=False)
    return BlobServiceClient(account_url=url, credential=cred)

def ensure_container(svc: BlobServiceClient, name: str):
    try: svc.create_container(name)
    except Exception: pass

def upload_file(svc, container: str, blob_path: str, local_path: Path, content_type: str):
    with local_path.open("rb") as f:
        svc.get_container_client(container).upload_blob(
            name=blob_path, data=f, overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
    print(f"☁️  Uploaded to: {container}/{blob_path}")


# ------------ CSV → ASX symbol map ------------
def load_asx_symbols_from_csv(csv_path: Path):
    """
    Reads ASX_Listed_Companies.csv and returns:
      - symbols_ax: set like {"BHP.AX", "CBA.AX", ...}
      - sym_info: dict {"BHP.AX": {"code":"BHP","company":"BHP Group", "industry":"Materials", ...}, ...}
    It tolerates minor header name variations and extra columns.
    """
    if not csv_path.exists():
        raise FileNotFoundError(f"ASX list CSV not found: {csv_path}")

    # normalize header keys
    def norm(s: str) -> str:
        return re.sub(r"\s+", " ", s.strip().lower())

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        headers = [norm(h) for h in reader.fieldnames or []]

        # find indices/keys for required columns
        # expected names (case/spacing can vary): "ASX code", "Company name", "GICs industry group"
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
        sym_info   = {}

        # Rewind & iterate rows with normalized keys mapping
        f.seek(0)
        reader = csv.DictReader(f)
        for row in reader:
            row_n = {norm(k): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}

            code = (row_n.get(h_code) or "").upper().replace(".", "")
            if not code:
                continue
            # Simple sanity: ASX codes are 1–5 letters typically
            if not re.fullmatch(r"[A-Z0-9]{1,6}", code):
                continue

            sym_ax = f"{code}.AX"
            symbols_ax.add(sym_ax)

            sym_info[sym_ax] = {
                "code": code,
                "company": row_n.get(h_company) if h_company else None,
                "industry": row_n.get(h_industry) if h_industry else None,
                # keep raw row too if you want
                # "_raw": row
            }

    return symbols_ax, sym_info


# ------------ Finnhub Logic ------------
def fetch_news(token: str, category: str = "general"):
    r = requests.get("https://finnhub.io/api/v1/news",
                     params={"category": category, "token": token},
                     timeout=30)
    r.raise_for_status()
    return r.json()

def match_tickers(item: dict, symbols_ax: set[str]) -> list[str]:
    """
    Returns a list of matched ASX tickers for a news item.
    Match strategy:
      1) Finnhub 'related' field tokens that end with .AX
      2) Regex word-boundary search for <CODE>.AX in headline/summary
         (e.g., 'BHP.AX', 'CBA.AX', etc.)
    We avoid matching raw 'BHP' without .AX to reduce false positives.
    """
    matches = set()

    # 1) related field
    related = (item.get("related") or "")
    for tok in related.split(","):
        t = tok.strip().upper()
        if t and t.endswith(".AX") and t in symbols_ax:
            matches.add(t)

    # 2) headline/summary text search
    text = f"{item.get('headline','')} {item.get('summary','')}".upper()
    # Find patterns like ' ABC.AX ' or '(ABC.AX)' using word-ish boundaries
    # collect all X.AX appearing, then intersect with our symbol set
    for m in re.finditer(r"\b([A-Z0-9]{1,6}\.AX)\b", text):
        cand = m.group(1).upper()
        if cand in symbols_ax:
            matches.add(cand)

    return sorted(matches)

def is_asx_broad(item: dict) -> bool:
    text_l = f"{item.get('headline','')} {item.get('summary','')}".lower()
    if any(kw in text_l for kw in KEYWORDS_L):
        return True
    # also consider if it mentions ASX index tickers by name
    # (we already cover most by keywords; leaving indices implied)
    return False


def main():
    load_dotenv(ENV_FILE_FINNHUB)
    load_dotenv(ENV_FILE_AZURE)

    token = os.getenv("FINNHUB_TOKEN")
    if not token:
        raise RuntimeError("Missing FINNHUB_TOKEN in finnhubCred.env")

    # Load ASX symbol universe from your CSV
    symbols_ax, sym_info = load_asx_symbols_from_csv(ASX_CSV_PATH)
    print(f"Loaded {len(symbols_ax)} ASX symbols from CSV")

    # Pull categories
    raw_items = []
    for cat in CATEGORIES:
        try:
            data = fetch_news(token, category=cat)
            for d in data:
                d["_category"] = cat
            raw_items.extend(data)
        except Exception as e:
            print(f"[WARN] Failed category {cat}: {e}")

    print(f"Fetched {len(raw_items)} total items across {CATEGORIES}")

    # Tag with tickers and keep only ASX-relevant broad OR ticker-matched
    enriched = []
    for it in raw_items:
        matched = match_tickers(it, symbols_ax)
        if matched or is_asx_broad(it):
            it["_matched_tickers"] = matched  # may be []
            enriched.append(it)

    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%d_%H%M%S")

    # Save filtered/enriched set
    out_jsonl = OUT_DIR / f"finnhub_asx_broad_news_tagged_{stamp}.jsonl"
    with out_jsonl.open("w", encoding="utf-8") as f:
        for it in enriched:
            it["_ingested_at_utc"] = now.isoformat(timespec="seconds")
            it["_source"] = "finnhub_broad_news"
            # Optionally attach company names for matched tickers
            if it.get("_matched_tickers"):
                it["_matched_companies"] = [
                    {"ticker": t, "company": sym_info.get(t, {}).get("company"), "industry": sym_info.get(t, {}).get("industry")}
                    for t in it["_matched_tickers"]
                ]
            f.write(json.dumps(it, ensure_ascii=False) + "\n")

    print(f"✅ ASX-enriched stories: {len(enriched)} → {out_jsonl.name}")

    # If too few, save a tiny unfiltered sample for debugging
    if len(enriched) < FALLBACK_MIN and raw_items:
        sample = raw_items[:FALLBACK_SAMPLE]
        debug_jsonl = OUT_DIR / f"finnhub_asx_broad_UNFILTERED_SAMPLE_{stamp}.jsonl"
        with debug_jsonl.open("w", encoding="utf-8") as f:
            for it in sample:
                it["_ingested_at_utc"] = now.isoformat(timespec="seconds")
                it["_source"] = "finnhub_broad_news_unfiltered_sample"
                f.write(json.dumps(it, ensure_ascii=False) + "\n")
        print(f"ℹ️ Few matches today. Saved {len(sample)}-item sample → {debug_jsonl.name}")

    # Upload to ADLS/Blob (date partition)
    svc = get_blob_service_client()
    container = os.getenv("AZURE_STORAGE_CONTAINER", "raw")
    ensure_container(svc, container)
    prefix = f"finnhub_broad_asx/year={now.year}/month={now.month:02d}/day={now.day:02d}/"
    upload_file(svc, container, prefix + out_jsonl.name, out_jsonl, "application/json")


if __name__ == "__main__":
    main()
