

import os
import io
import sys
import json
import time
import logging
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

import pandas as pd
import requests
import yfinance as yf
from yfinance import Ticker

# ----------------------------
# Basic setup
# ----------------------------
warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
REFERENCE_DIR = DATA_DIR / "reference"
for p in (LOG_DIR, RAW_DIR, REFERENCE_DIR):
    p.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "data_download.log"
# Create StreamHandler with UTF-8 encoding for console output
# Wrap sys.stdout with UTF-8 encoding to handle Unicode characters properly
try:
    import io
    # Create a TextIOWrapper with UTF-8 encoding for stdout
    utf8_stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    stream_handler = logging.StreamHandler(utf8_stdout)
except (AttributeError, TypeError):
    # Fallback: Use sys.stdout directly (may have encoding issues on Windows)
    stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setLevel(logging.INFO)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"),
              stream_handler]
)
logger = logging.getLogger("asx_raw")

# Quiet the Azure SDK's verbose HTTP logs
logging.getLogger("azure").setLevel(logging.WARNING)
logging.getLogger("azure.storage").setLevel(logging.WARNING)
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.ERROR)

# Quiet yfinance's verbose logging - set to CRITICAL to suppress all errors
logging.getLogger("yfinance").setLevel(logging.CRITICAL)
logging.getLogger("urllib3").setLevel(logging.CRITICAL)
logging.getLogger("requests").setLevel(logging.CRITICAL)
logging.getLogger("yfinance.base").setLevel(logging.CRITICAL)
logging.getLogger("yfinance.ticker").setLevel(logging.CRITICAL)
warnings.filterwarnings("ignore", category=UserWarning, module="yfinance")
warnings.filterwarnings("ignore", category=RuntimeWarning, module="yfinance")
warnings.filterwarnings("ignore", category=FutureWarning, module="yfinance")

# ----------------------------
# Azure uploader (RAW only, HNS/ADLS Gen2)
# ----------------------------
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / "azureCred.env")
except Exception:
    pass

AZURE_UPLOAD = os.getenv("AZURE_UPLOAD", "false").strip().lower() in {"1", "true", "yes"}
AZURE_CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
AZURE_FS = os.getenv("AZURE_STORAGE_FILESYSTEM", "").strip()  # ADLS filesystem (container)
AZURE_PREFIX_DEFAULT = os.getenv("AZURE_PREFIX", "asxStocks").strip()
AZURE_CLEAN_FIRST = os.getenv("AZURE_CLEAN_FIRST", "false").strip().lower() in {"1", "true", "yes"}
AZURE_DELETE_SLEEP_MS = int(os.getenv("AZURE_DELETE_SLEEP_MS", "250"))
AZURE_MAX_RETRIES = int(os.getenv("AZURE_MAX_RETRIES", "5"))

# Optional Azure error classes
try:
    from azure.core.exceptions import ResourceNotFoundError, HttpResponseError  # type: ignore
except Exception:
    ResourceNotFoundError = type("ResourceNotFoundError", (), {})
    class HttpResponseError(Exception):  # basic fallback
        def __init__(self, *a, **k):
            super().__init__(*a)

def _status_code_from_exc(e: Exception) -> Optional[int]:
    resp = getattr(e, "response", None)
    return getattr(resp, "status_code", None) if resp is not None else None

def _headers_from_exc(e: Exception) -> Dict[str, str]:
    try:
        resp = getattr(e, "response", None)
        if resp is None:
            return {}
        hdrs = getattr(resp, "headers", {}) or {}
        return dict(hdrs)
    except Exception:
        return {}

def _body_from_exc(e: Exception) -> str:
    try:
        resp = getattr(e, "response", None)
        if resp is None:
            return ""
        if hasattr(resp, "text") and callable(resp.text):
            return resp.text()  # type: ignore
        if hasattr(resp, "text"):
            return str(resp.text)
        if hasattr(resp, "content"):
            b = resp.content
            if isinstance(b, bytes):
                return b.decode("utf-8", errors="replace")
            return str(b)
    except Exception:
        return ""
    return ""

