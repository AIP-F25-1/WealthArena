#!/usr/bin/env python3
# File: scrapeCryptoData.py
import sys, json, time, logging, warnings
from pathlib import Path
from typing import List, Optional, Dict
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf

warnings.filterwarnings("ignore")

# ----------------------------
# Paths & logging
# ----------------------------
BASE_DIR = Path(__file__).resolve().parent
LOG_DIR  = BASE_DIR / "logs"
RAW_DIR  = (BASE_DIR / "data" / "raw_crypto")
for p in (LOG_DIR, RAW_DIR):
    p.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "crypto_download.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"),
              logging.StreamHandler()]
)
logger = logging.getLogger("crypto_local_aud")

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
    """
    Daily Series with AUDUSD (USD per 1 AUD). For USD→AUD: AUD = USD * (1 / AUDUSD).
    """
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
    s = s.asfreq("D").ffill()  # fill weekends/holidays so we can align with crypto
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

def _save_csv(df: pd.DataFrame, out_name: str) -> Path:
    path = (RAW_DIR / out_name).resolve()
    df.to_csv(path, index=False)
    logger.info(f"Saved -> {path}")
    return path

# ----------------------------
# Main
# ----------------------------
def main():
    import argparse
    parser = argparse.ArgumentParser(description="Crypto RAW downloader with AUD support (LOCAL)")
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
    args = parser.parse_args()

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
        days = int(round(args.years * 365.2425))  # account for leap years on average
        start_date = (today - timedelta(days=days)).isoformat()

    logger.info(f"Symbols (USD base list): {len(syms)}")
    logger.info(f"Target currency: {args.target_currency}")
    logger.info(f"Date range: {start_date} → {end_date}")
    logger.info(f"Output: {RAW_DIR}")

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
                    out = _save_csv(df, f"{usd_sym}_raw.csv")
                    results[usd_sym] = {"mode": "native_usd", "file": str(out)}
                    ok += 1
                    continue

                # AUD mode: try native AUD first
                aud_sym = usd_sym.replace("-USD", "-AUD")
                df_aud = _try_hist(aud_sym, start_date, end_date)
                if df_aud is not None:
                    out = _save_csv(df_aud, f"{aud_sym}_raw.csv")
                    results[usd_sym] = {"mode": "native_aud", "file": str(out), "aud_symbol": aud_sym}
                    ok += 1
                    continue

                # Fallback: USD pair then convert via AUDUSD=X
                df_usd = _try_hist(usd_sym, start_date, end_date)
                if df_usd is None:
                    continue
                df_conv = _convert_usd_df_to_aud(df_usd, fx_series)
                out = _save_csv(df_conv, f"{usd_sym.replace('-USD','-AUD')}_raw.csv")
                results[usd_sym] = {"mode": "usd_to_aud", "file": str(out), "aud_symbol": usd_sym.replace("-USD","-AUD")}
                ok += 1
            except Exception as e:
                logger.error(f"❌ {usd_sym}: {e}")

        if i + args.batch_size < len(syms):
            logger.info(f"Sleeping {args.sleep_between:.1f}s between batches…")
            time.sleep(args.sleep_between)

    if ok == 0:
        logger.error("❌ No crypto data saved.")
        sys.exit(1)

    summary = {
        "download_date": datetime.now().isoformat(),
        "num_symbols": ok,
        "date_range": {"start": start_date, "end": end_date},
        "target_currency": args.target_currency,
        "years_requested": float(args.years) if not args.start_date else None,
        "symbols": results,
        "output_dir": str(RAW_DIR.resolve()),
    }
    summary_path = BASE_DIR / "crypto_raw_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\n" + "="*70)
    print(f"📊 CRYPTO RAW SUMMARY (LOCAL, {args.target_currency})")
    print("="*70)
    print(f"✅ Symbols saved: {ok}")
    print(f"📅 Date range: {start_date} → {end_date}")
    print(f"📁 Raw folder: {RAW_DIR}")
    print(f"🧾 Summary:   {summary_path.name}")
    print("ℹ️  Modes used: native AUD if available; otherwise USD→AUD via AUDUSD=X (weekend FX ffilled).")
    print("\n🎉 Done!")

if __name__ == "__main__":
    main()
