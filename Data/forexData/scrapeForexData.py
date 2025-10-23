#!/usr/bin/env python3
"""
AUD Forex Downloader (3y, local-only) — Top-15 currencies only
- Synthesizes AUD/XXX via bridges (USD→EUR→GBP→JPY)
- Saves per-pair CSV to data/forex/raw/
- Writes summary JSON

Install:
  pip install yfinance pandas
"""

import json, time, logging, warnings
from pathlib import Path
from typing import Dict, Optional, Tuple, List
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import yfinance as yf

warnings.filterwarnings("ignore")

# ----------------------------
# Config
# ----------------------------
BASE_DIR      = Path(__file__).resolve().parent
LOG_DIR       = BASE_DIR / "logs"
DATA_DIR      = BASE_DIR / "data" / "forex"
RAW_DIR       = DATA_DIR / "raw"
for p in (LOG_DIR, RAW_DIR):
    p.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "aud_fx_top15.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"),
              logging.StreamHandler()]
)
logger = logging.getLogger("aud_fx_top15")

BASE = "AUD"

# Only these 15 quotes
TOP15_QUOTES = [
    "USD","EUR","JPY","GBP","CNY","CAD","CHF","NZD","SEK","NOK",
    "KRW","INR","SGD","HKD","BRL"
]

# Bridge priority
BRIDGES = ["USD","EUR","GBP","JPY"]

# ----------------------------
# Helpers
# ----------------------------
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

