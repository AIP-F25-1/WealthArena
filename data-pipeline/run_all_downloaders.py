#!/usr/bin/env python3
"""
Master orchestration script for running all asset class downloaders.
"""

import os
import sys
import subprocess
import json
import time
import yaml
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import io

BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Configure logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "orchestrator.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("orchestrator")

def load_automation_config():
    """Load automation configuration if available."""
    config_path = BASE_DIR.parent / "automation_config.yaml"
    if not config_path.exists():
        # Try example file
        config_path = BASE_DIR.parent / "automation_config.example.yaml"
    
    if config_path.exists():
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.warning(f"Could not load automation config: {e}")
    return {}

def get_mvp_config(config: Dict) -> tuple[bool, int]:
    """Get MVP mode settings from config."""
    mvp_mode = config.get('mvp_mode', {})
    enabled = mvp_mode.get('enabled', False)
    asx_limit = mvp_mode.get('asx_stock_limit', 100)
    return enabled, asx_limit

# Downloader configurations
DOWNLOADERS = [
    {
        "name": "ASX Stocks",
        "script": "asx_market_data_adls.py",
        "args": ["--start-date", "2022-01-01", "--end-date", "2025-01-01", "--batch-size", "80", "--sleep-between", "2.0"],
        "enabled": True
    },
    {
        "name": "Cryptocurrencies",
        "script": "crypto_market_data_adls.py",
        "args": ["--category", "Major", "--start-date", "2022-01-01", "--end-date", "2025-01-01", "--batch-size", "20"],
        "enabled": True
    },
    {
        "name": "Forex Pairs",
        "script": "forex_market_data_adls.py",
        "args": ["--category", "Major", "--start-date", "2022-01-01", "--end-date", "2025-01-01", "--batch-size", "10"],
        "enabled": True
    },
    {
        "name": "Commodities",
        "script": "commodities_market_data_adls.py",
        "args": ["--category", "All", "--start-date", "2022-01-01", "--end-date", "2025-01-01", "--batch-size", "10"],
        "enabled": True
    },
    {
        "name": "ETFs",
        "script": "etf_market_data_adls.py",
        "args": ["--start-date", "2022-01-01", "--end-date", "2025-01-01", "--batch-size", "20"],
        "enabled": True
    }
]

def print_header():
    """Print header banner."""
    print("\n" + "="*70)
    print(" " * 15 + "WEALTHARENA MULTI-ASSET DATA DOWNLOAD ORCHESTRATOR")
    print("="*70 + "\n")

def safe_print(text: str):
    """Print text safely, handling Unicode encoding errors on Windows."""
    try:
        print(text)
    except UnicodeEncodeError:
        # Fallback: encode to ASCII, replacing non-ASCII characters
        print(text.encode('ascii', errors='replace').decode('ascii'))

