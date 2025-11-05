#!/usr/bin/env python3
"""
AUD Forex Downloader (3y) — ADLS-style structure (optional cloud upload)

- Mirrors your ASX downloader style: logging, args, optional ADLS upload, retries
- Builds/synthesizes AUD/XXX via bridges (USD → EUR → GBP → JPY)
- Defaults to Top-15 quotes (can override with --quotes)
- Saves CSVs to data/forex/raw/
- Writes a JSON summary next to the script

Install:
  pip install yfinance pandas python-dotenv
"""

import os
import sys
import json
import time
import logging
import warnings
from pathlib import Path
from typing import Dict, Optional, Tuple, List
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import yfinance as yf

warnings.filterwarnings("ignore")

# ----------------------------
# Basic setup
# ----------------------------
BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
DATA_DIR = BASE_DIR / "data" / "forex"
RAW_DIR = DATA_DIR / "raw"
for p in (LOG_DIR, RAW_DIR):
    p.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "aud_fx_downloader.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"),
              logging.StreamHandler()]
)
logger = logging.getLogger("aud_fx")

# Quiet the Azure SDK’s verbose HTTP logs + drop any messages containing 'REDACTED'
class _DropRedacted(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:
            msg = str(record.msg)
        return "REDACTED" not in (msg or "")

for name, level in [
    ("azure", logging.WARNING),
    ("azure.storage", logging.WARNING),
    ("azure.core.pipeline.policies.http_logging_policy", logging.CRITICAL),
]:
    lg = logging.getLogger(name)
    lg.setLevel(level)
    lg.addFilter(_DropRedacted())

# Also filter our own logger, just in case we echo Azure tool messages
logger.addFilter(_DropRedacted())

# ----------------------------
# Optional Azure (HNS/ADLS Gen2) uploader
# ----------------------------
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / "azureCred.env")
except Exception:
    pass

AZURE_UPLOAD = os.getenv("AZURE_UPLOAD", "false").strip().lower() in {"1", "true", "yes"}
AZURE_CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
AZURE_FS = os.getenv("AZURE_STORAGE_FILESYSTEM", "").strip()
# CHANGED DEFAULT: now 'asxForex' (was 'forex' in the previous script)
AZURE_PREFIX_DEFAULT = os.getenv("AZURE_PREFIX_FOREX", "asxForex").strip()
AZURE_CLEAN_FIRST = os.getenv("AZURE_CLEAN_FIRST", "false").strip().lower() in {"1", "true", "yes"}
AZURE_DELETE_SLEEP_MS = int(os.getenv("AZURE_DELETE_SLEEP_MS", "250"))
AZURE_MAX_RETRIES = int(os.getenv("AZURE_MAX_RETRIES", "5"))

# Optional Azure error classes
try:
    from azure.core.exceptions import ResourceNotFoundError, HttpResponseError  # type: ignore
except Exception:
    ResourceNotFoundError = type("ResourceNotFoundError", (), {})
    class HttpResponseError(Exception):
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
    if status in (409, 412, 429):  # conflicts, precond failed, throttling
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
    """Minimal ADLS Gen2 uploader (same behavior as in your ASX script)."""
    def __init__(self, conn_str: str, filesystem: str, prefix: str, clean_first: bool = False):
        from azure.storage.filedatalake import DataLakeServiceClient  # type: ignore
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

        deleted = _retry(f"ADLS delete {full_path}", _do_delete, max_attempts=AZURE_MAX_RETRIES)
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

        def _do_upload():
            file_client.create_file()
            with open(local_path, "rb") as f:
                file_client.upload_data(f, overwrite=True)
            return True

        _retry(f"ADLS upload {full_path}", _do_upload, max_attempts=AZURE_MAX_RETRIES)
        props = file_client.get_file_properties()
        size = getattr(props, "size", None)
        logger.info(f"ADLS uploaded '{full_path}' ({size} bytes)")
        return full_path

# ----------------------------
# FX universe & bridges
# ----------------------------
BASE = "AUD"
TOP15_QUOTES_DEFAULT = [
    "USD","EUR","JPY","GBP","CNY","CAD","CHF","NZD","SEK","NOK",
    "KRW","INR","SGD","HKD","BRL"
]
BRIDGES = ["USD", "EUR", "GBP", "JPY"]  # priority

