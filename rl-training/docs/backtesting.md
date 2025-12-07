# Backtesting & Evaluation

The evaluation stack combines event-driven and vectorized engines with robust validation protocols to ensure trading strategies generalize.

## Event-Driven Backtesting (`src/backtesting/backtest_engine.py`)

- Built around Backtrader with wrappers for custom slippage and commission models (`CustomSlippageModel`, `CustomCommissionModel`).
- Transaction cost parameters (commission, spread, volatility beta, Kyle/Lorentzian slippage) are defined in `config/backtest_config.yaml` and instantiated via `build_transaction_cost_model`.
- Entry point: `python scripts/run_backtest.py --config config/backtest_config.yaml --strategy RLAgentStrategy`.
- Supports multi-data feeds, broker customization, and RL agent integration (`RLAgentStrategy` for live inference inside Backtrader).

## Vectorized Testing (`src/backtesting/vectorized_backtester.py`)

- Accelerated numpy/pandas pipeline that mirrors order generation and cost deduction for large-scale sweeps (factor tests, hyperparameter grids).
- Shares cost-model configuration with the event-driven engine to maintain consistency between research and execution.
- Exposes `run()` with hooks for scenario slicing, pipeline checkpoints, and metric aggregation.

## Walk-Forward Optimization (`src/backtesting/walk_forward.py`)

- Implements Purged K-Fold cross-validation with embargo periods to avoid look-ahead bias.
- Supports nested hyperparameter selection and parameter stability diagnostics (`ParameterStabilityAnalyzer`) to guard against overfitting.
- Execute via `python scripts/run_walk_forward.py --config config/backtest_config.yaml`. Results are archived in `results/walk_forward/`.

## Monte Carlo & Stress Testing (`src/backtesting/monte_carlo.py`)

- Block bootstrap, circular bootstrap, parametric, and regime-conditioned simulations generate alternative return paths.
- Includes block-length heuristics, scenario generation, VaR/CVaR estimators, and reporting utilities.
- Launch with `python scripts/run_monte_carlo.py --config config/backtest_config.yaml`, saving outputs to `results/monte_carlo/`.

## Performance & Reporting (`src/backtesting/performance.py`)

- Metrics: Sharpe, Sortino, Calmar, CVaR, maximum drawdown, turnover, hit ratio, tail skewness.
- Regime-aware decomposition pairs performance with detected regimes (`src/portfolio/regime_detector.py`).
- Reporting pipeline merges event-driven/vectorized outputs, Monte Carlo diagnostics, and LangGraph notes into PDF/HTML summaries via `scripts/generate_reports.py`.

## Validation Workflow

1. **Run event-driven backtests** for baseline fidelity (`results/backtests/`).
2. **Execute walk-forward optimization** with purged folds to validate temporal robustness.
3. **Perform Monte Carlo stress tests** (block bootstrap and parametric) to quantify tail risk.
4. **Aggregate metrics** using `PerformanceEvaluator` and archive to `results/reports/`.

Always document configuration hashes and git commits in `results/README.md` to maintain reproducibility of reported statistics.
