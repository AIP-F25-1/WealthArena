#!/usr/bin/env python3
# File: scrapeCryptoData.py  (ADLS-only: no local CSVs)
import os, sys, json, time, logging, warnings
from pathlib import Path
from typing import List, Optional, Dict
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf

# ----------------------------
# Basic setup
# ----------------------------
warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent
LOG_DIR  = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "crypto_download.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"),
              logging.StreamHandler()]
)
logger = logging.getLogger("crypto_adls_only")

# Quiet Azure SDK logs (if installed)
logging.getLogger("azure").setLevel(logging.WARNING)
logging.getLogger("azure.storage").setLevel(logging.WARNING)
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.ERROR)

# ----------------------------
# Azure uploader (ADLS Gen2 HNS)
# ----------------------------
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / "azureCred.env")
except Exception:
    pass

AZURE_UPLOAD = os.getenv("AZURE_UPLOAD", "false").strip().lower() in {"1","true","yes"}
AZURE_CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
AZURE_FS = os.getenv("AZURE_STORAGE_FILESYSTEM", "").strip()  # container / filesystem
AZURE_PREFIX_DEFAULT = os.getenv("AZURE_PREFIX_CRYPTO", "asxCrypto").strip()
AZURE_CLEAN_FIRST = os.getenv("AZURE_CLEAN_FIRST", "false").strip().lower() in {"1","true","yes"}
AZURE_DELETE_SLEEP_MS = int(os.getenv("AZURE_DELETE_SLEEP_MS", "250"))
AZURE_MAX_RETRIES = int(os.getenv("AZURE_MAX_RETRIES", "5"))

try:
    from azure.core.exceptions import ResourceNotFoundError, HttpResponseError  # type: ignore
except Exception:
    ResourceNotFoundError = type("ResourceNotFoundError", (), {})
    class HttpResponseError(Exception):  # fallback
        def __init__(self, *a, **k):
            super().__init__(*a)

def _status_code_from_exc(e: Exception) -> Optional[int]:
    resp = getattr(e, "response", None)
    return getattr(resp, "status_code", None) if resp is not None else None

def _headers_from_exc(e: Exception) -> Dict[str,str]:
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
    if status in (409, 412, 429):  # conflict, precondition failed, rate limit
        return True
    if 500 <= status <= 599:
        return True
    return False