# ----------------------------
# Helpers (FX math + yfinance IO)
# ----------------------------
def _to_daily(df: pd.DataFrame) -> Optional[pd.DataFrame]:
    if df is None or df.empty:
        return None
    if isinstance(df.columns, pd.MultiIndex):
        df = df.copy()
        df.columns = [c[0] for c in df.columns]
    df = df.rename(columns={c: str(c).title() for c in df.columns})
    need = ["Open","High","Low","Close"]
    if not all(c in df.columns for c in need):
        return None
    if "Volume" not in df.columns:
        df["Volume"] = 0
    out = df[["Open","High","Low","Close","Volume"]].copy()
    m = (out[["Open","High","Low","Close"]] > 0).all(axis=1)
    out = out.loc[m].copy()
    if out.empty:
        return None
    out.index = pd.to_datetime(out.index)
    out = out[~out.index.duplicated(keep="first")]
    return out

def _fetch_yf(ticker: str, start: str, end: str) -> Optional[pd.DataFrame]:
    try:
        d1 = yf.Ticker(ticker).history(start=start, end=end, interval="1d", auto_adjust=True)
        n1 = _to_daily(d1)
        if n1 is not None:
            return n1
        d2 = yf.download(tickers=ticker, start=start, end=end, interval="1d", auto_adjust=True, progress=False)
        return _to_daily(d2)
    except Exception as e:
        logger.info(f"{ticker}: fetch failed: {e}")
        return None

def _combine_ohlc(op: str, a: pd.DataFrame, b: pd.DataFrame) -> pd.DataFrame:
    j = a.join(b, how="inner", lsuffix="_A", rsuffix="_B")
    if j.empty:
        return pd.DataFrame()
    if op == "mul":
        O,H,L,C = j["Open_A"]*j["Open_B"], j["High_A"]*j["High_B"], j["Low_A"]*j["Low_B"], j["Close_A"]*j["Close_B"]
    else:
        O,H,L,C = j["Open_A"]/j["Open_B"], j["High_A"]/j["High_B"], j["Low_A"]/j["Low_B"], j["Close_A"]/j["Close_B"]
    out = pd.DataFrame({"Open":O,"High":H,"Low":L,"Close":C,"Volume":0}, index=j.index)
    return out.replace([pd.NA, float("inf"), -float("inf")], pd.NA).dropna()

def _ticker(b: str, q: str) -> str:
    return f"{b}{q}=X"

def _fetch_b_over_usd(b: str, start: str, end: str) -> Optional[pd.DataFrame]:
    d = _fetch_yf(_ticker(b, "USD"), start, end)
    if d is not None:
        return d
    inv = _fetch_yf(_ticker("USD", b), start, end)
    if inv is not None and not inv.empty:
        one = pd.DataFrame(index=inv.index, data={"Open":1.0,"High":1.0,"Low":1.0,"Close":1.0,"Volume":0})
        return _combine_ohlc("div", one, inv)  # 1/(USD/B)
    return None

def _fetch_b_over_quote(b: str, q: str, start: str, end: str) -> Tuple[Optional[pd.DataFrame], str]:
    d = _fetch_yf(_ticker(b, q), start, end)
    if d is not None:
        return d, _ticker(b, q)
    inv = _fetch_yf(_ticker(q, b), start, end)
    if inv is not None and not inv.empty:
        one = pd.DataFrame(index=inv.index, data={"Open":1.0,"High":1.0,"Low":1.0,"Close":1.0,"Volume":0})
        return _combine_ohlc("div", one, inv), _ticker(q, b) + " (inverted)"
    return None, ""

