
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

# Import crypto symbols
sys.path.insert(0, str(Path(__file__).parent.parent / "rl-training" / "src"))
try:
    from data.crypto.cryptocurrencies import (
        MAJOR_CRYPTOCURRENCIES,
        DEFI_TOKENS,
        LAYER_1_TOKENS,
        LAYER_2_TOKENS,
        MEME_COINS,
        STABLECOINS,
        EXCHANGE_TOKENS,
        CRYPTO_CATEGORIES
    )
    # Verify imports succeeded
    if not MAJOR_CRYPTOCURRENCIES:
        raise ImportError("MAJOR_CRYPTOCURRENCIES is empty")
except (ImportError, AttributeError) as e:
    # Fallback if import fails - logger not yet imported, use print
    print(f"[WARNING] Could not import crypto symbols from rl-training/src: {e}", file=sys.stderr)
    print("[WARNING] Using fallback crypto symbol lists", file=sys.stderr)
    MAJOR_CRYPTOCURRENCIES = ["BTC", "ETH", "BNB", "XRP", "ADA", "SOL", "DOGE", "DOT", "AVAX", "SHIB",
                              "MATIC", "LTC", "UNI", "LINK", "ATOM", "ALGO", "VET", "FIL", "TRX", "ETC"]
    DEFI_TOKENS = ["UNI", "AAVE", "COMP", "MKR", "SNX", "YFI", "CRV", "1INCH", "SUSHI", "CAKE"]
    LAYER_1_TOKENS = ["BTC", "ETH", "ADA", "SOL", "DOT", "AVAX", "ATOM", "ALGO", "NEAR", "FTM"]
    LAYER_2_TOKENS = ["MATIC", "OP", "ARB", "LRC", "IMX", "ZKS", "BOBA", "METIS"]
    MEME_COINS = ["DOGE", "SHIB", "PEPE", "FLOKI", "BONK", "WIF", "BABYDOGE", "ELON"]
    STABLECOINS = ["USDT", "USDC", "BUSD", "DAI", "FRAX", "TUSD", "USDP", "GUSD"]
    EXCHANGE_TOKENS = ["BNB", "FTT", "KCS", "HT", "OKB", "LEO", "CRO", "GT"]
    CRYPTO_CATEGORIES = {
        "Major": MAJOR_CRYPTOCURRENCIES,
        "DeFi": DEFI_TOKENS,
        "Layer1": LAYER_1_TOKENS,
        "Layer2": LAYER_2_TOKENS,
        "Meme": MEME_COINS,
        "Stablecoins": STABLECOINS,
        "Exchange": EXCHANGE_TOKENS
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
# Crypto symbol mapping to Yahoo Finance
# ----------------------------

def get_crypto_symbols(category: str = "Major") -> List[str]:
    """Get crypto symbols for specified category."""
    if category == "All":
        all_symbols = set()
        for cat_list in CRYPTO_CATEGORIES.values():
            all_symbols.update(cat_list)
        return sorted(all_symbols)
    
    category_map = {
        "Major": MAJOR_CRYPTOCURRENCIES,
        "DeFi": DEFI_TOKENS,
        "Layer1": LAYER_1_TOKENS,
        "Layer2": LAYER_2_TOKENS,
        "Meme": MEME_COINS,
        "Stablecoins": STABLECOINS,
        "Exchange": EXCHANGE_TOKENS
    }
    
    return category_map.get(category, MAJOR_CRYPTOCURRENCIES)

def crypto_to_yahoo_ticker(crypto_symbol: str) -> str:
    """Convert crypto symbol to Yahoo Finance ticker format."""
    # Most cryptos use {SYMBOL}-USD format
    # Handle special cases
    special_cases = {
        "USDT": "USDT-USD",
        "USDC": "USDC-USD",
        "BUSD": "BUSD-USD"
    }
    
    if crypto_symbol in special_cases:
        return special_cases[crypto_symbol]
    
    return f"{crypto_symbol}-USD"

# ----------------------------
# Main
# ----------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Cryptocurrency RAW downloader with ADLS Gen2 upload")
    parser.add_argument("--category", 
                       choices=["Major", "DeFi", "Layer1", "Layer2", "Meme", "Stablecoins", "Exchange", "All"],
                       default="Major",
                       help="Cryptocurrency category to download")
    parser.add_argument("--symbols", type=str, default=None,
                        help="Download specific symbols only (comma-separated, e.g., BTC-USD,ETH-USD)")
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD (default: today-3y)")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD (default: today)")
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--sleep-between", type=float, default=1.0)
    parser.add_argument("--azure-prefix", default="crypto",
                        help="Directory/prefix inside filesystem for uploads (default: crypto)")
    parser.add_argument("--clean-remote-first", action="store_true",
                        help="Delete existing remote files with same name before upload")
    args = parser.parse_args()

    # Get crypto symbols
    if args.symbols:
        # Parse comma-separated symbol list
        crypto_symbols_raw = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
        # Convert to crypto symbols (remove -USD suffix if present)
        crypto_symbols = [s.replace("-USD", "") for s in crypto_symbols_raw]
        logger.info(f"Downloading {len(crypto_symbols)} specific crypto symbols: {', '.join(crypto_symbols)}")
    else:
        crypto_symbols = get_crypto_symbols(args.category)
        logger.info(f"Retrieved {len(crypto_symbols)} crypto symbols for category '{args.category}'")
    if not crypto_symbols:
        logger.error(f"No symbols found for category: {args.category}")
        logger.error(f"Available categories: Major, DeFi, Layer1, Layer2, Meme, Stablecoins, Exchange, All")
        logger.error(f"MAJOR_CRYPTOCURRENCIES has {len(MAJOR_CRYPTOCURRENCIES) if 'MAJOR_CRYPTOCURRENCIES' in globals() else 0} items")
        sys.exit(1)

    # Convert to Yahoo Finance tickers
    yahoo_tickers = [crypto_to_yahoo_ticker(sym) for sym in crypto_symbols]
    
    # Validate symbols are in expected format (*-USD)
    if args.symbols:
        invalid_symbols = [t for t in yahoo_tickers if not t.endswith("-USD")]
        if invalid_symbols:
            logger.warning(f"Warning: Some symbols don't match expected crypto format (*-USD): {invalid_symbols}")
            # Filter out invalid symbols
            yahoo_tickers = [t for t in yahoo_tickers if t.endswith("-USD")]
    
    # Date range: default = last ~3 years
    today = datetime.now().date()
    end_date = args.end_date or today.isoformat()
    start_date = args.start_date or (today - timedelta(days=3*365)).isoformat()

    logger.info(f"Tickers to download (RAW only): {len(yahoo_tickers)} (category={args.category})")
    logger.info(f"Date range: {start_date} -> {end_date}")

    # Ensure raw/crypto directory exists
    crypto_raw_dir = RAW_DIR / "crypto"
    crypto_raw_dir.mkdir(parents=True, exist_ok=True)

    # Create downloader with crypto-specific raw directory
    class CryptoDownloader(RawDownloader):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.raw_dir = crypto_raw_dir

    # Download RAW
    dl = CryptoDownloader(
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
        summary_path = BASE_DIR / "crypto_download_summary.json"
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print("\n" + "="*70)
        print("[SUMMARY] CRYPTO RAW DOWNLOAD SUMMARY")
        print("="*70)
        print(f"[OK] Symbols downloaded (RAW): {len(all_raw)}")
        print(f"[DATE] Date range: {start_date} -> {end_date}")
        print(f"[FOLDER] Raw folder: {crypto_raw_dir}")
        print(f"[FILE] Summary:   {summary_path.name}")
        n = len(list(crypto_raw_dir.glob('*.csv')))
        print(f"  {crypto_raw_dir}: {n} file(s)")
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