def _retry(op_name: str, func, max_attempts=AZURE_MAX_RETRIES, base_sleep=0.3):
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
    ADLS Gen2 uploader using HNS:
    - Creates filesystem and (optional) prefix directory
    - Optional delete-first
    - Can upload bytes directly (no local files)
    """
    def __init__(self, conn_str: str, filesystem: str, prefix: str, clean_first: bool = False):
        from azure.storage.filedatalake import DataLakeServiceClient  # lazy import
        self.svc = DataLakeServiceClient.from_connection_string(conn_str)
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
        fc = self.fs.get_file_client(full_path)
        def _do_delete():
            try:
                fc.get_file_properties()
            except ResourceNotFoundError:
                return False
            try:
                fc.delete_file()
                return True
            except ResourceNotFoundError:
                return False
        deleted = _retry(f"ADLS delete {full_path}", _do_delete)
        if deleted and AZURE_DELETE_SLEEP_MS > 0:
            time.sleep(AZURE_DELETE_SLEEP_MS / 1000.0)
        return deleted

    def upload_bytes(self, data: bytes, remote_name: str) -> str:
        """Upload in-memory bytes as a file to ADLS."""
        full_path = self._full_path(remote_name)
        fc = self.fs.get_file_client(full_path)

        if self.clean_first:
            try:
                if self.delete_if_exists(remote_name):
                    logger.info(f"ADLS: deleted old file '{full_path}' before upload")
            except Exception as e:
                logger.warning(f"ADLS: delete failed for '{full_path}' (continuing): {e}")

        def _do_upload():
            fc.create_file()  # idempotent
            fc.upload_data(data, overwrite=True)
            return True

        _retry(f"ADLS upload {full_path}", _do_upload)
        props = fc.get_file_properties()
        size = getattr(props, "size", None)
        logger.info(f"ADLS uploaded '{full_path}' ({size} bytes)")
        return full_path

# ----------------------------
# Defaults
# ----------------------------
DEFAULT_CRYPTOS = [
    "BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD",
    "ADA-USD", "DOGE-USD", "TON-USD", "TRX-USD", "AVAX-USD",
]

# ----------------------------
# Helpers
# ----------------------------
def _normalize_ohlcv_df(df: pd.DataFrame) -> Optional[pd.DataFrame]:
    """Standardize to [Open, High, Low, Close, Volume, Date]."""
    if df is None or df.empty:
        return None
    df = df.rename(columns={c: str(c).title() for c in df.columns})
    need = ["Open", "High", "Low", "Close", "Volume"]
    if not all(c in df.columns for c in need):
        return None
    out = df[need].copy()
    idx = pd.to_datetime(out.index)
    idx = pd.DatetimeIndex(idx).tz_localize(None) if getattr(idx, "tz", None) is not None else idx
    out["Date"] = idx
    mask = (out[["Open", "High", "Low", "Close"]] > 0).all(axis=1)
    out = out.loc[mask].reset_index(drop=True)
    return out if not out.empty else None

def _try_hist(symbol: str, start: str, end: str) -> Optional[pd.DataFrame]:
    """Try a few yfinance paths to improve reliability."""
    attempts = [
        ("history-aa", lambda: yf.Ticker(symbol).history(
            start=start, end=end, interval="1d",
            auto_adjust=True, back_adjust=True)),
        ("history",    lambda: yf.Ticker(symbol).history(
            start=start, end=end, interval="1d",
            auto_adjust=False, back_adjust=False)),
        ("download",   lambda: yf.download(
            tickers=symbol, start=start, end=end,
            interval="1d", auto_adjust=True, progress=False, group_by="column")),
    ]
    last_err = None
    for tag, fn in attempts:
        try:
            df = fn()
            norm = _normalize_ohlcv_df(df)
            if norm is not None:
                logger.info(f"{symbol}: {len(norm)} rows via {tag}")
                return norm
            else:
                logger.info(f"{symbol}: empty via {tag}")
        except Exception as e:
            last_err = e
            logger.info(f"{symbol}: {tag} failed: {e}")
        time.sleep(0.20)
    if last_err:
        logger.error(f"Failed to fetch {symbol}: {last_err}")
    return None

def _squeeze_to_series(obj: pd.DataFrame) -> pd.Series:
    """Return a single numeric Series from a DataFrame/Series."""
    if isinstance(obj, pd.Series):
        return obj
    if not isinstance(obj, pd.DataFrame):
        raise TypeError("Expected DataFrame/Series for FX data.")
    if "Adj Close" in obj.columns:
        s = obj["Adj Close"]
    elif "Close" in obj.columns:
        s = obj["Close"]
    else:
        num = obj.select_dtypes(include="number")
        if num.empty:
            raise RuntimeError("FX data has no numeric columns.")
        s = num.iloc[:, 0]
    if isinstance(s, pd.DataFrame):
        s = s.iloc[:, 0]
    return pd.Series(s)

def _fetch_fx_audusd(start: str, end: str) -> pd.Series:
    """Daily Series with AUDUSD (USD per 1 AUD)."""
    fx = yf.download("AUDUSD=X", start=start, end=end, interval="1d",
                     auto_adjust=True, progress=False, group_by="column")
    if fx is None or fx.empty:
        raise RuntimeError("Could not download AUDUSD=X FX series from Yahoo.")
    s = _squeeze_to_series(fx).astype("float64").copy()
    idx = pd.to_datetime(s.index)
    idx = pd.DatetimeIndex(idx).tz_localize(None) if getattr(idx, "tz", None) is not None else idx
    s.index = idx.normalize()
    s = s.sort_index()
    s.name = "AUDUSD"
    s = s.asfreq("D").ffill()  # fill weekends/holidays so we can align 7-day crypto
    return s

def _convert_usd_df_to_aud(df_usd: pd.DataFrame, fx_series: pd.Series) -> pd.DataFrame:
    """Convert USD OHLC to AUD via AUDUSD (USD per 1 AUD)."""
    df = df_usd.copy()
    df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None).dt.normalize()
    df = df.set_index("Date")
    aligned = df.join(fx_series, how="left")
    aligned["AUDUSD"] = aligned["AUDUSD"].ffill()
    factor = 1.0 / aligned["AUDUSD"]
    for col in ["Open", "High", "Low", "Close"]:
        aligned[col] = aligned[col] * factor
    out = aligned.drop(columns=["AUDUSD"]).reset_index()
    return out

# ----------------------------
# Main
# ----------------------------
def main():
    import argparse
    parser = argparse.ArgumentParser(description="Crypto RAW downloader with AUD support (ADLS-only)")
    parser.add_argument("--symbols", nargs="*", default=None,
                        help="Space-separated USD symbols (e.g., BTC-USD ETH-USD). Default: majors.")
    parser.add_argument("--symbols-file", type=str, default=None,
                        help="Text file, one USD symbol per line.")
    parser.add_argument("--target-currency", default="AUD", choices=["USD","AUD"],
                        help="Save prices in this currency (default: AUD).")
    parser.add_argument("--years", type=float, default=3.0,
                        help="How many years of history to pull when start/end not given (default: 3).")
    parser.add_argument("--batch-size", type=int, default=25)
    parser.add_argument("--sleep-between", type=float, default=2.0)
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (overrides --years)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--azure-prefix", default=AZURE_PREFIX_DEFAULT,
                        help="Directory/prefix inside filesystem for uploads (default from AZURE_PREFIX_CRYPTO)")
    parser.add_argument("--clean-remote-first", action="store_true",
                        help="Delete remote before upload (also AZURE_CLEAN_FIRST=true)")
    args = parser.parse_args()

    # Ensure ADLS is configured (ADLS-only script)
    if not (AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS):
        logger.error("This script is ADLS-only. Set AZURE_UPLOAD=true and provide AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_FILESYSTEM.")
        sys.exit(2)

    # Build symbol list
    syms: List[str] = []
    if args.symbols_file:
        p = Path(args.symbols_file)
        if not p.exists():
            logger.error(f"symbols-file not found: {p}")
            sys.exit(2)
        syms += [ln.strip() for ln in p.read_text(encoding="utf-8").splitlines() if ln.strip()]
    if args.symbols:
        syms += args.symbols
    if not syms:
        syms = DEFAULT_CRYPTOS[:]

    # Date range defaults — use years if start not provided
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    if args.start_date:
        start_date = args.start_date
    else:
        days = int(round(args.years * 365.2425))  # approx leap-aware
        start_date = (today - timedelta(days=days)).isoformat()

    logger.info(f"Symbols (USD base list): {len(syms)}")
    logger.info(f"Target currency: {args.target_currency}")
    logger.info(f"Date range: {start_date} → {end_date}")
    logger.info(f"ADLS filesystem='{AZURE_FS}', prefix='{args.azure_prefix}'")

    # ADLS uploader
    uploader = ADLSGen2Sink(
        AZURE_CONN_STR, AZURE_FS, args.azure_prefix,
        clean_first=bool(args.clean_remote_first or AZURE_CLEAN_FIRST),
    )
    logger.info(
        f"ADLS upload ENABLED (clean_first={bool(args.clean_remote_first or AZURE_CLEAN_FIRST)})"
    )

    fx_series = None
    if args.target_currency == "AUD":
        fx_series = _fetch_fx_audusd(start_date, end_date)

    results: Dict[str, Dict[str, str]] = {}
    ok = 0

    for i in range(0, len(syms), args.batch_size):
        batch = syms[i:i + args.batch_size]
        logger.info(f"Batch {i//args.batch_size+1}: {len(batch)} symbols")
        for usd_sym in batch:
            try:
                if args.target_currency == "USD":
                    df = _try_hist(usd_sym, start_date, end_date)
                    if df is None:
                        continue
                    csv_bytes = df.to_csv(index=False).encode("utf-8")
                    remote_name = f"{usd_sym}_raw.csv"
                    remote_path = uploader.upload_bytes(csv_bytes, remote_name)
                    results[usd_sym] = {"mode": "native_usd", "remote": remote_path}
                    ok += 1
                else:
                    # AUD: try native AUD first
                    aud_sym = usd_sym.replace("-USD", "-AUD")
                    df_aud = _try_hist(aud_sym, start_date, end_date)
                    if df_aud is not None:
                        csv_bytes = df_aud.to_csv(index=False).encode("utf-8")
                        remote_name = f"{aud_sym}_raw.csv"
                        remote_path = uploader.upload_bytes(csv_bytes, remote_name)
                        results[usd_sym] = {"mode": "native_aud", "remote": remote_path, "aud_symbol": aud_sym}
                        ok += 1
                    else:
                        # Fallback: USD pair then convert via AUDUSD=X
                        df_usd = _try_hist(usd_sym, start_date, end_date)
                        if df_usd is None:
                            continue
                        df_conv = _convert_usd_df_to_aud(df_usd, fx_series)
                        csv_bytes = df_conv.to_csv(index=False).encode("utf-8")
                        aud_name = usd_sym.replace("-USD","-AUD")
                        remote_name = f"{aud_name}_raw.csv"
                        remote_path = uploader.upload_bytes(csv_bytes, remote_name)
                        results[usd_sym] = {
                            "mode": "usd_to_aud",
                            "remote": remote_path,
                            "aud_symbol": aud_name
                        }
                        ok += 1

            except Exception as e:
                logger.error(f"❌ {usd_sym}: {e}")

        if i + args.batch_size < len(syms):
            logger.info(f"Sleeping {args.sleep_between:.1f}s between batches…")
            time.sleep(args.sleep_between)

    if ok == 0:
        logger.error("❌ No crypto data uploaded to ADLS.")
        sys.exit(1)

    summary = {
        "download_date": datetime.now().isoformat(),
        "num_symbols": ok,
        "date_range": {"start": start_date, "end": end_date},
        "target_currency": args.target_currency,
        "years_requested": float(args.years) if not args.start_date else None,
        "symbols": results,
        "adls": {
            "filesystem": AZURE_FS,
            "prefix": args.azure_prefix,
            "clean_first": bool(args.clean_remote_first or AZURE_CLEAN_FIRST),
        },
        "notes": [
            "Daily OHLCV via Yahoo. For AUD: use native -AUD if present, else convert from USD via AUDUSD=X.",
            "No local files are written; uploads are in-memory bytes.",
        ],
    }
    # Print JSON summary to stdout so Airflow logs capture it
    print(json.dumps(summary, indent=2))

    print("\n" + "="*70)
    print(f"📊 CRYPTO RAW SUMMARY (ADLS-only, {args.target_currency})")
    print("="*70)
    print(f"✅ Symbols uploaded: {ok}")
    print(f"📅 Date range: {start_date} → {end_date}")
    print(f"☁️  ADLS: filesystem='{AZURE_FS}', prefix='{args.azure_prefix}'")
    print("\n🎉 Done!")

if __name__ == "__main__":
    main()
