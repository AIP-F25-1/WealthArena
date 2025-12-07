"""Master Bronze → Silver → Gold processing orchestrator."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

from src.data import BronzeToSilverProcessor, SilverToGoldProcessor
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run full data processing pipeline.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--stage", choices=["bronze-to-silver", "silver-to-gold", "all"], default="all")
    parser.add_argument("--assets", type=str, default="all")
    parser.add_argument("--parallel", action="store_true")
    parser.add_argument("--validate", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    load_environment()
    raw_config = yaml.safe_load(args.config.read_text())
    config = resolve_env_placeholders(raw_config)
    storage = config["storage"]

    if args.stage in ("bronze-to-silver", "all"):
        bronze_processor = BronzeToSilverProcessor(
            bronze_path=storage["bronze_path"],
            silver_path=storage["silver_path"],
            catalog_path=storage.get("catalog_path"),
        )
        logger.info("Running Bronze→Silver processing")
        # TODO: call bronze_processor per asset class

    if args.stage in ("silver-to-gold", "all"):
        silver_processor = SilverToGoldProcessor(
            silver_path=storage["silver_path"],
            gold_path=storage["gold_path"],
            feature_config=config.get("feature_config", {}),
        )
        logger.info("Running Silver→Gold processing")
        # TODO: call silver_processor per asset class


if __name__ == "__main__":
    main()
