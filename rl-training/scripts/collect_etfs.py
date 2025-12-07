"""
Collect ETF data via Yahoo Finance using configuration-defined universes.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import List, Sequence

import pandas as pd
import yaml

from src.data import YahooFinanceCollector
from src.data.collectors import RateLimiter
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)

DEFAULT_ETF_UNIVERSE = [
    "SPY",
    "QQQ",
    "IWM",
    "EEM",
    "TLT",
    "XLF",
    "XLE",
    "XLV",
    "XLY",
    "XLI",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect ETF market data.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--start-date", type=str, default=None)
    parser.add_argument("--end-date", type=str, default=None)
    parser.add_argument("--interval", type=str, default="1d")
    return parser.parse_args()


def _resolve_catalog_path(base: Path, reference: str) -> Path:
    reference_path = Path(reference)
    if reference_path.is_absolute():
        return reference_path.resolve()
    parts = list(reference_path.parts)
    if parts and parts[0].lower() == "catalog":
        reference_path = Path(*parts[1:]) if len(parts) > 1 else Path()
    return (base / reference_path).resolve()


def _extract_symbols_from_catalog(path: Path) -> List[str]:
    frame = pd.read_csv(path)
    column: str | None = None
    for candidate in frame.columns:
        if candidate.lower() in {"symbol", "ticker"}:
            column = candidate
            break
    if column is None:
        column = frame.columns[0]
    symbols = frame[column].dropna().astype(str).str.strip()
    return sorted({symbol for symbol in symbols if symbol})


def _chunked(values: Sequence[str], size: int) -> List[List[str]]:
    return [list(values[i : i + size]) for i in range(0, len(values), size)]


def _resolve_etf_symbols(
    catalog_base: Path,
    universes: dict[str, str],
) -> List[str]:
    resolved: List[str] = []
    for universe_name, reference in universes.items():
        if not reference:
            logger.warning("ETF universe %s missing catalog reference; skipping.", universe_name)
            continue
        catalog_path = _resolve_catalog_path(catalog_base, reference)
        if not catalog_path.exists():
            logger.warning(
                "ETF universe catalog missing for %s at %s. Falling back to default ETF list.",
                universe_name,
                catalog_path,
            )
            resolved.extend(DEFAULT_ETF_UNIVERSE)
            continue
        try:
            resolved.extend(_extract_symbols_from_catalog(catalog_path))
        except Exception:  # pylint: disable=broad-except
            logger.exception("Failed to load ETF symbols for universe %s (%s)", universe_name, catalog_path)
            resolved.extend(DEFAULT_ETF_UNIVERSE)
    if not resolved:
        logger.warning("No ETF universes resolved; using default fallback list.")
        resolved = DEFAULT_ETF_UNIVERSE.copy()
    return sorted({symbol for symbol in resolved if symbol})


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

        etfs_cfg = config.get("assets", {}).get("etfs", {})
        universes = etfs_cfg.get("universes", {})
        etf_symbols = _resolve_etf_symbols(catalog_base, universes)
        if not etf_symbols:
            logger.error("No ETF symbols resolved; aborting collection.")
            raise SystemExit(1)

        rate_limit_cfg = config.get("rate_limits", {}).get("yfinance", {})
        rate_limiter = None
        requests_per_second = rate_limit_cfg.get("requests_per_second")
        if requests_per_second:
            rate_limiter = RateLimiter(requests_per_interval=int(requests_per_second), interval_seconds=1.0)

        collector = YahooFinanceCollector(rate_limiter=rate_limiter)
        interval = etfs_cfg.get("interval", args.interval or "1d")
        batch_size_value = rate_limit_cfg.get("batch_size") or 50
        batch_size = max(1, int(batch_size_value))
        batches = _chunked(etf_symbols, batch_size)

        logger.info(
            "Collecting %d ETF symbols from %s to %s using interval=%s",
            len(etf_symbols),
            start_date,
            end_date,
            interval,
        )
        collected = 0
        success_batches = 0
        for batch in batches:
            result = collector.collect(
                symbols=batch,
                interval=interval,
                start=start_date,
                end=end_date,
                auto_adjust=False,
                bronze_root=bronze_root,
                asset_type="etfs",
            )
            if not result:
                logger.warning("Batch returned no data for ETF symbols %s", batch)
                continue
            collected += len(result)
            success_batches += 1

        if collected == 0:
            logger.error("No ETF symbols produced data. Verify Yahoo Finance availability or catalog entries.")
            raise SystemExit(2)

        logger.info(
            "Successfully collected %d ETF symbols across %d/%d batches.",
            collected,
            success_batches,
            len(batches),
        )
    except Exception:
        logger.exception("Failed to collect ETF data.")
        raise


if __name__ == "__main__":
    main()


