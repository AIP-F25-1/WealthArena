# process_and_load.py
import os
from pathlib import Path
import numpy as np
import pandas as pd
import fsspec
from dotenv import load_dotenv
from dbConnection import get_conn

load_dotenv()

# ADLS config
ACCOUNT   = os.getenv("AZURE_STORAGE_ACCOUNT")
ACCOUNT_KEY = os.getenv("AZURE_STORAGE_KEY")
CONTAINER = os.getenv("ADLS_CONTAINER", "raw")
RAW_PREFIX = os.getenv("ADLS_RAW_PREFIX", "asxStocks")  # files like BHP.AX_raw.csv

fs = fsspec.filesystem("abfs", account_name=ACCOUNT, account_key=ACCOUNT_KEY)

def list_raw_csvs():
    return fs.glob(f"abfs://{CONTAINER}/{RAW_PREFIX}/*.csv")

def read_raw_csv(abfs_path: str) -> pd.DataFrame:
    with fs.open(abfs_path, "rb") as f:
        df = pd.read_csv(f)
    # Normalize expected raw columns
    df.columns = [c.strip().title() for c in df.columns]
    df = df[["Open","High","Low","Close","Volume","Date"]]
    # tz-aware timestamps -> UTC date
    dt = pd.to_datetime(df["Date"], utc=True, errors="coerce")
    df["date"] = dt.dt.date
    # numeric cast
    for c in ["Open","High","Low","Close","Volume"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=["date"])
    return df.sort_values("date").reset_index(drop=True)

def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    close = df["Close"]
    vol   = df["Volume"]

    # SMAs
    df["Sma_5"]   = close.rolling(5).mean()
    df["Sma_10"]  = close.rolling(10).mean()
    df["Sma_20"]  = close.rolling(20).mean()
    df["Sma_50"]  = close.rolling(50).mean()
    df["Sma_200"] = close.rolling(200).mean()

    # EMAs, MACD
    df["Ema_12"] = close.ewm(span=12, adjust=False).mean()
    df["Ema_26"] = close.ewm(span=26, adjust=False).mean()
    df["Macd"]        = df["Ema_12"] - df["Ema_26"]
    df["Macd_Signal"] = df["Macd"].ewm(span=9, adjust=False).mean()
    df["Macd_Hist"]   = df["Macd"] - df["Macd_Signal"]

    # Bollinger(20,2)
    mid   = df["Sma_20"]
    std20 = close.rolling(20).std()
    df["Bb_Middle"] = mid
    df["Bb_Upper"]  = mid + 2*std20
    df["Bb_Lower"]  = mid - 2*std20

    # Returns
    df["Returns"] = close.pct_change().fillna(0.0)
    df["Log_Returns"] = np.log(close/close.shift(1)).replace([np.inf,-np.inf], np.nan).fillna(0.0)

    # Vol, momentum, volume features
    df["Volatility_20"] = df["Log_Returns"].rolling(20).std()           # un-annualized
    df["Momentum_20"]   = close - close.shift(20)
    df["Volume_Sma_20"] = vol.rolling(20).mean()
    df["Volume_Ratio"]  = vol / df["Volume_Sma_20"]

    # final order (matching your processed CSV)
    out = df[["Open","High","Low","Close","Volume","date",
              "Sma_5","Sma_10","Sma_20","Sma_50","Sma_200",
              "Ema_12","Ema_26","Macd","Macd_Signal","Macd_Hist",
              "Bb_Middle","Bb_Upper","Bb_Lower",
              "Returns","Log_Returns","Volatility_20","Momentum_20",
              "Volume_Sma_20","Volume_Ratio"]]
    return out

