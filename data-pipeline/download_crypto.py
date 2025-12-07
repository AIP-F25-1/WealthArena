
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

# Import crypto symbols
# Add wealtharena_rl/src to path once for package imports
wealtharena_src = Path(__file__).parent.parent / "wealtharena_rl" / "src"
if str(wealtharena_src) not in sys.path:
    sys.path.insert(0, str(wealtharena_src))
try:
    from data.crypto.cryptocurrencies import MAJOR_CRYPTOCURRENCIES, CRYPTO_CATEGORIES
except ImportError:
    # Fallback if import fails
    try:
        sys.path.insert(0, str(wealtharena_src / "data" / "crypto"))
        from cryptocurrencies import MAJOR_CRYPTOCURRENCIES, CRYPTO_CATEGORIES
    except ImportError:
        MAJOR_CRYPTOCURRENCIES = ["BTC", "ETH", "BNB", "XRP", "ADA", "SOL", "DOGE", "DOT", "AVAX", "SHIB", "MATIC", "LTC", "UNI", "LINK", "ATOM", "ALGO", "VET", "FIL", "TRX", "ETC"]
        CRYPTO_CATEGORIES = {"Major_Cryptocurrencies": MAJOR_CRYPTOCURRENCIES}

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
# Crypto symbol mapping to Yahoo Finance
# ----------------------------

CRYPTO_TICKER_MAP = {}
for symbol in MAJOR_CRYPTOCURRENCIES:
    CRYPTO_TICKER_MAP[symbol] = f"{symbol}-USD"

# ----------------------------
# Main
# ----------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Cryptocurrency RAW downloader (ADLS Gen2 optional)")
    parser.add_argument("--category", 
                       choices=["Major", "DeFi", "Layer1", "Layer2", "Meme", "Stablecoins", "Exchange", "All"],
                       default="Major",
                       help="Cryptocurrency category to download (Note: Only 'Major' and 'All' are fully implemented)")
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: today-3y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--sleep-between", type=float, default=1.0)
    parser.add_argument("--azure-prefix", default="crypto",
                       help="Directory/prefix inside filesystem for uploads (default: crypto)")
    parser.add_argument("--clean-remote-first", action="store_true",
                       help="Delete existing remote files with same name before upload")
    args = parser.parse_args()

    # Get crypto symbols from category
    # Map CLI category names to CRYPTO_CATEGORIES keys
    category_name_map = {
        "Major": "Major_Cryptocurrencies",
        "DeFi": "DeFi_Tokens",
        "Layer1": "Layer_1_Tokens",
        "Layer2": "Layer_2_Tokens",
        "Meme": "Meme_Coins",
        "Stablecoins": "Stablecoins",
        "Exchange": "Exchange_Tokens"
    }
    
    crypto_symbols = []
    
    if args.category == "All":
        # Combine all categories
        all_symbols = set()
        for category_key in CRYPTO_CATEGORIES.values():
            if isinstance(category_key, list):
                all_symbols.update(category_key)
        crypto_symbols = sorted(list(all_symbols)) if all_symbols else MAJOR_CRYPTOCURRENCIES
    elif args.category in category_name_map:
        category_key = category_name_map[args.category]
        if category_key in CRYPTO_CATEGORIES:
            crypto_symbols = CRYPTO_CATEGORIES[category_key]
        else:
            logger.error(f"Category '{args.category}' (mapped to '{category_key}') is not available in CRYPTO_CATEGORIES")
            logger.error(f"Available categories: {list(CRYPTO_CATEGORIES.keys())}")
            logger.warning(f"Falling back to Major cryptocurrencies")
            crypto_symbols = MAJOR_CRYPTOCURRENCIES
    else:
        # Fallback to Major
        crypto_symbols = MAJOR_CRYPTOCURRENCIES
    
    # Map to Yahoo Finance tickers (add -USD suffix)
    tickers = [f"{sym}-USD" for sym in crypto_symbols]

    # Date range: default = last 3 years
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=1095)).isoformat()

    logger.info(f"Crypto symbols to download (RAW): {len(tickers)} (category={args.category})")
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
            logger.error("No RAW crypto data available (downloaded or existing).")
            sys.exit(1)

        summary = {
            "download_date": datetime.now().isoformat(),
            "category": args.category,
            "num_symbols": len(all_raw),
            "date_range": {"start": start_date, "end": end_date},
            "symbols": sorted(all_raw.keys()),
        }
        summary_path = BASE_DIR / "crypto_download_summary.json"
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print("\n" + "="*70)
        print("📊 CRYPTO RAW DOWNLOAD SUMMARY")
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
        logger.error(f"RAW crypto download failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()

