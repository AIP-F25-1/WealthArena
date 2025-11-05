#!/usr/bin/env python3
# ADLS-only ASX RAW downloader
# - Saves reference to:  abfs://<FS>/<AZURE_PREFIX_REFERENCE_TOP>/asx/asx_companies.csv
# - Saves RAW to:        abfs://<FS>/<AZURE_PREFIX_ASX>/<SYMBOL>_raw.csv

import os, io, sys, json, time, logging, warnings
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

import pandas as pd
import requests
import yfinance as yf

warnings.filterwarnings("ignore")

# ───────────────────────── Logging ─────────────────────────
BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "data_download.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"),
              logging.StreamHandler()]
)
logger = logging.getLogger("asx_raw_adls_only")

# Quiet Azure SDK noise
logging.getLogger("azure").setLevel(logging.WARNING)
logging.getLogger("azure.storage").setLevel(logging.WARNING)
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.ERROR)

# ───────────────────────── ADLS setup ─────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / "azureCred.env")
except Exception:
    pass

AZURE_UPLOAD = os.getenv("AZURE_UPLOAD", "false").strip().lower() in {"1","true","yes"}
AZURE_CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
AZURE_FS      = os.getenv("AZURE_STORAGE_FILESYSTEM", "").strip()

# RAW price files live here (e.g., "asxStocks")
AZURE_PREFIX_ASX = os.getenv("AZURE_PREFIX_ASX", "asxStocks").strip()

# Reference list lives in a separate top-level prefix (e.g., "asxReference")
AZURE_PREFIX_REFERENCE_TOP = os.getenv("AZURE_PREFIX_REFERENCE_TOP", "asxReference").strip()

AZURE_CLEAN_FIRST   = os.getenv("AZURE_CLEAN_FIRST", "false").strip().lower() in {"1","true","yes"}
AZURE_DELETE_SLEEP_MS = int(os.getenv("AZURE_DELETE_SLEEP_MS", "250"))
AZURE_MAX_RETRIES     = int(os.getenv("AZURE_MAX_RETRIES", "5"))

# Inside the reference prefix we'll store it as "asx/asx_companies.csv"
REF_REMOTE_REL_PATH = "asx/asx_companies.csv"

try:
    from azure.core.exceptions import ResourceNotFoundError, HttpResponseError  # type: ignore
except Exception:
    ResourceNotFoundError = type("ResourceNotFoundError", (), {})
    class HttpResponseError(Exception): pass

def _status_code_from_exc(e: Exception) -> Optional[int]:
    resp = getattr(e, "response", None)
    return getattr(resp, "status_code", None) if resp is not None else None

def _should_retry(status: Optional[int]) -> bool:
    return (status in (409,412,429)) or (status is not None and 500 <= status <= 599)

def _retry(op_name: str, func, max_attempts=AZURE_MAX_RETRIES, base_sleep=0.3):
    last = None
    for attempt in range(1, max_attempts + 1):
        try:
            return func()
        except HttpResponseError as e:
            sc = _status_code_from_exc(e)
            logger.error(f"{op_name}: HttpResponseError status={sc}")
            if _should_retry(sc) and attempt < max_attempts:
                sleep = base_sleep * (2 ** (attempt - 1))
                logger.warning(f"{op_name}: transient {sc}, retry {attempt}/{max_attempts-1} after {sleep:.2f}s")
                time.sleep(sleep); last = e; continue
            raise
        except Exception as e:
            last = e
            if attempt < max_attempts:
                sleep = base_sleep * (2 ** (attempt - 1))
                logger.warning(f"{op_name}: error '{e}', retry {attempt}/{max_attempts-1} after {sleep:.2f}s")
                time.sleep(sleep); continue
            logger.error(f"{op_name}: failed after {max_attempts} attempts: {e}", exc_info=True)
            raise
    raise last or RuntimeError(f"{op_name}: unknown failure")

