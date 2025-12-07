# mlops/yahoo_ingest_mlflow.py
import os, time, argparse, json
import pandas as pd
import mlflow
from datetime import datetime
import yfinance as yf

# ---- CLI args ----
parser = argparse.ArgumentParser()
parser.add_argument("--tickers", type=str, required=True, help="Comma-separated tickers, e.g. AAPL,MSFT,GOOG")
parser.add_argument("--start", type=str, required=True, help="Start date YYYY-MM-DD")
parser.add_argument("--end", type=str, required=True, help="End date YYYY-MM-DD")
parser.add_argument("--interval", type=str, default="1d", help="1d,1h,5m,...")
parser.add_argument("--outdir", type=str, default="data", help="Output folder for CSV/Parquet")
parser.add_argument("--format", type=str, default="csv", choices=["csv", "parquet"])
args = parser.parse_args()

# ---- MLflow setup ----
EXPERIMENT = "data_ingest_yahoo"     # keep ingest runs separate from model-training runs
mlflow.set_experiment(EXPERIMENT)

tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
os.makedirs(args.outdir, exist_ok=True)

with mlflow.start_run(run_name=f"yahoo_ingest_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"):
    # log the “inputs” (params/tags) for reproducibility
    mlflow.log_param("tickers", ",".join(tickers))
    mlflow.log_param("start", args.start)
    mlflow.log_param("end", args.end)
    mlflow.log_param("interval", args.interval)
    mlflow.set_tag("component", "yahoo_ingest")

    overall_rows = 0
    overall_missing = 0
    per_ticker_stats = {}

    t0 = time.time()

    for t in tickers:
        df = yf.download(t, start=args.start, end=args.end, interval=args.interval, progress=False)

        # basic cleaning / index handling
        if isinstance(df.index, pd.DatetimeIndex):
            df = df.reset_index().rename(columns={"index": "datetime", "Date": "datetime"})

        rows, cols = df.shape
        missing = int(df.isna().sum().sum())
        overall_rows += rows
        overall_missing += missing

        per_ticker_stats[t] = {
            "rows": rows,
            "cols": cols,
            "missing_cells": missing,
        }

        # write file(s)
        base = f"{t}_{args.start}_{args.end}_{args.interval}"
        out_path = os.path.join(args.outdir, f"{base}.{args.format}")
        if args.format == "csv":
            df.to_csv(out_path, index=False)
        else:
            df.to_parquet(out_path, index=False)

        # log the file as an MLflow artifact
        mlflow.log_artifact(out_path, artifact_path=f"yahoo/{t}")

    elapsed = time.time() - t0

    # aggregate metrics
    mlflow.log_metric("tickers_count", len(tickers))
    mlflow.log_metric("total_rows", overall_rows)
    mlflow.log_metric("total_missing_cells", overall_missing)
    mlflow.log_metric("elapsed_seconds", elapsed)

    # log a small summary JSON as an artifact (handy for inspection)
    summary = {
        "tickers": tickers,
        "start": args.start,
        "end": args.end,
        "interval": args.interval,
        "stats": per_ticker_stats,
        "total_rows": overall_rows,
        "total_missing_cells": overall_missing,
        "elapsed_seconds": elapsed,
        "ingest_utc": datetime.utcnow().isoformat() + "Z",
    }
    summary_path = os.path.join(args.outdir, "yahoo_ingest_summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    mlflow.log_artifact(summary_path, artifact_path="yahoo")

    print(f"[OK] Ingested {len(tickers)} tickers, rows={overall_rows}, time={elapsed:.2f}s")
