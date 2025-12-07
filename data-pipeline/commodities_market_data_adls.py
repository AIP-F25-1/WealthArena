
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

# Import commodity symbols
sys.path.insert(0, str(Path(__file__).parent.parent / "rl-training" / "src"))
try:
    from data.commodities.commodities import (
        PRECIOUS_METALS,
        ENERGY_COMMODITIES,
        AGRICULTURAL_COMMODITIES,
        INDUSTRIAL_METALS,
        LIVESTOCK,
        COMMODITY_CATEGORIES
    )
    # Verify imports succeeded
    if not PRECIOUS_METALS:
        raise ImportError("PRECIOUS_METALS is empty")
except (ImportError, AttributeError) as e:
    # Fallback if import fails - logger not yet imported, use print
    print(f"[WARNING] Could not import commodity symbols from rl-training/src: {e}", file=sys.stderr)
    print("[WARNING] Using fallback commodity symbol lists", file=sys.stderr)
    PRECIOUS_METALS = ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"]
    ENERGY_COMMODITIES = ["CRUDE_OIL", "BRENT_OIL", "NATURAL_GAS", "HEATING_OIL", "GASOLINE"]
    AGRICULTURAL_COMMODITIES = ["WHEAT", "CORN", "SOYBEANS", "COFFEE", "SUGAR", "COTTON", "COCOA"]
    INDUSTRIAL_METALS = ["COPPER", "ALUMINUM", "ZINC", "NICKEL", "LEAD", "TIN"]
    LIVESTOCK = ["CATTLE", "HOGS", "FEEDER_CATTLE"]
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
# Commodity symbol mapping to Yahoo Finance futures
# ----------------------------

COMMODITY_TICKERS = {
    'GOLD': 'GC=F',
    'SILVER': 'SI=F',
    'PLATINUM': 'PL=F',
    'PALLADIUM': 'PA=F',
    'CRUDE_OIL': 'CL=F',
    'BRENT_OIL': 'BZ=F',
    'NATURAL_GAS': 'NG=F',
    'HEATING_OIL': 'HO=F',
    'GASOLINE': 'RB=F',
    'COPPER': 'HG=F',
    'ALUMINUM': 'ALI=F',
    'ZINC': 'ZN=F',
    'NICKEL': 'NID=F',
    'LEAD': 'LED=F',
    'TIN': 'TID=F',
    'WHEAT': 'ZW=F',
    'CORN': 'ZC=F',
    'SOYBEANS': 'ZS=F',
    'COFFEE': 'KC=F',
    'SUGAR': 'SB=F',
    'COTTON': 'CT=F',
    'COCOA': 'CC=F',
    'CATTLE': 'LE=F',
    'HOGS': 'HE=F',
    'FEEDER_CATTLE': 'FC=F'
}

def get_commodity_symbols(category: str = "All") -> List[str]:
    """Get commodities for specified category."""
    if category == "All":
        all_commodities = set(PRECIOUS_METALS + ENERGY_COMMODITIES + AGRICULTURAL_COMMODITIES + 
                             INDUSTRIAL_METALS + LIVESTOCK)
        return sorted(list(all_commodities))
    
    return COMMODITY_CATEGORIES.get(category, PRECIOUS_METALS)

def commodity_to_yahoo_ticker(commodity_symbol: str) -> Optional[str]:
    """Convert commodity symbol to Yahoo Finance futures ticker."""
    return COMMODITY_TICKERS.get(commodity_symbol)

# ----------------------------
# Main
# ----------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Commodities RAW downloader with ADLS Gen2 upload")
    parser.add_argument("--category", 
                       choices=["Precious_Metals", "Energy", "Agricultural", "Industrial_Metals", "Livestock", "All"],
                       default="All",
                       help="Commodity category to download")
    parser.add_argument("--symbols", type=str, default=None,
                        help="Download specific commodities only (comma-separated, e.g., GC=F,SI=F)")
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: today-3y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--sleep-between", type=float, default=1.0)
    parser.add_argument("--azure-prefix", default="commodities",
                        help="Directory/prefix inside filesystem for uploads (default: commodities)")
    parser.add_argument("--clean-remote-first", action="store_true",
                        help="Delete existing remote files with same name before upload")
    args = parser.parse_args()

    # Get commodity symbols
    if args.symbols:
        # Parse comma-separated symbol list
        yahoo_tickers = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
        logger.info(f"Downloading {len(yahoo_tickers)} specific commodities: {', '.join(yahoo_tickers)}")
        # Validate symbols are in expected format (*=F)
        invalid_symbols = [t for t in yahoo_tickers if not t.endswith("=F")]
        if invalid_symbols:
            logger.warning(f"Warning: Some symbols don't match expected commodity format (*=F): {invalid_symbols}")
            # Filter out invalid symbols
            yahoo_tickers = [t for t in yahoo_tickers if t.endswith("=F")]
    else:
        commodity_symbols = get_commodity_symbols(args.category)
        # Convert to Yahoo Finance tickers (filter out None values)
        yahoo_tickers = []
        for sym in commodity_symbols:
            ticker = commodity_to_yahoo_ticker(sym)
            if ticker:
                yahoo_tickers.append(ticker)
            else:
                logger.warning(f"No Yahoo Finance ticker mapping for commodity: {sym}")
        logger.info(f"Retrieved {len(commodity_symbols)} commodity symbols for category '{args.category}'")
        if not commodity_symbols:
            logger.error(f"No commodities found for category: {args.category}")
            logger.error(f"Available categories: Precious_Metals, Energy, Agricultural, Industrial_Metals, Livestock, All")
            logger.error(f"PRECIOUS_METALS has {len(PRECIOUS_METALS) if 'PRECIOUS_METALS' in globals() else 0} items")
            sys.exit(1)
    
    if not yahoo_tickers:
        logger.error("No valid Yahoo Finance tickers found for commodities")
        sys.exit(1)
    
    # Date range: default = last ~3 years
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=3*365)).isoformat()

    logger.info(f"Tickers to download (RAW only): {len(yahoo_tickers)} (category={args.category})")
    logger.info(f"Date range: {start_date} -> {end_date}")

    # Ensure raw/commodities directory exists
    commodities_raw_dir = RAW_DIR / "commodities"
    commodities_raw_dir.mkdir(parents=True, exist_ok=True)

    # Create downloader with commodities-specific raw directory
    class CommoditiesDownloader(RawDownloader):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.raw_dir = commodities_raw_dir

    # Download RAW
    dl = CommoditiesDownloader(
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
        summary_path = BASE_DIR / "commodities_download_summary.json"
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print("\n" + "="*70)
        print("[SUMMARY] COMMODITIES RAW DOWNLOAD SUMMARY")
        print("="*70)
        print(f"[OK] Symbols downloaded (RAW): {len(all_raw)}")
        print(f"[DATE] Date range: {start_date} -> {end_date}")
        print(f"[FOLDER] Raw folder: {commodities_raw_dir}")
        print(f"[FILE] Summary:   {summary_path.name}")
        n = len(list(commodities_raw_dir.glob('*.csv')))
        print(f"  {commodities_raw_dir}: {n} file(s)")
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