class ADLSGen2Sink:
    """Upload & download CSV bytes to/from ADLS Gen2 (no local files)."""
    def __init__(self, conn_str: str, filesystem: str, prefix: str, clean_first: bool = False):
        from azure.storage.filedatalake import DataLakeServiceClient
        self.svc = DataLakeServiceClient.from_connection_string(conn_str)
        try: self.svc.create_file_system(filesystem)
        except Exception: pass
        self.fs = self.svc.get_file_system_client(filesystem)
        self.prefix = prefix.strip().strip("/")
        self.clean_first = bool(clean_first)
        if self.prefix:
            try: self.fs.create_directory(self.prefix)
            except Exception: pass

    def _full_path(self, name: str) -> str:
        return f"{self.prefix}/{name}" if self.prefix else name

    def _delete_if_exists(self, full_path: str) -> bool:
        fc = self.fs.get_file_client(full_path)
        def _do():
            try: fc.get_file_properties()
            except ResourceNotFoundError: return False
            try: fc.delete_file(); return True
            except ResourceNotFoundError: return False
        deleted = _retry(f"ADLS delete {full_path}", _do)
        if deleted and AZURE_DELETE_SLEEP_MS > 0:
            time.sleep(AZURE_DELETE_SLEEP_MS / 1000.0)
        return deleted

    def upload_bytes(self, data: bytes, remote_name: str) -> str:
        full_path = self._full_path(remote_name)
        fc = self.fs.get_file_client(full_path)
        if self.clean_first:
            try:
                if self._delete_if_exists(full_path):
                    logger.info(f"ADLS: deleted old '{full_path}'")
            except Exception as e:
                logger.warning(f"Delete failed (continuing): {e}")
        def _do():
            fc.create_file()
            fc.upload_data(data, overwrite=True)
            return True
        _retry(f"ADLS upload {full_path}", _do)
        size = getattr(fc.get_file_properties(), "size", None)
        logger.info(f"ADLS uploaded '{full_path}' ({size} bytes)")
        return full_path

    def download_bytes(self, remote_name: str) -> Optional[bytes]:
        full_path = self._full_path(remote_name)
        fc = self.fs.get_file_client(full_path)
        try:
            stream = fc.download_file()
            return stream.readall()
        except ResourceNotFoundError:
            return None

# ───────────────────────── ASX list download ─────────────────────────
PRIMARY_CSV = os.getenv(
    "ASX_COMPANIES_CSV_URL",
    "https://www.asx.com.au/asx/research/ASXListedCompanies.csv",
).strip()

UA_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/120.0.0.0 Safari/537.36"),
    "Accept": "text/csv,application/octet-stream,application/json,text/html,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Referer": "https://www.asx.com.au/",
}
RENAMES = {"WPL": "WDS"}  # Woodside rename

def http_get(url: str, timeout=30, retries=3, backoff=1.4) -> bytes:
    if url.lower().startswith("abfs://"):
        try:
            import fsspec
            with fsspec.open(url, "rb") as f:
                return f.read()
        except Exception as e:
            raise RuntimeError(f"ABFS read failed for {url}: {e}")

    last = None
    s = requests.Session()
    s.headers.update(UA_HEADERS)
    for i in range(1, retries + 1):
        try:
            r = s.get(url, timeout=timeout, allow_redirects=True)
            r.raise_for_status()
            return r.content
        except Exception as e:
            last = e
            logger.warning(f"GET failed ({url}) attempt {i}/{retries}: {e}")
            if i < retries:
                time.sleep(backoff ** i)
    raise RuntimeError(f"GET failed for {url}: {last}")

def _find_header_index(text: str) -> int:
    lines = text.splitlines()
    for i, line in enumerate(lines[:100]):
        L = line.strip().lower()
        if "company name" in L and "asx code" in L:
            return i
    for i, line in enumerate(lines[:100]):
        L = line.strip().lower()
        if "asx code" in L and "gics" in L and "industry" in L:
            return i
    return -1

def _parse_asx_csv_bytes(content: bytes) -> pd.DataFrame:
    text = content.decode("utf-8", errors="replace")
    idx = _find_header_index(text)
    if idx == -1:
        raise RuntimeError("Couldn't locate CSV header in ASX file.")
    trimmed = "\n".join(text.splitlines()[idx:])
    df = pd.read_csv(io.StringIO(trimmed))
    if df.shape[1] < 2:
        raise RuntimeError("CSV parsed with too few columns.")
    return df

def _canonical_company_rows(df: pd.DataFrame) -> pd.DataFrame:
    code_col = None
    for c in df.columns:
        if str(c).strip().lower() in {"asx code", "code", "ticker", "symbol"}:
            code_col = c; break
    if code_col is None:
        code_col = df.columns[0]

    df = df.copy()
    df["__code__"] = df[code_col].astype(str).str.strip().str.upper()
    bad_values = {"", "ASX CODE", "CODE", "SYMBOL", "TICKER"}
    df = df[~df["__code__"].isin(bad_values)]
    df = df[df["__code__"].str.fullmatch(r"[A-Z0-9]{1,6}")]
    df = df.drop_duplicates(subset=["__code__"]).reset_index(drop=True)
    return df

