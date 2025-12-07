#!/usr/bin/env python3
"""
AUD Forex Downloader (3y) — ADLS-only

- Builds AUD/* via bridges (USD, EUR, GBP, JPY) using yfinance
- Uploads CSVs directly to ADLS Gen2 (no local CSVs)
- Prints a JSON summary to stdout (good for Airflow logs)

Env (typical):
  AZURE_UPLOAD=true
  AZURE_STORAGE_CONNECTION_STRING=...
  AZURE_STORAGE_FILESYSTEM=raw
  AZURE_PREFIX_FOREX=asxForex
  AZURE_CLEAN_FIRST=false
"""

import os, sys, json, time, logging, warnings
from pathlib import Path
from typing import Dict, Optional, Tuple, List
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import yfinance as yf

warnings.filterwarnings("ignore")

# ───────────────────────────── Logging ─────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "aud_fx_downloader.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"),
              logging.StreamHandler()]
)
logger = logging.getLogger("aud_fx_adls_only")

# Quiet Azure SDK noise
for name, level in [
    ("azure", logging.WARNING),
    ("azure.storage", logging.WARNING),
    ("azure.core.pipeline.policies.http_logging_policy", logging.CRITICAL),
]:
    logging.getLogger(name).setLevel(level)

# ─────────────────────── ADLS (HNS/Gen2) ───────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / "azureCred.env")
except Exception:
    pass

AZURE_UPLOAD = os.getenv("AZURE_UPLOAD", "false").strip().lower() in {"1","true","yes"}
AZURE_CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
AZURE_FS = os.getenv("AZURE_STORAGE_FILESYSTEM", "").strip()
AZURE_PREFIX_DEFAULT = os.getenv("AZURE_PREFIX_FOREX", "asxForex").strip()
AZURE_CLEAN_FIRST = os.getenv("AZURE_CLEAN_FIRST", "false").strip().lower() in {"1","true","yes"}
AZURE_DELETE_SLEEP_MS = int(os.getenv("AZURE_DELETE_SLEEP_MS", "250"))
AZURE_MAX_RETRIES = int(os.getenv("AZURE_MAX_RETRIES", "5"))

try:
    from azure.core.exceptions import ResourceNotFoundError, HttpResponseError  # type: ignore
except Exception:
    ResourceNotFoundError = type("ResourceNotFoundError", (), {})
    class HttpResponseError(Exception): pass

def _status_code(e: Exception) -> Optional[int]:
    resp = getattr(e, "response", None)
    return getattr(resp, "status_code", None) if resp is not None else None

def _should_retry(status: Optional[int]) -> bool:
    return (status in (409,412,429)) or (status is not None and 500 <= status <= 599)

def _retry(op_name: str, func, max_attempts=AZURE_MAX_RETRIES, base_sleep=0.3):
    last = None
    for attempt in range(1, max_attempts+1):
        try:
            return func()
        except HttpResponseError as e:
            sc = _status_code(e)
            logger.error(f"{op_name}: HttpResponseError status={sc}")
            if _should_retry(sc) and attempt < max_attempts:
                sleep = base_sleep * (2 ** (attempt-1))
                logger.warning(f"{op_name}: retry {attempt}/{max_attempts-1} after {sleep:.2f}s")
                time.sleep(sleep); last = e; continue
            raise
        except Exception as e:
            last = e
            if attempt < max_attempts:
                sleep = base_sleep * (2 ** (attempt-1))
                logger.warning(f"{op_name}: '{e}', retry {attempt}/{max_attempts-1} after {sleep:.2f}s")
                time.sleep(sleep); continue
            logger.error(f"{op_name}: failed after {max_attempts} attempts: {e}", exc_info=True)
            raise
    raise last or RuntimeError(f"{op_name}: unknown failure")