def _save_csv(df: pd.DataFrame, path: Path):
    df2 = df.copy()
    df2["Date"] = df2.index
    df2 = df2.reset_index(drop=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    df2.to_csv(path, index=False)
    logger.info(f"Saved RAW -> {path}")

# ----------------------------
# Downloader (mirrors your RawDownloader style)
# ----------------------------
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
                 clean_remote_first: bool = AZURE_CLEAN_FIRST,
                 enable_azure: bool = AZURE_UPLOAD):
        self.base = base_currency.upper()
        self.quotes = [q.upper() for q in quotes if q.upper() != self.base]
        self.start_date = start_date
        self.end_date = end_date
        self.batch_size = int(batch_size)
        self.sleep_between = float(sleep_between)
        self.max_workers = int(max_workers)
        self.raw_dir = RAW_DIR

        self.uploader = None
        if enable_azure and AZURE_CONN_STR and AZURE_FS:
            try:
                self.uploader = ADLSGen2Sink(
                    AZURE_CONN_STR, AZURE_FS, adls_prefix, clean_first=clean_remote_first
                )
                logger.info(f"ADLS upload enabled -> filesystem='{AZURE_FS}' prefix='{adls_prefix}' (raw only)")
            except Exception as e:
                logger.warning(f"ADLS upload disabled (init failed): {e}")

    def _build_all_pairs(self) -> Dict[str, Dict]:
        results: Dict[str, Dict] = {}
        # 1) AUD/USD
        audusd = _fetch_yf(_ticker("AUD", "USD"), self.start_date, self.end_date)
        if audusd is None or audusd.empty:
            raise RuntimeError("Failed to fetch AUDUSD=X; cannot compute cross rates.")

        # Direct save for AUDUSD
        audusd_path = self.raw_dir / "AUDUSD_fx_raw.csv"
        _save_csv(audusd, audusd_path)
        results["AUDUSD"] = {"ok": True, "path": str(audusd_path), "via": "direct:AUDUSD=X"}

        # 2) Precompute bridge legs B/USD and then AUD/B
        bridge_over_usd: Dict[str, Optional[pd.DataFrame]] = {}
        one = pd.DataFrame(index=audusd.index, data={"Open":1.0,"High":1.0,"Low":1.0,"Close":1.0,"Volume":0})
        bridge_over_usd["USD"] = one

        def _fetch_bridge(b: str):
            if b == "USD":
                return ("USD", bridge_over_usd["USD"])
            d = _fetch_b_over_usd(b, self.start_date, self.end_date)
            time.sleep(self.sleep_between)
            return (b, d)

        bridges_to_fetch = [b for b in BRIDGES if b != "USD"]
        if self.max_workers <= 1:
            for b in bridges_to_fetch:
                k, d = _fetch_bridge(b)
                bridge_over_usd[k] = d
        else:
            with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
                futs = {ex.submit(_fetch_bridge, b): b for b in bridges_to_fetch}
                for fut in as_completed(futs):
                    k, d = fut.result()
                    bridge_over_usd[k] = d

        aud_over_bridge: Dict[str, Optional[pd.DataFrame]] = {}
        for b in BRIDGES:
            b_usd = bridge_over_usd.get(b)
            if b_usd is None or b_usd.empty:
                aud_over_bridge[b] = None
                continue
            aud_over_bridge[b] = _combine_ohlc("div", audusd, b_usd)

        # 3) For each quote q, try B/q using bridges
        def _process_quote(q: str) -> Tuple[str, bool, Optional[str], str]:
            pair = f"{self.base}{q}"
            if q == "USD":
                return ("AUDUSD", True, str(audusd_path), "direct:AUDUSD=X")

            for b in BRIDGES:
                aud_b = aud_over_bridge.get(b)
                if aud_b is None or aud_b.empty:
                    continue
                leg, used = _fetch_b_over_quote(b, q, self.start_date, self.end_date)
                time.sleep(self.sleep_between)
                if leg is None or leg.empty:
                    continue
                combo = _combine_ohlc("mul", aud_b, leg)
                if combo.empty:
                    continue
                out_path = self.raw_dir / f"{pair}_fx_raw.csv"
                _save_csv(combo, out_path)
                return (pair, True, str(out_path), f"bridge={b}, via={used}")

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

        for pair, ok, path, note in task_results:
            if ok:
                results[pair] = {"ok": True, "path": path, "via": note}
            else:
                results[pair] = {"ok": False, "error": note}

        return results

    def _maybe_upload(self, local_path: Path):
        if not self.uploader:
            return
        try:
            self.uploader.upload_file(local_path, remote_name=local_path.name)
        except Exception as e:
            logger.warning(f"ADLS upload failed for {local_path.name}: {e}")

    def run(self) -> Dict[str, Dict]:
        logger.info(f"Starting AUD FX download for {len(self.quotes)} quotes "
                    f"(batch={self.batch_size}, sleep={self.sleep_between}s, workers={self.max_workers})")
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        results = self._build_all_pairs()

        # optional upload
        for k, v in results.items():
            if v.get("ok"):
                try:
                    self._maybe_upload(Path(v["path"]))
                except Exception as e:
                    logger.warning(f"Upload skip ({k}): {e}")
        ok_count = sum(1 for v in results.values() if v.get("ok"))
        logger.info(f"Completed FX: {ok_count}/{len(results)} pairs successful")
        return results

