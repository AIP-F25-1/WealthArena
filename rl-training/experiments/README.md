# Experiments Directory

Each experiment is stored in a timestamped subdirectory following the pattern `YYYYMMDD_HHMMSS_experiment_name/` with the structure:

- `config.yaml`: Training/evaluation configuration snapshot.
- `checkpoints/`: Model checkpoints and saved policies.
- `logs/`: Console and framework logs.
- `results/`: Metrics, plots, and evaluation summaries.
- `artifacts/`: Additional outputs (predictions, trades, rollout traces).

Use Weights \& Biases run IDs or Ray Tune trial IDs to map remote experiments to local artifacts. Update this directory when new experiments are executed via `scripts/train_all_agents.py` or backtesting scripts.
