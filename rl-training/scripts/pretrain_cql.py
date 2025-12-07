"""Run CQL offline pretraining for PPO and SAC models."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

from src.agents import CQLPretrainer, OfflineDatasetBuilder, SafetyValidator
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Offline pretrain agents using CQL.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--agents", type=str, default="all")
    parser.add_argument("--evaluate", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = yaml.safe_load(args.config.read_text())
    cql_config = config["cql_pretraining"]
    dataset_builder = OfflineDatasetBuilder(data_path=cql_config["dataset"]["source"])
    safety_validator = SafetyValidator(
        max_drawdown=cql_config["safety_constraints"]["max_drawdown"],
        max_position=cql_config["safety_constraints"]["max_position_size"],
        max_sector_weight=cql_config["safety_constraints"]["max_sector_weight"],
    )
    pretrainer = CQLPretrainer(config=cql_config, dataset_builder=dataset_builder, safety_validator=safety_validator)
    logger.info("Running CQL pretraining for agents=%s", args.agents)
    dataset = pretrainer.load_offline_data()
    pretrainer.pretrain(dataset)
    if args.evaluate:
        metrics = pretrainer.evaluate_offline(dataset)
        logger.info("Offline evaluation metrics: %s", metrics)


if __name__ == "__main__":
    main()
