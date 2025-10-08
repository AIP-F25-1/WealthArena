#!/usr/bin/env python3
"""
ASX Full List -> Yahoo Finance RAW Downloader (10-year history, HNS/ADLS-ready)

- Downloads the official ASX companies CSV (online; banner-proof)
- Normalizes to Yahoo tickers (CODE.AX), optional equities-only filter
- Downloads ~10 years of 1d OHLCV from yfinance (batched)
- Saves RAW CSVs locally (no processing)
- Optionally uploads RAW to ADLS Gen2 (HNS enabled) under a directory (default: asxStocks)

ENV FILE (azureCred.env) — optional (to enable upload):
  AZURE_UPLOAD=true
  AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=...   # your conn string
  AZURE_STORAGE_FILESYSTEM=raw                                   # ADLS filesystem (container)
  AZURE_PREFIX=asxStocks                                         # ADLS directory/prefix (optional)

Run examples:
  python asx_raw_downloader.py --equities-only
  python asx_raw_downloader.py --batch-size 80 --sleep-between 2
  python asx_raw_downloader.py --start-date 2015-01-01 --end-date 2025-10-07
"""

import os
import io
import re
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
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"),
              logging.StreamHandler()]
)
logger = logging.getLogger("asx_raw")

# ----------------------------
# Azure uploader (RAW only, HNS/ADLS Gen2)
# ----------------------------
# Expects azureCred.env next to this script:
#   AZURE_UPLOAD=true|false
#   AZURE_STORAGE_CONNECTION_STRING=...
#   AZURE_STORAGE_FILESYSTEM=raw
#   AZURE_PREFIX=asxStocks
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / "azureCred.env")
except Exception:
    pass

AZURE_UPLOAD = os.getenv("AZURE_UPLOAD", "false").strip().lower() in {"1", "true", "yes"}
AZURE_CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
AZURE_FS = os.getenv("AZURE_STORAGE_FILESYSTEM", "").strip()  # ADLS filesystem (container)
AZURE_PREFIX_DEFAULT = os.getenv("AZURE_PREFIX", "asxStocks").strip()

