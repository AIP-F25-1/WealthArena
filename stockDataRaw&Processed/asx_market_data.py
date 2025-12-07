#!/usr/bin/env python3
"""
ASX Full List -> Yahoo Finance Downloader (10-year history)

- Downloads the official ASX companies CSV (online; banner-proof)
- Normalizes to Yahoo tickers (CODE.AX) with rename fixes (e.g., WPL->WDS)
- Optional filter to equities only
- Downloads ~10 years of 1d OHLCV from yfinance (batched)
- Computes indicators (TA-Lib if present, else simplified pandas)
- Saves raw & processed data, plus JSON summary & quality report
- By default, suppresses TA-Lib fallback warnings (use --show-talib-fallback to see them)

Run examples:
  python asx_10yr_downloader.py --equities-only
  python asx_10yr_downloader.py --batch-size 80 --sleep-between 2
  python asx_10yr_downloader.py --start-date 2015-01-01 --end-date 2025-10-07
"""

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

import numpy as np
import pandas as pd
import requests
import yfinance as yf

warnings.filterwarnings("ignore")

# ----------------------------
# TA-Lib availability (once)
# ----------------------------
try:
    import talib as _talib  # type: ignore
except Exception:
    _talib = None

# ----------------------------
# Paths & Logging
# ----------------------------
BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
REFERENCE_DIR = DATA_DIR / "reference"
for p in (LOG_DIR, RAW_DIR, PROCESSED_DIR, REFERENCE_DIR):
    p.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "data_download.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"),
              logging.StreamHandler()]
)
logger = logging.getLogger("asx_10yr")

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

# Known rename(s)
RENAMES = {"WPL": "WDS"}  # Woodside Petroleum -> Woodside Energy

# ----------------------------
# HTTP helpers & CSV parsing
# ----------------------------
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
    # pick the code column (fallback to first)
    code_col = None
    for c in df.columns:
        if str(c).strip().lower() in {"asx code", "code", "ticker", "symbol"}:
            code_col = c
            break
    if code_col is None:
        code_col = df.columns[0]

    df = df.copy()
    df["__code__"] = (
        df[code_col]
        .astype(str)
        .str.strip()
        .str.upper()
    )

    # drop header-like/blank values
    bad_values = {"", "ASX CODE", "CODE", "SYMBOL", "TICKER"}
    df = df[~df["__code__"].isin(bad_values)]

    # keep only canonical company codes (matches official "companies" CSV)
    df = df[df["__code__"].str.fullmatch(r"[A-Z0-9]{1,6}")]

    # de-dup just in case
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

    # Canonical company rows only
    df_codes = _canonical_company_rows(df_raw)

    # Map optional columns by fuzzy names
    def pick(cols, *names):
        names = [n.lower() for n in names]
        for c in cols:
            if str(c).strip().lower() in names:
                return c
        return None

    cols = list(df_raw.columns)
    name_col = pick(cols, "company name", "company", "name")
    gics_col = None
    for c in cols:
        cl = str(c).strip().lower()
        if "gics" in cl and "industry" in cl:
            gics_col = c; break
    list_col = pick(cols, "listing date", "listing", "list date")
    mcap_col = pick(cols, "market cap", "market capitalisation", "market capitalization")

    out = pd.DataFrame({"asx_code": df_codes["__code__"]})
    if name_col is not None:
        out["company_name"] = (
            df_raw.loc[df_codes.index, name_col].astype(str).str.strip().values
        )
    if gics_col is not None:
        out["gics_industry_group"] = (
            df_raw.loc[df_codes.index, gics_col].astype(str).str.strip().values
        )
    if list_col is not None:
        out["listing_date"] = df_raw.loc[df_codes.index, list_col].values
    if mcap_col is not None:
        out["market_cap"] = df_raw.loc[df_codes.index, mcap_col].values

    # Normalize to Yahoo ticker + known renames
    base = out["asx_code"].map(lambda x: RENAMES.get(x, x))
    out["ticker_yf"] = base + ".AX"

    # Quick type guess from name
    out["security_type"] = out.get("company_name", pd.Series([""]*len(out))).map(_classify_from_name)
    out["is_etf"] = out["security_type"].eq("ETF")

    # Save the reference CSV
    save_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(save_path, index=False, encoding="utf-8")
    logger.info(f"Saved ASX reference CSV -> {save_path} ({len(out)} rows)")
    return out

