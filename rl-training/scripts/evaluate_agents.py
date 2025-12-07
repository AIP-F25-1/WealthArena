"""Evaluate trained agents across test datasets."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

from src.agents import PPOAgentFactory, SACMetaController
from src.backtesting import PerformanceEvaluator
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate PPO/SAC agents.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--agents", type=str, default="all")
    parser.add_argument("--test-data", type=Path, required=False)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = yaml.safe_load(args.config.read_text())
    evaluator = PerformanceEvaluator()
    logger.info("Evaluating agents=%s", args.agents)
    ppo_factory = PPOAgentFactory(base_config=config["ppo_agents"])
    sac_controller = SACMetaController(config=config["sac_meta_controller"], env=None)
    # TODO: load agents, run evaluation episodes, compute metrics with evaluator


if __name__ == "__main__":
    main()
