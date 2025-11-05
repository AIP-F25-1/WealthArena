#!/usr/bin/env python3
from __future__ import annotations

import os, math, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import polars as pl
import fsspec
from dotenv import load_dotenv

from dbConnection import get_conn

# ───────────────────────────── Config ─────────────────────────────
ENV_PATH = Path(__file__).with_name("sqlDB.env")
load_dotenv(ENV_PATH)

ACC  = os.getenv("AZURE_STORAGE_ACCOUNT")
KEY  = os.getenv("AZURE_STORAGE_KEY")
CONT = os.getenv("ADLS_CONTAINER", "raw")
PREF = os.getenv("ADLS_RAW_PREFIX_Crypto", "asxCrypto")   # ← default prefix for crypto raws

DELETE_SOURCE = os.getenv("ADLS_DELETE_SOURCE", "true").strip().lower() in {"1","true","yes"}
TRUNCATE_BEFORE = os.getenv("TRUNCATE_CRYPTO_PRICES_BEFORE", "false").strip().lower() in {"1","true","yes"}

MAX_WORKERS        = min(8, (os.cpu_count() or 4))
BATCH_ROWS         = int(os.getenv("BATCH_ROWS", "75000"))
MERGE_EVERY_ROWS   = int(os.getenv("MERGE_EVERY_ROWS", "200000"))

# Australia/Sydney for ts_local; crypto is 24/7 (label convenience)
LOCAL_TZ = "Australia/Sydney"

# Annualization for daily crypto (7d/week) vs equities
TRADING_DAYS_PER_YEAR = 365.0

# ────────────────────── ADLS access ─────────────────────
fs = fsspec.filesystem("abfs", account_name=ACC, account_key=KEY)

def list_paths() -> list[str]:
    paths = fs.glob(f"abfs://{CONT}/{PREF}/*_raw.csv")
    paths.sort()
    return paths

def _rm_with_retries(path: str, attempts: int = 5, base_sleep: float = 0.25) -> bool:
    for i in range(1, attempts + 1):
        try:
            if not fs.exists(path):
                return True
            fs.rm(path, recursive=False)
            if not fs.exists(path):
                return True
        except Exception as e:
            if i < attempts:
                time.sleep(base_sleep * (2 ** (i - 1)))
            else:
                print(f"[WARN] Failed to delete {path} after {attempts} attempts: {e}")
                return False
    return False

# ───────────────────── Indicators ─────────────────────
def rsi14_expr(close: pl.Expr) -> pl.Expr:
    diff = close.diff()
    gain = pl.when(diff > 0).then(diff).otherwise(0.0)
    loss = pl.when(diff < 0).then(-diff).otherwise(0.0)
    ag = gain.ewm_mean(alpha=1/14, adjust=False, ignore_nulls=True)
    al = loss.ewm_mean(alpha=1/14, adjust=False, ignore_nulls=True)
    rs = ag / pl.when(al == 0).then(None).otherwise(al)
    return 100 - (100 / (1 + rs))

# ───────────────────── Datetime parsing ─────────────────────
DT_WITH_TZ = [
    "%Y-%m-%d %H:%M:%S%:z", "%Y-%m-%dT%H:%M:%S%:z",
    "%Y-%m-%d %H:%M:%S%z",  "%Y-%m-%dT%H:%M:%S%z",
]
DT_NAIVE = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"]

def parse_datetime_utc(col: str = "Date") -> pl.Expr:
    cands: list[pl.Expr] = []
    for fmt in DT_WITH_TZ:
        cands.append(pl.col(col).str.strptime(pl.Datetime, format=fmt, strict=False).dt.convert_time_zone("UTC"))
    for fmt in DT_NAIVE:
        cands.append(pl.col(col).str.strptime(pl.Datetime, format=fmt, strict=False).dt.replace_time_zone("UTC"))
    return pl.coalesce(cands).alias("ts_utc")