# ----------------------------
# Main
# ----------------------------
def main():
    import argparse

    parser = argparse.ArgumentParser(description="AUD/* FX downloader (3y) — bridges, CSVs, optional ADLS upload")
    parser.add_argument("--quotes", default=",".join(TOP15_QUOTES_DEFAULT),
                        help="Comma-separated ISO codes (quotes) e.g. USD,EUR,JPY. Default = Top-15.")
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--sleep-between", type=float, default=0.4)
    parser.add_argument("--max-workers", type=int, default=6)
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: ~today-3y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--azure-prefix", default=AZURE_PREFIX_DEFAULT,
                        help="ADLS directory/prefix (default: asxForex)")
    parser.add_argument("--clean-remote-first", action="store_true",
                        help="Delete existing remote files with same name before upload (or use AZURE_CLEAN_FIRST=true)")
    parser.add_argument("--no-azure", action="store_true", help="Force disable ADLS upload even if env enables it.")
    args = parser.parse_args()

    quotes = [q.strip().upper() for q in args.quotes.split(",") if q.strip()]
    if not quotes:
        logger.error("No quotes specified. Provide --quotes USD,EUR,JPY,...")
        sys.exit(1)

    today = datetime.utcnow().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=365*3 + 2)).isoformat()

    logger.info(f"Quotes to download: {quotes}")
    logger.info(f"Date range: {start_date} → {end_date}")
    logger.info(f"Output dir: {RAW_DIR}")

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
        enable_azure=not args.no_azure and AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS
    )

    try:
        results = dl.run()
        if not results:
            logger.error("❌ No FX data downloaded.")
            sys.exit(1)

        succeeded = [k for k, v in results.items() if v.get("ok")]
        failed = {k: v.get("error", "") for k, v in results.items() if not v.get("ok")}

        summary = {
            "download_date": datetime.utcnow().isoformat() + "Z",
            "base_currency": BASE,
            "num_pairs": len(results),
            "successful": len(succeeded),
            "failed": len(failed),
            "date_range": {"start": start_date, "end": end_date},
            "files": {k: v["path"] for k, v in results.items() if v.get("ok")},
            "errors": failed,
            "output_dir": str(RAW_DIR),
            "bridges": BRIDGES
        }
        summary_path = BASE_DIR / "aud_fx_download_summary.json"
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print("\n" + "="*70)
        print("📊 AUD FX DOWNLOAD SUMMARY (3 years)")
        print("="*70)
        print(f"✅ Successful pairs: {len(succeeded)} / {len(results)}")
        print(f"📅 Date range: {start_date} → {end_date}")
        print(f"📁 Raw folder: {RAW_DIR}")
        print(f"🧾 Summary:   {summary_path.name}")
        n = len(list(RAW_DIR.glob('*.csv')))
        print(f"  {RAW_DIR}: {n} file(s)")
        if dl.uploader:
            print(f"☁️  ADLS upload: ENABLED (filesystem='{AZURE_FS}', prefix='{args.azure_prefix}', clean_first={bool(args.clean_remote_first or AZURE_CLEAN_FIRST)})")
        else:
            print("☁️  ADLS upload: disabled (use --no-azure or leave AZURE_* unset)")

        print("\n🎉 Done!")

    except Exception as e:
        logger.error(f"FX download failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
