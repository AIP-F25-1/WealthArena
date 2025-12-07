"""Orchestrate CQL pretraining, PPO training, and SAC meta-controller training."""

from __future__ import annotations

import argparse
import random
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import numpy as np
import yaml

from src.agents import (
    CQLPretrainer,
    OfflineDatasetBuilder,
    PPOAgentFactory,
    SACMetaController,
    SafetyValidator,
)
from src.environments import build_portfolio_env, build_trading_env
from src.utils import get_logger, load_environment, resolve_env_placeholders

logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train PPO asset agents and the SAC meta-controller.")
    parser.add_argument("--config", type=Path, required=True, help="Path to agent_config.yaml")
    parser.add_argument("--stage", choices=["pretrain", "finetune", "all"], default="all")
    parser.add_argument(
        "--asset-classes",
        type=str,
        default="stocks,forex,crypto,etfs,commodities,options",
        help="Comma-separated list of asset classes to train (ignored when --agents is provided).",
    )
    parser.add_argument(
        "--agents",
        type=str,
        default="all",
        help="Backward-compatible alias for --asset-classes. Use 'all' to train every asset class.",
    )
    parser.add_argument("--experiment-name", type=str, default="agentic-rl")
    parser.add_argument("--data-root", type=Path, default=Path("./data"))
    parser.add_argument("--gold-path", type=Path, default=None)
    parser.add_argument("--models-dir", type=Path, default=Path("./models"))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--disable-wandb", action="store_true")
    parser.add_argument("--distributed", action="store_true", help="Reserved for future Ray integration.")
    parser.add_argument("--num-workers", type=int, default=4, help="Reserved for distributed training.")
    parser.add_argument("--gpus", type=int, default=1, help="Reserved for distributed training.")
    return parser.parse_args()


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    try:
        import torch

        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
    except ImportError:
        logger.debug("PyTorch not available during seeding; skipping torch seed.")


def init_wandb(run_name: str, wandb_config: Dict[str, Any], disabled: bool) -> Optional["wandb.sdk.wandb_run.Run"]:
    if disabled or not wandb_config.get("enable", False):
        return None
    try:
        import wandb

        run = wandb.init(
            project=wandb_config.get("project", "agentic-rl-trading"),
            entity=wandb_config.get("entity"),
            name=run_name,
            config=wandb_config,
        )
        return run
    except Exception as exc:  # pragma: no cover - network/credential dependent
        logger.warning("Unable to initialise Weights & Biases logging: %s", exc)
        return None


def _validate_asset_data_availability(
    asset_classes: List[str],
    gold_path: Path,
) -> List[str]:
    """
    Check which asset classes have processed data in the Gold layer.
    
    Returns:
        Filtered list of asset classes that have data available
    """
    available_asset_classes = []
    
    # Try to use the private helper from builders, with fallback
    try:
        from src.environments.builders import _candidate_paths
        
        for asset_class in asset_classes:
            # Check if any candidate path exists for this asset class
            has_data = False
            for candidate_path in _candidate_paths(gold_path, asset_class):
                if candidate_path.exists():
                    has_data = True
                    break
            
            if has_data:
                available_asset_classes.append(asset_class)
                logger.debug("Asset class '%s' has data in Gold layer", asset_class)
            else:
                logger.warning(
                    "Asset class '%s' requested but no Gold data found. "
                    "Skipping %s agent training.",
                    asset_class,
                    asset_class,
                )
    except (ImportError, AttributeError) as exc:
        # Fallback: check common Gold paths directly
        logger.debug("Could not import _candidate_paths, using fallback path checking: %s", exc)
        common_paths = [
            gold_path / "features" / f"{asset_class}.parquet",
            gold_path / "features" / f"{asset_class}.feather",
            gold_path / "features" / f"{asset_class}.csv",
            gold_path / "training_sets" / f"{asset_class}.parquet",
            gold_path / "training_sets" / f"{asset_class}.csv",
        ]
        
        for asset_class in asset_classes:
            has_data = False
            for candidate_path in common_paths:
                if candidate_path.exists():
                    has_data = True
                    break
            
            if has_data:
                available_asset_classes.append(asset_class)
                logger.debug("Asset class '%s' has data in Gold layer (fallback check)", asset_class)
            else:
                logger.warning(
                    "Asset class '%s' requested but no Gold data found. "
                    "Skipping %s agent training.",
                    asset_class,
                    asset_class,
                )
    
    return available_asset_classes