# ───────────────────── Per-file processing ─────────────────────
def process_one(abfs_path: str) -> tuple[str, pl.DataFrame]:
    name = Path(abfs_path).name
    symbol = name.replace("_raw.csv", "").upper()  # e.g., BTC-AUD

    with fs.open(abfs_path, "rb") as f:
        df = pl.read_csv(
            f,
            infer_schema_length=0,
            try_parse_dates=False,
            ignore_errors=True,
            null_values=["", "null", "None"],
        )

    df = df.rename({c: c.strip().title() for c in df.columns})
    expected = {"Open","High","Low","Close","Volume","Date"}
    if missing := (expected - set(df.columns)):
        print(f"[WARN] {symbol}: missing columns {missing} — skipping")
        return symbol, pl.DataFrame()

    # numeric cleanse; crypto volumes can be fractional
    def _n(col: str) -> pl.Expr:
        return (
            pl.col(col)
              .cast(pl.Utf8, strict=False)
              .str.strip_chars()
              .str.replace_all(",", "")
              .str.replace_all(r"\s+", "")
              .cast(pl.Float64, strict=False)
        )

    df = (
        df.select("Open","High","Low","Close","Volume","Date")
          .with_columns([
              _n("Open").alias("Open"),
              _n("High").alias("High"),
              _n("Low").alias("Low"),
              _n("Close").alias("Close"),
              _n("Volume").alias("Volume"),
              parse_datetime_utc("Date")
          ])
          .drop("Date")
          .with_columns([
              pl.col("ts_utc").dt.convert_time_zone(LOCAL_TZ).alias("ts_local"),
              pl.col("ts_utc").dt.date().alias("date_utc"),
          ])
          .drop("ts_utc")
          .filter(pl.all_horizontal(pl.col(["Open","High","Low","Close"]).is_not_null()))
          .sort("date_utc")
    )

    if df.is_empty():
        print(f"[WARN] {symbol}: empty after cleaning — skipping")
        return symbol, pl.DataFrame()

    close = pl.col("Close")
    vol   = pl.col("Volume")

    out = (
        df
        .with_columns([
            close.rolling_mean(5).alias("SMA_5"),
            close.rolling_mean(10).alias("SMA_10"),
            close.rolling_mean(20).alias("SMA_20"),
            close.rolling_mean(50).alias("SMA_50"),
            close.rolling_mean(200).alias("SMA_200"),
        ])
        .with_columns([
            close.ewm_mean(span=12, adjust=False, ignore_nulls=True).alias("EMA_12"),
            close.ewm_mean(span=26, adjust=False, ignore_nulls=True).alias("EMA_26"),
        ])
        .with_columns((pl.col("EMA_12") - pl.col("EMA_26")).alias("MACD"))
        .with_columns(pl.col("MACD").ewm_mean(span=9, adjust=False, ignore_nulls=True).alias("MACD_signal"))
        .with_columns((pl.col("MACD") - pl.col("MACD_signal")).alias("MACD_hist"))
        .with_columns(rsi14_expr(close).alias("RSI_14"))
        .with_columns([
            pl.col("SMA_20").alias("BB_middle"),
            (pl.col("SMA_20") + 2 * close.rolling_std(20)).alias("BB_upper"),
            (pl.col("SMA_20") - 2 * close.rolling_std(20)).alias("BB_lower"),
        ])
        .with_columns([
            close.pct_change().alias("Returns"),
            (close / close.shift(1)).log().alias("Log_Returns"),
        ])
        .with_columns([
            (pl.col("Returns").rolling_std(20) * math.sqrt(TRADING_DAYS_PER_YEAR)).alias("Volatility_20"),
            (close / close.shift(20) - 1).alias("Momentum_20"),
            vol.rolling_mean(20).alias("Volume_SMA_20"),
        ])
        .with_columns((vol / pl.col("Volume_SMA_20")).alias("Volume_Ratio"))
        .with_columns(pl.lit(symbol).alias("symbol"))
        .select([
            "symbol","ts_local","date_utc","Open","High","Low","Close","Volume",
            "SMA_5","SMA_10","SMA_20","SMA_50","SMA_200",
            "EMA_12","EMA_26","RSI_14",
            "MACD","MACD_signal","MACD_hist",
            "BB_middle","BB_upper","BB_lower",
            "Returns","Log_Returns","Volatility_20","Momentum_20",
            "Volume_SMA_20","Volume_Ratio",
        ])
        .drop_nulls(subset=["Close","date_utc","ts_local"])
    )
    return symbol, out

