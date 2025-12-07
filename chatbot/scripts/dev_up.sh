#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

python -m venv .venv || true
source .venv/bin/activate

pip install -U pip
pip install -r requirements.txt

python scripts/kb_ingest.py

export APP_HOST=127.0.0.1
export APP_PORT=${1:-8000}
python -m uvicorn app.main:app --host "$APP_HOST" --port "$APP_PORT" --reload