def parse_asset_selection(args: argparse.Namespace) -> List[str]:
    if args.agents and args.agents != "all":
        asset_list = args.agents
    else:
        asset_list = args.asset_classes
    return [asset.strip() for asset in asset_list.split(",") if asset.strip()]


def train_ppo_agents(
    factory: PPOAgentFactory,
    selected_assets: Iterable[str],
    ppo_config: Dict[str, Any],
    gold_path: Path,
    models_dir: Path,
    seed: int,
    wandb_run: Optional["wandb.sdk.wandb_run.Run"],
) -> None:
    defaults = ppo_config.get("defaults", {})
    asset_configs = ppo_config.get("asset_classes", {})

    for asset in selected_assets:
        asset_cfg = asset_configs.get(asset)
        if asset_cfg is None:
            logger.warning("Skipping asset class '%s' because it is not defined in the config.", asset)
            continue

        logger.info("Training PPO agent for asset class '%s'", asset)
        env_overrides = asset_cfg.get("env_config", {})
        window_size = asset_cfg.get("window_size", defaults.get("window_size", 64))
        env = build_trading_env(
            asset,
            gold_path,
            window_size=window_size,
            transaction_cost=asset_cfg.get("reward_weights", {}).get("transaction_cost_bps", 10) / 10_000,
            env_overrides=env_overrides,
        )
        env.reset(seed=seed)

        creator_name = f"create_{asset}_agent"
        if not hasattr(factory, creator_name):
            logger.error("PPOAgentFactory does not implement '%s'; skipping asset class.", creator_name)
            env.close()
            continue

        agent = getattr(factory, creator_name)(env)
        total_timesteps = int(asset_cfg.get("timesteps", defaults.get("timesteps", 1_000_000)))
        checkpoint_interval = int(asset_cfg.get("checkpoint_interval", defaults.get("checkpoint_interval", 100_000)))
        eval_interval = int(asset_cfg.get("eval_interval", checkpoint_interval))
        evaluation_episodes = int(asset_cfg.get("evaluation_episodes", 5))

        checkpoints_dir = models_dir / "ppo_agents" / asset
        checkpoints_dir.mkdir(parents=True, exist_ok=True)

        steps_completed = 0
        while steps_completed < total_timesteps:
            next_chunk = min(checkpoint_interval, total_timesteps - steps_completed)
            agent.train(next_chunk)
            steps_completed += next_chunk

            metrics = agent.evaluate(episodes=evaluation_episodes)
            metrics = {f"ppo/{asset}/{k}": v for k, v in metrics.items()}
            metrics[f"ppo/{asset}/global_step"] = steps_completed

            checkpoint_path = checkpoints_dir / f"ppo_{asset}_{steps_completed}.zip"
            agent.save(str(checkpoint_path))
            logger.info("Saved PPO checkpoint for %s at %s", asset, checkpoint_path)

            if wandb_run:
                try:
                    import wandb

                    wandb.log(metrics, step=steps_completed)
                except Exception as exc:  # pragma: no cover - network/credential dependent
                    logger.warning("Failed to log PPO metrics to Weights & Biases: %s", exc)

        env.close()