def load_stage(cn, symbol: str, dfp: pd.DataFrame):
    # pyodbc batch insert
    rows = []
    for r in dfp.itertuples(index=False):
        rows.append((
            symbol, r.date,
            float(r.Open) if pd.notna(r.Open) else None,
            float(r.High) if pd.notna(r.High) else None,
            float(r.Low)  if pd.notna(r.Low)  else None,
            float(r.Close)if pd.notna(r.Close)else None,
            int(r.Volume) if pd.notna(r.Volume) else None,
            float(r.Sma_5) if pd.notna(r.Sma_5) else None,
            float(r.Sma_10) if pd.notna(r.Sma_10) else None,
            float(r.Sma_20) if pd.notna(r.Sma_20) else None,
            float(r.Sma_50) if pd.notna(r.Sma_50) else None,
            float(r.Sma_200) if pd.notna(r.Sma_200) else None,
            float(r.Ema_12) if pd.notna(r.Ema_12) else None,
            float(r.Ema_26) if pd.notna(r.Ema_26) else None,
            float(r.Macd) if pd.notna(r.Macd) else None,
            float(r.Macd_Signal) if pd.notna(r.Macd_Signal) else None,
            float(r.Macd_Hist) if pd.notna(r.Macd_Hist) else None,
            float(r.Bb_Middle) if pd.notna(r.Bb_Middle) else None,
            float(r.Bb_Upper) if pd.notna(r.Bb_Upper) else None,
            float(r.Bb_Lower) if pd.notna(r.Bb_Lower) else None,
            float(r.Returns) if pd.notna(r.Returns) else None,
            float(r.Log_Returns) if pd.notna(r.Log_Returns) else None,
            float(r.Volatility_20) if pd.notna(r.Volatility_20) else None,
            float(r.Momentum_20) if pd.notna(r.Momentum_20) else None,
            float(r.Volume_Sma_20) if pd.notna(r.Volume_Sma_20) else None,
            float(r.Volume_Ratio) if pd.notna(r.Volume_Ratio) else None,
        ))
    cur = cn.cursor()
    cur.fast_executemany = True
    cur.executemany("""
        INSERT INTO dbo.processed_stage (
            symbol,[date],[open],[high],[low],[close],volume,
            sma_5,sma_10,sma_20,sma_50,sma_200,
            ema_12,ema_26,macd,macd_signal,macd_hist,
            bb_middle,bb_upper,bb_lower,
            returns,log_returns,volatility_20,momentum_20,
            volume_sma_20,volume_ratio
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)
    cn.commit()

def merge_stage(cn):
    sql = """
    MERGE dbo.processed_prices AS tgt
    USING (SELECT * FROM dbo.processed_stage) AS src
      ON (tgt.symbol = src.symbol AND tgt.[date] = src.[date])
    WHEN MATCHED THEN UPDATE SET
      [open]=src.[open],[high]=src.[high],[low]=src.[low],[close]=src.[close],volume=src.volume,
      sma_5=src.sma_5,sma_10=src.sma_10,sma_20=src.sma_20,sma_50=src.sma_50,sma_200=src.sma_200,
      ema_12=src.ema_12,ema_26=src.ema_26,macd=src.macd,macd_signal=src.macd_signal,macd_hist=src.macd_hist,
      bb_middle=src.bb_middle,bb_upper=src.bb_upper,bb_lower=src.bb_lower,
      returns=src.returns,log_returns=src.log_returns,volatility_20=src.volatility_20,momentum_20=src.momentum_20,
      volume_sma_20=src.volume_sma_20,volume_ratio=src.volume_ratio
    WHEN NOT MATCHED THEN
      INSERT (symbol,[date],[open],[high],[low],[close],volume,
              sma_5,sma_10,sma_20,sma_50,sma_200,
              ema_12,ema_26,macd,macd_signal,macd_hist,
              bb_middle,bb_upper,bb_lower,
              returns,log_returns,volatility_20,momentum_20,
              volume_sma_20,volume_ratio)
      VALUES (src.symbol,src.[date],src.[open],src.[high],src.[low],src.[close],src.volume,
              src.sma_5,src.sma_10,src.sma_20,src.sma_50,src.sma_200,
              src.ema_12,src.ema_26,src.macd,src.macd_signal,src.macd_hist,
              src.bb_middle,src.bb_upper,src.bb_lower,
              src.returns,src.log_returns,src.volatility_20,src.momentum_20,
              src.volume_sma_20,src.volume_ratio);
    TRUNCATE TABLE dbo.processed_stage;
    """
    cn.cursor().execute(sql)
    cn.commit()

def main():
    cn = get_conn()
    paths = list_raw_csvs()
    print(f"Found {len(paths)} RAW files in ADLS.")
    processed_rows = 0

    for i, abfs_path in enumerate(paths, 1):
        name = Path(abfs_path).name
        symbol = name.replace("_raw.csv", "").upper()

        raw = read_raw_csv(abfs_path)
        if raw.empty:
            continue
        proc = compute_features(raw).dropna(subset=["Close"])  # drop pre-warmup rows
        if proc.empty:
            continue

        # attach symbol
        proc.insert(0, "symbol", symbol)

        load_stage(cn, symbol, proc)
        processed_rows += len(proc)

        # merge in chunks to keep stage small
        if i % 40 == 0:
            merge_stage(cn)
            print(f"Merged at file {i}/{len(paths)}…")

    merge_stage(cn)
    cn.close()
    print(f"✅ Done. Upserted ~{processed_rows} rows.")

if __name__ == "__main__":
    main()
