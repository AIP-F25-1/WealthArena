
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

# Import shared classes from ASX downloader
from asx_market_data_adls import (
    ADLSGen2Sink,
    RawDownloader,
    BASE_DIR,
    LOG_DIR,
    DATA_DIR,
    RAW_DIR,
    REFERENCE_DIR,
    logger,
    AZURE_UPLOAD,
    AZURE_CONN_STR,
    AZURE_FS,
    AZURE_PREFIX_DEFAULT,
    AZURE_CLEAN_FIRST,
    download_asx_companies_csv,
    _classify_from_name
)

# ----------------------------
# Major Global ETFs
# ----------------------------

MAJOR_GLOBAL_ETFS = [
    'SPY',    # SPDR S&P 500 ETF
    'QQQ',    # Invesco QQQ (Nasdaq-100)
    'IWM',    # iShares Russell 2000 ETF
    'VTI',    # Vanguard Total Stock Market ETF
    'VOO',    # Vanguard S&P 500 ETF
    'VEA',    # Vanguard FTSE Developed Markets ETF
    'VWO',    # Vanguard FTSE Emerging Markets ETF
    'AGG',    # iShares Core U.S. Aggregate Bond ETF
    'BND',    # Vanguard Total Bond Market ETF
    'GLD',    # SPDR Gold Shares
    'SLV',    # iShares Silver Trust
    'USO',    # United States Oil Fund
    'TLT',    # iShares 20+ Year Treasury Bond ETF
    'EEM',    # iShares MSCI Emerging Markets ETF
    'XLF',    # Financial Select Sector SPDR Fund
    'XLE',    # Energy Select Sector SPDR Fund
    'XLK',    # Technology Select Sector SPDR Fund
    'XLV',    # Health Care Select Sector SPDR Fund
    'XLI',    # Industrial Select Sector SPDR Fund
    'XLP',    # Consumer Staples Select Sector SPDR Fund
    'XLY',    # Consumer Discretionary Select Sector SPDR Fund
    'XLB',    # Materials Select Sector SPDR Fund
    'XLU',    # Utilities Select Sector SPDR Fund
    'XLC',    # Communication Services Select Sector SPDR Fund
    'XRE',    # Real Estate Select Sector SPDR Fund
    'DIA',    # SPDR Dow Jones Industrial Average ETF
    'EFA',    # iShares MSCI EAFE ETF
    'IEMG',   # iShares Core MSCI Emerging Markets ETF
    'IJH',    # iShares Core S&P Mid-Cap ETF
    'IJR',    # iShares Core S&P Small-Cap ETF
    'IEFA',   # iShares Core MSCI EAFE ETF
    'IVV',    # iShares Core S&P 500 ETF
    'VGK',    # Vanguard FTSE Europe ETF
    'VPL',    # Vanguard FTSE Pacific ETF
    'VNQ',    # Vanguard Real Estate ETF
    'VXF',    # Vanguard Extended Market ETF
    'VBR',    # Vanguard Small-Cap Value ETF
    'VBK',    # Vanguard Small-Cap Growth ETF
    'VTV',    # Vanguard Value ETF
    'VUG',    # Vanguard Growth ETF
    'VXUS',   # Vanguard Total International Stock ETF
    'VYM',    # Vanguard High Dividend Yield ETF
    'VO',     # Vanguard Mid-Cap ETF
    'VGT',    # Vanguard Information Technology ETF
    'VFH',    # Vanguard Financials ETF
    'VDE',    # Vanguard Energy ETF
    'VHT',    # Vanguard Health Care ETF
    'VCR',    # Vanguard Consumer Discretionary ETF
    'VIG',    # Vanguard Dividend Appreciation ETF
    'VNQI',   # Vanguard Global ex-U.S. Real Estate ETF
    'BIV',    # Vanguard Intermediate-Term Bond ETF
    'BSV',    # Vanguard Short-Term Bond ETF
    'BLV',    # Vanguard Long-Term Bond ETF
    'SHY',    # iShares 1-3 Year Treasury Bond ETF
    'IEI',    # iShares 3-7 Year Treasury Bond ETF
    'IEF',    # iShares 7-10 Year Treasury Bond ETF
    'LQD',    # iShares iBoxx $ Investment Grade Corporate Bond ETF
    'HYG',    # iShares iBoxx $ High Yield Corporate Bond ETF
    'TIP',    # iShares TIPS Bond ETF
    'MUB',    # iShares National Muni Bond ETF
    'BNDX',   # Vanguard Total International Bond ETF
    'BNDW',   # Vanguard Total World Bond ETF
    'EMB',    # iShares J.P. Morgan USD Emerging Markets Bond ETF
    'JNK',    # SPDR Bloomberg High Yield Bond ETF
    'SCHX',   # Schwab U.S. Large-Cap ETF
    'SCHM',   # Schwab U.S. Mid-Cap ETF
    'SCHA',   # Schwab U.S. Small-Cap ETF
    'SCHF',   # Schwab International Equity ETF
    'SCHE',   # Schwab Emerging Markets Equity ETF
    'SCHO',   # Schwab Short-Term U.S. Treasury ETF
    'SCHR',   # Schwab Intermediate-Term U.S. Treasury ETF
    'SCHQ',   # Schwab Long-Term U.S. Treasury ETF
    'SCHZ',   # Schwab U.S. Aggregate Bond ETF
    'SCHB',   # Schwab U.S. Broad Market ETF
    'SCHY',   # Schwab International Dividend Equity ETF
    'SCHD',   # Schwab U.S. Dividend Equity ETF
    'SCHG',   # Schwab U.S. Large-Cap Growth ETF
    'SCHV',   # Schwab U.S. Large-Cap Value ETF
]

