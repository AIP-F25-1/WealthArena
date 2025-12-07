#!/usr/bin/env python3
"""
WealthArena - Daily Market Data Refresh
Downloads latest market data (last 7 days) for all asset classes and uploads to ADLS Gen2.
"""

import os
import sys
import json
import logging
import warnings
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime, timedelta

# Add Financial_Assets_Pipeline to path
pipeline_dir = Path(__file__).parent.parent.parent / "Financial_Assets_Pipeline"
sys.path.insert(0, str(pipeline_dir))

# Import existing classes
from asx_market_data_adls import RawDownloader, ADLSGen2Sink, download_asx_companies_csv

# Import symbol lists
wealtharena_rl_dir = Path(__file__).parent.parent.parent / "WealthArena_RL"

# Default symbol lists (used if import fails)
DEFAULT_CRYPTOCURRENCIES = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'AVAX', 'LINK', 'UNI', 'ATOM', 'MATIC', 'ALGO', 'VET', 'FIL', 'TRX', 'ETC', 'LTC', 'BCH', 'XLM', 'AAVE']
DEFAULT_CURRENCY_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURJPY', 'GBPJPY', 'EURGBP', 'AUDNZD', 'EURAUD']

if wealtharena_rl_dir.exists():
    sys.path.insert(0, str(wealtharena_rl_dir))
    try:
        from src.data.crypto.cryptocurrencies import MAJOR_CRYPTOCURRENCIES
        from src.data.currencies.currency_pairs import MAJOR_PAIRS
    except ImportError:
        print("[WARN] Could not import symbol lists from WealthArena_RL, using default lists")
        MAJOR_CRYPTOCURRENCIES = DEFAULT_CRYPTOCURRENCIES
        MAJOR_PAIRS = DEFAULT_CURRENCY_PAIRS
else:
    MAJOR_CRYPTOCURRENCIES = DEFAULT_CRYPTOCURRENCIES
    MAJOR_PAIRS = DEFAULT_CURRENCY_PAIRS

warnings.filterwarnings("ignore")

# =========================== Configuration ===========================

BASE_DIR = Path(__file__).parent.parent.parent
SCRIPT_DIR = Path(__file__).parent
LOG_DIR = SCRIPT_DIR / "logs"

# Load environment variables
env_path = BASE_DIR / "Financial_Assets_Pipeline" / "azureCred.env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

env_path = BASE_DIR / "Financial_Assets_Pipeline" / "sqlDB.env"
if env_path.exists():
    load_dotenv(env_path)

AZURE_UPLOAD = os.getenv("AZURE_UPLOAD", "true").strip().lower() in {"1", "true", "yes"}
AZURE_CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
AZURE_FS = os.getenv("AZURE_STORAGE_FILESYSTEM", "raw").strip()

# =========================== Logging Setup ===========================

LOG_DIR.mkdir(parents=True, exist_ok=True)
log_filename = f"01_market_data_refresh_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
log_file = LOG_DIR / log_filename

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("daily_market_refresh")
logging.getLogger("azure").setLevel(logging.WARNING)
logging.getLogger("azure.storage").setLevel(logging.WARNING)
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.ERROR)

# =========================== Symbol Lists ===========================

def get_asx_stocks() -> List[str]:
    """Get ASX stock symbols (Equity and ETF types)"""
    logger.info("Fetching ASX company list...")
    try:
        ref_path = BASE_DIR / "Financial_Assets_Pipeline" / "data" / "reference" / "asx_companies.csv"
        ref_path.parent.mkdir(parents=True, exist_ok=True)
        df = download_asx_companies_csv(ref_path)
        
        # Filter for Equity and ETF types
        df_filtered = df[df["security_type"].isin(["Equity", "ETF"])]
        symbols = df_filtered["ticker_yf"].dropna().drop_duplicates().tolist()
        logger.info(f"Found {len(symbols)} ASX symbols (Equity + ETF)")
        return symbols
    except Exception as e:
        logger.error(f"Failed to fetch ASX list: {e}")
        return []