def print_summary(results: List[Dict], mvp_enabled: bool = False, asx_limit: int = 0):
    """Print execution summary."""
    # Use ASCII-safe icons for Windows console compatibility
    SUCCESS_ICON = "[OK]"
    FAIL_ICON = "[FAIL]"
    
    total_time = sum(r.get("duration", 0) for r in results)
    total_symbols = sum(r.get("symbols_downloaded", 0) for r in results)
    successful = sum(1 for r in results if r.get("status") == "success")
    failed = sum(1 for r in results if r.get("status") == "failed")
    
    safe_print("\n" + "="*70)
    safe_print(" " * 28 + "DOWNLOAD SUMMARY")
    safe_print("="*70)
    
    # Show MVP mode status if enabled
    if mvp_enabled and asx_limit > 0:
        safe_print("\n[MVP MODE ACTIVE]")
        safe_print(f"  ASX Stocks Limited: {asx_limit} of 1845 total")
        estimated_cost_savings = int((1 - (asx_limit / 1845)) * 100)
        estimated_time_savings = int((1 - (asx_limit / 1845)) * 100)
        safe_print(f"  Estimated Cost Savings: ~{estimated_cost_savings}%")
        safe_print(f"  Estimated Time Savings: ~{estimated_time_savings}%")
    safe_print(f"\n{SUCCESS_ICON} Total Execution Time: {int(total_time//60)}m {int(total_time%60)}s")
    safe_print(f"{SUCCESS_ICON} Total Symbols Downloaded: {total_symbols}")
    safe_print(f"{SUCCESS_ICON} Successful Downloads: {successful}/{len(results)}")
    safe_print(f"{FAIL_ICON} Failed Downloads: {failed}/{len(results)}")
    
    safe_print(f"\n[BREAKDOWN BY ASSET CLASS]")
    for result in results:
        status_icon = SUCCESS_ICON if result.get("status") == "success" else FAIL_ICON
        symbols = result.get("symbols_downloaded", 0)
        duration = result.get("duration", 0)
        safe_print(f"  {status_icon} {result.get('name', 'Unknown')}: {symbols} symbols ({int(duration//60)}m {int(duration%60)}s)")
    
    # Derive ADLS filesystem and account from environment variables
    azure_upload = os.getenv("AZURE_UPLOAD", "false").strip().lower() in {"1", "true", "yes"}
    azure_fs = os.getenv("AZURE_STORAGE_FILESYSTEM", "").strip()
    azure_conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
    
    # Extract account name from connection string if available
    storage_account = None
    if azure_conn_str:
        # Connection string format: DefaultEndpointsProtocol=https;AccountName=account_name;AccountKey=...;EndpointSuffix=...
        for part in azure_conn_str.split(";"):
            if part.startswith("AccountName="):
                storage_account = part.split("=", 1)[1] if "=" in part else None
                break
    
    # Only show ADLS section if upload is enabled
    if azure_upload and azure_fs:
        safe_print(f"\n[ADLS UPLOAD STATUS]")
        safe_print(f"  - Filesystem: {azure_fs}")
        safe_print(f"  - Total Files Uploaded: {total_symbols}")
        if storage_account:
            safe_print(f"  - Storage Account: {storage_account}")
        else:
            safe_print(f"  - Storage Account: (could not be determined from connection string)")
    elif azure_upload:
        # Upload enabled but filesystem not configured
        safe_print(f"\n[ADLS UPLOAD STATUS]")
        safe_print(f"  - Warning: AZURE_UPLOAD is enabled but AZURE_STORAGE_FILESYSTEM is not set")
    
    safe_print(f"\n[NEXT STEPS]")
    safe_print(f"  1. Run processAndStore.py to compute technical indicators")
    safe_print(f"  2. Verify data quality in Azure SQL Database")
    safe_print(f"  3. Export processed CSVs for RL training")
    
    if successful == len(results):
        safe_print(f"\n[SUCCESS] All downloads completed successfully!")
    else:
        safe_print(f"\n[WARNING] Some downloads failed. Check logs for details.")