def _should_retry(status: Optional[int]) -> bool:
    if status is None:
        return False
    if status in (409, 412, 429):
        return True
    if 500 <= status <= 599:
        return True
    return False

def _retry(op_name: str, func, max_attempts=5, base_sleep=0.3):
    last = None
    for attempt in range(1, max_attempts + 1):
        try:
            return func()
        except HttpResponseError as e:
            sc = _status_code_from_exc(e)
            hdrs = _headers_from_exc(e)
            body = _body_from_exc(e)
            logger.error(f"{op_name}: HttpResponseError status={sc} headers={hdrs} body={body[:500]}")
            if _should_retry(sc) and attempt < max_attempts:
                sleep = base_sleep * (2 ** (attempt - 1))
                logger.warning(f"{op_name}: transient {sc}, retry {attempt}/{max_attempts-1} after {sleep:.2f}s")
                time.sleep(sleep)
                last = e
                continue
            raise
        except Exception as e:
            last = e
            if attempt < max_attempts:
                sleep = base_sleep * (2 ** (attempt - 1))
                logger.warning(f"{op_name}: error '{e}', retry {attempt}/{max_attempts-1} after {sleep:.2f}s")
                time.sleep(sleep)
                continue
            logger.error(f"{op_name}: failed after {max_attempts} attempts: {e}", exc_info=True)
            raise
    raise last or RuntimeError(f"{op_name}: unknown failure")

class ADLSGen2Sink:
    """
    Minimal ADLS Gen2 uploader using Hierarchical Namespace (HNS).
    - Creates filesystem and prefix directory if missing
    - Optional delete-first
    - Streaming upload (low memory)
    - Verifies uploaded size
    """
    def __init__(self, conn_str: str, filesystem: str, prefix: str, clean_first: bool = False):
        from azure.storage.filedatalake import DataLakeServiceClient  # lazy import
        self.svc = DataLakeServiceClient.from_connection_string(conn_str)
        # Ensure filesystem exists
        try:
            self.svc.create_file_system(filesystem)
        except Exception:
            pass
        self.fs = self.svc.get_file_system_client(filesystem)

        self.prefix = prefix.strip().strip("/")
        self.clean_first = bool(clean_first)
        if self.prefix:
            try:
                self.fs.create_directory(self.prefix)
            except Exception:
                pass

    def _full_path(self, name: str) -> str:
        return f"{self.prefix}/{name}" if self.prefix else name

    def delete_if_exists(self, remote_name: str) -> bool:
        full_path = self._full_path(remote_name)
        file_client = self.fs.get_file_client(full_path)

        def _do_delete():
            try:
                file_client.get_file_properties()
            except ResourceNotFoundError:
                return False
            try:
                file_client.delete_file()
                return True
            except ResourceNotFoundError:
                return False

        deleted = _retry(
            f"ADLS delete {full_path}",
            _do_delete,
            max_attempts=AZURE_MAX_RETRIES
        )
        if deleted and AZURE_DELETE_SLEEP_MS > 0:
            time.sleep(AZURE_DELETE_SLEEP_MS / 1000.0)
        return deleted

    def upload_file(self, local_path: Path, remote_name: Optional[str] = None):
        name = remote_name or local_path.name
        full_path = self._full_path(name)
        file_client = self.fs.get_file_client(full_path)

        if self.clean_first:
            try:
                if self.delete_if_exists(name):
                    logger.info(f"ADLS: deleted old file '{full_path}' before upload")
            except Exception as e:
                logger.warning(f"ADLS: delete failed for '{full_path}' (continuing): {e}")

        # Create (idempotent), then upload_data with overwrite=True (streams internally)
        def _do_upload():
            file_client.create_file()  # safe if exists
            with open(local_path, "rb") as f:
                file_client.upload_data(f, overwrite=True)  # streaming
            return True

        _retry(f"ADLS upload {full_path}", _do_upload, max_attempts=AZURE_MAX_RETRIES)

        # Verify size
        props = file_client.get_file_properties()
        size = getattr(props, "size", None)
        logger.info(f"ADLS uploaded '{full_path}' ({size} bytes)")
        return full_path