class ADLSGen2Sink:
    """Upload in-memory CSV bytes to ADLS Gen2 (no local files)."""
    def __init__(self, conn_str: str, filesystem: str, prefix: str, clean_first: bool = False):
        from azure.storage.filedatalake import DataLakeServiceClient  # lazy import
        self.svc = DataLakeServiceClient.from_connection_string(conn_str)
        try: self.svc.create_file_system(filesystem)
        except Exception: pass
        self.fs = self.svc.get_file_system_client(filesystem)
        self.prefix = prefix.strip().strip("/")
        self.clean_first = bool(clean_first)
        if self.prefix:
            try: self.fs.create_directory(self.prefix)
            except Exception: pass

    def _path(self, name: str) -> str:
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
            time.sleep(AZURE_DELETE_SLEEP_MS/1000.0)
        return deleted

    def upload_bytes(self, data: bytes, remote_name: str) -> str:
        full_path = self._path(remote_name)
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

# ───────────────────────── FX universe ─────────────────────────
BASE = "AUD"
TOP15_QUOTES_DEFAULT = [
    "USD","EUR","JPY","GBP","CNY","CAD","CHF","NZD","SEK","NOK",
    "KRW","INR","SGD","HKD","BRL"
]
BRIDGES = ["USD","EUR","GBP","JPY"]

# ───────────────────────── Helpers ─────────────────────────
def _ticker(b: str, q: str) -> str: return f"{b}{q}=X"

def _to_daily(df: pd.DataFrame) -> Optional[pd.DataFrame]:
    if df is None or df.empty: return None
    if isinstance(df.columns, pd.MultiIndex):
        df = df.copy(); df.columns = [c[0] for c in df.columns]
    df = df.rename(columns={c: str(c).title() for c in df.columns})
    need = ["Open","High","Low","Close"]
    if not all(c in df.columns for c in need): return None
    if "Volume" not in df.columns: df["Volume"] = 0
    out = df[["Open","High","Low","Close","Volume"]].copy()
    m = (out[["Open","High","Low","Close"]] > 0).all(axis=1)
    out = out.loc[m].copy()
    if out.empty: return None
    out.index = pd.to_datetime(out.index)
    out = out[~out.index.duplicated(keep="first")]
    return out

def _fetch_yf(ticker: str, start: str, end: str) -> Optional[pd.DataFrame]:
    try:
        d1 = yf.Ticker(ticker).history(start=start, end=end, interval="1d", auto_adjust=True)
        n1 = _to_daily(d1)
        if n1 is not None: return n1
        d2 = yf.download(tickers=ticker, start=start, end=end, interval="1d", auto_adjust=True, progress=False)
        return _to_daily(d2)
    except Exception as e:
        logger.info(f"{ticker}: fetch failed: {e}")
        return None

def _combine_ohlc(op: str, a: pd.DataFrame, b: pd.DataFrame) -> pd.DataFrame:
    j = a.join(b, how="inner", lsuffix="_A", rsuffix="_B")
    if j.empty: return pd.DataFrame()
    if op == "mul":
        O,H,L,C = j["Open_A"]*j["Open_B"], j["High_A"]*j["High_B"], j["Low_A"]*j["Low_B"], j["Close_A"]*j["Close_B"]
    else:
        O,H,L,C = j["Open_A"]/j["Open_B"], j["High_A"]/j["High_B"], j["Low_A"]/j["Low_B"], j["Close_A"]/j["Close_B"]
    out = pd.DataFrame({"Open":O,"High":H,"Low":L,"Close":C,"Volume":0}, index=j.index)
    return out.replace([pd.NA, float("inf"), -float("inf")], pd.NA).dropna()

def _b_over_usd(b: str, start: str, end: str) -> Optional[pd.DataFrame]:
    d = _fetch_yf(_ticker(b, "USD"), start, end)
    if d is not None: return d
    inv = _fetch_yf(_ticker("USD", b), start, end)
    if inv is not None and not inv.empty:
        one = pd.DataFrame(index=inv.index, data={"Open":1.0,"High":1.0,"Low":1.0,"Close":1.0,"Volume":0})
        return _combine_ohlc("div", one, inv)  # 1/(USD/B)
    return None

def _b_over_q(b: str, q: str, start: str, end: str) -> Tuple[Optional[pd.DataFrame], str]:
    d = _fetch_yf(_ticker(b, q), start, end)
    if d is not None: return d, _ticker(b, q)
    inv = _fetch_yf(_ticker(q, b), start, end)
    if inv is not None and not inv.empty:
        one = pd.DataFrame(index=inv.index, data={"Open":1.0,"High":1.0,"Low":1.0,"Close":1.0,"Volume":0})
        return _combine_ohlc("div", one, inv), _ticker(q, b) + " (inverted)"
    return None, ""

