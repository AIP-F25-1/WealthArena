from pathlib import Path
from datetime import datetime, timezone
import pandas as pd

# Base folders
DATA_RAW = Path("data/raw/yahoo")
DATA_BRONZE = Path("data/bronze/yahoo")
(DATA_RAW).mkdir(parents=True, exist_ok=True)
(DATA_BRONZE / "prices").mkdir(parents=True, exist_ok=True)  # ensure nested folder exists

def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()

def save_df(df: pd.DataFrame, base: Path):
    """
    Save a dataframe to Parquet and CSV with the same base path.
    Example: base=".../AAPL_1d" -> writes AAPL_1d.parquet and AAPL_1d.csv
    """
    base.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(base.with_suffix(".parquet"))
    df.reset_index(drop=False).to_csv(base.with_suffix(".csv"), index=False)

def normalize_prices(df: pd.DataFrame, ticker: str, timeframe: str) -> pd.DataFrame:
    """
    Make Yahoo OHLCV frames tidy and consistent.
    Handles different datetime index/column names robustly.
    """
    if df is None or df.empty:
        return pd.DataFrame(columns=[
            "ts","open","high","low","close","adj close","volume","ticker","timeframe","source"
        ])

    out = df.reset_index()

    # Find a datetime-like column and call it 'ts'
    dt_col = None
    for cand in ["Datetime", "Date", "date", "datetime", "index"]:
        if cand in out.columns:
            dt_col = cand
            break
    if dt_col is None:
        # fallback: try to detect a datetime-like column
        for col in out.columns:
            try:
                pd.to_datetime(out[col])
                dt_col = col
                break
            except Exception:
                continue
    if dt_col is None:
        raise ValueError("Could not find a datetime column in Yahoo data")

    out = out.rename(columns={dt_col: "ts"})
    out = out.rename(columns=str.lower)

    # Standardize timestamp to UTC
    out["ts"] = pd.to_datetime(out["ts"], utc=True, errors="coerce")

    out["ticker"] = ticker
    out["timeframe"] = timeframe
    out["source"] = "yahoo"

    # Ensure core columns exist
    for col in ["open","high","low","close","adj close","volume"]:
        if col not in out.columns:
            out[col] = pd.NA

    # Clean invalid rows and order
    out = out.dropna(subset=["ts"]).sort_values("ts").reset_index(drop=True)
    return out

def basic_price_checks(df: pd.DataFrame) -> list[str]:
    issues = []
    if df is None or df.empty:
        issues.append("empty dataframe")
        return issues
    if (df["volume"].fillna(0) < 0).any():
        issues.append("negative volume found")
    if not df["ts"].is_monotonic_increasing:
        issues.append("timestamps out of order")
    return issues
