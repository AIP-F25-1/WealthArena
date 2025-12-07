import os, time, mlflow
from pathlib import Path


from prometheus_client import start_http_server, Counter, Summary

RETRAIN_RUNS    = Counter('wealth_retrain_runs_total', 'Auto-retrain runs attempted')
RETRAIN_ERRORS  = Counter('wealth_retrain_errors_total', 'Auto-retrain errors')
RETRAIN_TIME    = Summary('wealth_retrain_duration_seconds', 'Auto-retrain duration (s)')
RETRAIN_ACC     = Summary('wealth_retrain_candidate_accuracy', 'Accuracy of candidate model')
PROMOTIONS      = Counter('wealth_retrain_promotions_total', 'Promotions to PRODUCTION')

start_http_server(8002)
print("[metrics] Auto-retrain metrics at http://127.0.0.1:8002/metrics")

@RETRAIN_TIME.time()
def run_autoretrain():
    RETRAIN_RUNS.inc()
    try:
        # ... your existing training logic ...
        model, acc = train_simple_model()       # or your real trainer
        RETRAIN_ACC.observe(acc)

        # ... register + stage; if promoted to PRODUCTION:
        # PROMOTIONS.inc()
    except Exception:
        RETRAIN_ERRORS.inc()
        raise

if __name__ == "__main__":
    run_autoretrain()
    import time; time.sleep(30)



DATA_DIR = Path("data")
CHECK_INTERVAL = 3600  # check every hour
THRESHOLD = 0.85       # retrain if accuracy < 0.85

def get_latest_model_metric():
    client = mlflow.tracking.MlflowClient()
    runs = client.search_runs(experiment_ids=["0"], order_by=["metrics.accuracy DESC"], max_results=1)
    return runs[0].data.metrics.get("accuracy", 0) if runs else 0

def new_data_available():
    recent_files = [f for f in DATA_DIR.glob("*.csv") if time.time() - f.stat().st_mtime < 86400]
    return bool(recent_files)

if __name__ == "__main__":
    acc = get_latest_model_metric()
    if acc < THRESHOLD or new_data_available():
        print("⚙️ Retraining model...")
        os.system("python mlops/train_yahoo_from_csv.py")
    else:
        print("✅ Model healthy, no retrain needed.")