def _classify_from_name(name: Optional[str]) -> str:
    if not name:
        return "Equity"
    n = " " + str(name).upper() + " "
    if any(k in n for k in [" ETF", "ETF ", " ETF)", "(ETF", "ETFS", "VANGUARD", "ISHARES",
                             "BETASHARES", "VANECK", "SPDR", "GLOBAL X"]):
        return "ETF"
    if "TRUST" in n:
        return "Trust"
    if "FUND" in n or "MANAGED FUND" in n:
        return "Fund"
    return "Equity"

def build_asx_reference_csv_bytes_from_http() -> bytes:
    logger.info(f"Fetching ASX CSV from: {PRIMARY_CSV}")
    content = http_get(PRIMARY_CSV, timeout=45, retries=5)
    logger.info(f"ASX CSV bytes: {len(content)}")
    df_raw = _parse_asx_csv_bytes(content)
    logger.info(f"Parsed ASX frame: {df_raw.shape[0]} rows, {df_raw.shape[1]} cols")

    df = _canonical_company_rows(df_raw)

    def pick(cols, *names):
        names = [n.lower() for n in names]
        for c in cols:
            if str(c).strip().lower() in names:
                return c
        return None

    cols = list(df_raw.columns)
    name_col = pick(cols, "company name", "company", "name")
    gics_col = next((c for c in cols if "gics" in str(c).lower() and "industry" in str(c).lower()), None)
    list_col = pick(cols, "listing date", "listing", "list date")
    mcap_col = pick(cols, "market cap", "market capitalisation", "market capitalization")

    out = pd.DataFrame({"asx_code": df["__code__"]})
    if name_col: out["company_name"] = df_raw.loc[df.index, name_col].astype(str).str.strip().values
    if gics_col: out["gics_industry_group"] = df_raw.loc[df.index, gics_col].astype(str).str.strip().values
    if list_col: out["listing_date"] = df_raw.loc[df.index, list_col].values
    if mcap_col: out["market_cap"] = df_raw.loc[df.index, mcap_col].values

    base = out["asx_code"].map(lambda x: RENAMES.get(x, x))
    out["ticker_yf"] = base + ".AX"
    out["security_type"] = out.get("company_name", pd.Series([""]*len(out))).map(_classify_from_name)
    out["is_etf"] = out["security_type"].eq("ETF")

    return out.to_csv(index=False, encoding="utf-8").encode("utf-8")

def get_or_create_reference_csv_bytes(ref_uploader: ADLSGen2Sink) -> bytes:
    """
    1) If ASX_COMPANIES_CSV_URL is abfs:// — read that.
    2) Else try HTTPS (PRIMARY_CSV).
       On success: upload to <AZURE_PREFIX_REFERENCE_TOP>/asx/asx_companies.csv and return bytes.
    3) If HTTPS fails: fallback to the cached file in the reference prefix.
    """
    # 1) explicit abfs:// override
    if PRIMARY_CSV.lower().startswith("abfs://"):
        logger.info(f"Reading companies CSV from ABFS override: {PRIMARY_CSV}")
        try:
            import fsspec
            with fsspec.open(PRIMARY_CSV, "rb") as f:
                return f.read()
        except Exception as e:
            raise RuntimeError(f"ABFS override failed: {e}")

    # 2) try live HTTP and persist to ADLS (reference area)
    try:
        csv_bytes = build_asx_reference_csv_bytes_from_http()
        try:
            ref_uploader.upload_bytes(csv_bytes, REF_REMOTE_REL_PATH)
            logger.info(f"Persisted reference to ADLS at '{AZURE_PREFIX_REFERENCE_TOP}/{REF_REMOTE_REL_PATH}'")
        except Exception as e:
            logger.warning(f"Could not persist reference to ADLS (continuing): {e}")
        return csv_bytes
    except Exception as e:
        logger.warning(f"Live fetch failed; trying ADLS fallback: {e}")

    # 3) fallback from previously saved ADLS file
    cached = ref_uploader.download_bytes(REF_REMOTE_REL_PATH)
    if cached:
        logger.info(f"Reusing cached reference from ADLS '{AZURE_PREFIX_REFERENCE_TOP}/{REF_REMOTE_REL_PATH}'")
        return cached

    raise RuntimeError(
        "Could not obtain ASX companies list: live fetch failed and no cached "
        f"file at '{AZURE_PREFIX_REFERENCE_TOP}/{REF_REMOTE_REL_PATH}'. "
        "Consider setting ASX_COMPANIES_CSV_URL to an abfs:// or https:// mirror."
    )