def _df_to_csv_bytes(df: pd.DataFrame) -> bytes:
    df2 = df.copy()
    df2["Date"] = df2.index
    df2 = df2.reset_index(drop=True)
    return df2.to_csv(index=False).encode("utf-8")

# ───────────────────────── Downloader ─────────────────────────
class FxRawDownloader:
    def __init__(self,
                 base_currency: str,
                 quotes: List[str],
                 start_date: str,
                 end_date: str,
                 batch_size: int = 20,
                 sleep_between: float = 0.4,
                 max_workers: int = 6,
                 adls_prefix: str = AZURE_PREFIX_DEFAULT,
                 clean_remote_first: bool = AZURE_CLEAN_FIRST):
        # ADLS-only hard requirement
        if not (AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS):
            raise RuntimeError("ADLS-only: set AZURE_UPLOAD=true and provide AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_FILESYSTEM.")
        self.base = base_currency.upper()
        self.quotes = [q.upper() for q in quotes if q.upper() != self.base]
        self.start_date = start_date
        self.end_date = end_date
        self.batch_size = int(batch_size)
        self.sleep_between = float(sleep_between)
        self.max_workers = int(max_workers)
        self.uploader = ADLSGen2Sink(AZURE_CONN_STR, AZURE_FS, adls_prefix, clean_first=clean_remote_first)
        logger.info(f"ADLS upload enabled -> filesystem='{AZURE_FS}' prefix='{adls_prefix}'")

    def _build_all_pairs(self) -> Dict[str, Dict]:
        results: Dict[str, Dict] = {}

        # 1) AUD/USD (direct)
        audusd = _fetch_yf(_ticker("AUD","USD"), self.start_date, self.end_date)
        if audusd is None or audusd.empty:
            raise RuntimeError("Failed to fetch AUDUSD=X; cannot compute cross rates.")

        # Upload AUDUSD
        csv_bytes = _df_to_csv_bytes(audusd)
        remote_audusd = self.uploader.upload_bytes(csv_bytes, "AUDUSD_fx_raw.csv")
        results["AUDUSD"] = {"ok": True, "remote": remote_audusd, "via": "direct:AUDUSD=X"}

        # 2) Precompute bridges B/USD and AUD/B
        bridge_over_usd: Dict[str, Optional[pd.DataFrame]] = {}
        one = pd.DataFrame(index=audusd.index, data={"Open":1.0,"High":1.0,"Low":1.0,"Close":1.0,"Volume":0})
        bridge_over_usd["USD"] = one

        def _fetch_bridge(b: str):
            if b == "USD": return ("USD", bridge_over_usd["USD"])
            d = _b_over_usd(b, self.start_date, self.end_date)
            time.sleep(self.sleep_between)
            return (b, d)

        bridges_to_fetch = [b for b in BRIDGES if b != "USD"]
        if self.max_workers <= 1:
            for b in bridges_to_fetch:
                k, d = _fetch_bridge(b); bridge_over_usd[k] = d
        else:
            with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
                futs = {ex.submit(_fetch_bridge, b): b for b in bridges_to_fetch}
                for fut in as_completed(futs):
                    k, d = fut.result(); bridge_over_usd[k] = d

        aud_over_bridge: Dict[str, Optional[pd.DataFrame]] = {}
        for b in BRIDGES:
            b_usd = bridge_over_usd.get(b)
            aud_over_bridge[b] = None if (b_usd is None or b_usd.empty) else _combine_ohlc("div", audusd, b_usd)

        # 3) Each quote via first available bridge
        def _process_quote(q: str) -> Tuple[str, bool, Optional[str], str]:
            pair = f"{self.base}{q}"
            if q == "USD":
                return ("AUDUSD", True, remote_audusd, "direct:AUDUSD=X")
            for b in BRIDGES:
                aud_b = aud_over_bridge.get(b)
                if aud_b is None or aud_b.empty: continue
                leg, used = _b_over_q(b, q, self.start_date, self.end_date)
                time.sleep(self.sleep_between)
                if leg is None or leg.empty: continue
                combo = _combine_ohlc("mul", aud_b, leg)
                if combo.empty: continue
                csv_bytes = _df_to_csv_bytes(combo)
                remote = self.uploader.upload_bytes(csv_bytes, f"{pair}_fx_raw.csv")
                return (pair, True, remote, f"bridge={b}, via={used}")
            return (pair, False, None, "no_bridge_leg_available")

        all_quotes = list(self.quotes)
        logger.info(f"Attempting {len(all_quotes)} quotes via bridges: {BRIDGES}")
        if self.max_workers <= 1:
            task_results = [_process_quote(q) for q in all_quotes]
        else:
            task_results = []
            with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
                futs = {ex.submit(_process_quote, q): q for q in all_quotes}
                for fut in as_completed(futs):
                    task_results.append(fut.result())

        for pair, ok, remote, note in task_results:
            results[pair] = {"ok": ok, ("remote" if ok else "error"): (remote if ok else note), "via": note if ok else None}

        return results

    def run(self) -> Dict[str, Dict]:
        logger.info(f"Starting AUD FX download for {len(self.quotes)} quotes "
                    f"(batch={self.batch_size}, sleep={self.sleep_between}s, workers={self.max_workers})")
        results = self._build_all_pairs()
        ok_count = sum(1 for v in results.values() if v.get("ok"))
        logger.info(f"Completed FX: {ok_count}/{len(results)} pairs successful")
        return results

