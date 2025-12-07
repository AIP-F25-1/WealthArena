"""Validate data quality across medallion layers."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

from src.data import DataValidator
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run data quality validation.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--layer", choices=["bronze", "silver", "gold"], default="gold")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = yaml.safe_load(args.config.read_text())
    validator = DataValidator(rules=config.get("validation_rules", {}))
    logger.info("Validating %s layer datasets", args.layer)
    # TODO: Load datasets and call validator methods


if __name__ == "__main__":
    main()
