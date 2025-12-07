import optuna, mlflow, random

from prometheus_client import start_http_server, Counter, Summary

# metrics
TUNE_TRIALS     = Counter('wealth_tune_trials_total', 'Optuna trials completed')
TUNE_ERRORS     = Counter('wealth_tune_errors_total', 'Optuna errors')
TUNE_TIME       = Summary('wealth_tune_duration_seconds', 'Total tuning duration (s)')
TUNE_BEST_ACC   = Summary('wealth_tune_best_accuracy', 'Best accuracy per sweep')

# start metrics server
start_http_server(8001)
print("[metrics] Optuna metrics at http://127.0.0.1:8001/metrics")

@TUNE_TIME.time()
def run_tuning():
    study = optuna.create_study(direction="maximize")
    try:
        def objective(trial):
            # (your existing search space & training code)
            acc = ...  # compute accuracy
            TUNE_TRIALS.inc()          # count each finished trial
            mlflow.log_metric("accuracy", acc)
            return acc

        with mlflow.start_run(run_name="optuna_sweep"):
            study.optimize(objective, n_trials=8)
            best_acc = float(study.best_value)
            TUNE_BEST_ACC.observe(best_acc)   # record best acc
            # (your existing: train final model, log_model(... registered_model_name=...))
    except Exception:
        TUNE_ERRORS.inc()
        raise

if __name__ == "__main__":
    run_tuning()
    # keep the endpoint alive briefly so Prometheus can scrape
    import time; time.sleep(30)



def objective(trial):
    lr = trial.suggest_float("lr", 1e-4, 1e-1, log=True)
    depth = trial.suggest_int("depth", 3, 10)
    acc = 0.8 + random.random() * 0.15  # mock accuracy
    mlflow.log_param("lr", lr)
    mlflow.log_param("depth", depth)
    mlflow.log_metric("accuracy", acc)
    return acc

if __name__ == "__main__":
    mlflow.set_experiment("optuna_tuning")
    with mlflow.start_run():
        study = optuna.create_study(direction="maximize")
        study.optimize(objective, n_trials=5)
        print("Best params:", study.best_params)