class ADLSGen2Sink:
    """
    Minimal ADLS Gen2 uploader using Hierarchical Namespace (HNS).
    Uses azure.storage.filedatalake so we can write directly to a directory like 'asxStocks/'.
    """
    def __init__(self, conn_str: str, filesystem: str, prefix: str):
        from azure.storage.filedatalake import DataLakeServiceClient  # lazy import
        self.svc = DataLakeServiceClient.from_connection_string(conn_str)
        self.fs = self.svc.get_file_system_client(filesystem)
        try:
            self.fs.create_file_system()
        except Exception:
            pass
        self.prefix = prefix.strip().strip("/")  # e.g., "asxStocks"
        # Ensure directory exists (idempotent)
        if self.prefix:
            try:
                self.fs.create_directory(self.prefix)
            except Exception:
                pass

    def upload_file(self, local_path: Path, remote_name: Optional[str] = None):
        name = remote_name or local_path.name
        # path under filesystem: {prefix}/{name} or just name if no prefix
        full_path = f"{self.prefix}/{name}" if self.prefix else name
        file_client = self.fs.get_file_client(full_path)
        # upload_data with overwrite=True will create/replace the file
        with open(local_path, "rb") as f:
            data = f.read()
        file_client.upload_data(data, overwrite=True)
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
    # choose the code column
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
    logger.info("Fetching official ASX CSV…")
    content = http_get(PRIMARY_CSV, timeout=30, retries=3)
    logger.info(f"ASX CSV bytes: {len(content)}")
    df_raw = _parse_asx_csv_bytes(content)
    logger.info(f"Parsed ASX frame: {df_raw.shape[0]} rows, {df_raw.shape[1]} cols")

    df = _canonical_company_rows(df_raw)

    # optional columns
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

    # Normalize to Yahoo ticker and rough type
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
                 adls_prefix: str = AZURE_PREFIX_DEFAULT):
        self.symbols = list(dict.fromkeys(symbols))  # de-dup preserve order
        self.start_date = start_date
        self.end_date = end_date
        self.batch_size = int(batch_size)
        self.sleep_between = float(sleep_between)
        self.raw_dir = RAW_DIR

        self.uploader = None
        if AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS:
            try:
                self.uploader = ADLSGen2Sink(AZURE_CONN_STR, AZURE_FS, adls_prefix)
                logger.info(f"ADLS upload enabled -> filesystem='{AZURE_FS}' prefix='{adls_prefix}' (raw only)")
            except Exception as e:
                logger.warning(f"ADLS upload disabled (init failed): {e}")

        logger.info(f"RawDownloader initialized for {len(self.symbols)} symbols | {self.start_date} → {self.end_date}")

    def _normalize_df(self, df: pd.DataFrame) -> Optional[pd.DataFrame]:
        if df is None or df.empty:
            return None
        # yfinance sometimes returns lowercase/labeled cols; normalize
        rename_map = {c: str(c).title() for c in df.columns}
        df = df.rename(columns=rename_map)
        expected = ["Open", "High", "Low", "Close", "Volume"]
        if not all(c in df.columns for c in expected):
            return None
        df = df[expected].copy()
        df["Date"] = df.index
        return df.reset_index(drop=True)

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
                if norm is not None and not norm.empty:
                    # Simple sanity: positive prices
                    mask = (norm[["Open", "High", "Low", "Close"]] > 0).all(axis=1)
                    norm = norm.loc[mask].copy()
                    if not norm.empty:
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

    def save_raw(self, df: pd.DataFrame, symbol: str):
        file_path = (self.raw_dir / f"{symbol}_raw.csv").resolve()
        file_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(file_path, index=False)
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
                    raw = self.download_symbol(sym)
                    if raw is None or raw.empty:
                        continue
                    self.save_raw(raw, sym)
                    all_raw[sym] = raw
                    success += 1
                except Exception as e:
                    logger.error(f"❌ {sym}: {e}")
            if i + self.batch_size < len(self.symbols):
                logger.info(f"Sleeping {self.sleep_between:.1f}s between batches…")
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
    parser.add_argument("--batch-size", type=int, default=80)
    parser.add_argument("--sleep-between", type=float, default=2.0)
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: ~today-10y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--azure-prefix", default=AZURE_PREFIX_DEFAULT,
                        help="Directory/prefix inside filesystem for uploads (default: asxStocks)")
    args = parser.parse_args()

    # 1) Download & save ASX list (reference)
    ref_path = REFERENCE_DIR / "asx_companies.csv"
    ref_df = download_asx_companies_csv(ref_path)

    # 2) Build symbols list
    df_symbols = ref_df.copy()
    if args.equities_only:
        df_symbols = df_symbols.loc[df_symbols["security_type"].eq("Equity")].copy()

    tickers = df_symbols["ticker_yf"].dropna().drop_duplicates().tolist()
    if args.max_symbols and args.max_symbols > 0:
        tickers = tickers[:args.max_symbols]

    # 3) Date range: default = last ~10 years
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=3652)).isoformat()

    logger.info(f"Tickers to download (RAW only): {len(tickers)} (equities_only={bool(args.equities_only)})")
    logger.info(f"Date range: {start_date} → {end_date}")

    # 4) Download RAW
    dl = RawDownloader(
        symbols=tickers,
        start_date=start_date,
        end_date=end_date,
        batch_size=args.batch_size,
        sleep_between=args.sleep_between,
        adls_prefix=args.azure_prefix,
    )

    try:
        all_raw = dl.run()
        if not all_raw:
            logger.error("❌ No RAW data downloaded successfully.")
            sys.exit(1)

        # Simple summary JSON for bookkeeping (RAW-only)
        summary = {
            "download_date": datetime.now().isoformat(),
            "num_symbols": len(all_raw),
            "date_range": {"start": start_date, "end": end_date},
            "symbols": sorted(all_raw.keys()),
        }
        summary_path = BASE_DIR / "raw_download_summary.json"
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print("\n" + "="*70)
        print("📊 ASX 10-YEAR RAW DOWNLOAD SUMMARY")
        print("="*70)
        print(f"✅ Symbols downloaded (RAW): {len(all_raw)}")
        print(f"📅 Date range: {start_date} → {end_date}")
        print(f"📁 Raw folder: {RAW_DIR}")
        print(f"🧾 Summary:   {summary_path.name}")
        n = len(list(RAW_DIR.glob('*.csv')))
        print(f"  {RAW_DIR}: {n} file(s)")
        if AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS:
            print(f"☁️  ADLS upload: ENABLED (filesystem='{AZURE_FS}', prefix='{args.azure_prefix}')")
        else:
            print("☁️  ADLS upload: disabled (set AZURE_UPLOAD=true and provide connection string + filesystem)")

        print("\n🎉 Done!")

    except Exception as e:
        logger.error(f"RAW download failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
