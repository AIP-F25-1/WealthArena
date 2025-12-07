
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

# Import forex pairs
# Add wealtharena_rl/src to path once for package imports
wealtharena_src = Path(__file__).parent.parent / "wealtharena_rl" / "src"
if str(wealtharena_src) not in sys.path:
    sys.path.insert(0, str(wealtharena_src))
try:
    from data.currencies.currency_pairs import MAJOR_PAIRS, MINOR_PAIRS, EXOTIC_PAIRS, CURRENCY_CATEGORIES
except ImportError:
    # Fallback if import fails
    try:
        sys.path.insert(0, str(wealtharena_src / "data" / "currencies"))
        from currency_pairs import MAJOR_PAIRS, MINOR_PAIRS, EXOTIC_PAIRS, CURRENCY_CATEGORIES
    except ImportError:
        MAJOR_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD"]
        MINOR_PAIRS = ["EURGBP", "EURJPY", "EURCHF", "EURAUD", "EURCAD", "EURNZD"]
        EXOTIC_PAIRS = ["USDTRY", "USDZAR", "USDMXN", "USDBRL", "USDRUB", "USDINR"]
        CURRENCY_CATEGORIES = {"Major_Pairs": MAJOR_PAIRS, "Minor_Pairs": MINOR_PAIRS, "Exotic_Pairs": EXOTIC_PAIRS}

# Import shared classes from ASX downloader
from asx_market_data_adls import (
    ADLSGen2Sink,
    RawDownloader,
    BASE_DIR,
    LOG_DIR,
    DATA_DIR,
    RAW_DIR,
    logger,
    AZURE_UPLOAD,
    AZURE_CONN_STR,
    AZURE_FS,
    AZURE_PREFIX_DEFAULT,
    AZURE_CLEAN_FIRST
)

# ----------------------------
# Forex pair mapping to Yahoo Finance
# ----------------------------

def forex_to_yahoo_ticker(pair: str) -> str:
    """Convert forex pair to Yahoo Finance ticker format."""
    # Handle both EUR/USD and EURUSD formats
    pair = pair.replace("/", "").strip().upper()
    
    # Yahoo Finance uses =X suffix for forex pairs
    return f"{pair}=X"

# ----------------------------
# Main
# ----------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Forex pairs RAW downloader (ADLS Gen2 optional)")
    parser.add_argument("--category", 
                       choices=["Major", "Minor", "Exotic", "All"],
                       default="Major",
                       help="Forex category to download")
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: today-3y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--sleep-between", type=float, default=1.0)
    parser.add_argument("--azure-prefix", default="forex",
                       help="Directory/prefix inside filesystem for uploads (default: forex)")
    parser.add_argument("--clean-remote-first", action="store_true",
                       help="Delete existing remote files with same name before upload")
    args = parser.parse_args()

    # Get forex pairs from category
    category_map = {
        "Major": MAJOR_PAIRS,
        "Minor": MINOR_PAIRS,
        "Exotic": EXOTIC_PAIRS,
        "All": MAJOR_PAIRS + MINOR_PAIRS + EXOTIC_PAIRS
    }
    
    forex_pairs = category_map.get(args.category, MAJOR_PAIRS)
    
    # Map to Yahoo Finance tickers (add =X suffix)
    tickers = [forex_to_yahoo_ticker(pair) for pair in forex_pairs]

    # Date range: default = last 3 years
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=1095)).isoformat()

    logger.info(f"Forex pairs to download (RAW): {len(tickers)} (category={args.category})")
    logger.info(f"Date range: {start_date} → {end_date}")

    # Download RAW
    dl = RawDownloader(
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
            logger.error("No RAW forex data available (downloaded or existing).")
            sys.exit(1)

        summary = {
            "download_date": datetime.now().isoformat(),
            "category": args.category,
            "num_symbols": len(all_raw),
            "date_range": {"start": start_date, "end": end_date},
            "symbols": sorted(all_raw.keys()),
        }
        summary_path = BASE_DIR / "forex_download_summary.json"
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print("\n" + "="*70)
        print("📊 FOREX RAW DOWNLOAD SUMMARY")
        print("="*70)
        print(f"✅ Symbols downloaded (RAW): {len(all_raw)}")
        print(f"📅 Date range: {start_date} → {end_date}")
        print(f"📁 Raw folder: {RAW_DIR}")
        print(f"🧾 Summary:   {summary_path.name}")
        n = len(list(RAW_DIR.glob('*.csv')))
        print(f"  {RAW_DIR}: {n} file(s)")
        if AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS:
            print(f"☁️  ADLS upload: ENABLED (filesystem='{AZURE_FS}', prefix='{args.azure_prefix}', clean_first={bool(args.clean_remote_first or AZURE_CLEAN_FIRST)})")
        else:
            print("☁️  ADLS upload: disabled (set AZURE_UPLOAD=true and provide connection string + filesystem)")

        print("\n🎉 Done!")

    except Exception as e:
        logger.error(f"RAW forex download failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()

