"""Master data collection orchestration script."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import List

import yaml

from src.data import (
    AlphaVantageCollector,
    CCXTCollector,
    FREDCollector,
    SocialMediaCollector,
    YahooFinanceCollector,
)
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect multi-asset historical data.")
    parser.add_argument("--config", type=Path, required=True, help="Path to data_config.yaml")
    parser.add_argument("--start-date", type=str, default=None, help="Override start date")
    parser.add_argument("--end-date", type=str, default=None, help="Override end date")
    parser.add_argument(
        "--assets",
        type=str,
        default="all",
        help="Comma-separated asset groups to collect (stocks,forex,crypto,etfs,commodities,options,news,social,macro)",
    )
    parser.add_argument("--parallel", action="store_true", help="Enable parallel downloads")
    parser.add_argument("--dry-run", action="store_true", help="Log actions without downloading")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    load_environment()
    raw_config = yaml.safe_load(args.config.read_text())
    config = resolve_env_placeholders(raw_config)

    logger.info("Launching collection with config=%s", args.config)
    assets: List[str] = [asset.strip() for asset in args.assets.split(",")] if args.assets != "all" else []

    if args.dry_run:
        logger.info("Dry run enabled. Exiting without downloads.")
        return

    yahoo_collector = YahooFinanceCollector()
    ccxt_collector = CCXTCollector()
    alpha_collector = AlphaVantageCollector()
    fred_collector = FREDCollector()
    social_collector = SocialMediaCollector()

    logger.debug("Collectors initialized: %s", [yahoo_collector, ccxt_collector])
    # TODO: iterate over config["assets"] and dispatch to collectors using resolved paths


if __name__ == "__main__":
    main()
