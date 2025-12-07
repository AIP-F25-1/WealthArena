# Deployment & Serving

This guide covers packaging, serving, and paper-trading the multi-agent system.

## BentoML Service (`src/serving/model_server.py`)

- `ModelServer.build_bento()` packages PPO agents, the SAC meta-controller, feature transformers, and configuration artefacts into a Bento bundle.
- The resulting service (`TradingService`) exposes REST endpoints:
  - `POST /predict` – infer per-asset actions (raw agent outputs).
  - `POST /allocate` – return SAC-derived portfolio weights.
  - `GET /health` – readiness/liveness probe.
  - `GET /metrics` – Prometheus metrics when enabled.
- Build & serve:
  ```bash
  python scripts/serve_models.py --config config/agent_config.yaml --backtest-config config/backtest_config.yaml
  ```
- The service honours environment variables from `.env`/`.env.template` (API keys, WANDB project, LangSmith tokens). Follow the logger pattern in `src/utils.get_logger` for custom endpoints.

## Paper Trading & Live Sandbox (`src/serving/paper_trading.py`)

- `PaperTradingConnector` routes allocations through broker-specific adapters:
  - `AlpacaConnector` for equities/crypto using Alpaca’s paper trading API.
  - `CCXTConnector` for exchange sandboxes (Binance, Kraken, FTX, etc.).
- Real-time execution entry points:
  ```bash
  python scripts/run_paper_trading.py --config config/agent_config.yaml --env paper
  python scripts/serve_and_trade.py --serve-only   # Serve Bento + orchestrate live trading
  ```
- `.env.template` documents required credentials:
  - `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`
  - `CCXT_EXCHANGE`, `CCXT_API_KEY`, `CCXT_SECRET`
  - `WANDB_API_KEY`, `LANGSMITH_API_KEY`, `LANGSMITH_TRACING`
  - `RAY_ADDRESS`, `OMP_NUM_THREADS`, `MKL_NUM_THREADS`
- Risk & compliance: `OrderExecutor` enforces position limits, leverage caps, and cooldowns before orders leave the system.

## Orchestration & Monitoring

- LangGraph workflows (`src/orchestration/multi_agent_orchestrator.py`) coordinate PPO agents, the SAC controller, and execution connectors. Use `scripts/serve_and_trade.py` to spin up the full orchestration graph.
- LangSmith tracing can be toggled via environment variables and is automatically captured by `src/orchestration/experiment_tracker.py`.
- Experiment logging and alerts publish to W&B/TensorBoard directories under `experiments/`.

## Windows & Deployment Notes

- On Windows 10/11 prefer the conda environment (`environment.yml`) and run `python scripts/setup_environment.py` for dependency validation.
- Install TA-Lib via Gohlke wheels if building from source fails (`pip install <wheel>`), or rely on `conda install -c conda-forge ta-lib`.
- Set CPU affinity variables to avoid Ray oversubscription: `OMP_NUM_THREADS=1`, `MKL_NUM_THREADS=1`.
- For production packaging, export Bento bundles to `models/bentos/` and optionally containerize via `bentoml containerize TradingService:latest`.
