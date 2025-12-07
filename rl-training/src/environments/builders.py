"""
Utility builders for constructing trading environments from stored datasets.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, Optional

import pandas as pd

from .portfolio_env import MultiAssetPortfolioEnv
from .trading_env import (
    CommodityTradingEnv,
    CryptoTradingEnv,
    ETFTradingEnv,
    ForexTradingEnv,
    OptionsTradingEnv,
    StockTradingEnv,
    TradingEnv,
)

ENV_CLASS_REGISTRY = {
    "stocks": StockTradingEnv,
    "forex": ForexTradingEnv,
    "crypto": CryptoTradingEnv,
    "etfs": ETFTradingEnv,
    "commodities": CommodityTradingEnv,
    "options": OptionsTradingEnv,
}


def _read_table(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Expected dataset at {path} (run the Bronze→Silver→Gold pipeline first).")
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    if path.suffix == ".feather":
        return pd.read_feather(path)
    if path.suffix == ".csv":
        return pd.read_csv(path, parse_dates=True, infer_datetime_format=True)
    raise ValueError(f"Unsupported file extension for dataset: {path.name}")


def _candidate_paths(base: Path, asset_name: str) -> Iterable[Path]:
    yield base / "features" / f"{asset_name}.parquet"
    yield base / "features" / f"{asset_name}.feather"
    yield base / "features" / f"{asset_name}.csv"
    yield base / "training_sets" / f"{asset_name}.parquet"
    yield base / "training_sets" / f"{asset_name}.csv"


def load_asset_frame(asset_class: str, gold_path: Path) -> pd.DataFrame:
    for candidate in _candidate_paths(gold_path, asset_class):
        if candidate.exists():
            frame = _read_table(candidate)
            if "close" not in frame.columns:
                raise ValueError(
                    f"Dataset {candidate} for asset class '{asset_class}' is missing a 'close' column required by TradingEnv."
                )
            return frame
    raise FileNotFoundError(
        f"No dataset found for asset class '{asset_class}' under {gold_path}. "
        "Ensure the Silver→Gold pipeline generated the required features."
    )


def build_trading_env(
    asset_class: str,
    gold_path: Path,
    *,
    window_size: int = 64,
    initial_cash: float = 1_000_000.0,
    transaction_cost: float = 0.0005,
    env_overrides: Optional[Dict[str, Any]] = None,
) -> TradingEnv:
    env_overrides = env_overrides or {}
    env_cls = ENV_CLASS_REGISTRY.get(asset_class)
    if env_cls is None:
        raise KeyError(f"Unsupported asset class '{asset_class}'. Available: {sorted(ENV_CLASS_REGISTRY.keys())}")

    frame = load_asset_frame(asset_class, gold_path)
    config = {
        "window_size": env_overrides.get("window_size", window_size),
        "initial_cash": env_overrides.get("initial_cash", initial_cash),
        "transaction_cost": env_overrides.get("transaction_cost", transaction_cost),
        "reward_scaling": env_overrides.get("reward_scaling", 1.0),
        "max_position": env_overrides.get("max_position", 1.0),
    }
    config.update(env_overrides)
    return env_cls(frame, config=config)


def build_portfolio_env(
    gold_path: Path,
    *,
    window_size: int = 63,
    initial_capital: float = 1_000_000.0,
    leverage_limit: float = 1.5,
    turnover_penalty: float = 0.1,
    risk_penalty: float = 0.2,
    risk_free_rate: float = 0.0,
    allow_short: bool = False,
    covariance_matrix: Optional[pd.DataFrame] = None,
) -> MultiAssetPortfolioEnv:
    candidates = [
        gold_path / "portfolios" / "meta_controller_inputs.parquet",
        gold_path / "portfolios" / "meta_controller.parquet",
        gold_path / "features" / "meta_controller.parquet",
    ]
    for path in candidates:
        if path.exists():
            frame = _read_table(path)
            break
    else:
        raise FileNotFoundError(
            f"Unable to locate portfolio training dataset in {gold_path}. "
            "Expected one of: meta_controller_inputs.parquet or meta_controller.parquet."
        )

    config = {
        "window_size": window_size,
        "initial_capital": initial_capital,
        "leverage_limit": leverage_limit,
        "turnover_penalty": turnover_penalty,
        "risk_penalty": risk_penalty,
        "risk_free_rate": risk_free_rate,
        "allow_short": allow_short,
    }
    if covariance_matrix is not None:
        config["covariance_matrix"] = covariance_matrix

    return MultiAssetPortfolioEnv(data=frame, config=config)

