# fast_process_and_load.py
import os, math
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import polars as pl
import fsspec
import pyodbc
from dotenv import load_dotenv
from dbConnection import get_conn

# ---------- Config ----------
ENV_PATH = Path(__file__).with_name("sqlDB.env")
load_dotenv(ENV_PATH)

ACC  = os.getenv("AZURE_STORAGE_ACCOUNT")
KEY  = os.getenv("AZURE_STORAGE_KEY")
CONT = os.getenv("ADLS_CONTAINER", "raw")
PREF = os.getenv("ADLS_RAW_PREFIX", "asxStocks")

MAX_WORKERS        = min(8, (os.cpu_count() or 4))     # parallel readers
BATCH_ROWS         = 75_000                             # rows per executemany batch
MERGE_EVERY_ROWS   = 400_000                            # merge after this many staged rows

# ---------- ADLS ----------
fs = fsspec.filesystem("abfs", account_name=ACC, account_key=KEY)

def list_paths():
    return fs.glob(f"abfs://{CONT}/{PREF}/*_raw.csv")

# ---------- RSI(14) – Wilder smoothing ----------
def rsi14_expr(close_expr: pl.Expr) -> pl.Expr:
    diff = close_expr.diff()
    gain = pl.when(diff > 0).then(diff).otherwise(0.0)
    loss = pl.when(diff < 0).then(-diff).otherwise(0.0)
    ag = gain.ewm_mean(alpha=1/14, adjust=False, ignore_nulls=True)
    al = loss.ewm_mean(alpha=1/14, adjust=False, ignore_nulls=True)
    rs = ag / pl.when(al == 0).then(None).otherwise(al)
    return 100 - (100 / (1 + rs))

# ---------- per-file processing ----------
def process_one(abfs_path: str):
    name = Path(abfs_path).name
    symbol = name.replace("_raw.csv", "").upper()
    with fs.open(abfs_path, "rb") as f:
        df = pl.read_csv(f)

    # Normalize columns
    df = df.rename({c: c.strip().title() for c in df.columns})
    df = df.select("Open","High","Low","Close","Volume","Date")

    # Parse with tz, keep ASX local; also compute date_utc
    df = (
        df.with_columns([
            pl.col("Date")
              .str.strip_chars()
              .str.strptime(pl.Datetime, strict=False)
              .dt.convert_time_zone("Australia/Sydney")
              .alias("ts_local"),
            pl.col("Open").cast(pl.Float64, strict=False),
            pl.col("High").cast(pl.Float64, strict=False),
            pl.col("Low").cast(pl.Float64, strict=False),
            pl.col("Close").cast(pl.Float64, strict=False),
            pl.col("Volume").cast(pl.Int64, strict=False)
        ])
        .drop("Date")
        .with_columns([
            pl.col("ts_local").dt.convert_time_zone("UTC").dt.date().alias("date_utc")
        ])
        .sort("date_utc")
    )

    close = pl.col("Close")
    vol   = pl.col("Volume")

    # Build features in sequential blocks (respect dependencies)
    out = (
        df
        # SMAs
        .with_columns([
            close.rolling_mean(5).alias("SMA_5"),
            close.rolling_mean(10).alias("SMA_10"),
            close.rolling_mean(20).alias("SMA_20"),
            close.rolling_mean(50).alias("SMA_50"),
            close.rolling_mean(200).alias("SMA_200"),
        ])
        # EMAs
        .with_columns([
            close.ewm_mean(span=12, adjust=False, ignore_nulls=True).alias("EMA_12"),
            close.ewm_mean(span=26, adjust=False, ignore_nulls=True).alias("EMA_26"),
        ])
        # MACD -> signal -> hist
        .with_columns([(pl.col("EMA_12") - pl.col("EMA_26")).alias("MACD")])
        .with_columns([pl.col("MACD").ewm_mean(span=9, adjust=False, ignore_nulls=True).alias("MACD_signal")])
        .with_columns([(pl.col("MACD") - pl.col("MACD_signal")).alias("MACD_hist")])
        # RSI(14)
        .with_columns([rsi14_expr(close).alias("RSI_14")])
        # Bollinger(20,2)
        .with_columns([
            pl.col("SMA_20").alias("BB_middle"),
            (pl.col("SMA_20") + 2*close.rolling_std(20)).alias("BB_upper"),
            (pl.col("SMA_20") - 2*close.rolling_std(20)).alias("BB_lower"),
        ])
        # Returns + Log_Returns
        .with_columns([
            close.pct_change().alias("Returns"),
            (close / close.shift(1)).log().alias("Log_Returns"),
        ])
        # Volatility(20, annualized), Momentum(20 %), Volume features
        .with_columns([
            (pl.col("Returns").rolling_std(20) * math.sqrt(252)).alias("Volatility_20"),
            (close / close.shift(20) - 1).alias("Momentum_20"),
            vol.rolling_mean(20).alias("Volume_SMA_20"),
        ])
        .with_columns([(vol / pl.col("Volume_SMA_20")).alias("Volume_Ratio")])
        # attach symbol, finalize
        .with_columns([pl.lit(symbol).alias("symbol")])
        .select([
            "symbol","ts_local","date_utc","Open","High","Low","Close","Volume",
            "SMA_5","SMA_10","SMA_20","SMA_50","SMA_200",
            "EMA_12","EMA_26","RSI_14",
            "MACD","MACD_signal","MACD_hist",
            "BB_middle","BB_upper","BB_lower",
            "Returns","Log_Returns","Volatility_20","Momentum_20",
            "Volume_SMA_20","Volume_Ratio"
        ])
        .drop_nulls(subset=["Close","date_utc","ts_local"])
    )
    return symbol, out

