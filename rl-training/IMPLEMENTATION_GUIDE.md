# Implementation Guide

Step-by-step execution plan aligned with the critical implementation checklist.

## Phase 1: Foundation (Week 1–2)

1. **Create Environment**
   - `conda env create -f environment.yml`
   - `conda activate agentic-rl-trading`
   - Install optional GPU packages if available.
2. **Configure Secrets**
   - Copy `.env.template` → `.env` and populate API keys.
   - Validate API connectivity (Alpha Vantage, FRED, Reddit, Alpaca, CCXT).
3. **Collect Historical Data**
   - Generate stock catalog files: `python scripts/generate_stock_catalog.py --config config/data_config.yaml` (prerequisite; may take 2–3 minutes via Yahoo Finance Screener API).
   - Customize the universe size with `--target-count` if you need more or fewer tickers per sector.
   - Verify that seven CSV files exist in `data/catalog/stocks/` before running collectors.
   - `python scripts/collect_all_data.py --config config/data_config.yaml --assets all`
   - Verify Bronze layer populations and audit logs.
4. **Process Data Pipeline**
   - `python scripts/process_data_pipeline.py --stage bronze-to-silver`
   - `python scripts/process_data_pipeline.py --stage silver-to-gold --validate`
   - Inspect Silver/Gold outputs and data quality reports.
5. **Validate Data Quality**
   - Run `python scripts/validate_data.py` (to be implemented).
   - Update `PROGRESS_TRACKER.md` for Phase 1 milestones.

## Phase 2: Individual Agents (Week 3–5)

6. **Configure Agent Hyperparameters**
   - Review `config/agent_config.yaml` PPO sections.
   - Adjust sector-specific rewards and constraints if needed.
7. **Offline Pretraining (CQL)**
   - `python scripts/train_all_agents.py --stage pretrain --agents all --distributed`
   - Store checkpoints under `models/cql_pretrained`.
8. **Fine-Tune PPO Agents**
   - Iterate per asset class (stocks, forex, crypto, ETFs, commodities, options).
   - `python scripts/train_all_agents.py --stage finetune --agents stocks`
   - Monitor via W&B dashboards.
9. **Evaluate Individual Agents**
   - `python scripts/evaluate_agents.py --agents stocks`
   - Record metrics in `results/backtests`.
10. **Integrate Sentiment & Macro Features**
    - Confirm Gold datasets include sentiment/macro features.
    - Update PPO observation spaces if new features added.

## Phase 3: Meta-Model (Week 6–7)

11. **Train SAC Meta-Controller**
    - `python scripts/train_all_agents.py --agents sac --stage all`
    - Aggregate PPO signals as inputs.
12. **Covariance Estimation & Risk Management**
    - Implement Ledoit-Wolf covariance in `src/portfolio/optimizer.py`.
    - Validate `RiskManager` thresholds via unit tests.
13. **Regime Detection Integration**
    - Fit HMM/GMM models using `src/portfolio/regime_detector.py`.
    - Store regime probabilities under `data/gold/regimes`.
14. **Portfolio Optimization Pipeline**
    - Combine SAC outputs with PyPortfolioOpt allocations if needed.
    - Ensure risk constraints respected before execution.

## Phase 4: Orchestration & Testing (Week 8–9)

15. **LangGraph Workflow Setup**
    - Define workflows in `src/orchestration/multi_agent_orchestrator.py`.
    - Configure LangSmith tracing.
16. **Run Comprehensive Backtests**
    - `python scripts/run_comprehensive_backtest.py --backtest-type all`
    - Analyze output reports; validate against benchmarks.
17. **Walk-Forward Optimization**
    - `python scripts/run_comprehensive_backtest.py --backtest-type walk-forward`
    - Evaluate parameter stability.
18. **Monte Carlo Stress Testing**
    - `python scripts/run_comprehensive_backtest.py --backtest-type monte-carlo`
    - Review VaR/CVaR distributions.
19. **Update Documentation**
    - Capture findings in `docs/backtesting.md` and `results/reports`.

## Phase 5: Deployment (Week 10)

20. **Package Models with BentoML**
    - `python scripts/serve_and_trade.py --serve-only --models-dir ./models`
    - Validate health and metrics endpoints.
21. **Set Up Paper Trading**
    - Configure Alpaca/CCXT credentials in `.env`.
    - `python scripts/serve_and_trade.py --platform alpaca`
22. **Run Paper Trading Loop**
    - Monitor trades, exposures, and LangSmith logs.
23. **Risk Monitoring**
    - Utilize `src/portfolio/risk_manager.py` for real-time alerts.
24. **Finalize Deployment Docs**
    - Update `docs/deployment.md` and `docs/troubleshooting.md`.

## Phase 6: Paper Writing (Week 11–12)

25. **Generate Figures & Tables**
    - Use notebooks `06_backtest_analysis.ipynb`, `09_paper_results.ipynb`.
    - Export visuals to `paper/figures` and `paper/tables`.
26. **Draft LaTeX Sections**
    - Populate `paper/sections/*.tex` per outline.
27. **Compile References**
    - Maintain APA citations in `paper/references.bib`.
28. **Review & Finalize**
    - Run LaTeX build (`latexmk` or `pdflatex`) via `paper/Makefile` or `compile.sh`.
    - Ensure reproducibility artifacts archived in `results/` and `experiments/`.

## Progress Tracking

- Update `PROGRESS_TRACKER.md` after each milestone.
- Log experiment metadata in W&B and locally under `experiments/`.
- Document deviations, blockers, and resolutions in `docs/troubleshooting.md`.

## Windows-Specific Notes

- Prefer conda installations for TA-Lib, cvxpy, and PyTorch CUDA.
- Set `OMP_NUM_THREADS` and `MKL_NUM_THREADS` to avoid CPU oversubscription.
- Use WSL2 for heavy backtests if Windows constraints arise.
- Install MiKTeX or TeX Live for LaTeX compilation when generating the paper.