def _save_csv(df: pd.DataFrame, path: Path):
    df2 = df.copy(); df2["Date"] = df2.index; df2 = df2.reset_index(drop=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    df2.to_csv(path, index=False)
    logger.info(f"Saved -> {path}")

def _ticker(b: str, q: str) -> str:
    return f"{b}{q}=X"

def _fetch_b_over_usd(b: str, start: str, end: str) -> Optional[pd.DataFrame]:
    d = _fetch_yf(_ticker(b,"USD"), start, end)
    if d is not None: return d
    inv = _fetch_yf(_ticker("USD", b), start, end)
    if inv is not None and not inv.empty:
        one = pd.DataFrame(index=inv.index, data={"Open":1.0,"High":1.0,"Low":1.0,"Close":1.0,"Volume":0})
        return _combine_ohlc("div", one, inv)  # 1/(USD/B)
    return None

def _fetch_b_over_quote(b: str, q: str, start: str, end: str):
    d = _fetch_yf(_ticker(b,q), start, end)
    if d is not None: return d, _ticker(b,q)
    inv = _fetch_yf(_ticker(q,b), start, end)
    if inv is not None and not inv.empty:
        one = pd.DataFrame(index=inv.index, data={"Open":1.0,"High":1.0,"Low":1.0,"Close":1.0,"Volume":0})
        return _combine_ohlc("div", one, inv), _ticker(q,b) + " (inverted)"
    return None, ""

# ----------------------------
# Main
# ----------------------------
def main():
    import argparse
    parser = argparse.ArgumentParser(description="AUD/* (top-15 currencies) via multi-bridge cross-rate, local-only")
    parser.add_argument("--sleep-between", type=float, default=0.4)
    parser.add_argument("--max-workers", type=int, default=6)
    parser.add_argument("--start-date", default=None)
    parser.add_argument("--end-date", default=None)
    args = parser.parse_args()

    today = datetime.utcnow().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=365*3 + 2)).isoformat()

    quotes = [q for q in TOP15_QUOTES if q != BASE]

    logger.info(f"Top-15 quotes: {quotes}")
    logger.info(f"Date range: {start_date} → {end_date}")
    logger.info(f"Output: {RAW_DIR}")

    # AUD/USD (base leg)
    audusd = _fetch_yf(_ticker("AUD","USD"), start_date, end_date)
    if audusd is None or audusd.empty:
        logger.error("Failed to fetch AUDUSD=X; cannot proceed.")
        return

    # Bridges B/USD
    bridge_over_usd: Dict[str, Optional[pd.DataFrame]] = {"USD": pd.DataFrame(index=audusd.index, data={"Open":1.0,"High":1.0,"Low":1.0,"Close":1.0,"Volume":0})}
    def _fetch_bridge(b: str):
        if b == "USD": return ("USD", bridge_over_usd["USD"])
        d = _fetch_b_over_usd(b, start_date, end_date); time.sleep(args.sleep_between); return (b, d)

    bridges_to_fetch = [b for b in BRIDGES if b != "USD"]
    if args.max_workers <= 1:
        for b in bridges_to_fetch:
            k, d = _fetch_bridge(b); bridge_over_usd[k] = d
    else:
        with ThreadPoolExecutor(max_workers=args.max_workers) as ex:
            futs = {ex.submit(_fetch_bridge, b): b for b in bridges_to_fetch}
            for fut in as_completed(futs):
                k, d = fut.result(); bridge_over_usd[k] = d

    # Precompute AUD/B = (AUD/USD)/(B/USD)
    aud_over_bridge: Dict[str, Optional[pd.DataFrame]] = {}
    for b in BRIDGES:
        b_usd = bridge_over_usd.get(b)
        aud_over_bridge[b] = None if (b_usd is None or b_usd.empty) else _combine_ohlc("div", audusd, b_usd)

    results: Dict[str, Dict] = {}
    succeeded, failed = [], []

    def _process(q: str):
        if q == "USD":
            p = RAW_DIR / "AUDUSD_fx_raw.csv"; _save_csv(audusd, p)
            return ("AUDUSD", True, str(p), "direct:AUDUSD=X")
        for b in BRIDGES:
            aud_b = aud_over_bridge.get(b)
            if aud_b is None or aud_b.empty: continue
            leg, used = _fetch_b_over_quote(b, q, start_date, end_date); time.sleep(args.sleep_between)
            if leg is None or leg.empty: continue
            combo = _combine_ohlc("mul", aud_b, leg)
            if combo.empty: continue
            pair = f"AUD{q}"; p = RAW_DIR / f"{pair}_fx_raw.csv"; _save_csv(combo, p)
            return (pair, True, str(p), f"bridge={b}, via={used}")
        return (f"AUD{q}", False, None, "no_bridge_leg_available")

    if args.max_workers <= 1:
        task_results = [_process(q) for q in quotes]
    else:
        task_results = []
        with ThreadPoolExecutor(max_workers=args.max_workers) as ex:
            futs = {ex.submit(_process, q): q for q in quotes}
            for fut in as_completed(futs):
                task_results.append(fut.result())

    for pair, ok, path, note in task_results:
        if ok: results[pair] = {"ok": True, "path": path, "note": note}; succeeded.append(pair)
        else:  results[pair] = {"ok": False, "error": note}; failed.append(pair)

    summary = {
        "run_at": datetime.utcnow().isoformat() + "Z",
        "base_currency": BASE,
        "quotes": quotes,
        "bridges": BRIDGES,
        "date_range": {"start": start_date, "end": end_date},
        "successful": len(succeeded),
        "failed": len(failed),
        "files": {k: v["path"] for k,v in results.items() if v.get("ok")},
        "errors": {k: v.get("error","") for k,v in results.items() if not v.get("ok")},
        "output_dir": str(RAW_DIR),
    }
    (DATA_DIR / "aud_fx_top15_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\n" + "="*70)
    print("📊 AUD FOREX — Top-15 (3y)")
    print("="*70)
    print(f"✅ Successful: {len(succeeded)} / {len(quotes)}")
    print(f"📁 Output dir: {RAW_DIR}")
    print(f"🧾 Summary:   {DATA_DIR / 'aud_fx_top15_summary.json'}")
    if failed:
        print(f"⚠️  No bridge legs for: {len(failed)} — likely missing Yahoo legs for that quote.")

if __name__ == "__main__":
    main()
