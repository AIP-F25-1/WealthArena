# API Reference

The project uses docstrings and Sphinx to surface API documentation for critical modules. Add or update docstrings before regenerating the reference.

## Generating Docs

Regenerate the Sphinx sources whenever code changes introduce new public APIs:

```bash
sphinx-apidoc -o docs/api src/
```

Then build HTML output with:

```bash
sphinx-build -b html docs/source docs/build
```

## Key Entry Points

### Data (`src/data`)
- `collectors.YahooFinanceCollector.collect(symbols, interval, bronze_root, asset_type)` – downloads OHLCV data, enforces rate limits, and optionally persists to the Bronze layer.
- `collectors.CCXTCollector._fetch(exchange_id, symbol, timeframe, limit)` – wraps CCXT and returns a timestamp-indexed OHLCV frame.
- `processors.BronzeToSilverProcessor.process_*` – schema validation, corporate actions, and data quality flags for all asset classes.

### Feature Engineering (`src/features`)
- `technical.TechnicalIndicators.compute_sma(series, window)` – TA-Lib compatible SMA used across technical pipelines.
- `sentiment.SentimentFeatures.aggregate_sentiment(df)` – aligns FinBERT/BERTweet outputs with time-indexed aggregates and forward fills gaps.
- `correlation.CorrelationEstimator.compute_rolling_covariance(frame, window)` – produces Ledoit–Wolf shrinkage covariance matrices.

### Environments (`src/environments`)
- `trading_env.TradingEnv.step(action)` – executes trades with transaction costs, returning observation, reward, termination flags, and diagnostics.
- `portfolio_env.PortfolioEnv.step(action_vector)` – aggregates multi-asset returns, enforces leverage constraints, and produces reward components.
- `builders.build_trading_env(config)` / `builders.build_portfolio_env(config)` – load Gold datasets and materialize gym-compatible environments.

### Agents (`src/agents`)
- `ppo_agent.PPOAgent.train(total_timesteps)` – wraps Stable-Baselines3 PPO training with callback support and checkpointing.
- `ppo_agent.PPOAgentFactory.create_<asset>_agent(env)` – returns configured PPO agents per asset class using overrides from `config/agent_config.yaml`.
- `sac_meta_controller.SACMetaController.allocate_portfolio(observation)` – produces allocation weights informed by PPO signals, macro inputs, and covariance matrices.
- `cql_pretrainer.CQLPretrainer.pretrain(dataset)` – executes conservative Q-learning offline training with safety validation.

### Portfolio & Risk (`src/portfolio`)
- `optimizer.PortfolioOptimizer.optimize_sharpe()` – returns non-negative weights that sum to one using mean-variance optimization.
- `risk_manager.RiskManager.generate_risk_report(returns, equity_curve)` – computes VaR, CVaR, and drawdown statistics for monitoring.
- `regime_detector.RegimeDetector.predict(features)` – classifies regimes feeding back into the SAC controller.

### Backtesting (`src/backtesting`)
- `backtest_engine.BacktestEngine.run()` – runs Backtrader simulations with custom transaction cost models.
- `vectorized_backtester.VectorizedBacktester.run()` – executes vectorized backtests with consistent cost deductions.
- `walk_forward.WalkForwardOptimizer.run()` – performs purged K-fold walk-forward evaluation.
- `monte_carlo.MonteCarloSimulator.block_bootstrap()` / `.parametric_simulation()` – generates alternative paths for stress testing.

### Orchestration & Serving (`src/orchestration`, `src/serving`)
- `multi_agent_orchestrator.MultiAgentOrchestrator.create_workflow()` – assembles LangGraph workflows connecting PPO agents, SAC controller, and execution nodes.
- `ray_trainer.RayTrainer.train_ppo_agents()` – launches distributed PPO training jobs with Ray Tune.
- `model_server.ModelServer.build_bento()` – packages agents and controllers into a BentoML bundle (TradingService).
- `paper_trading.OrderExecutor.execute_signal(signal)` – validates and routes signals to Alpaca/CCXT connectors.

Maintain descriptive docstrings for these APIs to keep Sphinx output informative and aligned with code changes.