def run_downloader(downloader: Dict, skip_flags: Dict, asx_limit: int = 0) -> Dict:
    """Run a single downloader and return results."""
    name = downloader["name"]
    script = downloader["script"]
    args = downloader["args"].copy()  # Make a copy to avoid modifying the original
    
    # Add --limit argument for ASX stocks in MVP mode
    if name == "ASX Stocks" and asx_limit > 0:
        args.extend(["--limit", str(asx_limit)])
        logger.info(f"Adding --limit {asx_limit} for MVP mode")
    
    # Add --etf-limit argument for ETFs in MVP mode
    if name == "ETFs":
        # Check config for MVP mode and ETF limit
        config = load_automation_config()
        mvp_mode = config.get('mvp_mode', {})
        if mvp_mode.get('enabled') and mvp_mode.get('etf_limit'):
            etf_limit = mvp_mode.get('etf_limit')
            args.extend(["--etf-limit", str(etf_limit)])
            logger.info(f"Adding --etf-limit {etf_limit} for MVP mode")
    
    # Check skip flags
    # Map names explicitly to keys (normalized)
    name_to_key_map = {
        'ASX Stocks': 'asx',
        'Cryptocurrencies': 'crypto',
        'Forex Pairs': 'forex',
        'Commodities': 'commodities',
        'ETFs': 'etfs'
    }
    
    # Map downloader names to asset class for symbol aggregation
    name_to_asset_class = {
        'ASX Stocks': 'asx',
        'Cryptocurrencies': 'crypto',
        'Forex Pairs': 'forex',
        'Commodities': 'commodities',
        'ETFs': 'etfs'
    }
    
    # Use explicit mapping if available, otherwise normalize by removing spaces/underscores
    skip_key = name_to_key_map.get(name)
    if not skip_key:
        skip_key = name.lower().replace(" ", "_").replace("pairs", "").strip("_")
    
    if skip_key in skip_flags and skip_flags[skip_key]:
        logger.info(f"Skipping {name} (--skip-{skip_key})")
        return {
            "name": name,
            "status": "skipped",
            "duration": 0,
            "symbols_downloaded": 0,
            "asset_class": name_to_asset_class.get(name, skip_key),
            "symbols": []
        }
    
    logger.info(f"Starting {name} download...")
    logger.info(f"  Script: {script}")
    logger.info(f"  Date Range: {args[args.index('--start-date')+1] if '--start-date' in args else 'N/A'} -> {args[args.index('--end-date')+1] if '--end-date' in args else 'N/A'}")
    
    script_path = BASE_DIR / script
    if not script_path.exists():
        logger.error(f"Script not found: {script_path}")
        return {
            "name": name,
            "status": "failed",
            "error": f"Script not found: {script}",
            "duration": 0,
            "symbols_downloaded": 0,
            "asset_class": name_to_asset_class.get(name, skip_key),
            "symbols": []
        }
    
    start_time = time.time()
    try:
        # Run subprocess
        cmd = [sys.executable, str(script_path)] + args
        logger.info(f"Executing: {' '.join(cmd)}")
        
        # Try UTF-8 first, fallback to error handling for Windows console encoding issues
        try:
            result = subprocess.run(
                cmd,
                cwd=str(BASE_DIR),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace"  # Replace invalid UTF-8 bytes instead of failing
            )
        except UnicodeDecodeError:
            # Fallback: use system encoding with error replacement
            result = subprocess.run(
                cmd,
                cwd=str(BASE_DIR),
                capture_output=True,
                text=True,
                encoding=sys.getdefaultencoding(),
                errors="replace"
            )
        
        duration = time.time() - start_time
        
        if result.returncode == 0:
            # Try to extract symbols downloaded from output
            symbols_downloaded = 0
            symbols = []
            
            # Try to load symbols from per-asset summary files
            asset_class = name_to_asset_class.get(name, skip_key)
            summary_files = {
                'asx': BASE_DIR / "asx_download_summary.json",
                'crypto': BASE_DIR / "crypto_download_summary.json",
                'forex': BASE_DIR / "forex_download_summary.json",
                'commodities': BASE_DIR / "commodities_download_summary.json",
                'etfs': BASE_DIR / "etf_download_summary.json"
            }
            
            if asset_class in summary_files:
                summary_path = summary_files[asset_class]
                if summary_path.exists():
                    try:
                        with open(summary_path, 'r', encoding='utf-8') as f:
                            summary_data = json.load(f)
                            if isinstance(summary_data, dict) and 'symbols' in summary_data:
                                symbols = summary_data['symbols']
                                symbols_downloaded = len(symbols)
                                logger.info(f"Loaded {len(symbols)} symbols from {summary_path.name}")
                    except Exception as e:
                        logger.warning(f"Could not load symbols from {summary_path.name}: {e}")
            
            # Fall back to parsing output if summary file doesn't exist
            if not symbols and result.stdout:
                for line in result.stdout.split("\n"):
                    if "Symbols downloaded" in line or "symbols downloaded" in line.lower():
                        # Extract number from line
                        import re
                        match = re.search(r'(\d+)', line)
                        if match:
                            symbols_downloaded = int(match.group(1))
                            break
            
            logger.info(f"[OK] {name} completed in {int(duration//60)}m {int(duration%60)}s | Downloaded: {symbols_downloaded} symbols")
            
            return {
                "name": name,
                "status": "success",
                "duration": duration,
                "symbols_downloaded": symbols_downloaded,
                "asset_class": asset_class,
                "symbols": symbols,
                "stdout": result.stdout if result.stdout else "",
                "stderr": result.stderr if result.stderr else ""
            }
        else:
            logger.error(f"[FAIL] {name} failed with return code {result.returncode}")
            
            # Safely extract error output
            error_output = ""
            if result.stderr:
                try:
                    error_output = result.stderr[:500] if len(result.stderr) > 500 else result.stderr
                except (TypeError, AttributeError):
                    error_output = str(result.stderr)[:500] if result.stderr else ""
            else:
                error_output = "No error output available"
            
            logger.error(f"Error output: {error_output}")
            
            return {
                "name": name,
                "status": "failed",
                "error": error_output,
                "duration": time.time() - start_time,
                "symbols_downloaded": 0,
                "asset_class": name_to_asset_class.get(name, skip_key),
                "symbols": [],
                "returncode": result.returncode,
                "stdout": result.stdout if result.stdout else "",
                "stderr": result.stderr if result.stderr else ""
            }
    
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"[FAIL] {name} failed with exception: {e}", exc_info=True)
        
        return {
            "name": name,
            "status": "failed",
            "error": str(e),
            "duration": duration,
            "symbols_downloaded": 0,
            "asset_class": name_to_asset_class.get(name, skip_key),
            "symbols": []
        }

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Orchestrate all asset class downloaders")
    parser.add_argument("--skip-asx", action="store_true", help="Skip ASX stocks download")
    parser.add_argument("--skip-crypto", action="store_true", help="Skip crypto download")
    parser.add_argument("--skip-forex", action="store_true", help="Skip forex download")
    parser.add_argument("--skip-commodities", action="store_true", help="Skip commodities download")
    parser.add_argument("--skip-etfs", action="store_true", help="Skip ETFs download")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be executed without running")
    parser.add_argument("--mvp-mode", action="store_true", help="Enable MVP mode (limit ASX stocks)")
    parser.add_argument("--asx-limit", type=int, default=0, help="Limit ASX stocks to top N (overrides config)")
    args = parser.parse_args()
    
    # Load configuration
    config = load_automation_config()
    mvp_enabled, asx_limit_config = get_mvp_config(config)
    
    # Use command-line overrides if provided
    if args.mvp_mode:
        mvp_enabled = True
    if args.asx_limit > 0:
        asx_limit_config = args.asx_limit
        mvp_enabled = True  # Enable MVP mode when limit is specified
    
    # Map flag names to normalized keys (matching name_to_key_map in run_downloader)
    skip_flags = {
        "asx": args.skip_asx,
        "crypto": args.skip_crypto,
        "forex": args.skip_forex,
        "commodities": args.skip_commodities,
        "etfs": args.skip_etfs
    }
    
    print_header()
    
    # Show MVP mode status
    if mvp_enabled:
        logger.info(f"MVP MODE ACTIVE: Limiting ASX stocks to top {asx_limit_config}")
    
    if args.dry_run:
        safe_print("[DRY RUN MODE] - No downloads will be executed\n")
        for i, downloader in enumerate(DOWNLOADERS, 1):
            if downloader.get("enabled", True):
                print(f"[{i}/{len(DOWNLOADERS)}] Would run: {downloader['name']}")
                print(f"  Script: {downloader['script']}")
                print(f"  Args: {' '.join(downloader['args'])}")
        print("\nUse without --dry-run to execute downloads.")
        return
    
    results = []
    for i, downloader in enumerate(DOWNLOADERS, 1):
        if not downloader.get("enabled", True):
            continue
        
        print(f"[{i}/{len([d for d in DOWNLOADERS if d.get('enabled', True)])}] Starting {downloader['name']} download...")
        result = run_downloader(downloader, skip_flags, asx_limit=asx_limit_config if mvp_enabled else 0)
        results.append(result)
    
    # Print summary with MVP status
    print_summary(results, mvp_enabled=mvp_enabled, asx_limit=asx_limit_config)
    
    # Save results to JSON
    summary_path = BASE_DIR / "orchestrator_summary.json"
    summary_path.write_text(json.dumps({
        "timestamp": datetime.now().isoformat(),
        "results": results
    }, indent=2), encoding="utf-8")
    
    logger.info(f"Summary saved to: {summary_path}")
    
    # Aggregate symbols into downloaded_symbols.json
    downloaded_symbols = []
    for result in results:
        if result.get("status") == "success" and result.get("symbols"):
            asset_class = result.get("asset_class", "")
            for symbol in result.get("symbols", []):
                downloaded_symbols.append({
                    "symbol": symbol,
                    "asset_class": asset_class
                })
    
    if downloaded_symbols:
        downloaded_symbols_path = BASE_DIR / "downloaded_symbols.json"
        downloaded_symbols_path.write_text(json.dumps(downloaded_symbols, indent=2), encoding="utf-8")
        logger.info(f"Aggregated {len(downloaded_symbols)} symbols into {downloaded_symbols_path.name}")

if __name__ == "__main__":
    main()