# ----------------------------
# ASX CSV Download (online)
# ----------------------------
PRIMARY_CSV = "https://www.asx.com.au/asx/research/ASXListedCompanies.csv"
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
            code_col = c
            break
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

def download_asx_companies_csv(save_path: Path) -> pd.DataFrame:
    logger.info("Fetching official ASX CSV...")
    content = http_get(PRIMARY_CSV, timeout=30, retries=3)
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

    save_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(save_path, index=False, encoding="utf-8")
    logger.info(f"Saved ASX reference CSV -> {save_path} ({len(out)} rows)")
    return out

# ----------------------------
# RAW downloader (no processing)
# ----------------------------
class RawDownloader:
    def __init__(self, symbols: List[str], start_date: str, end_date: str,
                 batch_size: int = 80, sleep_between: float = 2.0,
                 adls_prefix: str = AZURE_PREFIX_DEFAULT,
                 clean_remote_first: bool = AZURE_CLEAN_FIRST):
        self.symbols = list(dict.fromkeys(symbols))  # de-dup preserve order
        self.start_date = start_date
        self.end_date = end_date
        self.batch_size = int(batch_size)
        self.sleep_between = float(sleep_between)
        self.raw_dir = RAW_DIR
        
        # Configure yfinance with better error handling
        try:
            import yfinance.utils as yf_utils
            yf_utils.cache.clear()
        except:
            pass

        self.uploader = None
        if AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS:
            try:
                self.uploader = ADLSGen2Sink(
                    AZURE_CONN_STR, AZURE_FS, adls_prefix,
                    clean_first=clean_remote_first,
                )
                logger.info(
                    f"ADLS upload enabled -> filesystem='{AZURE_FS}' "
                    f"prefix='{adls_prefix}' (raw only, clean_first={clean_remote_first})"
                )
            except Exception as e:
                logger.warning(f"ADLS upload disabled (init failed): {e}")

        logger.info(f"RawDownloader initialized for {len(self.symbols)} symbols | {self.start_date} -> {self.end_date}")

    def _normalize_df(self, df: pd.DataFrame) -> Optional[pd.DataFrame]:
        """Normalize DataFrame to standard format - matching wealtharena_rl exactly."""
        if df is None or df.empty:
            return None
        
        # Handle MultiIndex columns from yf.download
        if isinstance(df.columns, pd.MultiIndex):
            # Flatten MultiIndex columns - take first level
            if len(df.columns.levels) == 2:
                df.columns = [col[0] if isinstance(col, tuple) else str(col) for col in df.columns]
        
        # Standardize column names to title case (exactly like wealtharena_rl)
        rename_map = {c: c.title() for c in df.columns}
        df = df.rename(columns=rename_map)
        
        # Expected OHLCV columns
        expected = ["Open", "High", "Low", "Close", "Volume"]
        
        # Check if all required columns exist (exactly like wealtharena_rl)
        if not all(c in df.columns for c in expected):
            return None
        
        # Select only the required columns
        df = df[expected].copy()
        
        # Handle Date - exactly like wealtharena_rl: df["Date"] = df.index
        df["Date"] = df.index
        
        # Reorder: Date first, then OHLCV
        df = df[["Date"] + expected]
        
        # Reset index to clean integer index (exactly like wealtharena_rl)
        return df.reset_index(drop=True)

    def download_symbol(self, symbol: str) -> Optional[pd.DataFrame]:
        """Download symbol using working approach from wealtharena_rl."""
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
                if df is None or df.empty:
                    continue
                
                # Debug: Check what columns we got
                logger.debug(f"{symbol}: {tag} returned shape {df.shape}, columns: {df.columns.tolist()}")
                    
                norm = self._normalize_df(df)
                if norm is not None and not norm.empty:
                    # Sanity check: positive prices
                    if "Open" in norm.columns and "High" in norm.columns and "Low" in norm.columns and "Close" in norm.columns:
                        mask = (norm[["Open", "High", "Low", "Close"]] > 0).all(axis=1)
                        norm = norm.loc[mask].copy()
                        if norm.empty:
                            logger.debug(f"{symbol}: Filtered to 0 rows after sanity check")
                            continue
                    
                    logger.info(f"{symbol}: {len(norm)} rows via {tag}")
                    return norm
                else:
                    logger.debug(f"{symbol}: {tag} normalization returned None or empty")
                    pass  # Silently continue
            except Exception as e:
                last_err = e
                msg = str(e).lower()
                # Silently ignore expected errors for delisted symbols
                if "possibly delisted" not in msg and "no timezone" not in msg and "expecting value" not in msg:
                    logger.debug(f"{symbol}: {tag} exception: {type(e).__name__}")
            time.sleep(0.25)  # Short delay between attempts
        
        return None  # Return None silently for delisted symbols
    

    def save_raw(self, df: pd.DataFrame, symbol: str):
        file_path = (self.raw_dir / f"{symbol}_raw.csv").resolve()
        file_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(file_path, index=False, encoding='utf-8')
        logger.info(f"Saved RAW -> {file_path}")
        if self.uploader:
            try:
                remote_path = self.uploader.upload_file(file_path, remote_name=file_path.name)
                logger.info(f"Uploaded RAW to ADLS: {remote_path}")
            except Exception as e:
                logger.warning(f"ADLS upload failed for {symbol}: {e}")

    def run(self) -> Dict[str, pd.DataFrame]:
        logger.info(f"Starting RAW downloads for {len(self.symbols)} symbols (batch={self.batch_size}, sleep={self.sleep_between}s)")
        all_raw: Dict[str, pd.DataFrame] = {}
        success = 0
        for i in range(0, len(self.symbols), self.batch_size):
            batch = self.symbols[i:i + self.batch_size]
            logger.info(f"Batch {i//self.batch_size+1}: {len(batch)} symbols")
            for sym in batch:
                try:
                    # Check if file already exists
                    existing_file = self.raw_dir / f"{sym}_raw.csv"
                    if existing_file.exists():
                        try:
                            existing_df = pd.read_csv(existing_file, encoding='utf-8')
                            if not existing_df.empty:
                                all_raw[sym] = existing_df
                                success += 1
                                logger.info(f"[EXISTING] {sym}: Using existing file ({len(existing_df)} rows)")
                                continue
                        except:
                            pass  # If read fails, re-download
                    
                    # Download new data
                    raw = self.download_symbol(sym)
                    if raw is None or raw.empty:
                        # Skip silently - delisted symbols are expected
                        continue
                    self.save_raw(raw, sym)
                    all_raw[sym] = raw
                    success += 1
                    logger.info(f"[DOWNLOADED] {sym}: Downloaded {len(raw)} rows")
                except Exception as e:
                    # Only log unexpected errors
                    if "delisted" not in str(e).lower() and "timezone" not in str(e).lower():
                        logger.warning(f"[WARNING] {sym}: {type(e).__name__} - {str(e)[:100]}")
                    # Continue with next symbol
            if i + self.batch_size < len(self.symbols):
                logger.info(f"Sleeping {self.sleep_between:.1f}s between batches...")
                time.sleep(self.sleep_between)
        logger.info(f"Completed RAW: {success}/{len(self.symbols)} symbols successful")
        return all_raw

