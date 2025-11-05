#!/usr/bin/env python3
# File: processAndStoreCommodities.py
from __future__ import annotations

import os
import math
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Tuple

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
PREF = os.getenv("ADLS_RAW_PREFIX_COMMODITIES", "asxCommodities")  # folder holding *_raw.csv

# Delete sources in ADLS ONLY AFTER a successful MERGE
DELETE_SOURCE = os.getenv("ADLS_DELETE_SOURCE", "true").strip().lower() in {"1", "true", "yes"}

# Truncate target table BEFORE processing (full reload)
TRUNCATE_PRICES_BEFORE = os.getenv("TRUNCATE_COMMODITIES_BEFORE", "false").strip().lower() in {"1", "true", "yes"}

# Parallelism + batching
MAX_WORKERS        = min(8, (os.cpu_count() or 4))
BATCH_ROWS         = int(os.getenv("BATCH_ROWS", "75000"))
MERGE_EVERY_ROWS   = int(os.getenv("MERGE_EVERY_ROWS", "200000"))

# Destination timezone label (presentation only)
AU_TZ = "Australia/Sydney"

# ────────────────────── ADLS / Storage access ─────────────────────

fs = fsspec.filesystem("abfs", account_name=ACC, account_key=KEY)

def list_paths() -> List[str]:
    pats = [
        f"abfs://{CONT}/{PREF}/*_AUD_raw.csv",
        f"abfs://{CONT}/{PREF}/*_USD_raw.csv",
        f"abfs://{CONT}/{PREF}/*_raw.csv",
    ]
    paths: List[str] = []
    for pat in pats:
        paths.extend(fs.glob(pat))
    return sorted(set(paths))

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

# ───────────────────── Technical indicators (Polars) ─────────────────────

def rsi14_expr(close_expr: pl.Expr) -> pl.Expr:
    """RSI(14) using Wilder smoothing."""
    diff = close_expr.diff()
    gain = pl.when(diff > 0).then(diff).otherwise(0.0)
    loss = pl.when(diff < 0).then(-diff).otherwise(0.0)
    ag = gain.ewm_mean(alpha=1/14, adjust=False, ignore_nulls=True)
    al = loss.ewm_mean(alpha=1/14, adjust=False, ignore_nulls=True)
    rs = ag / pl.when(al == 0).then(None).otherwise(al)
    return 100 - (100 / (1 + rs))

# ────────────────────── Robust datetime parsing ──────────────────────

DT_FORMATS_WITH_TZ = [
    "%Y-%m-%d %H:%M:%S%:z",
    "%Y-%m-%dT%H:%M:%S%:z",
    "%Y-%m-%d %H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%S%z",
]
DT_FORMATS_NAIVE = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d",
]

def parse_datetime_utc(col: str = "Date") -> pl.Expr:
    cands: list[pl.Expr] = []
    for fmt in DT_FORMATS_WITH_TZ:
        cands.append(pl.col(col).str.strptime(pl.Datetime, format=fmt, strict=False).dt.convert_time_zone("UTC"))
    for fmt in DT_FORMATS_NAIVE:
        cands.append(pl.col(col).str.strptime(pl.Datetime, format=fmt, strict=False).dt.replace_time_zone("UTC"))
    return pl.coalesce(cands).alias("ts_utc")

# ────────────────────── Filename helpers ──────────────────────

def infer_symbol_and_ccy(name: str) -> tuple[str, str]:
    """
    From filenames like:
      GC_F_AUD_raw.csv  -> ('GC=F', 'AUD')
      CL_F_USD_raw.csv  -> ('CL=F', 'USD')
      NG_F_raw.csv      -> ('NG=F', 'USD')  # default to USD if unknown
    """
    base = name
    ccy = "UNK"
    if base.endswith("_AUD_raw.csv"):
        ccy = "AUD"; base = base[:-len("_AUD_raw.csv")]
    elif base.endswith("_USD_raw.csv"):
        ccy = "USD"; base = base[:-len("_USD_raw.csv")]
    elif base.endswith("_raw.csv"):
        base = base[:-len("_raw.csv")]
    symbol = base.replace("_", "=").upper()
    if ccy == "UNK":
        ccy = "USD"
    return symbol, ccy

# ────────────────────── Per-file processing ──────────────────────