# ───────────────────────── RAW downloader (no local writes) ─────────────────────────
class RawDownloader:
    def __init__(self, symbols: List[str], start_date: str, end_date: str,
                 batch_size: int = 80, sleep_between: float = 2.0,
                 raw_uploader: ADLSGen2Sink = None):
        if not (AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS):
            raise RuntimeError("ADLS-only: set AZURE_UPLOAD=true and provide AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_FILESYSTEM.")
        if raw_uploader is None:
            raise ValueError("raw_uploader is required")

        self.symbols = list(dict.fromkeys(symbols))
        self.start_date = start_date
        self.end_date = end_date
        self.batch_size = int(batch_size)
        self.sleep_between = float(sleep_between)
        self.uploader = raw_uploader

        logger.info(
            f"ADLS upload enabled -> filesystem='{AZURE_FS}' "
            f"prefix='{self.uploader.prefix}' (raw, clean_first={AZURE_CLEAN_FIRST})"
        )

    def _normalize_df(self, df: pd.DataFrame) -> Optional[pd.DataFrame]:
        if df is None or df.empty:
            return None
        df = df.rename(columns={c: str(c).title() for c in df.columns})
        expected = ["Open","High","Low","Close","Volume"]
        if not all(c in df.columns for c in expected):
            return None
        out = df[expected].copy()
        idx = pd.to_datetime(out.index)
        out["Date"] = idx
        mask = (out[["Open","High","Low","Close"]] > 0).all(axis=1)
        out = out.loc[mask].reset_index(drop=True)
        return out if not out.empty else None

    def download_symbol(self, symbol: str) -> Optional[pd.DataFrame]:
        attempts = [
            ("history-1", lambda: yf.Ticker(symbol).history(
                start=self.start_date, end=self.end_date, interval="1d",
                auto_adjust=True, back_adjust=True)),
            ("history-2", lambda: yf.Ticker(symbol).history(
                start=self.start_date, end=self.end_date, interval="1d",
                auto_adjust=True, back_adjust=False)),
            ("download", lambda: yf.download(
                tickers=symbol, start=self.start_date, end=self.end_date,
                interval="1d", auto_adjust=True, progress=False, group_by="column")),
        ]
        last_err = None
        for tag, fn in attempts:
            try:
                df = fn()
                norm = self._normalize_df(df)
                if norm is not None:
                    logger.info(f"{symbol}: {len(norm)} rows via {tag}")
                    return norm
                else:
                    logger.info(f"{symbol}: empty via {tag}")
            except Exception as e:
                last_err = e
                logger.info(f"{symbol}: {tag} failed: {e}")
            time.sleep(0.25)
        if last_err:
            logger.error(f"Failed to fetch {symbol}: {last_err}")
        else:
            logger.error(f"No data for {symbol} in {self.start_date}→{self.end_date}")
        return None

    def _df_to_csv_bytes(self, df: pd.DataFrame) -> bytes:
        return df.to_csv(index=False).encode("utf-8")

    def upload_raw(self, df: pd.DataFrame, symbol: str) -> Optional[str]:
        try:
            csv_bytes = self._df_to_csv_bytes(df)
            # IMPORTANT: no extra /raw/ folder here — keep files directly under AZURE_PREFIX_ASX
            remote_name = f"{symbol}_raw.csv"
            remote_path = self.uploader.upload_bytes(csv_bytes, remote_name)
            return remote_path
        except Exception as e:
            logger.warning(f"ADLS upload failed for {symbol}: {e}")
            return None

    def run(self) -> Dict[str, str]:
        logger.info(f"Starting RAW downloads for {len(self.symbols)} symbols (batch={self.batch_size}, sleep={self.sleep_between}s)")
        remotes: Dict[str, str] = {}
        success = 0
        for i in range(0, len(self.symbols), self.batch_size):
            batch = self.symbols[i:i + self.batch_size]
            logger.info(f"Batch {i//self.batch_size+1}: {len(batch)} symbols")
            for sym in batch:
                try:
                    raw = self.download_symbol(sym)
                    if raw is None or raw.empty:
                        continue
                    rp = self.upload_raw(raw, sym)
                    if rp:
                        remotes[sym] = rp
                        success += 1
                except Exception as e:
                    logger.error(f"❌ {sym}: {e}")
            if i + self.batch_size < len(self.symbols):
                logger.info(f"Sleeping {self.sleep_between:.1f}s between batches…")
                time.sleep(self.sleep_between)
        logger.info(f"Completed RAW: {success}/{len(self.symbols)} symbols successful")
        return remotes

