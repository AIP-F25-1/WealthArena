"""Collect equity and ETF data via Yahoo Finance."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, List, Sequence

import pandas as pd
import yaml

from src.data import YahooFinanceCollector
from src.data.collectors import RateLimiter
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect stock and ETF data.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--asset-type", choices=["stocks", "etfs"], default="stocks")
    parser.add_argument("--start-date", type=str, default=None)
    parser.add_argument("--end-date", type=str, default=None)
    parser.add_argument("--interval", type=str, default="1d")
    parser.add_argument(
        "--allow-fallback",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Allow fallback symbols when catalogs are missing (default: enabled).",
    )
    return parser.parse_args()


def _extract_symbols_from_catalog(path: Path) -> List[str]:
    frame = pd.read_csv(path)
    symbol_column = None
    for column in frame.columns:
        if column.lower() in {"symbol", "ticker"}:
            symbol_column = column
            break
    if symbol_column is None:
        symbol_column = frame.columns[0]
    symbols: Iterable[str] = frame[symbol_column].dropna().astype(str).str.strip()
    return sorted({symbol for symbol in symbols if symbol})


def _chunked(values: Sequence[str], size: int) -> List[List[str]]:
    return [list(values[i : i + size]) for i in range(0, len(values), size)]


def _resolve_catalog_path(catalog_base: Path, reference: str) -> Path:
    reference_path = Path(reference)
    if reference_path.is_absolute():
        return reference_path.resolve()
    parts = list(reference_path.parts)
    if parts and parts[0].lower() == "catalog":
        reference_path = Path(*parts[1:]) if len(parts) > 1 else Path()
    return (catalog_base / reference_path).resolve()


def main() -> None:
    args = parse_args()
    try:
        load_environment()
        raw_config = yaml.safe_load(args.config.read_text())
        config = resolve_env_placeholders(raw_config)

        storage_cfg = config.get("storage", {})
        bronze_root = Path(storage_cfg.get("bronze_path", "./data/bronze"))
        catalog_base = Path(storage_cfg.get("catalog_path", "./data/catalog"))

        date_cfg = config.get("date_ranges", {}).get("default", {})
        start_date = args.start_date or date_cfg.get("start")
        end_date = args.end_date or date_cfg.get("end")

        assets_cfg = config.get("assets", {})
        asset_cfg = assets_cfg.get(args.asset_type, {})
        symbols: List[str] = []
        if args.asset_type == "stocks":
            sectors = asset_cfg.get("sectors", {})
            resolved_catalogs = []
            for sector_name, sector_cfg in sectors.items():
                reference = sector_cfg.get("universe_reference")
                if not reference:
                    logger.warning("Sector %s missing universe_reference; skipping.", sector_name)
                    continue
                catalog_path = _resolve_catalog_path(catalog_base, reference)
                resolved_catalogs.append((sector_name, catalog_path))

            existing_catalogs = sum(1 for _, path in resolved_catalogs if path.exists())
            if existing_catalogs == 0 and args.allow_fallback:
                logger.info(
                    "No catalog files detected. Will fall back to safety list. To collect sector-specific stocks, first run: "
                    "python scripts/generate_stock_catalog.py --config config/data_config.yaml",
                )

            for sector_name, catalog_path in resolved_catalogs:
                if not catalog_path.exists():
                    logger.warning(
                        "Catalog missing for sector %s at %s. Run 'python scripts/generate_stock_catalog.py --config "
                        "config/data_config.yaml' to generate catalog files.",
                        sector_name,
                        catalog_path,
                    )
                    continue
                try:
                    symbols.extend(_extract_symbols_from_catalog(catalog_path))
                except Exception:  # pylint: disable=broad-except
                    logger.exception("Failed to load symbols for sector %s from %s", sector_name, catalog_path)
        else:
            universes = asset_cfg.get("universes", {})
            for universe_name, reference in universes.items():
                if not reference:
                    logger.warning("Universe %s missing reference path; skipping.", universe_name)
                    continue
                catalog_path = _resolve_catalog_path(catalog_base, reference)
                if not catalog_path.exists():
                    logger.warning("Catalog missing for ETF universe %s at %s; skipping.", universe_name, catalog_path)
                    continue
                try:
                    symbols.extend(_extract_symbols_from_catalog(catalog_path))
                except Exception:  # pylint: disable=broad-except
                    logger.exception("Failed to load symbols for ETF universe %s from %s", universe_name, catalog_path)

        symbols = sorted({symbol for symbol in symbols if symbol})
        if not symbols:
            fallback_symbols = (
                ["AAPL", "MSFT", "GOOGL", "AMZN", "META"]
                if args.asset_type == "stocks"
                else ["SPY", "QQQ", "IWM", "EEM", "TLT"]
            )
            if args.allow_fallback:
                logger.warning(
                    "No sector catalog files found. This usually indicates the catalog generation step was skipped. "
                    "Run 'python scripts/generate_stock_catalog.py --config config/data_config.yaml' to create the intended "
                    "50-stock per-sector universe. Using fallback universe %s for asset_type=%s.",
                    fallback_symbols,
                    args.asset_type,
                )
                symbols = fallback_symbols
            else:
                logger.error("No symbols resolved for asset_type=%s and fallback disabled; aborting.", args.asset_type)
                raise SystemExit(1)

        rate_limit_cfg = config.get("rate_limits", {}).get("yfinance", {})
        rate_limiter = None
        requests_per_second = rate_limit_cfg.get("requests_per_second")
        if requests_per_second:
            rate_limiter = RateLimiter(requests_per_interval=int(requests_per_second), interval_seconds=1.0)

        collector = YahooFinanceCollector(rate_limiter=rate_limiter)
        interval = asset_cfg.get("interval", args.interval or "1d")
        auto_adjust = False
        if args.asset_type == "stocks":
            auto_adjust = asset_cfg.get("adjustments", {}).get("auto_adjust", False)

        logger.info(
            "Collecting %d %s symbols from %s to %s using interval=%s",
            len(symbols),
            args.asset_type,
            start_date,
            end_date,
            interval,
        )
        batch_size_value = rate_limit_cfg.get("batch_size") or 50
        batch_size = max(1, int(batch_size_value))
        batches = _chunked(symbols, batch_size)
        collected = 0
        success_batches = 0
        for batch in batches:
            result = collector.collect(
                symbols=batch,
                interval=interval,
                start=start_date,
                end=end_date,
                auto_adjust=auto_adjust,
                bronze_root=bronze_root,
                asset_type=args.asset_type,
            )
            if not result:
                logger.warning("Batch returned no data for symbols %s", batch)
                continue
            collected += len(result)
            success_batches += 1
        if collected == 0:
            logger.error("No %s symbols produced data. Check Yahoo Finance availability.", args.asset_type)
            raise SystemExit(2)
        logger.info(
            "Successfully collected %d %s symbols across %d/%d batches.",
            collected,
            args.asset_type,
            success_batches,
            len(batches),
        )
    except Exception:
        logger.exception("Failed to collect %s data.", args.asset_type)
        raise


if __name__ == "__main__":
    main()