# ----------------------------
# Downloader with indicators
# ----------------------------
class DataDownloader:
    def __init__(self, config: Dict[str, Any], show_talib_fallback: bool = False):
        self.symbols = list(dict.fromkeys(config.get("symbols", [])))       # de-dup preserve order
        self.start_date = config.get("start_date")
        self.end_date = config.get("end_date")
        self.batch_size = int(config.get("batch_size", 80))
        self.sleep_between = float(config.get("sleep_between", 2.0))
        self.raw_dir = RAW_DIR
        self.processed_dir = PROCESSED_DIR
        self._show_talib_fallback = bool(show_talib_fallback)
        logger.info(f"DataDownloader initialized for {len(self.symbols)} symbols | {self.start_date} → {self.end_date}")

    def _normalize_df(self, df: pd.DataFrame) -> Optional[pd.DataFrame]:
        if df is None or df.empty:
            return None
        rename_map = {c: c.title() for c in df.columns}
        df = df.rename(columns=rename_map)
        expected = ["Open", "High", "Low", "Close", "Volume"]
        if not all(c in df.columns for c in expected):
            return None
        df = df[expected].copy()
        df["Date"] = df.index
        return df.reset_index(drop=True)

    def download_symbol_data(self, symbol: str) -> Optional[pd.DataFrame]:
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
                    # sanity: positive prices
                    mask = (norm[["Open", "High", "Low", "Close"]] > 0).all(axis=1)
                    norm = norm.loc[mask].copy()
                    if not norm.empty:
                        logger.info(f"{symbol}: {len(norm)} rows via {tag}")
                        return norm
                    logger.warning(f"{symbol}: filtered to 0 rows after sanity")
                else:
                    logger.warning(f"{symbol}: empty via {tag}")
            except Exception as e:
                last_err = e
                # downgrade common delisted/no-timezone cases to WARNING
                msg = str(e).lower()
                if "possibly delisted" in msg or "no timezone" in msg:
                    logger.warning(f"{symbol}: {e}")
                else:
                    logger.warning(f"{symbol}: {tag} failed: {e}")
            time.sleep(0.25)
        if last_err:
            logger.error(f"Failed to fetch {symbol}: {last_err}")
        else:
            logger.error(f"No data for {symbol} in {self.start_date}→{self.end_date}")
        return None

    def add_technical_indicators(self, data: pd.DataFrame, symbol: str) -> pd.DataFrame:
        if data.empty:
            return data
        df = data.copy()

        if _talib is not None:
            # TA-Lib path (quiet)
            df['SMA_5'] = _talib.SMA(df['Close'], timeperiod=5)
            df['SMA_10'] = _talib.SMA(df['Close'], timeperiod=10)
            df['SMA_20'] = _talib.SMA(df['Close'], timeperiod=20)
            df['SMA_50'] = _talib.SMA(df['Close'], timeperiod=50)
            df['SMA_200'] = _talib.SMA(df['Close'], timeperiod=200)
            df['EMA_12'] = _talib.EMA(df['Close'], timeperiod=12)
            df['EMA_26'] = _talib.EMA(df['Close'], timeperiod=26)
            df['RSI'] = _talib.RSI(df['Close'], timeperiod=14)
            macd, macd_sig, macd_hist = _talib.MACD(df['Close'])
            df['MACD'], df['MACD_signal'], df['MACD_hist'] = macd, macd_sig, macd_hist
            u, m, l = _talib.BBANDS(df['Close'], timeperiod=20, nbdevup=2, nbdevdn=2)
            df['BB_upper'], df['BB_middle'], df['BB_lower'] = u, m, l
        else:
            # Simplified path; only log if user asked to see the note
            if self._show_talib_fallback:
                logger.info("TA-Lib not available; using simplified indicators")
            df['SMA_5'] = df['Close'].rolling(5).mean()
            df['SMA_10'] = df['Close'].rolling(10).mean()
            df['SMA_20'] = df['Close'].rolling(20).mean()
            df['SMA_50'] = df['Close'].rolling(50).mean()
            df['SMA_200'] = df['Close'].rolling(200).mean()
            ema12 = df['Close'].ewm(span=12).mean()
            ema26 = df['Close'].ewm(span=26).mean()
            df['EMA_12'], df['EMA_26'] = ema12, ema26
            macd = ema12 - ema26
            df['MACD'] = macd
            df['MACD_signal'] = macd.ewm(span=9).mean()
            df['MACD_hist'] = df['MACD'] - df['MACD_signal']
            mid = df['Close'].rolling(20).mean()
            std = df['Close'].rolling(20).std()
            df['BB_middle'] = mid
            df['BB_upper'] = mid + 2 * std
            df['BB_lower'] = mid - 2 * std

        # returns/vol
        df['Returns'] = df['Close'].pct_change()
        df['Log_Returns'] = np.log(df['Close'] / df['Close'].shift(1))
        df['Volatility_20'] = df['Returns'].rolling(20).std() * np.sqrt(252)

        # momentum & helpers
        df['Momentum_20'] = df['Close'] / df['Close'].shift(20) - 1
        df['Volume_SMA_20'] = df['Volume'].rolling(20).mean()
        df['Volume_Ratio'] = df['Volume'] / df['Volume_SMA_20']

        # clean
        df = df.replace([np.inf, -np.inf], np.nan).fillna(method='ffill').fillna(0)

        # stable features after warmup
        if len(df) > 200:
            df = df.iloc[200:].reset_index(drop=True)
        return df

    def save_data(self, data: pd.DataFrame, symbol: str, data_type: str = "processed"):
        file_path = (self.raw_dir / f"{symbol}_raw.csv").resolve() if data_type == "raw" \
            else (self.processed_dir / f"{symbol}_processed.csv").resolve()
        file_path.parent.mkdir(parents=True, exist_ok=True)
        data.to_csv(file_path, index=False)
        logger.info(f"Saved {data_type} -> {file_path}")

    def download_all_data(self) -> Dict[str, pd.DataFrame]:
        logger.info(f"Starting downloads for {len(self.symbols)} symbols (batch={self.batch_size}, sleep={self.sleep_between}s)")
        all_data: Dict[str, pd.DataFrame] = {}
        success = 0
        for i in range(0, len(self.symbols), self.batch_size):
            batch = self.symbols[i:i + self.batch_size]
            logger.info(f"Batch {i//self.batch_size+1}: {len(batch)} symbols")
            for sym in batch:
                try:
                    raw = self.download_symbol_data(sym)
                    if raw is None or raw.empty:
                        continue
                    self.save_data(raw, sym, "raw")
                    proc = self.add_technical_indicators(raw, sym)
                    self.save_data(proc, sym, "processed")
                    all_data[sym] = proc
                    success += 1
                    logger.info(f"✅ {sym}: {len(proc)} rows, {len(proc.columns)} features")
                except Exception as e:
                    logger.error(f"❌ {sym}: {e}")
            if i + self.batch_size < len(self.symbols):
                logger.info(f"Sleeping {self.sleep_between:.1f}s between batches…")
                time.sleep(self.sleep_between)
        logger.info(f"Completed: {success}/{len(self.symbols)} symbols successful")
        return all_data

    def create_data_summary(self, all_data: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
        summary = {
            "download_date": datetime.now().isoformat(),
            "symbols": list(all_data.keys()),
            "num_symbols": len(all_data),
            "date_range": {"start": self.start_date, "end": self.end_date},
            "symbol_details": {}
        }
        for sym, df in all_data.items():
            if not df.empty:
                summary["symbol_details"][sym] = {
                    "records": int(len(df)),
                    "features": int(len(df.columns)),
                    "date_range": {
                        "start": str(pd.to_datetime(df['Date']).min().date()),
                        "end": str(pd.to_datetime(df['Date']).max().date())
                    },
                    "price_range": {
                        "min": float(df['Close'].min()),
                        "max": float(df['Close'].max()),
                        "mean": float(df['Close'].mean())
                    },
                    "volume_range": {
                        "min": float(df['Volume'].min()),
                        "max": float(df['Volume'].max()),
                        "mean": float(df['Volume'].mean())
                    }
                }
        return summary

    def validate_data_quality(self, all_data: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
        report = {"overall_quality": "good", "issues": [], "symbol_quality": {}}
        for sym, df in all_data.items():
            issues = []
            if df.empty:
                report["symbol_quality"][sym] = "poor"
                issues.append("Empty dataset")
                continue
            missing_pct = df.isnull().sum().sum() / (len(df) * len(df.columns)) * 100
            if missing_pct > 5:
                issues.append(f"High missing data: {missing_pct:.1f}%")
            if len(df) > 1:
                rets = df['Close'].pct_change()
                extreme_moves = int((rets.abs() > 0.5).sum())
                if extreme_moves > 0:
                    issues.append(f"Extreme price moves: {extreme_moves}")
            if issues:
                report["symbol_quality"][sym] = "good" if len(issues) <= 2 else "poor"
                report["issues"].extend([f"{sym}: {x}" for x in issues])
            else:
                report["symbol_quality"][sym] = "excellent"
        poor = sum(1 for q in report["symbol_quality"].values() if q == "poor")
        if poor > len(all_data) * 0.3:
            report["overall_quality"] = "poor"
        elif poor > 0:
            report["overall_quality"] = "fair"
        return report

# ----------------------------
# Main
# ----------------------------
def main():
    import argparse

    parser = argparse.ArgumentParser(description="ASX -> Yahoo 10-year downloader")
    parser.add_argument("--equities-only", action="store_true",
                        help="Only download companies classified as Equity")
    parser.add_argument("--max-symbols", type=int, default=0,
                        help="Limit number of tickers (0 = no limit)")
    parser.add_argument("--batch-size", type=int, default=80)
    parser.add_argument("--sleep-between", type=float, default=2.0)
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: today-10y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--show-talib-fallback", action="store_true",
                        help="Log a notice when TA-Lib is not available (off by default)")
    args = parser.parse_args()

    # 1) Download & save ASX list (reference)
    ref_path = REFERENCE_DIR / "asx_companies.csv"
    ref_df = download_asx_companies_csv(ref_path)

    # 2) Build symbols list
    if args.equities_only:
        ref_df = ref_df.loc[ref_df["security_type"].eq("Equity")].copy()

    tickers = ref_df["ticker_yf"].dropna().drop_duplicates().tolist()
    # no hardcoded expected count — we use whatever the file actually contains
    if args.max_symbols and args.max_symbols > 0:
        tickers = tickers[:args.max_symbols]

    # 3) Date range: default = last ~10 years
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    if args.start_date:
        start_date = args.start_date
    else:
        # ~10y = 3652 days (leap-year safe enough for market data)
        start_date = (today - timedelta(days=3652)).isoformat()

    logger.info(f"Tickers to download: {len(tickers)} (equities_only={bool(args.equities_only)})")
    logger.info(f"Date range: {start_date} → {end_date}")

    # 4) Download all symbols
    config = {
        "symbols": tickers,
        "start_date": start_date,
        "end_date": end_date,
        "batch_size": args.batch_size,
        "sleep_between": args.sleep_between,
    }
    downloader = DataDownloader(config, show_talib_fallback=args.show_talib_fallback)

    try:
        all_data = downloader.download_all_data()
        if not all_data:
            logger.error("❌ No data downloaded successfully.")
            sys.exit(1)

        summary = downloader.create_data_summary(all_data)
        quality = downloader.validate_data_quality(all_data)

        summary_path = BASE_DIR / "data_download_summary.json"
        quality_path = BASE_DIR / "data_quality_report.json"
        summary_path.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
        quality_path.write_text(json.dumps(quality, indent=2, default=str), encoding="utf-8")

        print("\n" + "="*70)
        print("📊 ASX 10-YEAR DATA DOWNLOAD SUMMARY")
        print("="*70)
        print(f"✅ Symbols downloaded: {len(all_data)}")
        print(f"📅 Date range: {start_date} → {end_date}")
        print(f"📁 Raw:       {RAW_DIR}")
        print(f"📁 Processed: {PROCESSED_DIR}")
        print(f"🧾 Summary:   {summary_path.name}")
        print(f"🧾 Quality:   {quality_path.name}")
        for folder in [RAW_DIR, PROCESSED_DIR]:
            n = len(list(folder.glob('*.csv')))
            print(f"  {folder}: {n} file(s)")
        print("\n🎉 Done!")

    except Exception as e:
        logger.error(f"Download failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
