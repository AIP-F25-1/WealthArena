#!/usr/bin/env python3
"""
Check processed symbols in database and identify missing non-ASX symbols.

This utility script helps users:
1. View processed symbols by asset class
2. Identify missing non-ASX symbols (crypto, forex, commodities, ETFs)
3. Download and process missing symbols only
4. Get instructions to resume from Phase 4
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple
from datetime import datetime

import pandas as pd
from dotenv import load_dotenv

from dbConnection import get_conn
from export_to_rl_training import detect_asset_class

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("check_symbols")

BASE_DIR = Path(__file__).resolve().parent

def get_processed_symbols(conn) -> Dict[str, List[str]]:
    """Get all processed symbols grouped by asset class."""
    query = """
    SELECT 
        symbol,
        COUNT(*) as row_count,
        MIN(date_utc) as min_date,
        MAX(date_utc) as max_date
    FROM dbo.processed_prices
    GROUP BY symbol
    ORDER BY symbol
    """
    
    df = pd.read_sql(query, conn)
    
    # Group by asset class
    symbols_by_class: Dict[str, List[Tuple[str, int, str, str]]] = {
        "stocks": [],
        "crypto": [],
        "forex": [],
        "commodities": [],
        "etfs": []
    }
    
    for _, row in df.iterrows():
        symbol = row["symbol"]
        row_count = row["row_count"]
        min_date = row["min_date"]
        max_date = row["max_date"]
        
        asset_class = detect_asset_class(symbol)
        symbols_by_class[asset_class].append((symbol, row_count, min_date, max_date))
    
    # Convert to simple list format for easier handling
    result = {}
    for asset_class, items in symbols_by_class.items():
        result[asset_class] = [item[0] for item in items]
    
    return result

def get_expected_symbols() -> Dict[str, Set[str]]:
    """Load expected symbols from reference files."""
    expected = {
        "crypto": set(),
        "forex": set(),
        "commodities": set(),
        "etfs": set()
    }
    
    # Load crypto symbols
    try:
        from crypto_market_data_adls import crypto_to_yahoo_ticker, get_crypto_symbols
        crypto_symbols = get_crypto_symbols("Major")
        for sym in crypto_symbols:
            yahoo_ticker = crypto_to_yahoo_ticker(sym)
            if yahoo_ticker:
                expected["crypto"].add(yahoo_ticker)
    except Exception as e:
        logger.warning(f"Could not load crypto symbols: {e}")
    
    # Load forex symbols
    try:
        from forex_market_data_adls import forex_to_yahoo_ticker, get_forex_symbols
        forex_pairs = get_forex_symbols("Major")
        for pair in forex_pairs:
            yahoo_ticker = forex_to_yahoo_ticker(pair)
            if yahoo_ticker:
                expected["forex"].add(yahoo_ticker)
    except Exception as e:
        logger.warning(f"Could not load forex symbols: {e}")
    
    # Load commodities symbols
    try:
        from commodities_market_data_adls import commodity_to_yahoo_ticker, get_commodity_symbols
        commodity_symbols = get_commodity_symbols("All")
        for sym in commodity_symbols:
            yahoo_ticker = commodity_to_yahoo_ticker(sym)
            if yahoo_ticker:
                expected["commodities"].add(yahoo_ticker)
    except Exception as e:
        logger.warning(f"Could not load commodity symbols: {e}")
    
    # Load ETF symbols - prefer reading from etf_download_summary.json if present
    etf_summary_path = BASE_DIR / "etf_download_summary.json"
    if etf_summary_path.exists():
        try:
            with open(etf_summary_path, 'r', encoding='utf-8') as f:
                etf_summary = json.load(f)
                if isinstance(etf_summary, dict) and 'symbols' in etf_summary:
                    etf_symbols = etf_summary['symbols']
                    for etf in etf_symbols:
                        expected["etfs"].add(str(etf).upper())
                    logger.info(f"Loaded {len(etf_symbols)} ETF symbols from etf_download_summary.json")
        except Exception as e:
            logger.warning(f"Could not load ETF symbols from etf_download_summary.json: {e}")
            # Fall back to small curated subset
            curated_etfs = ["SPY", "QQQ", "IVV"]  # Historically used 3 ETFs
            for etf in curated_etfs:
                expected["etfs"].add(etf.upper())
            logger.info(f"Using curated ETF subset: {curated_etfs}")
    else:
        # Check for mvp_mode.etf_limit from automation_config.yaml
        config_path = BASE_DIR.parent / "automation_config.yaml"
        if not config_path.exists():
            config_path = BASE_DIR.parent / "automation_config.example.yaml"
        
        etf_limit = None
        if config_path.exists():
            try:
                import yaml
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f)
                    if config and 'mvp_mode' in config:
                        mvp_config = config['mvp_mode']
                        if isinstance(mvp_config, dict) and 'etf_limit' in mvp_config:
                            etf_limit = mvp_config['etf_limit']
            except Exception as e:
                logger.warning(f"Could not load ETF limit from config: {e}")
        
        if etf_limit and isinstance(etf_limit, int) and etf_limit > 0:
            # Use limited subset from MAJOR_GLOBAL_ETFS
            try:
                from etf_market_data_adls import MAJOR_GLOBAL_ETFS
                limited_etfs = MAJOR_GLOBAL_ETFS[:etf_limit]
                for etf in limited_etfs:
                    expected["etfs"].add(etf.upper())
                logger.info(f"Using limited ETF list: {len(limited_etfs)} symbols (limit: {etf_limit})")
            except Exception as e:
                logger.warning(f"Could not load limited ETF symbols: {e}")
                # Fall back to small curated subset
                curated_etfs = ["SPY", "QQQ", "IVV"]
                for etf in curated_etfs:
                    expected["etfs"].add(etf.upper())
                logger.info(f"Using curated ETF subset: {curated_etfs}")
        else:
            # Default to small curated subset
            curated_etfs = ["SPY", "QQQ", "IVV"]  # Historically used 3 ETFs
            for etf in curated_etfs:
                expected["etfs"].add(etf.upper())
            logger.info(f"Using curated ETF subset: {curated_etfs}")
    
    return expected

def find_missing_symbols(processed: Dict[str, List[str]], expected: Dict[str, Set[str]]) -> Dict[str, List[str]]:
    """Find missing non-ASX symbols."""
    missing = {}
    
    for asset_class in ["crypto", "forex", "commodities", "etfs"]:
        processed_set = set(s.upper() for s in processed.get(asset_class, []))
        expected_set = expected.get(asset_class, set())
        
        missing_list = sorted(list(expected_set - processed_set))
        if missing_list:
            missing[asset_class] = missing_list
    
    return missing

def display_summary(processed: Dict[str, List[str]], missing: Dict[str, List[str]], 
                    row_counts: Dict[str, int] = None):
    """Display processed symbols summary."""
    print("\n" + "="*70)
    print(" " * 18 + "PROCESSED SYMBOLS SUMMARY")
    print("="*70 + "\n")
    
    asset_class_names = {
        "stocks": "STOCKS (ASX)",
        "crypto": "CRYPTO",
        "forex": "FOREX",
        "commodities": "COMMODITIES",
        "etfs": "ETFS"
    }
    
    for asset_class in ["stocks", "crypto", "forex", "commodities", "etfs"]:
        symbols = processed.get(asset_class, [])
        count = len(symbols)
        name = asset_class_names[asset_class]
        
        if count > 0:
            print(f"{name}: {count} symbols processed")
            
            # Show first 30 symbols
            display_symbols = sorted(symbols)[:30]
            if len(display_symbols) == count:
                print(f"  All: {', '.join(display_symbols)}")
            else:
                print(f"  First 30: {', '.join(display_symbols)}, ...")
            
            # Show missing if any
            if asset_class in missing:
                missing_list = missing[asset_class]
                print(f"  Missing: {', '.join(missing_list)} ({len(missing_list)} symbols)")
            else:
                print(f"  Missing: None ✓")
        else:
            print(f"{name}: 0 symbols processed")
            if asset_class in missing:
                missing_list = missing[asset_class]
                print(f"  Missing: {', '.join(missing_list)} ({len(missing_list)} symbols)")
            else:
                print(f"  Missing: All expected symbols")
        
        print()
    
    print("="*70)

def download_missing_symbols(missing: Dict[str, List[str]], start_date: str, end_date: str):
    """Download missing symbols using appropriate downloader scripts."""
    import subprocess
    from pathlib import Path
    
    python_cmd = "python"
    if sys.executable:
        python_cmd = sys.executable
    
    total_downloaded = 0
    
    # Download crypto
    if "crypto" in missing and missing["crypto"]:
        logger.info(f"Downloading {len(missing['crypto'])} missing crypto symbols...")
        symbols_str = ",".join(missing["crypto"])
        cmd = [python_cmd, "crypto_market_data_adls.py", 
               "--symbols", symbols_str,
               "--start-date", start_date,
               "--end-date", end_date]
        result = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True)
        if result.returncode == 0:
            total_downloaded += len(missing["crypto"])
            logger.info("✓ Crypto symbols downloaded")
        else:
            logger.error(f"Failed to download crypto symbols: {result.stderr}")
    
    # Download forex
    if "forex" in missing and missing["forex"]:
        logger.info(f"Downloading {len(missing['forex'])} missing forex pairs...")
        symbols_str = ",".join(missing["forex"])
        cmd = [python_cmd, "forex_market_data_adls.py",
               "--symbols", symbols_str,
               "--start-date", start_date,
               "--end-date", end_date]
        result = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True)
        if result.returncode == 0:
            total_downloaded += len(missing["forex"])
            logger.info("✓ Forex pairs downloaded")
        else:
            logger.error(f"Failed to download forex pairs: {result.stderr}")
    
    # Download commodities
    if "commodities" in missing and missing["commodities"]:
        logger.info(f"Downloading {len(missing['commodities'])} missing commodities...")
        symbols_str = ",".join(missing["commodities"])
        cmd = [python_cmd, "commodities_market_data_adls.py",
               "--symbols", symbols_str,
               "--start-date", start_date,
               "--end-date", end_date]
        result = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True)
        if result.returncode == 0:
            total_downloaded += len(missing["commodities"])
            logger.info("✓ Commodities downloaded")
        else:
            logger.error(f"Failed to download commodities: {result.stderr}")
    
    # Download ETFs
    if "etfs" in missing and missing["etfs"]:
        logger.info(f"Downloading {len(missing['etfs'])} missing ETFs...")
        symbols_str = ",".join(missing["etfs"])
        cmd = [python_cmd, "etf_market_data_adls.py",
               "--symbols", symbols_str,
               "--start-date", start_date,
               "--end-date", end_date]
        result = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True)
        if result.returncode == 0:
            total_downloaded += len(missing["etfs"])
            logger.info("✓ ETFs downloaded")
        else:
            logger.error(f"Failed to download ETFs: {result.stderr}")
    
    return total_downloaded

def process_missing_symbols(missing: Dict[str, List[str]]):
    """Process only the missing symbols."""
    import subprocess
    from pathlib import Path
    
    python_cmd = "python"
    if sys.executable:
        python_cmd = sys.executable
    
    # Collect all missing symbols
    all_missing = []
    for asset_class in ["crypto", "forex", "commodities", "etfs"]:
        if asset_class in missing:
            all_missing.extend(missing[asset_class])
    
    if not all_missing:
        logger.info("No missing symbols to process")
        return
    
    logger.info(f"Processing {len(all_missing)} missing symbols...")
    symbols_str = ",".join(all_missing)
    cmd = [python_cmd, "processAndStore.py", "--symbols", symbols_str]
    result = subprocess.run(cmd, cwd=BASE_DIR, capture_output=True, text=True)
    
    if result.returncode == 0:
        logger.info(f"✓ Processed {len(all_missing)} symbols")
    else:
        logger.error(f"Failed to process symbols: {result.stderr}")

def export_symbol_list(processed: Dict[str, List[str]], output_file: Path):
    """Export processed symbols list to JSON file."""
    data = {
        "timestamp": datetime.now().isoformat(),
        "symbols_by_class": processed,
        "total_symbols": sum(len(symbols) for symbols in processed.values())
    }
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Exported symbol list to {output_file}")

def main():
    parser = argparse.ArgumentParser(
        description="Check processed symbols in database and identify missing non-ASX symbols"
    )
    parser.add_argument("--download", action="store_true",
                        help="Download missing non-ASX symbols")
    parser.add_argument("--process", action="store_true",
                        help="Process downloaded missing symbols")
    parser.add_argument("--start-date", default="2022-01-01",
                        help="Start date for downloading (YYYY-MM-DD)")
    parser.add_argument("--end-date", default=None,
                        help="End date for downloading (YYYY-MM-DD, default: today)")
    parser.add_argument("--export", type=str, default=None,
                        help="Export processed symbols to JSON file")
    parser.add_argument("--show-details", action="store_true",
                        help="Show detailed row counts per symbol")
    args = parser.parse_args()
    
    # Set default end date to today
    if not args.end_date:
        from datetime import date
        args.end_date = date.today().isoformat()
    
    # Load environment
    load_dotenv(BASE_DIR / "sqlDB.env")
    
    # Connect to database
    logger.info("Connecting to Azure SQL Database...")
    try:
        conn = get_conn()
        
        # Verify connection
        cursor = conn.cursor()
        cursor.execute("SELECT DB_NAME();")
        db_name = cursor.fetchone()[0]
        logger.info(f"✅ Connected to: {db_name}")
        
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        sys.exit(1)
    
    # Get processed symbols
    logger.info("Querying processed symbols from database...")
    try:
        processed = get_processed_symbols(conn)
        total_processed = sum(len(symbols) for symbols in processed.values())
        logger.info(f"✅ Found {total_processed} processed symbols")
    except Exception as e:
        logger.error(f"❌ Failed to query symbols: {e}")
        conn.close()
        sys.exit(1)
    
    # Get expected symbols
    logger.info("Loading expected non-ASX symbols...")
    expected = get_expected_symbols()
    
    # Find missing symbols
    missing = find_missing_symbols(processed, expected)
    total_missing = sum(len(symbols) for symbols in missing.values())
    
    # Display summary
    display_summary(processed, missing)
    
    # Export symbol list if requested
    if args.export:
        export_symbol_list(processed, Path(args.export))
    
    # Download missing symbols if requested
    if args.download and total_missing > 0:
        print("\n" + "="*70)
        print(" " * 20 + "DOWNLOADING MISSING SYMBOLS")
        print("="*70 + "\n")
        
        downloaded = download_missing_symbols(missing, args.start_date, args.end_date)
        if downloaded > 0:
            logger.info(f"✅ Downloaded {downloaded} missing symbols")
            
            # Process if requested
            if args.process:
                print("\n" + "="*70)
                print(" " * 22 + "PROCESSING MISSING SYMBOLS")
                print("="*70 + "\n")
                process_missing_symbols(missing)
        else:
            logger.warning("No symbols were downloaded")
    elif args.download and total_missing == 0:
        logger.info("✅ All non-ASX symbols are already processed")
    
    # Show action required message
    if total_missing > 0:
        print("\n" + "="*70)
        print(" " * 24 + "ACTION REQUIRED")
        print("="*70)
        print(f"\n✓ Download and process {total_missing} missing non-ASX symbols")
        print(f"✓ Skip remaining ASX stocks (not needed for MVP)")
        print(f"✓ Continue to Phase 4 (Export to RL Training)")
        print(f"\nRun this script with --download --process flags to fetch missing symbols.")
        print(f"Then stop Phase 3 and run: ./master_automation.ps1 -StartFromPhase 4")
    else:
        print("\n" + "="*70)
        print(" " * 22 + "READY FOR PHASE 4")
        print("="*70)
        print(f"\n✅ All non-ASX symbols are processed")
        print(f"✅ {total_processed} total symbols ready for export")
        print(f"\nYou can now:")
        print(f"  1. Stop Phase 3 (Ctrl+C if running)")
        print(f"  2. Run: ./master_automation.ps1 -StartFromPhase 4")
        print(f"\nThis will skip remaining ASX stocks and proceed with available data.")
    
    print()
    
    # Close connection
    try:
        conn.close()
    except:
        pass

if __name__ == "__main__":
    main()

