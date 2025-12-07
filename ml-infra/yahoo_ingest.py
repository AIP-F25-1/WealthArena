import argparse, time, sys, yaml
from pathlib import Path
import pandas as pd
import yfinance as yf

# Ensure bronze/prices exists even if utils isn't imported yet
(Path("data/bronze/yahoo/prices")).mkdir(parents=True, exist_ok=True)

from utils import (
    DATA_RAW, DATA_BRONZE, save_df,
    normalize_prices, basic_price_checks, utc_now_iso
)

def load_cfg(cfg_path: str):
    with open(cfg_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def fetch_daily(tkr: str, start: str|None, end: str|None) -> pd.DataFrame:
    t = yf.Ticker(tkr)
    if start:
        return t.history(start=start, end=end or None, interval="1d", auto_adjust=False)
    return t.history(period="max", interval="1d", auto_adjust=False)

def fetch_intraday(tkr: str, interval: str, period: str) -> pd.DataFrame:
    t = yf.Ticker(tkr)
    return t.history(period=period, interval=interval, auto_adjust=False)

def fetch_actions(tkr: str):
    t = yf.Ticker(tkr)
    return t.dividends, t.splits

def fetch_options_snapshots(tkr: str, max_expiries: int):
    t = yf.Ticker(tkr)
    expiries = list(t.options or [])[:max_expiries]
    chains = []
    for exp in expiries:
        oc = t.option_chain(exp)
        oc.calls["expiry"] = exp
        oc.puts["expiry"] = exp
        chains.append(("calls", oc.calls.copy()))
        chains.append(("puts",  oc.puts.copy()))
    return chains

def main(args):
    cfg = load_cfg(args.config)
    tickers = cfg["universe"]
    s = cfg["settings"]
    polite = float(s.get("polite_pause_seconds", 0.4))

    # daily settings
    daily_start = s["daily"].get("start") or None
    daily_end   = s["daily"].get("end") or None

    # intraday settings
    intraday_on = bool(s["intraday"].get("enabled", False))
    intr_int    = s["intraday"].get("interval", "1m")
    intr_period = s["intraday"].get("lookback_period", "7d")

    # options settings
    opt_on      = bool(s["options"].get("enabled", False))
    opt_n       = int(s["options"].get("expiries", 1))

    run_id = utc_now_iso()
    print(f"[run] {run_id} tickers={len(tickers)}")

    for tkr in tickers:
        print(f"--- {tkr} ---")

        # 1) DAILY
        try:
            daily = fetch_daily(tkr, daily_start, daily_end)
            if daily is None or daily.empty:
                print(f"[warn] daily {tkr}: empty frame (start={daily_start}, end={daily_end})")
            else:
                daily.index = pd.to_datetime(daily.index).tz_localize(None)
                save_df(daily, DATA_RAW / f"{tkr}/{tkr}_1d")
                bronze = normalize_prices(daily, tkr, "1d")
                issues = basic_price_checks(bronze)
                if issues:
                    print(f"[warn] {tkr} daily: {issues}")
                bronze.to_parquet(DATA_BRONZE / f"prices/{tkr}_1d.parquet", index=False)
                print(f"[ok] daily {tkr}: {len(bronze)} rows")
        except Exception as e:
            print(f"[err] daily {tkr}: {e}")

        # 2) INTRADAY (with empty-frame guard)
        if intraday_on:
            try:
                intr = fetch_intraday(tkr, intr_int, intr_period)
                if intr is None or intr.empty:
                    print(f"[warn] intraday {tkr}: empty frame (interval={intr_int}, period={intr_period})")
                else:
                    intr.index = pd.to_datetime(intr.index).tz_localize(None)
                    save_df(intr, DATA_RAW / f"{tkr}/{tkr}_{intr_int}")
                    bronze_i = normalize_prices(intr, tkr, intr_int)
                    bronze_i.to_parquet(DATA_BRONZE / f"prices/{tkr}_{intr_int}.parquet", index=False)
                    print(f"[ok] intraday {tkr} {intr_int}: {len(bronze_i)} rows")
            except Exception as e:
                print(f"[warn] intraday {tkr}: {e}")

        # 3) CORPORATE ACTIONS
        try:
            div, spl = fetch_actions(tkr)
            (DATA_RAW / f"{tkr}").mkdir(parents=True, exist_ok=True)
            div.to_frame("dividend").to_csv(DATA_RAW / f"{tkr}/{tkr}_dividends.csv")
            spl.to_frame("split_ratio").to_csv(DATA_RAW / f"{tkr}/{tkr}_splits.csv")
        except Exception as e:
            print(f"[warn] actions {tkr}: {e}")

        # 4) OPTIONS (snapshot)
        if opt_on:
            try:
                chains = fetch_options_snapshots(tkr, opt_n)
                for kind, df in chains:
                    out = DATA_RAW / f"{tkr}/options/{kind}_{tkr}.csv"
                    out.parent.mkdir(parents=True, exist_ok=True)
                    df.to_csv(out, mode="a", header=not out.exists(), index=False)
                print(f"[ok] options {tkr}: {len(chains)} frames")
            except Exception as e:
                print(f"[warn] options {tkr}: {e}")

        time.sleep(polite)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="config/tickers.yaml")
    args = ap.parse_args()
    sys.exit(main(args))