# ────────────────────────── DB load helpers ──────────────────────────
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
        "Volume_SMA_20","Volume_Ratio",
    ]
    tbl = df_pl.select(cols).to_dict(as_series=False)

    def gen():
        n = len(df_pl)
        for i in range(n):
            yield (
                tbl["symbol"][i],
                str(tbl["ts_local"][i]),
                tbl["date_utc"][i],
                tbl["Open"][i], tbl["High"][i], tbl["Low"][i], tbl["Close"][i], tbl["Volume"][i],
                tbl["SMA_5"][i], tbl["SMA_10"][i], tbl["SMA_20"][i], tbl["SMA_50"][i], tbl["SMA_200"][i],
                tbl["EMA_12"][i], tbl["EMA_26"][i], tbl["RSI_14"][i],
                tbl["MACD"][i], tbl["MACD_signal"][i], tbl["MACD_hist"][i],
                tbl["BB_middle"][i], tbl["BB_upper"][i], tbl["BB_lower"][i],
                tbl["Returns"][i], tbl["Log_Returns"][i], tbl["Volatility_20"][i], tbl["Momentum_20"][i],
                tbl["Volume_SMA_20"][i], tbl["Volume_Ratio"][i],
            )

    cur = conn.cursor()
    cur.fast_executemany = True
    rows = list(gen())
    for start in range(0, len(rows), BATCH_ROWS):
        batch = rows[start:start + BATCH_ROWS]
        cur.executemany("""
            INSERT INTO dbo.crypto_processed_stage (
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

def merge_stage(conn) -> tuple[int,int]:
    cur = conn.cursor()
    cur.execute("SET LOCK_TIMEOUT 60000;")
    cur.execute("IF OBJECT_ID('tempdb..#act') IS NOT NULL DROP TABLE #act; CREATE TABLE #act(action NVARCHAR(10));")
    cur.execute("""
        MERGE dbo.crypto_processed_prices AS tgt
        USING (SELECT * FROM dbo.crypto_processed_stage) AS src
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
                  src.volume_sma_20,src.volume_ratio)
        OUTPUT $action INTO #act(action);
    """)
    cur.execute("SELECT SUM(CASE WHEN action='INSERT' THEN 1 ELSE 0 END), SUM(CASE WHEN action='UPDATE' THEN 1 ELSE 0 END) FROM #act;")
    row = cur.fetchone() or (0,0)
    cur.execute("DROP TABLE #act; TRUNCATE TABLE dbo.crypto_processed_stage;")
    conn.commit()
    ins, upd = (row[0] or 0, row[1] or 0)
    print(f"MERGE summary -> inserted: {ins}, updated: {upd}")
    return ins, upd

# ───────────────────────────── Main ─────────────────────────────
def main() -> None:
    # nicer stdout in Airflow
    try:
        import sys; sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

    paths = list_paths()
    print(f"Found {len(paths)} RAW crypto file(s) at abfs://{CONT}/{PREF}")
    if not paths:
        return

    conn = get_conn()

    # Fresh stage; optional full reload
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE dbo.crypto_processed_stage;")
    if TRUNCATE_BEFORE:
        print("⚠️  TRUNCATE dbo.crypto_processed_prices (full reload requested)…")
        cur.execute("TRUNCATE TABLE dbo.crypto_processed_prices;")
    conn.commit()

    processed_files = 0
    staged_rows = 0
    buffer: list[pl.DataFrame] = []
    pending_delete: list[str] = []

    def stage_now(buf: list[pl.DataFrame]) -> int:
        if not buf:
            return 0
        big = pl.concat(buf, how="vertical_relaxed") if len(buf) > 1 else buf[0]
        return insert_stage(conn, big)

    def do_merge_and_maybe_delete():
        nonlocal pending_delete
        if not pending_delete:
            return
        merge_stage(conn)
        if DELETE_SOURCE:
            ok = 0
            for p in pending_delete:
                if _rm_with_retries(p): ok += 1
            print(f"Deleted {ok}/{len(pending_delete)} source file(s) post-MERGE.")
        pending_delete = []

    try:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futs = {ex.submit(process_one, p): p for p in paths}
            for fut in as_completed(futs):
                src = futs[fut]
                try:
                    _, dfp = fut.result()
                except Exception as e:
                    print(f"[WARN] Skipping (error) {src} → {e}")
                    continue

                processed_files += 1
                if dfp.is_empty():
                    continue

                buffer.append(dfp)

                if sum(df.height for df in buffer) >= BATCH_ROWS:
                    staged_rows += stage_now(buffer)
                    pending_delete.extend([src])
                    buffer.clear()

                if staged_rows >= MERGE_EVERY_ROWS:
                    print(f"MERGE after staging ~{staged_rows} rows …")
                    do_merge_and_maybe_delete()
                    staged_rows = 0

                if processed_files % 100 == 0:
                    print(f"Processed {processed_files}/{len(paths)} files …")

        if buffer:
            staged_rows += stage_now(buffer)
            pending_delete.extend(paths[-len(buffer):])
            buffer.clear()

        print("Final MERGE …")
        do_merge_and_maybe_delete()
        print("✅ Done.")

    finally:
        try: conn.close()
        except Exception: pass

if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback; traceback.print_exc(); raise