# ----------------------------
# ETF Symbol Collection
# ----------------------------

def get_asx_etf_symbols() -> List[str]:
    """Extract ASX ETF symbols from ASX company list."""
    ref_path = REFERENCE_DIR / "asx_companies.csv"
    
    # Download if not exists
    if not ref_path.exists():
        logger.info("ASX company list not found, downloading...")
        download_asx_companies_csv(ref_path)
    
    try:
        df = pd.read_csv(ref_path)
        # Filter for ETFs
        etf_df = df.loc[df.get("security_type", pd.Series([""] * len(df))).eq("ETF")].copy()
        tickers = etf_df.get("ticker_yf", pd.Series([])).dropna().drop_duplicates().tolist()
        return tickers
    except Exception as e:
        logger.warning(f"Failed to extract ASX ETFs: {e}")
        return []

def get_all_etf_symbols(asx_only: bool = False, global_only: bool = False) -> List[str]:
    """Get all ETF symbols (ASX + Global)."""
    all_symbols = []
    
    if not global_only:
        asx_etfs = get_asx_etf_symbols()
        all_symbols.extend(asx_etfs)
    
    if not asx_only:
        all_symbols.extend(MAJOR_GLOBAL_ETFS)
    
    # Remove duplicates and sort
    return sorted(list(set(all_symbols)))

# ----------------------------
# Main
# ----------------------------

