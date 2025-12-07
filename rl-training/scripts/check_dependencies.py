"""Check availability of critical Python packages and system dependencies."""

from __future__ import annotations

import importlib
import sys

from src.utils import get_logger


logger = get_logger(__name__)


# (module_name, package_name)
REQUIRED_PACKAGES = [
    ("torch", "torch"),
    ("stable_baselines3", "stable-baselines3"),
    ("ray", "ray[rllib,tune]"),
    ("yfinance", "yfinance"),
    ("ccxt", "ccxt"),
    ("fredapi", "fredapi"),
    ("transformers", "transformers"),
    ("pypfopt", "pyportfolioopt"),
    ("bentoml", "bentoml"),
]


def main() -> None:
    missing = []
    for module_name, package_name in REQUIRED_PACKAGES:
        try:
            importlib.import_module(module_name)
        except ImportError:
            missing.append(package_name)
            logger.error("Missing package: %s", package_name)
    if missing:
        logger.error("Missing dependencies detected: %s", missing)
        sys.exit(1)
    logger.info("All required packages available.")


if __name__ == "__main__":
    main()