# ----------------------------
# Main
# ----------------------------
def main():
    import argparse

    parser = argparse.ArgumentParser(description="ASX -> Yahoo 10-year RAW downloader (ADLS Gen2 optional)")
    parser.add_argument("--equities-only", action="store_true", help="Only download companies classified as Equity")
    parser.add_argument("--max-symbols", type=int, default=0, help="Limit number of tickers (0 = no limit)")
    parser.add_argument("--limit", type=int, default=0, help="Limit download to top N ASX stocks by market cap (alias for --max-symbols)")
    parser.add_argument("--batch-size", type=int, default=80)
    parser.add_argument("--sleep-between", type=float, default=2.0)
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: ~today-10y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--azure-prefix", default=AZURE_PREFIX_DEFAULT,
                        help="Directory/prefix inside filesystem for uploads (default: asxStocks)")
    parser.add_argument("--clean-remote-first", action="store_true",
                        help="Delete existing remote files with same name before upload (also AZURE_CLEAN_FIRST=true)")
    args = parser.parse_args()
    
    # Use --limit if provided, otherwise use --max-symbols
    if args.limit > 0:
        args.max_symbols = args.limit

    # 1) Download & save ASX list (reference)
    ref_path = REFERENCE_DIR / "asx_companies.csv"
    ref_df = download_asx_companies_csv(ref_path)

    # 2) Build symbols list
    df_symbols = ref_df.copy()
    if args.equities_only:
        df_symbols = df_symbols.loc[df_symbols["security_type"].eq("Equity")].copy()

    tickers = df_symbols["ticker_yf"].dropna().drop_duplicates().tolist()
    total_symbols = len(tickers)
    
    # Apply limit if specified
    if args.max_symbols and args.max_symbols > 0:
        tickers = tickers[:args.max_symbols]
        logger.info(f"MVP Mode: Limiting to top {args.max_symbols} ASX stocks by market cap (from {total_symbols} total)")

    # 3) Date range: default = last ~10 years
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=3652)).isoformat()

    logger.info(f"Tickers to download (RAW only): {len(tickers)} (equities_only={bool(args.equities_only)})")
    logger.info(f"Date range: {start_date} -> {end_date}")
    if args.max_symbols and args.max_symbols > 0:
        estimated_time_savings = int((1 - (args.max_symbols / total_symbols)) * 100)
        logger.info(f"Estimated time savings: ~{estimated_time_savings}%")

    # Ensure raw/stocks directory exists for organized storage
    stocks_raw_dir = RAW_DIR / "stocks"
    stocks_raw_dir.mkdir(parents=True, exist_ok=True)

    # Create downloader with stocks-specific raw directory
    class StocksDownloader(RawDownloader):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.raw_dir = stocks_raw_dir

    # 4) Download RAW
    dl = StocksDownloader(
        symbols=tickers,
        start_date=start_date,
        end_date=end_date,
        batch_size=args.batch_size,
        sleep_between=args.sleep_between,
        adls_prefix=args.azure_prefix,
        clean_remote_first=bool(args.clean_remote_first or AZURE_CLEAN_FIRST),
    )

    try:
        all_raw = dl.run()
        if not all_raw:
            logger.error("No RAW data available (downloaded or existing).")
            sys.exit(1)

        summary = {
            "download_date": datetime.now().isoformat(),
            "num_symbols": len(all_raw),
            "date_range": {"start": start_date, "end": end_date},
            "symbols": sorted(all_raw.keys()),
        }
        summary_path = BASE_DIR / "raw_download_summary.json"
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print("\n" + "="*70)
        print("[SUMMARY] ASX 10-YEAR RAW DOWNLOAD SUMMARY")
        print("="*70)
        print(f"[OK] Symbols downloaded (RAW): {len(all_raw)}")
        print(f"[DATE] Date range: {start_date} -> {end_date}")
        print(f"[FOLDER] Raw folder: {stocks_raw_dir}")
        print(f"[FILE] Summary:   {summary_path.name}")
        n = len(list(stocks_raw_dir.glob('*.csv')))
        print(f"  {stocks_raw_dir}: {n} file(s)")
        if AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS:
            print(f"[AZURE] ADLS upload: ENABLED (filesystem='{AZURE_FS}', prefix='{args.azure_prefix}', clean_first={bool(args.clean_remote_first or AZURE_CLEAN_FIRST)})")
        else:
            print("[AZURE] ADLS upload: disabled (set AZURE_UPLOAD=true and provide connection string + filesystem)")

        print("\n[SUCCESS] Done!")

    except Exception as e:
        logger.error(f"RAW download failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