def process_one(abfs_path: str) -> tuple[str, pl.DataFrame]:
    fname = Path(abfs_path).name
    symbol, quote_ccy = infer_symbol_and_ccy(fname)

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
    missing = expected - set(df.columns)
    if missing:
        print(f"[WARN] {symbol}: missing columns {missing} in {fname} — skipping")
        return symbol, pl.DataFrame()

    def clean_num(col: str) -> pl.Expr:
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
              clean_num("Open").alias("Open"),
              clean_num("High").alias("High"),
              clean_num("Low").alias("Low"),
              clean_num("Close").alias("Close"),
              pl.col("Volume").cast(pl.Float64, strict=False),
              parse_datetime_utc("Date").alias("ts_utc"),
          ])
          .drop("Date")
          .with_columns([
              pl.col("ts_utc").dt.convert_time_zone(AU_TZ).alias("ts_local"),
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

    # Build features in passes so older Polars versions can use newly added cols.
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
        # MACD
        .with_columns((pl.col("EMA_12") - pl.col("EMA_26")).alias("MACD"))
        .with_columns(pl.col("MACD").ewm_mean(span=9, adjust=False, ignore_nulls=True).alias("MACD_signal"))
        .with_columns((pl.col("MACD") - pl.col("MACD_signal")).alias("MACD_hist"))
        # RSI
        .with_columns(rsi14_expr(close).alias("RSI_14"))
        # Bollinger (20, 2σ)
        .with_columns([
            pl.col("SMA_20").alias("BB_middle"),
            (pl.col("SMA_20") + 2 * close.rolling_std(20)).alias("BB_upper"),
            (pl.col("SMA_20") - 2 * close.rolling_std(20)).alias("BB_lower"),
        ])
        # PASS 1: create Returns / Log_Returns
        .with_columns([
            ((close / close.shift(1)) - 1).alias("Returns"),
            (close / close.shift(1)).log().alias("Log_Returns"),
        ])
        # PASS 2: use Returns to compute vol; add momentum & volume SMA
        .with_columns([
            (pl.col("Returns").rolling_std(20) * math.sqrt(252)).alias("Volatility_20"),
            (close / close.shift(20) - 1).alias("Momentum_20"),
            vol.rolling_mean(20).alias("Volume_SMA_20"),
        ])
        # Safe volume ratio (avoid div-by-zero)
        .with_columns([
            pl.when(pl.col("Volume_SMA_20") == 0).then(None).otherwise(pl.col("Volume_SMA_20")).alias("Volume_SMA_20")
        ])
        .with_columns((vol / pl.col("Volume_SMA_20")).alias("Volume_Ratio"))
        # Labels
        .with_columns([
            pl.lit(symbol).alias("symbol"),
            pl.lit(quote_ccy).alias("quote_ccy"),
        ])
        # Final select
        .select([
            "symbol","quote_ccy","ts_local","date_utc","Open","High","Low","Close","Volume",
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

STAGE_COLS = [
    "symbol","quote_ccy","ts_local","date_utc","Open","High","Low","Close","Volume",
    "SMA_5","SMA_10","SMA_20","SMA_50","SMA_200",
    "EMA_12","EMA_26","RSI_14",
    "MACD","MACD_signal","MACD_hist",
    "BB_middle","BB_upper","BB_lower",
    "Returns","Log_Returns","Volatility_20","Momentum_20",
    "Volume_SMA_20","Volume_Ratio",
]

def insert_stage(conn, df_pl: pl.DataFrame) -> int:
    """Insert into dbo.commodities_processed_stage with dynamic column list & placeholders."""
    if df_pl.is_empty():
        return 0

    # Build column names and placeholders dynamically to avoid count mismatches
    cols_sql = ",".join(f"[{c}]" if c.lower() in {"open","high","low","close"} else c for c in STAGE_COLS)
    placeholders = ",".join("?" for _ in STAGE_COLS)

    tbl = df_pl.select(STAGE_COLS).to_dict(as_series=False)

    def gen_rows():
        n = len(df_pl)
        for i in range(n):
            yield tuple(tbl[c][i] for c in STAGE_COLS)

    cur = conn.cursor()
    cur.fast_executemany = True
    rows = list(gen_rows())

    for start in range(0, len(rows), BATCH_ROWS):
        batch = rows[start:start + BATCH_ROWS]
        cur.executemany(
            f"INSERT INTO dbo.commodities_processed_stage ({cols_sql}) VALUES ({placeholders})",
            batch
        )
    conn.commit()
    return len(rows)

def merge_stage(conn) -> tuple[int, int]:
    """MERGE stage -> prices; return (inserted, updated); then TRUNCATE stage."""
    cur = conn.cursor()
    cur.execute("SET LOCK_TIMEOUT 60000;")
    cur.execute("IF OBJECT_ID('tempdb..#act') IS NOT NULL DROP TABLE #act; "
                "CREATE TABLE #act(action NVARCHAR(10));")

    cur.execute("""
        MERGE dbo.commodities_processed_prices AS tgt
        USING (SELECT * FROM dbo.commodities_processed_stage) AS src
          ON (tgt.symbol = src.symbol AND tgt.quote_ccy = src.quote_ccy AND tgt.date_utc = src.date_utc)
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
          INSERT (symbol,quote_ccy,ts_local,date_utc,[open],[high],[low],[close],volume,
                  sma_5,sma_10,sma_20,sma_50,sma_200,
                  ema_12,ema_26,rsi_14,
                  macd,macd_signal,macd_hist,
                  bb_middle,bb_upper,bb_lower,
                  returns,log_returns,volatility_20,momentum_20,
                  volume_sma_20,volume_ratio)
          VALUES (src.symbol,src.quote_ccy,src.ts_local,src.date_utc,src.[open],src.[high],src.[low],src.[close],src.volume,
                  src.sma_5,src.sma_10,src.sma_20,src.sma_50,src.sma_200,
                  src.ema_12,src.ema_26,src.rsi_14,
                  src.macd,src.macd_signal,src.macd_hist,
                  src.bb_middle,src.bb_upper,src.bb_lower,
                  src.returns,src.log_returns,src.volatility_20,src.momentum_20,
                  src.volume_sma_20,src.volume_ratio)
        OUTPUT $action INTO #act(action);
    """)

    cur.execute("""
        SELECT
          inserted = SUM(CASE WHEN action = 'INSERT' THEN 1 ELSE 0 END),
          updated  = SUM(CASE WHEN action = 'UPDATE' THEN 1 ELSE 0 END)
        FROM #act;
    """)
    row = cur.fetchone()
    inserted, updated = (row or (0, 0))
    cur.execute("DROP TABLE #act;")
    cur.execute("TRUNCATE TABLE dbo.commodities_processed_stage;")
    conn.commit()
    return (inserted or 0, updated or 0)

# ───────────────────────────── Main ─────────────────────────────

def main() -> None:
    # Force line-buffered stdout in Airflow/containers
    try:
        import sys
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

    paths = list_paths()
    print(f"Found {len(paths)} RAW commodity file(s) under abfs://{CONT}/{PREF}")
    if not paths:
        return

    conn = get_conn()

    # Defensive cleanup at the very start
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE dbo.commodities_processed_stage;")
    if TRUNCATE_PRICES_BEFORE:
        print("⚠️  TRUNCATE dbo.commodities_processed_prices (full reload requested)…")
        cur.execute("TRUNCATE TABLE dbo.commodities_processed_prices;")
    conn.commit()

    staged_rows = 0
    processed_files = 0
    buffer: list[tuple[str, pl.DataFrame]] = []
    pending_to_delete: list[str] = []

    def stage_buffer(buf: list[tuple[str, pl.DataFrame]]) -> int:
        if not buf:
            return 0
        dfs = [df for _, df in buf if df is not None and not df.is_empty()]
        if not dfs:
            return 0
        big = pl.concat(dfs, how="vertical_relaxed") if len(dfs) > 1 else dfs[0]
        return insert_stage(conn, big)

    def do_merge_and_delete() -> None:
        nonlocal pending_to_delete
        if not pending_to_delete:
            return
        inserted, updated = merge_stage(conn)
        print(f"MERGE summary -> inserted: {inserted}, updated: {updated}")
        if DELETE_SOURCE:
            ok = 0
            for p in pending_to_delete:
                if _rm_with_retries(p):
                    ok += 1
            print(f"Deleted {ok}/{len(pending_to_delete)} source file(s) from ADLS (post-MERGE).")
        pending_to_delete = []

    try:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futures = {ex.submit(process_one, p): p for p in paths}
            for fut in as_completed(futures):
                src = futures[fut]
                try:
                    _, dfp = fut.result()
                except Exception as e:
                    print(f"[WARN] Skipping file due to error: {src} → {e}")
                    continue

                buffer.append((src, dfp))
                processed_files += 1

                if sum(len(x[1]) for x in buffer if x[1] is not None and not x[1].is_empty()) >= BATCH_ROWS:
                    staged_rows += stage_buffer(buffer)
                    pending_to_delete.extend([p for p, df in buffer if df is not None and not df.is_empty()])
                    buffer.clear()

                if staged_rows >= MERGE_EVERY_ROWS:
                    print(f"MERGE after staging ~{staged_rows} rows …")
                    do_merge_and_delete()
                    staged_rows = 0

                if processed_files % 100 == 0:
                    print(f"Processed {processed_files}/{len(paths)} files …")

        # Flush remainder
        if buffer:
            staged_rows += stage_buffer(buffer)
            pending_to_delete.extend([p for p, df in buffer if df is not None and not df.is_empty()])
            buffer.clear()

        print("Final MERGE …")
        do_merge_and_delete()
        print("✅ Done.")

    finally:
        try:
            conn.close()
        except Exception:
            pass

if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        raise