def train_sac_meta_controller(
    sac_config: Dict[str, Any],
    gold_path: Path,
    models_dir: Path,
    seed: int,
    wandb_run: Optional["wandb.sdk.wandb_run.Run"],
) -> None:
    training_cfg = sac_config.get("training", {})
    total_timesteps = int(training_cfg.get("total_timesteps", 1_000_000))
    checkpoint_interval = int(training_cfg.get("checkpoint_interval", 50_000))
    evaluation_interval = int(training_cfg.get("evaluation_interval", checkpoint_interval))
    evaluation_episodes = int(training_cfg.get("evaluation_episodes", 5))

    env = build_portfolio_env(
        gold_path,
        window_size=training_cfg.get("window_size", 63),
        initial_capital=sac_config.get("initial_capital", 1_000_000.0),
        leverage_limit=sac_config.get("leverage_limit", 1.5),
        turnover_penalty=sac_config.get("reward_config", {}).get("turnover_penalty", 0.1),
        risk_penalty=sac_config.get("reward_config", {}).get("risk_penalty", 0.2),
        allow_short=sac_config.get("action_bounds", [0.0, 1.0])[0] < 0,
    )
    env.reset(seed=seed)

    controller = SACMetaController(config=sac_config, env=env)
    controller.mapper.allow_short = sac_config.get("action_bounds", [0.0, 1.0])[0] < 0
    controller.mapper.leverage_limit = sac_config.get("leverage_limit", 1.5)
    checkpoints_dir = models_dir / "sac_controller"
    checkpoints_dir.mkdir(parents=True, exist_ok=True)

    steps_completed = 0
    while steps_completed < total_timesteps:
        next_chunk = min(checkpoint_interval, total_timesteps - steps_completed)
        controller.train(next_chunk)
        steps_completed += next_chunk

        if steps_completed % evaluation_interval == 0 or steps_completed == total_timesteps:
            metrics = controller.evaluate(episodes=evaluation_episodes)
            metrics = {f"sac/meta/{k}": v for k, v in metrics.items()}
            metrics["sac/meta/global_step"] = steps_completed
            if wandb_run:
                try:
                    import wandb

                    wandb.log(metrics, step=steps_completed)
                except Exception as exc:  # pragma: no cover
                    logger.warning("Failed to log SAC metrics to Weights & Biases: %s", exc)

        checkpoint_path = checkpoints_dir / f"sac_meta_controller_{steps_completed}.zip"
        controller.save(str(checkpoint_path))
        logger.info("Saved SAC meta-controller checkpoint at %s", checkpoint_path)

    env.close()


def main() -> None:
    args = parse_args()
    load_environment()
    seed_everything(args.seed)

    raw_config = yaml.safe_load(args.config.read_text())
    config = resolve_env_placeholders(raw_config)

    selected_assets = parse_asset_selection(args)
    gold_path = Path(args.gold_path) if args.gold_path else Path(args.data_root) / "gold"
    models_dir = Path(args.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    # Validate which asset classes have data available in Gold layer
    if args.stage in ("finetune", "all"):
        available_assets = _validate_asset_data_availability(selected_assets, gold_path)
        if not available_assets:
            logger.error(
                "No asset classes have data available in Gold layer at %s. "
                "Ensure the Bronze→Silver→Gold pipeline has been completed.",
                gold_path,
            )
            return
        if len(available_assets) < len(selected_assets):
            logger.warning(
                "Only %d out of %d requested asset classes have data available. "
                "Training will proceed with: %s",
                len(available_assets),
                len(selected_assets),
                ",".join(available_assets),
            )
        selected_assets = available_assets

    logger.info("Training stage=%s assets=%s", args.stage, ",".join(selected_assets))

    wandb_run: Optional["wandb.sdk.wandb_run.Run"] = None
    logging_cfg = config.get("logging", {})
    if args.stage in ("finetune", "all"):
        wandb_cfg = logging_cfg.get("wandb", {})
        run_name = f"{args.experiment_name}-{int(time.time())}"
        wandb_run = init_wandb(run_name, wandb_cfg, args.disable_wandb)

    if args.stage in ("pretrain", "all"):
        cql_config = config["cql_pretraining"]
        dataset_builder = OfflineDatasetBuilder(data_path=cql_config["dataset"]["source"])
        safety_validator = SafetyValidator(
            max_drawdown=cql_config["safety_constraints"]["max_drawdown"],
            max_position=cql_config["safety_constraints"]["max_position_size"],
            max_sector_weight=cql_config["safety_constraints"]["max_sector_weight"],
        )
        pretrainer = CQLPretrainer(config=cql_config, dataset_builder=dataset_builder, safety_validator=safety_validator)
        logger.info("Running CQL pretraining")
        dataset = pretrainer.load_offline_data()
        pretrainer.pretrain(dataset)

    if args.stage in ("finetune", "all"):
        ppo_config = config["ppo_agents"]
        factory = PPOAgentFactory(base_config=ppo_config)
        train_ppo_agents(factory, selected_assets, ppo_config, gold_path, models_dir, args.seed, wandb_run)

        sac_config = config["sac_meta_controller"]
        train_sac_meta_controller(sac_config, gold_path, models_dir, args.seed, wandb_run)

    if wandb_run:
        try:
            import wandb

            wandb.finish()
        except Exception:  # pragma: no cover
            pass


if __name__ == "__main__":
    main()