# ───────────────────────── Main ─────────────────────────
def main():
    import argparse
    parser = argparse.ArgumentParser(description="ASX -> Yahoo 10-year RAW downloader (ADLS Gen2 ONLY)")
    parser.add_argument("--equities-only", action="store_true", help="Only download companies classified as Equity")
    parser.add_argument("--max-symbols", type=int, default=0, help="Limit number of tickers (0 = no limit)")
    parser.add_argument("--batch-size", type=int, default=80)
    parser.add_argument("--sleep-between", type=float, default=2.0)
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: ~today-10y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--azure-prefix", default=AZURE_PREFIX_ASX,
                        help="RAW directory/prefix inside filesystem for uploads (default: asxStocks)")
    parser.add_argument("--clean-remote-first", action="store_true",
                        help="Delete existing remote files with same name before upload (or AZURE_CLEAN_FIRST=true)")
    args = parser.parse_args()

    if not (AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS):
        logger.error("This script is ADLS-only. Set AZURE_UPLOAD=true and provide AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_FILESYSTEM.")
        sys.exit(2)

    # Two uploaders: one for RAW, one for REFERENCE
    raw_uploader = ADLSGen2Sink(AZURE_CONN_STR, AZURE_FS, args.azure_prefix,
                                clean_first=bool(args.clean_remote_first or AZURE_CLEAN_FIRST))
    ref_uploader = ADLSGen2Sink(AZURE_CONN_STR, AZURE_FS, AZURE_PREFIX_REFERENCE_TOP,
                                clean_first=False)

    # 1) Obtain the ASX reference CSV (live or cached) and ensure it’s stored in the reference prefix
    ref_csv_bytes = get_or_create_reference_csv_bytes(ref_uploader)
    ref_remote = f"{AZURE_PREFIX_REFERENCE_TOP}/{REF_REMOTE_REL_PATH}"
    logger.info(f"Reference ready at: abfs://{AZURE_FS}/{ref_remote}")

    # 2) Build symbols list from reference (in-memory)
    ref_df = pd.read_csv(io.BytesIO(ref_csv_bytes))
    df_symbols = ref_df.copy()
    if args.equities_only:
        df_symbols = df_symbols.loc[df_symbols["security_type"].eq("Equity")].copy()
    tickers = df_symbols["ticker_yf"].dropna().drop_duplicates().tolist()
    if args.max_symbols and args.max_symbols > 0:
        tickers = tickers[:args.max_symbols]

    # 3) Date range defaults
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=3652)).isoformat()

    logger.info(f"Tickers to download (RAW only): {len(tickers)} (equities_only={bool(args.equities_only)})")
    logger.info(f"Date range: {start_date} → {end_date}")

    # 4) Download + upload RAWs into <AZURE_PREFIX_ASX>/<SYMBOL>_raw.csv
    dl = RawDownloader(
        symbols=tickers,
        start_date=start_date,
        end_date=end_date,
        batch_size=args.batch_size,
        sleep_between=args.sleep_between,
        raw_uploader=raw_uploader,
    )

    try:
        remotes = dl.run()
        if not remotes:
            logger.error("❌ No RAW data uploaded to ADLS.")
            sys.exit(1)

        summary = {
            "download_date": datetime.now().isoformat(),
            "num_symbols": len(remotes),
            "date_range": {"start": start_date, "end": end_date},
            "reference_remote": f"abfs://{AZURE_FS}/{ref_remote}",
            "raw_prefix": f"abfs://{AZURE_FS}/{args.azure_prefix}",
            "raw_remotes_count": len(remotes),
        }
        print(json.dumps(summary, indent=2))
        print("\n🎉 ASX RAW → ADLS complete.")

    except Exception as e:
        logger.error(f"RAW download failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