def get_crypto_symbols() -> List[str]:
    """Get cryptocurrency symbols in Yahoo format"""
    if not MAJOR_CRYPTOCURRENCIES:
        return []
    
    # Map to Yahoo format (e.g., BTC -> BTC-USD)
    symbols = [f"{sym}-USD" for sym in MAJOR_CRYPTOCURRENCIES]
    logger.info(f"Found {len(symbols)} crypto symbols")
    return symbols

def get_forex_symbols() -> List[str]:
    """Get forex pair symbols in Yahoo format"""
    if not MAJOR_PAIRS:
        return []
    
    # Map to Yahoo format (e.g., EURUSD -> EURUSD=X)
    symbols = [f"{pair}=X" for pair in MAJOR_PAIRS]
    logger.info(f"Found {len(symbols)} forex symbols")
    return symbols

def get_commodity_symbols() -> List[str]:
    """Get commodity futures symbols"""
    commodities = [
        "GC=F",   # Gold
        "SI=F",   # Silver
        "CL=F",   # Crude Oil
        "NG=F",   # Natural Gas
        "HG=F",   # Copper
        "ZC=F",   # Corn
        "ZS=F",   # Soybean
        "ZW=F",   # Wheat
        "KC=F",   # Coffee
        "CT=F",   # Cotton
        "SB=F",   # Sugar
        "LB=F",   # Lumber
        "PA=F",   # Palladium
        "PL=F",   # Platinum
        "HO=F",   # Heating Oil
        "RB=F",   # Gasoline
        "ZB=F"    # T-Bond
    ]
    logger.info(f"Found {len(commodities)} commodity symbols")
    return commodities

def get_etf_symbols() -> List[str]:
    """Get ETF symbols (global major ETFs)"""
    etfs = [
        # US ETFs
        "SPY", "QQQ", "IWM", "DIA", "VTI", "VEU", "EFA", "IEFA",
        "IVV", "ITOT", "IWF", "IWD", "IJH", "IJR", "IJJ", "IJS",
        # Sector ETFs
        "XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLB",
        "XLU", "XME", "XRT", "XHB", "XPH",
        # International ETFs
        "EWJ", "EWZ", "EWU", "EWG", "EWY", "EWC", "EEM",
        "VGK", "VPL", "VGK", "VWO",
        # ASX ETFs (from ASX list if available)
    ]
    
    # Try to get ASX ETFs
    try:
        ref_path = BASE_DIR / "Financial_Assets_Pipeline" / "data" / "reference" / "asx_companies.csv"
        if ref_path.exists():
            from asx_market_data_adls import download_asx_companies_csv
            df = download_asx_companies_csv(ref_path)
            asx_etfs = df[df["security_type"] == "ETF"]["ticker_yf"].dropna().tolist()
            etfs.extend(asx_etfs)
    except Exception as e:
        logger.warning(f"Could not fetch ASX ETFs: {e}")
    
    # Remove duplicates
    etfs = list(dict.fromkeys(etfs))
    logger.info(f"Found {len(etfs)} ETF symbols")
    return etfs

# =========================== Download Logic ===========================

def download_asset_class(asset_class: str, symbols: List[str], prefix: str, 
                         start_date: str, end_date: str) -> Dict[str, Any]:
    """Download data for one asset class with retry logic"""
    if not symbols:
        logger.warning(f"No symbols for {asset_class}")
        return {"success": 0, "failed": [], "failed_count": 0}
    
    logger.info(f"Downloading {asset_class}: {len(symbols)} symbols")
    
    # Initialize downloader
    downloader = RawDownloader(
        symbols=symbols,
        start_date=start_date,
        end_date=end_date,
        batch_size=50,
        sleep_between=1.0,
        adls_prefix=prefix,
        clean_remote_first=False  # Append mode
    )
    
    # Run download
    try:
        all_raw = downloader.run()
        success_count = len(all_raw)
        failed_symbols = [s for s in symbols if s not in all_raw]
        failed_count = len(failed_symbols)
        
        logger.info(f"✅ {asset_class}: {success_count}/{len(symbols)} downloaded")
        
        # Retry failed symbols once
        if failed_symbols:
            logger.info(f"Retrying {len(failed_symbols)} failed symbols for {asset_class}")
            retry_downloader = RawDownloader(
                symbols=failed_symbols,
                start_date=start_date,
                end_date=end_date,
                batch_size=50,
                sleep_between=1.0,
                adls_prefix=prefix,
                clean_remote_first=False
            )
            retry_raw = retry_downloader.run()
            success_count += len(retry_raw)
            still_failed = [s for s in failed_symbols if s not in retry_raw]
            failed_count = len(still_failed)
            
            if still_failed != failed_symbols:
                logger.info(f"Retry improved: {len(retry_raw)} additional successes")
        
        return {"success": success_count, "failed": still_failed if failed_symbols else failed_symbols, "failed_count": failed_count}
    except Exception as e:
        logger.error(f"❌ {asset_class}: Download failed: {e}")
        return {"success": 0, "failed": symbols, "failed_count": len(symbols)}

