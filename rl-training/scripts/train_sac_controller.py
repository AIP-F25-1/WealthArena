"""Train SAC meta-controller for portfolio allocation."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

from src.agents import SACMetaController
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train SAC meta-controller.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--timesteps", type=int, default=1_000_000)
    parser.add_argument("--distributed", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = yaml.safe_load(args.config.read_text())
    sac_config = config["sac_meta_controller"]
    controller = SACMetaController(config=sac_config, env=None)  # TODO: provide portfolio env
    logger.info("Training SAC meta-controller for %d timesteps", args.timesteps)
    # TODO: instantiate portfolio environment and call controller.train()


if __name__ == "__main__":
    main()
