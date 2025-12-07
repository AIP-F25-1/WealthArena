"""Run Bronze → Silver data processing pipeline."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Set

import yaml

from src.data import BronzeToSilverProcessor
from src.utils import get_logger, resolve_env_placeholders


logger = get_logger(__name__)

# Expected asset types based on data collection scripts
EXPECTED_ASSET_TYPES = {
    "stocks",
    "forex",
    "crypto",
    "etfs",
    "commodities",
    "options",
    "social",
    "news",
    "macro",
}


def _resolve_catalog_path(base: Path, reference: str) -> Path:
    """
    Resolve a catalog reference path relative to the catalog base directory.
    
    Args:
        base: Base catalog directory path
        reference: Catalog reference (e.g., "catalog/stocks/technology_services.csv")
    
    Returns:
        Resolved absolute path to the catalog file
    """
    reference_path = Path(reference)
    if reference_path.is_absolute():
        return reference_path.resolve()
    parts = list(reference_path.parts)
    if parts and parts[0].lower() == "catalog":
        reference_path = Path(*parts[1:]) if len(parts) > 1 else Path()
    return (base / reference_path).resolve()


def _get_available_asset_types(bronze_root: Path) -> Set[str]:
    """
    Scan the bronze_path directory for subdirectories (asset types) that have at least one data file.
    
    Returns:
        Set of asset type strings that have data in Bronze layer
    """
    available = set()
    if not bronze_root.exists():
        logger.warning("Bronze root directory does not exist: %s", bronze_root)
        return available
    
    for item in bronze_root.iterdir():
        if not item.is_dir():
            continue
        
        asset_type = item.name
        # Check if this directory has any parquet files (directly or in subdirectories)
        parquet_files = list(item.rglob("*.parquet"))
        if parquet_files:
            available.add(asset_type)
            logger.debug("Found Bronze data for asset type '%s' (%d parquet files)", asset_type, len(parquet_files))
        else:
            logger.debug("No Bronze data found for asset type '%s'", asset_type)
    
    return available


def _get_assets_with_silver_data(silver_root: Path) -> Set[str]:
    """
    Check which asset types already have Silver layer data.
    
    Returns:
        Set of asset type strings that already have Silver data
    """
    existing = set()
    if not silver_root.exists():
        return existing
    
    for item in silver_root.iterdir():
        if not item.is_dir():
            continue
        
        asset_type = item.name
        # Check if this directory has any parquet files
        parquet_files = list(item.glob("*.parquet"))
        if parquet_files:
            existing.add(asset_type)
            logger.info("Found existing Silver data for asset type '%s' (%d files)", 
                       asset_type, len(parquet_files))
    
    return existing


def _get_existing_silver_identifiers(silver_root: Path, asset_type: str) -> Set[str]:
    """
    Get the set of identifiers (symbols/pairs) that already have Silver files.
    
    Returns:
        Set of identifier strings (without file extension)
    """
    existing = set()
    asset_dir = silver_root / asset_type
    if not asset_dir.exists():
        return existing
    
    for parquet_file in asset_dir.glob("*.parquet"):
        # Remove .parquet extension to get the identifier
        identifier = parquet_file.stem
        existing.add(identifier)
    
    return existing


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Process Bronze data to Silver layer.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--assets", type=str, default="all", help="Comma-separated asset classes")
    parser.add_argument("--validate", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raw_config = yaml.safe_load(args.config.read_text())
    config = resolve_env_placeholders(raw_config)
    
    bronze_root = Path(config["storage"]["bronze_path"])
    silver_root = Path(config["storage"]["silver_path"])
    
    available_asset_types = _get_available_asset_types(bronze_root)
    existing_silver_assets = _get_assets_with_silver_data(silver_root)
    
    logger.info("Available asset types in Bronze layer: %s", sorted(available_asset_types))
    if existing_silver_assets:
        logger.info("Asset types with existing Silver data (will be skipped): %s", sorted(existing_silver_assets))
    
    if not available_asset_types:
        logger.warning("No asset types found in Bronze layer. Ensure data collection has been completed.")
        return
    
    # Determine which asset types to process
    if args.assets.lower() == "all":
        requested_asset_types = EXPECTED_ASSET_TYPES
    else:
        requested_asset_types = {asset.strip() for asset in args.assets.split(",") if asset.strip()}
    
    # Filter to only available asset types
    asset_types_to_process = requested_asset_types & available_asset_types
    missing_asset_types = requested_asset_types - available_asset_types
    
    if missing_asset_types:
        logger.warning(
            "Asset types requested but not available in Bronze layer: %s. Skipping these asset types.",
            sorted(missing_asset_types)
        )
    
    # Note: We don't skip entire asset types if they have some data - we'll filter individual identifiers later
    logger.info("Processing Bronze→Silver for asset types: %s", sorted(asset_types_to_process))
    
    processor = BronzeToSilverProcessor(
        bronze_path=config["storage"]["bronze_path"],
        silver_path=config["storage"]["silver_path"],
        catalog_path=config["storage"].get("catalog_path"),
    )
    
    # Get identifiers from config or discover from Bronze
    assets_cfg = config.get("assets", {})
    
    # Process each asset type
    processing_results = {}
    for asset_type in sorted(asset_types_to_process):
        logger.info("Processing asset type: %s", asset_type)
        try:
            if asset_type == "stocks":
                # Get stock symbols from config
                stock_symbols = []
                stocks_cfg = assets_cfg.get("stocks", {})
                sectors_cfg = stocks_cfg.get("sectors", {})
                catalog_base = Path(config["storage"].get("catalog_path", "./data/catalog"))
                for sector_name, sector_cfg in sectors_cfg.items():
                    catalog_ref = sector_cfg.get("universe_reference")
                    if catalog_ref:
                        catalog_path = _resolve_catalog_path(catalog_base, catalog_ref)
                        if catalog_path.exists():
                            import pandas as pd
                            df = pd.read_csv(catalog_path)
                            symbol_col = None
                            for col in df.columns:
                                if col.lower() in {"symbol", "ticker"}:
                                    symbol_col = col
                                    break
                            if symbol_col:
                                stock_symbols.extend(df[symbol_col].dropna().astype(str).tolist())
                if stock_symbols:
                    processor.process_stocks(stock_symbols)
                else:
                    logger.warning("No stock symbols found in config. Skipping stocks processing.")
            elif asset_type == "forex":
                forex_pairs = []
                # First try config
                forex_cfg = assets_cfg.get("forex", {})
                pairs_cfg = forex_cfg.get("pairs", {})
                for pair_list in pairs_cfg.values():
                    forex_pairs.extend(pair_list)
                
                # Also discover from Bronze structure (handles cases where symbols have =X suffix)
                forex_bronze_dir = bronze_root / "forex"
                if forex_bronze_dir.exists():
                    for source_dir in forex_bronze_dir.iterdir():
                        if source_dir.is_dir():
                            for pair_dir in source_dir.iterdir():
                                if pair_dir.is_dir():
                                    pair_symbol = pair_dir.name
                                    # Remove =X suffix if present for matching, but keep original for processing
                                    pair_clean = pair_symbol.replace("=X", "").upper()
                                    if pair_clean not in [p.replace("=X", "").upper() for p in forex_pairs]:
                                        forex_pairs.append(pair_symbol)
                
                # Remove duplicates while preserving order
                seen = set()
                unique_pairs = []
                for pair in forex_pairs:
                    pair_key = pair.replace("=X", "").upper()
                    if pair_key not in seen:
                        seen.add(pair_key)
                        unique_pairs.append(pair)
                
                # Filter out pairs that already have Silver data
                existing_forex = _get_existing_silver_identifiers(silver_root, "forex")
                pairs_to_process = []
                for pair in unique_pairs:
                    # Check both with and without =X suffix
                    pair_variants = [pair, pair.replace("=X", ""), f"{pair}=X" if "=X" not in pair else pair]
                    if not any(variant in existing_forex for variant in pair_variants):
                        pairs_to_process.append(pair)
                
                if existing_forex:
                    logger.info("Skipping %d forex pairs that already have Silver data: %s", 
                               len(existing_forex), sorted(list(existing_forex))[:5])
                
                if pairs_to_process:
                    logger.info("Processing %d forex pairs (discovered from Bronze and config)", len(pairs_to_process))
                    processor.process_forex(pairs_to_process)
                else:
                    logger.info("All forex pairs already have Silver data. Skipping forex processing.")
            elif asset_type == "crypto":
                crypto_symbols = []
                crypto_cfg = assets_cfg.get("crypto", {})
                symbols_cfg = crypto_cfg.get("symbols", {})
                for symbol_list in symbols_cfg.values():
                    crypto_symbols.extend(symbol_list)
                if crypto_symbols:
                    processor.process_crypto(crypto_symbols)
                else:
                    logger.warning("No crypto symbols found in config. Skipping crypto processing.")
            elif asset_type == "macro":
                macro_series = assets_cfg.get("macro", {}).get("fred_series", [])
                if macro_series:
                    processor.process_macro(macro_series)
                else:
                    logger.warning("No macro series found in config. Skipping macro processing.")
            elif asset_type == "etfs":
                etf_symbols = []
                # First try config/catalog
                etfs_cfg = assets_cfg.get("etfs", {})
                universes_cfg = etfs_cfg.get("universes", {})
                catalog_base = Path(config["storage"].get("catalog_path", "./data/catalog"))
                for universe_name, catalog_ref in universes_cfg.items():
                    if catalog_ref:
                        catalog_path = _resolve_catalog_path(catalog_base, catalog_ref)
                        if catalog_path.exists():
                            import pandas as pd
                            df = pd.read_csv(catalog_path)
                            symbol_col = None
                            for col in df.columns:
                                if col.lower() in {"symbol", "ticker"}:
                                    symbol_col = col
                                    break
                            if symbol_col:
                                etf_symbols.extend(df[symbol_col].dropna().astype(str).tolist())
                
                # Also discover from Bronze structure (fallback if catalog doesn't work)
                etfs_bronze_dir = bronze_root / "etfs"
                if etfs_bronze_dir.exists():
                    for source_dir in etfs_bronze_dir.iterdir():
                        if source_dir.is_dir():
                            for symbol_dir in source_dir.iterdir():
                                if symbol_dir.is_dir():
                                    symbol = symbol_dir.name.upper()
                                    if symbol not in etf_symbols:
                                        etf_symbols.append(symbol)
                
                # Remove duplicates while preserving order
                seen = set()
                unique_symbols = []
                for symbol in etf_symbols:
                    symbol_upper = symbol.upper()
                    if symbol_upper not in seen:
                        seen.add(symbol_upper)
                        unique_symbols.append(symbol)
                
                # Filter out ETFs that already have Silver data
                existing_etfs = _get_existing_silver_identifiers(silver_root, "etfs")
                symbols_to_process = [s for s in unique_symbols if s.upper() not in {e.upper() for e in existing_etfs}]
                
                if existing_etfs:
                    logger.info("Skipping %d ETF symbols that already have Silver data: %s", 
                               len(existing_etfs), sorted(list(existing_etfs))[:5])
                
                if symbols_to_process:
                    logger.info("Processing %d ETF symbols (discovered from Bronze and config)", len(symbols_to_process))
                    processor.process_etfs(symbols_to_process)
                else:
                    logger.info("All ETF symbols already have Silver data. Skipping ETFs processing.")
            elif asset_type == "commodities":
                commodity_symbols = []
                commodities_cfg = assets_cfg.get("commodities", {})
                contracts_cfg = commodities_cfg.get("contracts", {})
                # Flatten nested structure (precious_metals, energy, agriculture, industrial_metals)
                for category_symbols in contracts_cfg.values():
                    if isinstance(category_symbols, list):
                        commodity_symbols.extend(category_symbols)
                if commodity_symbols:
                    processor.process_commodities(commodity_symbols)
                else:
                    logger.warning("No commodity symbols found in config. Skipping commodities processing.")
            elif asset_type == "options":
                # Discover option underlyings from Bronze directory structure
                options_bronze_dir = bronze_root / "options"
                underlyings = set()
                if options_bronze_dir.exists():
                    for source_dir in options_bronze_dir.iterdir():
                        if source_dir.is_dir():
                            # Look for parquet files and read underlying from the 'underlying' column
                            for parquet_file in source_dir.rglob("*.parquet"):
                                try:
                                    # Read a small sample to get the underlying column
                                    import pandas as pd
                                    df_sample = pd.read_parquet(parquet_file, nrows=1)
                                    if "underlying" in df_sample.columns:
                                        underlying = df_sample["underlying"].iloc[0]
                                        if pd.notna(underlying):
                                            underlyings.add(str(underlying).upper())
                                    else:
                                        # Fallback: parse from filename if column not available
                                        # Filename pattern: {underlying}_{expiry_date}_{option_type}
                                        # Handle cases like BRK-B_2024-01-19_call
                                        parts = parquet_file.stem.split("_")
                                        if len(parts) >= 3:
                                            # Last 2 parts are expiry_date and option_type, rest is underlying
                                            underlying = "_".join(parts[:-2]).upper()
                                            underlyings.add(underlying)
                                except Exception as exc:
                                    logger.warning("Error reading underlying from %s: %s", parquet_file, exc)
                                    continue
                if underlyings:
                    processor.process_options(list(underlyings))
                else:
                    logger.warning("No option underlyings discovered from Bronze. Skipping options processing.")
            elif asset_type == "social":
                # Discover social queries from Bronze directory structure or config
                social_bronze_dir = bronze_root / "social"
                queries = set()
                if social_bronze_dir.exists():
                    for source_dir in social_bronze_dir.iterdir():
                        if source_dir.is_dir():
                            for identifier_dir in source_dir.iterdir():
                                if identifier_dir.is_dir():
                                    # Identifier is the query (with underscores replaced by spaces)
                                    query = identifier_dir.name.replace("_", " ")
                                    queries.add(query)
                if queries:
                    processor.process_social(list(queries))
                else:
                    logger.warning("No social queries discovered from Bronze. Skipping social processing.")
            elif asset_type == "news":
                # Load news tickers from config or discover from Bronze
                news_cfg = assets_cfg.get("news", {})
                catalog_reference = news_cfg.get("tickers_reference")
                tickers = []
                if catalog_reference:
                    catalog_base = Path(config["storage"].get("catalog_path", "./data/catalog"))
                    catalog_path = _resolve_catalog_path(catalog_base, catalog_reference)
                    if catalog_path.exists():
                        import pandas as pd
                        df = pd.read_csv(catalog_path)
                        symbol_col = None
                        for col in df.columns:
                            if col.lower() in {"symbol", "ticker"}:
                                symbol_col = col
                                break
                        if symbol_col:
                            tickers.extend(df[symbol_col].dropna().astype(str).tolist())
                # Also discover from Bronze structure
                news_bronze_dir = bronze_root / "news"
                if news_bronze_dir.exists():
                    for source_dir in news_bronze_dir.iterdir():
                        if source_dir.is_dir():
                            for ticker_dir in source_dir.iterdir():
                                if ticker_dir.is_dir():
                                    tickers.append(ticker_dir.name.upper())
                if tickers:
                    processor.process_news(list(set(tickers)))
                else:
                    logger.warning("No news tickers found. Skipping news processing.")
            else:
                logger.warning("Unknown asset type: %s. Skipping.", asset_type)
            # Track processing results
            processing_results[asset_type] = "success"
            
            # Validate output
            silver_asset_dir = Path(config["storage"]["silver_path"]) / asset_type
            if silver_asset_dir.exists():
                parquet_files = list(silver_asset_dir.glob("*.parquet"))
                logger.info("Created %d Silver files for asset type '%s'", len(parquet_files), asset_type)
            else:
                logger.warning("Silver directory for '%s' was not created", asset_type)
        except Exception as exc:  # pylint: disable=broad-except
            logger.exception("Error processing asset type '%s': %s", asset_type, exc)
            logger.warning("Continuing with remaining asset types despite error in %s", asset_type)
            processing_results[asset_type] = f"failed: {exc}"
    
    # Summary
    successful = sum(1 for status in processing_results.values() if status == "success")
    failed = len(processing_results) - successful
    logger.info("Completed Bronze→Silver processing: %d successful, %d failed out of %d asset types", 
                successful, failed, len(asset_types_to_process))
    if failed > 0:
        failed_types = [asset_type for asset_type, status in processing_results.items() if status != "success"]
        logger.warning("Failed asset types: %s", failed_types)


if __name__ == "__main__":
    main()