def main():
    import argparse
    import yaml
    from pathlib import Path

    parser = argparse.ArgumentParser(description="ETF RAW downloader with ADLS Gen2 upload")
    parser.add_argument("--asx-only", action="store_true", help="Download only ASX ETFs")
    parser.add_argument("--global-only", action="store_true", help="Download only global ETFs")
    parser.add_argument("--symbols", type=str, default=None,
                        help="Download specific ETFs only (comma-separated, e.g., SPY,QQQ,IVV)")
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: today-3y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--sleep-between", type=float, default=1.0)
    parser.add_argument("--azure-prefix", default="etfs",
                        help="Directory/prefix inside filesystem for uploads (default: etfs)")
    parser.add_argument("--clean-remote-first", action="store_true",
                        help="Delete existing remote files with same name before upload")
    parser.add_argument("--etf-limit", type=int, default=None,
                        help="Limit number of ETFs to download (for MVP mode)")
    args = parser.parse_args()

    # Get ETF symbols
    if args.symbols:
        # Parse comma-separated symbol list
        etf_symbols = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
        logger.info(f"Downloading {len(etf_symbols)} specific ETFs: {', '.join(etf_symbols)}")
        # Check if provided symbols are in the known ETF list (warn but continue)
        known_etfs = set(MAJOR_GLOBAL_ETFS)
        unknown_symbols = [s for s in etf_symbols if s not in known_etfs]
        if unknown_symbols:
            logger.warning(f"Warning: Some symbols are not in known ETF list: {unknown_symbols}")
            logger.warning("Proceeding with all provided symbols (user may know additional ETFs)")
    else:
        etf_symbols = get_all_etf_symbols(asx_only=args.asx_only, global_only=args.global_only)
        
        # Apply ETF limit if provided or if MVP mode is enabled
        etf_limit = args.etf_limit
        if not etf_limit:
            # Check automation_config.yaml for MVP mode and ETF limit
            config_path = BASE_DIR.parent / "automation_config.yaml"
            if not config_path.exists():
                config_path = BASE_DIR.parent / "automation_config.example.yaml"
            
            if config_path.exists():
                try:
                    with open(config_path, 'r', encoding='utf-8') as f:
                        config = yaml.safe_load(f)
                        if config and 'mvp_mode' in config:
                            mvp_config = config['mvp_mode']
                            if isinstance(mvp_config, dict) and mvp_config.get('enabled'):
                                etf_limit = mvp_config.get('etf_limit', 3)  # Default to 3 for MVP
                                logger.info(f"MVP mode enabled, limiting ETFs to {etf_limit}")
                except Exception as e:
                    logger.warning(f"Could not load ETF limit from config: {e}")
        
        if etf_limit and etf_limit > 0:
            # Use small curated default list for MVP (historically used 3)
            if etf_limit <= 3:
                curated_etfs = ["SPY", "QQQ", "IVV"]  # Small curated subset
                etf_symbols = [etf for etf in etf_symbols if etf in curated_etfs]
                logger.info(f"Using curated ETF subset for MVP: {curated_etfs[:etf_limit]}")
            else:
                # Limit to first N ETFs from the list
                original_count = len(etf_symbols)
                etf_symbols = etf_symbols[:etf_limit]
                logger.info(f"Limited ETFs from {original_count} to {len(etf_symbols)} (MVP limit: {etf_limit})")
    
    if not etf_symbols:
        logger.error("No ETF symbols found.")
        sys.exit(1)
    
    # Date range: default = last ~3 years
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=3*365)).isoformat()

    logger.info(f"Tickers to download (RAW only): {len(etf_symbols)} (ASX-only={args.asx_only}, Global-only={args.global_only})")
    logger.info(f"Date range: {start_date} -> {end_date}")

    # Ensure raw/etfs directory exists
    etfs_raw_dir = RAW_DIR / "etfs"
    etfs_raw_dir.mkdir(parents=True, exist_ok=True)

    # Create downloader with ETFs-specific raw directory
    class ETFDownloader(RawDownloader):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.raw_dir = etfs_raw_dir

    # Download RAW
    dl = ETFDownloader(
        symbols=etf_symbols,
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
            logger.error("No RAW ETF data available (downloaded or existing).")
            sys.exit(1)

        summary = {
            "download_date": datetime.now().isoformat(),
            "num_symbols": len(all_raw),
            "asx_only": args.asx_only,
            "global_only": args.global_only,
            "date_range": {"start": start_date, "end": end_date},
            "symbols": sorted(all_raw.keys()),
        }
        summary_path = BASE_DIR / "etf_download_summary.json"
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print("\n" + "="*70)
        print("[SUMMARY] ETF RAW DOWNLOAD SUMMARY")
        print("="*70)
        print(f"[OK] Symbols downloaded (RAW): {len(all_raw)}")
        print(f"[DATE] Date range: {start_date} -> {end_date}")
        print(f"[FOLDER] Raw folder: {etfs_raw_dir}")
        print(f"[FILE] Summary:   {summary_path.name}")
        n = len(list(etfs_raw_dir.glob('*.csv')))
        print(f"  {etfs_raw_dir}: {n} file(s)")
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