# ───────────────────────── Main ─────────────────────────
def main():
    import argparse
    parser = argparse.ArgumentParser(description="AUD/* FX downloader (3y) — bridges → ADLS-only")
    parser.add_argument("--quotes", default=",".join(TOP15_QUOTES_DEFAULT),
                        help="Comma-separated ISO codes (quotes), e.g. USD,EUR,JPY")
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--sleep-between", type=float, default=0.4)
    parser.add_argument("--max-workers", type=int, default=6)
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: ~today-3y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--azure-prefix", default=AZURE_PREFIX_DEFAULT,
                        help="ADLS directory/prefix (default from AZURE_PREFIX_FOREX)")
    parser.add_argument("--clean-remote-first", action="store_true",
                        help="Delete remote before upload (or AZURE_CLEAN_FIRST=true)")
    args = parser.parse_args()

    if not (AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS):
        logger.error("This script is ADLS-only. Set AZURE_UPLOAD=true and provide AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_FILESYSTEM.")
        sys.exit(2)

    quotes = [q.strip().upper() for q in args.quotes.split(",") if q.strip()]
    if not quotes:
        logger.error("No quotes specified. Provide --quotes USD,EUR,JPY,...")
        sys.exit(1)

    today = datetime.utcnow().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=365*3 + 2)).isoformat()

    logger.info(f"Quotes: {quotes}")
    logger.info(f"Date range: {start_date} → {end_date}")
    logger.info(f"ADLS: filesystem='{AZURE_FS}', prefix='{args.azure_prefix}'")

    try:
        dl = FxRawDownloader(
            base_currency=BASE,
            quotes=quotes,
            start_date=start_date,
            end_date=end_date,
            batch_size=args.batch_size,
            sleep_between=args.sleep_between,
            max_workers=args.max_workers,
            adls_prefix=args.azure_prefix,
            clean_remote_first=bool(args.clean_remote_first or AZURE_CLEAN_FIRST),
        )
        results = dl.run()
        succeeded = {k: v["remote"] for k, v in results.items() if v.get("ok")}
        failed = {k: v.get("error","") for k, v in results.items() if not v.get("ok")}

        summary = {
            "download_date": datetime.utcnow().isoformat() + "Z",
            "base_currency": BASE,
            "num_pairs": len(results),
            "successful": len(succeeded),
            "failed": len(failed),
            "date_range": {"start": start_date, "end": end_date},
            "adls": {"filesystem": AZURE_FS, "prefix": args.azure_prefix, "clean_first": bool(args.clean_remote_first or AZURE_CLEAN_FIRST)},
            "remotes": succeeded,
            "errors": failed,
            "bridges": BRIDGES
        }
        # Print JSON so Airflow captures it
        print(json.dumps(summary, indent=2))
        print("\n🎉 FX to ADLS complete.")

    except Exception as e:
        logger.error(f"FX download failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