# =========================== Main Execution ===========================

def main():
    """Main execution function"""
    start_time = datetime.now()
    logger.info("=" * 70)
    logger.info("Starting daily market data refresh...")
    logger.info("=" * 70)
    
    # Calculate date range (last 7 days)
    today = datetime.now()
    end_date = today.date().isoformat()
    start_date = (today - timedelta(days=7)).date().isoformat()
    
    logger.info(f"Date range: {start_date} → {end_date}")
    logger.info("")
    
    # Define asset classes
    asset_classes = {
        "ASX Stocks": (get_asx_stocks, "asxStocks"),
        "Crypto": (get_crypto_symbols, "crypto"),
        "Forex": (get_forex_symbols, "forex"),
        "Commodities": (get_commodity_symbols, "commodities"),
        "ETFs": (get_etf_symbols, "etfs")
    }
    
    # Download data for each asset class
    results = {}
    total_success = 0
    total_failed = 0
    all_failed_symbols = []
    
    for asset_class, (get_symbols_func, prefix) in asset_classes.items():
        symbols = get_symbols_func()
        
        result = download_asset_class(
            asset_class=asset_class,
            symbols=symbols,
            prefix=prefix,
            start_date=start_date,
            end_date=end_date
        )
        
        results[asset_class] = result
        total_success += result["success"]
        total_failed += result.get("failed_count", result.get("failed", 0) if isinstance(result.get("failed"), int) else len(result.get("failed", [])))
        all_failed_symbols.extend(result.get("failed", []))
        
        logger.info("")
    
    # Calculate duration
    duration = datetime.now() - start_time
    duration_seconds = int(duration.total_seconds())
    
    # Write failed symbols to file
    if all_failed_symbols:
        failed_file = LOG_DIR / f"failed_symbols_{datetime.now().strftime('%Y%m%d')}.txt"
        failed_file.write_text("\n".join(all_failed_symbols), encoding="utf-8")
        logger.info(f"Saved {len(all_failed_symbols)} failed symbols to {failed_file.name}")
    
    # Generate summary
    summary = {
        "date": datetime.now().isoformat(),
        "date_range": {"start": start_date, "end": end_date},
        "symbols_downloaded": total_success,
        "symbols_failed": total_failed,
        "by_asset_class": {k: v["success"] for k, v in results.items()},
        "duration_seconds": duration_seconds
    }
    
    # Save summary
    summary_path = SCRIPT_DIR / "raw_download_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    
    # Print final summary
    logger.info("=" * 70)
    logger.info("📊 SUMMARY")
    logger.info("=" * 70)
    logger.info(f"Symbols downloaded: {total_success}/{total_success + total_failed}")
    logger.info(f"Duration: {duration_seconds}s")
    logger.info("")
    
    for asset_class, result in results.items():
        logger.info(f"  {asset_class}: {result['success']} symbols")
    
    logger.info("")
    logger.info("✅ Daily market data refresh completed")
    logger.info("=" * 70)
    
    # Exit with error code if failures exceed threshold
    if total_failed > total_success * 0.1:  # More than 10% failures
        logger.error(f"High failure rate detected: {total_failed} failures")
        return 1
    
    return 0

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

