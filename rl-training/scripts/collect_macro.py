"""Collect macroeconomic indicators from FRED and related sources."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import List

import yaml

from src.data import FREDCollector
from src.data.collectors import RateLimiter
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect macroeconomic time series.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--series", type=str, default=None, help="Comma-separated override list")
    parser.add_argument("--start-date", type=str, default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        load_environment()
        raw_config = yaml.safe_load(args.config.read_text())
        config = resolve_env_placeholders(raw_config)

        storage_cfg = config.get("storage", {})
        bronze_root = Path(storage_cfg.get("bronze_path", "./data/bronze"))

        date_cfg = config.get("date_ranges", {}).get("default", {})
        start_date = args.start_date or date_cfg.get("start")

        macro_cfg = config.get("assets", {}).get("macro", {})
        series: List[str]
        if args.series:
            series = [series_id.strip() for series_id in args.series.split(",") if series_id.strip()]
        else:
            series = list(macro_cfg.get("fred_series", []))

        if not series:
            logger.warning("No FRED series configured; skipping macro data collection.")
            logger.info("To collect macro data, configure FRED_API_KEY and add series to config/data_config.yaml")
            return

        # Check if FRED API key is available
        import os
        fred_key_candidates = [
            "FRED_API_KEY_PRIMARY",
            "FRED_API_KEY",
            "FRED_API_KEY_SECONDARY",
            "FRED_API_KEY_BACKUP",
        ]
        if not any(os.getenv(candidate) for candidate in fred_key_candidates):
            logger.warning(
                "FRED API key not configured. Skipping macro data collection. "
                "To collect macro data, set FRED_API_KEY in .env file. "
                "Get a free API key from https://fred.stlouisfed.org/docs/api/api_key.html"
            )
            return

        rate_cfg = config.get("rate_limits", {}).get("fred", {})
        rate_limiter = None
        requests_per_minute = rate_cfg.get("requests_per_minute")
        if requests_per_minute:
            per_second = max(1, int(requests_per_minute / 60))
            rate_limiter = RateLimiter(requests_per_interval=per_second, interval_seconds=1.0)

        collector = FREDCollector(rate_limiter=rate_limiter)
        logger.info("Collecting %d FRED macro series starting from %s.", len(series), start_date)

        success = 0
        for series_id in series:
            try:
                collector.collect(
                    series_id=series_id,
                    observation_start=start_date,
                    bronze_root=bronze_root,
                    asset_type="macro",
                )
                success += 1
            except Exception:  # pylint: disable=broad-except
                logger.exception("Failed to collect FRED series %s", series_id)
        if success:
            logger.info("Successfully collected %d FRED series.", success)
        else:
            logger.warning("No FRED series collected.")
    except Exception:
        logger.exception("Failed to collect macro data.")
        raise


if __name__ == "__main__":
    main()
