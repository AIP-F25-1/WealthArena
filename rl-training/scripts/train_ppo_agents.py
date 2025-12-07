"""Train PPO agents for specified asset classes."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

from src.agents import PPOAgentFactory
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train PPO agents.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--assets", type=str, default="stocks", help="Comma-separated asset classes")
    parser.add_argument("--timesteps", type=int, default=1_000_000)
    parser.add_argument("--distributed", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = yaml.safe_load(args.config.read_text())
    base_config = config["ppo_agents"]
    factory = PPOAgentFactory(base_config=base_config)
    logger.info("Training PPO agents for assets=%s", args.assets)
    # TODO: instantiate environments and call agent.train()


if __name__ == "__main__":
    main()