# ---------- DB load ----------
def insert_stage(conn, df_pl: pl.DataFrame) -> int:
    if df_pl.is_empty():
        return 0

    cols = [
        "symbol","ts_local","date_utc","Open","High","Low","Close","Volume",
        "SMA_5","SMA_10","SMA_20","SMA_50","SMA_200",
        "EMA_12","EMA_26","RSI_14",
        "MACD","MACD_signal","MACD_hist",
        "BB_middle","BB_upper","BB_lower",
        "Returns","Log_Returns","Volatility_20","Momentum_20",
        "Volume_SMA_20","Volume_Ratio"
    ]
    table = df_pl.select(cols).to_dict(as_series=False)

    def gen_rows():
        n = len(df_pl)
        for i in range(n):
            yield (
                table["symbol"][i],
                str(table["ts_local"][i]),        # ISO8601 with offset
                table["date_utc"][i],
                table["Open"][i], table["High"][i], table["Low"][i], table["Close"][i], table["Volume"][i],
                table["SMA_5"][i], table["SMA_10"][i], table["SMA_20"][i], table["SMA_50"][i], table["SMA_200"][i],
                table["EMA_12"][i], table["EMA_26"][i], table["RSI_14"][i],
                table["MACD"][i], table["MACD_signal"][i], table["MACD_hist"][i],
                table["BB_middle"][i], table["BB_upper"][i], table["BB_lower"][i],
                table["Returns"][i], table["Log_Returns"][i], table["Volatility_20"][i], table["Momentum_20"][i],
                table["Volume_SMA_20"][i], table["Volume_Ratio"][i]
            )

    cur = conn.cursor()
    cur.fast_executemany = True
    rows = list(gen_rows())
    # Optional sanity:
    # assert len(rows[0]) == 28, f"Row has {len(rows[0])} values, expected 28"
    for start in range(0, len(rows), BATCH_ROWS):
        batch = rows[start:start+BATCH_ROWS]
        cur.executemany("""
            INSERT INTO dbo.processed_stage (
                symbol,ts_local,date_utc,[open],[high],[low],[close],volume,
                sma_5,sma_10,sma_20,sma_50,sma_200,
                ema_12,ema_26,rsi_14,
                macd,macd_signal,macd_hist,
                bb_middle,bb_upper,bb_lower,
                returns,log_returns,volatility_20,momentum_20,
                volume_sma_20,volume_ratio
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, batch)
    conn.commit()
    return len(rows)

def merge_stage(conn):
    cur = conn.cursor()
    cur.execute("""
        MERGE dbo.processed_prices AS tgt
        USING (SELECT * FROM dbo.processed_stage) AS src
          ON (tgt.symbol = src.symbol AND tgt.date_utc = src.date_utc)
        WHEN MATCHED THEN UPDATE SET
          ts_local=src.ts_local,
          [open]=src.[open],[high]=src.[high],[low]=src.[low],[close]=src.[close],volume=src.volume,
          sma_5=src.sma_5,sma_10=src.sma_10,sma_20=src.sma_20,sma_50=src.sma_50,sma_200=src.sma_200,
          ema_12=src.ema_12,ema_26=src.ema_26,rsi_14=src.rsi_14,
          macd=src.macd,macd_signal=src.macd_signal,macd_hist=src.macd_hist,
          bb_middle=src.bb_middle,bb_upper=src.bb_upper,bb_lower=src.bb_lower,
          returns=src.returns,log_returns=src.log_returns,volatility_20=src.volatility_20,momentum_20=src.momentum_20,
          volume_sma_20=src.volume_sma_20,volume_ratio=src.volume_ratio
        WHEN NOT MATCHED THEN
          INSERT (symbol,ts_local,date_utc,[open],[high],[low],[close],volume,
                  sma_5,sma_10,sma_20,sma_50,sma_200,
                  ema_12,ema_26,rsi_14,
                  macd,macd_signal,macd_hist,
                  bb_middle,bb_upper,bb_lower,
                  returns,log_returns,volatility_20,momentum_20,
                  volume_sma_20,volume_ratio)
          VALUES (src.symbol,src.ts_local,src.date_utc,src.[open],src.[high],src.[low],src.[close],src.volume,
                  src.sma_5,src.sma_10,src.sma_20,src.sma_50,src.sma_200,
                  src.ema_12,src.ema_26,src.rsi_14,
                  src.macd,src.macd_signal,src.macd_hist,
                  src.bb_middle,src.bb_upper,src.bb_lower,
                  src.returns,src.log_returns,src.volatility_20,src.momentum_20,
                  src.volume_sma_20,src.volume_ratio);
        TRUNCATE TABLE dbo.processed_stage;
    """)
    conn.commit()

def main():
    paths = list_paths()
    print(f"Found {len(paths)} RAW files.")
    if not paths:
        return

    conn = get_conn()
    staged_rows = 0
    processed_files = 0
    buffer: list[pl.DataFrame] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = {ex.submit(process_one, p): p for p in paths}
        for fut in as_completed(futs):
            _, dfp = fut.result()
            buffer.append(dfp)
            processed_files += 1

            # Stage when buffer big enough
            if sum(len(x) for x in buffer) >= BATCH_ROWS:
                big = pl.concat(buffer, how="vertical_relaxed")
                staged_rows += insert_stage(conn, big)
                buffer.clear()

            # Periodic MERGE
            if staged_rows >= MERGE_EVERY_ROWS:
                print(f"MERGE after staging ~{staged_rows} rows …")
                merge_stage(conn)
                staged_rows = 0

            if processed_files % 100 == 0:
                print(f"Processed {processed_files}/{len(paths)} files …")

    if buffer:
        big = pl.concat(buffer, how="vertical_relaxed")
        staged_rows += insert_stage(conn, big)

    print("Final MERGE …")
    merge_stage(conn)
    conn.close()
    print("✅ Done.")

if __name__ == "__main__":
    main()
