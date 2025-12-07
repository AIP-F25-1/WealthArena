
import os
import sys
import json
import time
import logging
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf

# Import forex symbols
sys.path.insert(0, str(Path(__file__).parent.parent / "rl-training" / "src"))
try:
    from data.currencies.currency_pairs import (
        MAJOR_PAIRS,
        MINOR_PAIRS,
        EXOTIC_PAIRS,
        CURRENCY_CATEGORIES
    )
    # Verify imports succeeded
    if not MAJOR_PAIRS:
        raise ImportError("MAJOR_PAIRS is empty")
except (ImportError, AttributeError) as e:
    # Fallback if import fails - logger not yet imported, use print
    print(f"[WARNING] Could not import forex symbols from rl-training/src: {e}", file=sys.stderr)
    print("[WARNING] Using fallback forex symbol lists", file=sys.stderr)
    MAJOR_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD"]
    MINOR_PAIRS = ["EURGBP", "EURJPY", "EURCHF", "EURAUD", "EURCAD", "EURNZD",
                   "GBPJPY", "GBPCHF", "GBPAUD", "GBPCAD", "GBPNZD",
                   "CHFJPY", "AUDJPY", "AUDCHF", "AUDCAD", "AUDNZD",
                   "NZDCAD", "NZDCHF", "NZDJPY", "CADCHF", "CADJPY"]
    EXOTIC_PAIRS = ["USDTRY", "USDZAR", "USDMXN", "USDBRL", "USDRUB", "USDINR",
                    "EURTRY", "EURZAR", "EURMXN", "EURBRL", "EURRUB", "EURINR"]
    CURRENCY_CATEGORIES = {
        "Major": MAJOR_PAIRS,
        "Minor": MINOR_PAIRS,
        "Exotic": EXOTIC_PAIRS
    }

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

def get_forex_symbols(category: str = "Major") -> List[str]:
    """Get forex pairs for specified category."""
    if category == "All":
        all_pairs = set(MAJOR_PAIRS + MINOR_PAIRS + EXOTIC_PAIRS)
        return sorted(all_pairs)
    
    category_map = {
        "Major": MAJOR_PAIRS,
        "Minor": MINOR_PAIRS,
        "Exotic": EXOTIC_PAIRS
    }
    
    return category_map.get(category, MAJOR_PAIRS)

def forex_to_yahoo_ticker(forex_pair: str) -> str:
    """Convert forex pair to Yahoo Finance ticker format."""
    # Remove any separators (e.g., EUR/USD -> EURUSD)
    pair = forex_pair.replace("/", "").replace("-", "").upper()
    
    # Yahoo Finance uses {PAIR}=X format
    # Handle both formats: EURUSD and EUR/USD
    return f"{pair}=X"

# ----------------------------
# Main
# ----------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Forex pairs RAW downloader with ADLS Gen2 upload")
    parser.add_argument("--category", 
                       choices=["Major", "Minor", "Exotic", "All"],
                       default="Major",
                       help="Forex category to download")
    parser.add_argument("--symbols", type=str, default=None,
                        help="Download specific forex pairs only (comma-separated, e.g., EURUSD=X,GBPUSD=X)")
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: today-3y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--sleep-between", type=float, default=1.0)
    parser.add_argument("--azure-prefix", default="forex",
                        help="Directory/prefix inside filesystem for uploads (default: forex)")
    parser.add_argument("--clean-remote-first", action="store_true",
                        help="Delete existing remote files with same name before upload")
    args = parser.parse_args()

    # Get forex pairs
    if args.symbols:
        # Parse comma-separated symbol list
        yahoo_tickers = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
        logger.info(f"Downloading {len(yahoo_tickers)} specific forex pairs: {', '.join(yahoo_tickers)}")
        # Validate symbols are in expected format (*=X)
        invalid_symbols = [t for t in yahoo_tickers if not t.endswith("=X")]
        if invalid_symbols:
            logger.warning(f"Warning: Some symbols don't match expected forex format (*=X): {invalid_symbols}")
            # Filter out invalid symbols
            yahoo_tickers = [t for t in yahoo_tickers if t.endswith("=X")]
    else:
        forex_pairs = get_forex_symbols(args.category)
        # Convert to Yahoo Finance tickers
        yahoo_tickers = [forex_to_yahoo_ticker(pair) for pair in forex_pairs]
        logger.info(f"Retrieved {len(forex_pairs)} forex pairs for category '{args.category}'")
        if not forex_pairs:
            logger.error(f"No pairs found for category: {args.category}")
            logger.error(f"Available categories: Major, Minor, Exotic, All")
            logger.error(f"MAJOR_PAIRS has {len(MAJOR_PAIRS)} items, MINOR_PAIRS has {len(MINOR_PAIRS) if 'MINOR_PAIRS' in globals() else 0} items, EXOTIC_PAIRS has {len(EXOTIC_PAIRS) if 'EXOTIC_PAIRS' in globals() else 0} items")
            sys.exit(1)
    
    if not yahoo_tickers:
        logger.error("No valid forex tickers to download")
        sys.exit(1)
    
    # Date range: default = last ~3 years
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=3*365)).isoformat()

    logger.info(f"Tickers to download (RAW only): {len(yahoo_tickers)} (category={args.category})")
    logger.info(f"Date range: {start_date} -> {end_date}")

    # Ensure raw/forex directory exists
    forex_raw_dir = RAW_DIR / "forex"
    forex_raw_dir.mkdir(parents=True, exist_ok=True)

    # Create downloader with forex-specific raw directory
    class ForexDownloader(RawDownloader):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.raw_dir = forex_raw_dir

    # Download RAW
    dl = ForexDownloader(
        symbols=yahoo_tickers,
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
            logger.error("[ERROR] No RAW data downloaded successfully.")
            sys.exit(1)

        summary = {
            "download_date": datetime.now().isoformat(),
            "num_symbols": len(all_raw),
            "category": args.category,
            "date_range": {"start": start_date, "end": end_date},
            "symbols": sorted(all_raw.keys()),
        }
        summary_path = BASE_DIR / "forex_download_summary.json"
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print("\n" + "="*70)
        print("[SUMMARY] FOREX RAW DOWNLOAD SUMMARY")
        print("="*70)
        print(f"[OK] Symbols downloaded (RAW): {len(all_raw)}")
        print(f"[DATE] Date range: {start_date} -> {end_date}")
        print(f"[FOLDER] Raw folder: {forex_raw_dir}")
        print(f"[FILE] Summary:   {summary_path.name}")
        n = len(list(forex_raw_dir.glob('*.csv')))
        print(f"  {forex_raw_dir}: {n} file(s)")
        if AZURE_UPLOAD and AZURE_CONN_STR and AZURE_FS:
            print(f"[AZURE] ADLS upload: ENABLED (filesystem='{AZURE_FS}', prefix='{args.azure_prefix}', clean_first={bool(args.clean_remote_first or AZURE_CLEAN_FIRST)})")
        else:
            print("[AZURE] ADLS upload: disabled (set AZURE_UPLOAD=true and provide connection string + filesystem)")

        print("\n[SUCCESS] Done!")

    except Exception as e:
        logger.error(f"RAW download failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()

