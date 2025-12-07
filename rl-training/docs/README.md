# Project Documentation

> **Note**: This document describes the `docs/` directory structure within the `rl-training/` component. For the main RL training setup and usage, see [rl-training/README.md](../README.md). This file serves as an index for the technical documentation within the rl-training component.

The `docs/` directory provides high-level and subsystem-specific documentation for the Agentic Multi-Agent RL Trading System.

## Contents

- `architecture.md` – System overview, component interactions, and data flow.
- `data_pipeline.md` – Medallion architecture, collectors/processors, ETL commands.
- `agents.md` – PPO agents, SAC meta-controller, CQL pretraining details.
- `backtesting.md` – Event-driven/vectorized engines, walk-forward, Monte Carlo, metrics.
- `deployment.md` – BentoML serving, paper trading connectors, environment configuration.
- `api_reference.md` – Quick reference for key modules/functions.
- `troubleshooting.md` – Common issues and remediation steps on Windows/WSL/Linux.

## Building the Paper

```bash
cd paper
pdflatex main.tex   # requires TeX Live or MiKTeX with biblatex/biber
biber main
pdflatex main.tex
```

## Running Tests

```bash
conda activate agentic-rl-trading
pytest -v --cov=src --cov-report=html
```

## Updating Documentation

Install documentation dependencies once per environment:

```bash
pip install sphinx myst-parser sphinxcontrib-mermaid
```

Then regenerate API stubs and build HTML output:

```bash
# Regenerate API stubs and build Sphinx docs
sphinx-apidoc -o docs/api src/
sphinx-build -b html docs/source docs/build
```

1. Keep module docstrings accurate; the API reference pulls descriptions directly from code.
2. Update configuration references whenever `config/*.yaml` changes.
3. Sync troubleshooting steps with new dependencies or known issues.
