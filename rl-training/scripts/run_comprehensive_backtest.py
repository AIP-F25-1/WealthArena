"""Run comprehensive backtesting suite (event-driven, vectorized, WFO, Monte Carlo)."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Optional, Tuple

import pandas as pd
import yaml

from src.backtesting import (
    BacktestEngine,
    MonteCarloSimulator,
    VectorizedBacktester,
    WalkForwardOptimizer,
)
from src.backtesting.transaction_costs import build_transaction_cost_model
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run full backtesting workflow.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--backtest-type", type=str, default="all")
    parser.add_argument("--start-date", type=str, default=None)
    parser.add_argument("--end-date", type=str, default=None)
    parser.add_argument("--num-simulations", type=int, default=10_000)
    parser.add_argument("--output-dir", type=Path, default=Path("./results/backtests"))
    return parser.parse_args()


def _load_table(base_path: Path, candidates: Tuple[str, ...], description: str) -> Optional[pd.DataFrame]:
    for candidate in candidates:
        file_path = base_path / candidate
        if not file_path.exists():
            continue
        try:
            if file_path.suffix in {".parquet", ".pq"}:
                data = pd.read_parquet(file_path)
            elif file_path.suffix in {".feather"}:
                data = pd.read_feather(file_path)
            elif file_path.suffix in {".csv"}:
                data = pd.read_csv(file_path, parse_dates=True, infer_datetime_format=True)
            else:
                logger.warning("Unsupported file extension for %s at %s", description, file_path)
                continue
        except Exception:
            logger.exception("Failed to load %s from %s", description, file_path)
            return None
        if data.empty:
            logger.warning("%s at %s is empty.", description.capitalize(), file_path)
            return None
        logger.debug("Loaded %s from %s", description, file_path)
        return data
    logger.warning(
        "No files found for %s in %s. Expected one of %s",
        description,
        base_path,
        candidates,
    )
    return None


def main() -> None:
    args = parse_args()
    load_environment()
    raw_config = yaml.safe_load(args.config.read_text())
    config = resolve_env_placeholders(raw_config)
    logger.info("Running comprehensive backtest type=%s", args.backtest_type)

    backtest_cfg = config.get("backtesting", {})
    data_root = Path(backtest_cfg.get("data_path", "./data/gold/features")).expanduser()

    prices = _load_table(data_root, ("prices.parquet", "prices.feather", "prices.csv"), "price data")
    signals = _load_table(data_root, ("signals.parquet", "signals.feather", "signals.csv"), "signal data")
    features = _load_table(data_root, ("features.parquet", "features.feather", "features.csv"), "feature data")

    transaction_cost_cfg = config.get("transaction_costs", {})
    impact_cfg = config.get("market_impact", {})
    default_asset_class = backtest_cfg.get("default_asset_class", "stocks")
    try:
        transaction_cost_model = build_transaction_cost_model(default_asset_class, transaction_cost_cfg, impact_cfg)
    except Exception as exc:  # pragma: no cover - config dependent
        logger.warning("Falling back to default transaction cost model: %s", exc)
        transaction_cost_model = None

    if args.backtest_type in ("event-driven", "all"):
        if prices is None:
            logger.error("Skipping event-driven backtest: price data missing under %s", data_root)
        else:
            try:
                import backtrader as bt
            except ImportError:
                logger.error("Skipping event-driven backtest: backtrader is not installed. Install it to run this mode.")
            else:
                cerebro = bt.Cerebro()
                data_feed = bt.feeds.PandasData(dataname=prices)
                cerebro.adddata(data_feed)
                cerebro.broker.setcash(backtest_cfg.get("initial_capital", 100_000))
                engine = BacktestEngine(cerebro=cerebro)
                if transaction_cost_model is not None:
                    engine.set_transaction_cost_model(transaction_cost_model)
                engine.run()
                logger.info("Event-driven backtest completed successfully.")

    if args.backtest_type in ("vectorized", "all"):
        if prices is None or signals is None:
            logger.error(
                "Skipping vectorized backtest: prices or signals missing (prices=%s, signals=%s).",
                "available" if prices is not None else "missing",
                "available" if signals is not None else "missing",
            )
        else:
            shared_index = prices.index.intersection(signals.index)
            if shared_index.empty:
                logger.error("Skipping vectorized backtest: prices and signals have no overlapping timestamps.")
            else:
                aligned_prices = prices.loc[shared_index].sort_index()
                aligned_signals = signals.loc[shared_index].sort_index()
                vector_backtester = VectorizedBacktester(
                    prices=aligned_prices,
                    signals=aligned_signals,
                    transaction_cost_model=transaction_cost_model,
                )
                results = vector_backtester.run()
                logger.info(
                    "Vectorized backtest produced %d return points (total transaction cost %.6f).",
                    len(results["returns"]),
                    float(results["transaction_costs"].sum()),
                )

    if args.backtest_type in ("walk-forward", "all"):
        wf_cfg = config.get("walk_forward", {})
        wf_data = features if features is not None else prices
        if wf_data is None:
            logger.error("Skipping walk-forward optimization: feature or price data unavailable in %s.", data_root)
        else:
            optimizer = WalkForwardOptimizer(
                in_sample_window=wf_cfg.get("in_sample_window_days", 252),
                out_sample_window=wf_cfg.get("out_of_sample_window_days", 63),
                step_size=wf_cfg.get("step_size_days", 63),
                purge=wf_cfg.get("purge_days", 0),
                embargo=wf_cfg.get("embargo_days", 0),
            )
            wf_results = optimizer.run(wf_data)
            logger.info("Walk-forward optimization completed with %d folds.", len(wf_results))

    if args.backtest_type in ("monte-carlo", "all"):
        returns_series: Optional[pd.Series] = None
        if prices is not None:
            daily_returns = prices.sort_index().pct_change().dropna(how="all")
            if not daily_returns.empty:
                returns_series = daily_returns.mean(axis=1).dropna()
        if returns_series is None or returns_series.empty:
            logger.error("Skipping Monte Carlo simulation: unable to derive returns from price data in %s.", data_root)
        else:
            mc_cfg = config.get("monte_carlo", {})
            simulator = MonteCarloSimulator(
                returns=returns_series,
                num_simulations=args.num_simulations,
                seed=mc_cfg.get("seed", 123),
            )
            simulations = simulator.parametric_simulation(distribution=mc_cfg.get("methods", ["parametric_student_t"])[0])
            logger.info("Monte Carlo simulation generated %s paths.", simulations.shape[0])


if __name__ == "__main__":
    main()
