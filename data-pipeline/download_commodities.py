
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

# Import commodities
# Add wealtharena_rl/src to path once for package imports
wealtharena_src = Path(__file__).parent.parent / "wealtharena_rl" / "src"
if str(wealtharena_src) not in sys.path:
    sys.path.insert(0, str(wealtharena_src))
try:
    from data.commodities.commodities import (
        PRECIOUS_METALS, ENERGY_COMMODITIES, AGRICULTURAL_COMMODITIES,
        INDUSTRIAL_METALS, LIVESTOCK, COMMODITY_CATEGORIES, MAJOR_COMMODITIES
    )
except ImportError:
    # Fallback if import fails
    try:
        sys.path.insert(0, str(wealtharena_src / "data" / "commodities"))
        from commodities import (
            PRECIOUS_METALS, ENERGY_COMMODITIES, AGRICULTURAL_COMMODITIES,
            INDUSTRIAL_METALS, LIVESTOCK, COMMODITY_CATEGORIES, MAJOR_COMMODITIES
        )
    except ImportError:
        PRECIOUS_METALS = ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"]
        ENERGY_COMMODITIES = ["CRUDE_OIL", "BRENT_OIL", "NATURAL_GAS", "HEATING_OIL", "GASOLINE"]
        AGRICULTURAL_COMMODITIES = ["WHEAT", "CORN", "SOYBEANS", "SUGAR", "COFFEE", "COTTON", "COCOA"]
        INDUSTRIAL_METALS = ["COPPER", "ALUMINUM", "ZINC", "NICKEL", "LEAD", "TIN"]
        LIVESTOCK = ["CATTLE", "HOGS", "FEEDER_CATTLE"]
        MAJOR_COMMODITIES = PRECIOUS_METALS + ENERGY_COMMODITIES + AGRICULTURAL_COMMODITIES + INDUSTRIAL_METALS + LIVESTOCK
        COMMODITY_CATEGORIES = {
            "Precious_Metals": PRECIOUS_METALS,
            "Energy": ENERGY_COMMODITIES,
            "Agricultural": AGRICULTURAL_COMMODITIES,
            "Industrial_Metals": INDUSTRIAL_METALS,
            "Livestock": LIVESTOCK
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
# Commodity ticker mapping to Yahoo Finance futures
# ----------------------------

COMMODITY_TICKERS = {
    # Precious Metals
    "GOLD": "GC=F",      # Gold Futures
    "SILVER": "SI=F",    # Silver Futures
    "PLATINUM": "PL=F",  # Platinum Futures
    "PALLADIUM": "PA=F", # Palladium Futures
    
    # Energy
    "CRUDE_OIL": "CL=F",     # WTI Crude Oil Futures
    "BRENT_OIL": "BZ=F",     # Brent Crude Oil Futures
    "NATURAL_GAS": "NG=F",   # Natural Gas Futures
    "HEATING_OIL": "HO=F",   # Heating Oil Futures
    "GASOLINE": "RB=F",      # Gasoline Futures
    
    # Agricultural
    "WHEAT": "ZW=F",     # Wheat Futures
    "CORN": "ZC=F",      # Corn Futures
    "SOYBEANS": "ZS=F",  # Soybeans Futures
    "COFFEE": "KC=F",    # Coffee Futures
    "SUGAR": "SB=F",     # Sugar Futures
    "COTTON": "CT=F",    # Cotton Futures
    "COCOA": "CC=F",     # Cocoa Futures
    
    # Industrial Metals
    "COPPER": "HG=F",    # Copper Futures
    "ALUMINUM": "ALI=F", # Aluminum Futures (LME)
    "ZINC": "ZN=F",      # Zinc Futures
    "NICKEL": "NI=F",    # Nickel Futures
    "LEAD": "PB=F",      # Lead Futures
    "TIN": "SN=F",       # Tin Futures
    
    # Livestock
    "CATTLE": "LE=F",    # Live Cattle Futures
    "HOGS": "HE=F",      # Lean Hogs Futures
    "FEEDER_CATTLE": "GF=F",  # Feeder Cattle Futures
}

# ----------------------------
# Main
# ----------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Commodities RAW downloader (ADLS Gen2 optional)")
    parser.add_argument("--category", 
                       choices=["Precious_Metals", "Energy", "Agricultural", "Industrial_Metals", "Livestock", "All"],
                       default="All",
                       help="Commodity category to download")
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: today-3y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--sleep-between", type=float, default=1.0)
    parser.add_argument("--azure-prefix", default="commodities",
                       help="Directory/prefix inside filesystem for uploads (default: commodities)")
    parser.add_argument("--clean-remote-first", action="store_true",
                       help="Delete existing remote files with same name before upload")
    args = parser.parse_args()

    # Get commodity symbols from category
    if args.category == "All":
        commodity_symbols = list(COMMODITY_TICKERS.keys())
    else:
        category_symbols = COMMODITY_CATEGORIES.get(args.category, [])
        commodity_symbols = [s for s in category_symbols if s in COMMODITY_TICKERS]
        
        # Warn about symbols in category that aren't mapped
        missing_symbols = [s for s in category_symbols if s not in COMMODITY_TICKERS]
        if missing_symbols:
            logger.warning(f"The following symbols in category '{args.category}' are not mapped to Yahoo tickers and will be skipped: {missing_symbols}")
    
    # Map to Yahoo Finance futures symbols
    tickers = [COMMODITY_TICKERS[sym] for sym in commodity_symbols if sym in COMMODITY_TICKERS]

    # Date range: default = last 3 years
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=1095)).isoformat()

    logger.info(f"Commodities to download (RAW): {len(tickers)} (category={args.category})")
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
            logger.error("No RAW commodity data available (downloaded or existing).")
            sys.exit(1)

        summary = {
            "download_date": datetime.now().isoformat(),
            "category": args.category,
            "num_symbols": len(all_raw),
            "date_range": {"start": start_date, "end": end_date},
            "symbols": sorted(all_raw.keys()),
        }
        summary_path = BASE_DIR / "commodities_download_summary.json"
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print("\n" + "="*70)
        print("📊 COMMODITIES RAW DOWNLOAD SUMMARY")
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
        logger.error(f"RAW commodities download failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()

