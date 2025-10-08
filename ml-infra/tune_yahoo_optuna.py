# mlops/tune_yahoo_optuna.py
import os, time, glob
from pathlib import Path

import mlflow
from mlflow.models import infer_signature

import optuna
import ray
from ray import tune
from ray.tune.search.optuna import OptunaSearch

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score


EXPERIMENT_NAME = "yahoo_optuna_sweep"
MODEL_NAME = "yahoo_direction_classifier"
DATA_DIR = Path(__file__).resolve().parent / "data"
TICKER = "AAPL"


def _latest_csv(ticker: str) -> Path:
    pattern = str(DATA_DIR / f"{ticker}_*.csv")
    files = glob.glob(pattern)
    if not files:
        raise FileNotFoundError(f"No CSV found for {ticker} in {DATA_DIR}. Run yahoo_ingest_mlflow.py first.")
    files.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    return Path(files[0])


def _make_features(df: pd.DataFrame):
    df = df.copy()
    df["ret_1"] = df["Close"].pct_change()
    df["sma_5"] = df["Close"].rolling(5).mean()
    df["sma_gap"] = df["Close"] / df["sma_5"] - 1.0
    df["target"] = (df["Close"].shift(-1) > df["Close"]).astype(int)
    df = df.dropna()

    X = df[["Open", "High", "Low", "Close", "Volume", "ret_1", "sma_gap"]].astype(float)
    y = df["target"].astype(int)
    return X, y


def train_fn(config):
    mlflow.set_experiment(EXPERIMENT_NAME)
    with mlflow.start_run(nested=True):
        csv_path = _latest_csv(TICKER)
        df = pd.read_csv(csv_path)
        X, y = _make_features(df)
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        model = LogisticRegression(
            C=config["C"],
            max_iter=config["max_iter"],
            solver="lbfgs"
        )

        t0 = time.time()
        model.fit(Xtr, ytr)
        acc = accuracy_score(yte, model.predict(Xte))
        elapsed = time.time() - t0

        mlflow.log_params(config)
        mlflow.log_metric("accuracy", acc)
        mlflow.log_metric("train_seconds", elapsed)
        mlflow.set_tag("source", "optuna_ray")

        tune.report(accuracy=acc)


def main():
    ray.init(ignore_reinit_error=True)

    # Define Optuna search space
    search_space = {
        "C": tune.loguniform(1e-2, 1e2),
        "max_iter": tune.choice([100, 200, 400, 800])
    }

    optuna_search = OptunaSearch(metric="accuracy", mode="max")

    analysis = tune.run(
        train_fn,
        config=search_space,
        num_samples=8,   # number of trials
        search_alg=optuna_search,
        resources_per_trial={"cpu": 1},
        verbose=1
    )

    best_cfg = analysis.get_best_config(metric="accuracy", mode="max")

    # Retrain with best config and register model
    csv_path = _latest_csv(TICKER)
    df = pd.read_csv(csv_path)
    X, y = _make_features(df)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    final_model = LogisticRegression(C=best_cfg["C"], max_iter=best_cfg["max_iter"], solver="lbfgs")
    final_model.fit(Xtr, ytr)
    final_acc = accuracy_score(yte, final_model.predict(Xte))

    mlflow.set_experiment(EXPERIMENT_NAME)
    with mlflow.start_run(run_name="optuna_best"):
        mlflow.log_params(best_cfg)
        mlflow.log_metric("accuracy", final_acc)
        sig = infer_signature(Xtr, final_model.predict(Xtr))
        mlflow.sklearn.log_model(final_model, "model", registered_model_name=MODEL_NAME,
                                 input_example=Xtr.iloc[:2], signature=sig)
    print(f"[OK] Best config {best_cfg} with accuracy {final_acc:.4f} registered in MLflow")


if __name__ == "__main__":
    main()
