#!/usr/bin/env python3
from __future__ import annotations

import os
import math
import time
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
PREF = os.getenv("ADLS_RAW_PREFIX_ASX", "asxStocks")

# Delete sources in ADLS ONLY AFTER a successful MERGE
DELETE_SOURCE = os.getenv("ADLS_DELETE_SOURCE", "true").strip().lower() in {"1", "true", "yes"}

# Truncate target table BEFORE processing (full reload)
TRUNCATE_PRICES_BEFORE = os.getenv("TRUNCATE_PRICES_BEFORE", "false").strip().lower() in {"1", "true", "yes"}

# Parallelism + batching
MAX_WORKERS        = min(8, (os.cpu_count() or 4))
BATCH_ROWS         = int(os.getenv("BATCH_ROWS", "75000"))        # stage rows per executemany
MERGE_EVERY_ROWS   = int(os.getenv("MERGE_EVERY_ROWS", "200000")) # merge more frequently in Airflow

# Destination timezone for “local” timestamps
ASX_TZ = "Australia/Sydney"

# Optional connection string for robust delete fallback
AZURE_CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()

# Deletion retry knobs
DEL_ATTEMPTS_FSSPEC = int(os.getenv("DEL_ATTEMPTS_FSSPEC", "5"))
DEL_ATTEMPTS_SDK    = int(os.getenv("DEL_ATTEMPTS_SDK", "3"))
DEL_BASE_SLEEP      = float(os.getenv("DEL_BASE_SLEEP", "0.25"))

# ────────────────────── ADLS / Storage access ─────────────────────

fs = fsspec.filesystem("abfs", account_name=ACC, account_key=KEY)

def list_paths() -> list[str]:
    # Match exactly what the scraper writes: <asxStocks>/<SYMBOL>_raw.csv
    pat = f"abfs://{CONT}/{PREF}/*_raw.csv"
    paths = fs.glob(pat)
    paths.sort()
    print(f"[LIST] Glob pattern: {pat}")
    print(f"[LIST] Found {len(paths)} file(s) to process.")
    return paths

# ───────────────────── Robust deletion helpers ─────────────────────

def _sdk_delete_once(abfs_path: str) -> bool:
    """
    Delete with Azure SDK (DataLakeFileClient) as a fallback.
    Supports both connection string and account/key.
    """
    from urllib.parse import urlparse

    # abfs://<container>/<prefix>/<file>
    u = urlparse(abfs_path)
    container = u.netloc
    # remove leading '/'
    path_in_fs = u.path[1:] if u.path.startswith("/") else u.path

    try:
        from azure.storage.filedatalake import DataLakeServiceClient
        if AZURE_CONN_STR:
            svc = DataLakeServiceClient.from_connection_string(AZURE_CONN_STR)
        else:
            if not ACC or not KEY:
                print(f"[DEL][SDK] Missing ACC/KEY and no connection string; cannot delete via SDK: {abfs_path}")
                return False
            acct_url = f"https://{ACC}.dfs.core.windows.net"
            svc = DataLakeServiceClient(account_url=acct_url, credential=KEY)

        fs_client = svc.get_file_system_client(container)
        file_client = fs_client.get_file_client(path_in_fs)
        file_client.delete_file()
        return True
    except Exception as e:
        print(f"[DEL][SDK] Failed: {abfs_path} → {e}")
        return False

def _rm_with_retries(abfs_path: str,
                     attempts_fsspec: int = DEL_ATTEMPTS_FSSPEC,
                     attempts_sdk: int = DEL_ATTEMPTS_SDK,
                     base_sleep: float = DEL_BASE_SLEEP) -> bool:
    """
    Try fsspec deletes with cache invalidation + backoff,
    then fallback to Azure SDK a few times.
    """
    print(f"[DEL] Attempting delete: {abfs_path}")

    # 1) Try fsspec a few times
    for i in range(1, attempts_fsspec + 1):
        try:
            # quick exit if already gone
            if not fs.exists(abfs_path):
                print(f"[DEL][FSSPEC] Already gone: {abfs_path}")
                return True
            fs.rm(abfs_path, recursive=False)
            # verify removal
            fs.invalidate_cache(abfs_path)
            if not fs.exists(abfs_path):
                print(f"[DEL][FSSPEC] Deleted: {abfs_path}")
                return True
            else:
                print(f"[DEL][FSSPEC] Still exists after rm(): {abfs_path}")
        except Exception as e:
            print(f"[DEL][FSSPEC] {abfs_path} → attempt {i}/{attempts_fsspec} failed: {e}")
        # backoff
        time.sleep(base_sleep * (2 ** (i - 1)))

    # 2) Fallback to SDK
    for j in range(1, attempts_sdk + 1):
        ok = _sdk_delete_once(abfs_path)
        if ok:
            # verify via fs layer too
            fs.invalidate_cache(abfs_path)
            if not fs.exists(abfs_path):
                print(f"[DEL][SDK] Deleted: {abfs_path}")
                return True
            else:
                print(f"[DEL][SDK] Deleted via SDK but fs still sees it; sleeping & recheck …")
                time.sleep(base_sleep * (2 ** (j - 1)))
                fs.invalidate_cache(abfs_path)
                if not fs.exists(abfs_path):
                    print(f"[DEL][SDK] Confirmed deleted after recheck: {abfs_path}")
                    return True
        else:
            print(f"[DEL][SDK] {abfs_path} → attempt {j}/{attempts_sdk} failed.")
        time.sleep(base_sleep * (2 ** (j - 1)))

    print(f"[DEL] Gave up deleting: {abfs_path}")
    return False

# ───────────────────── Technical indicators (Polars) ─────────────────────

def rsi14_expr(close_expr: pl.Expr) -> pl.Expr:
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
]

def parse_datetime_utc(col: str = "Date") -> pl.Expr:
    candidates: list[pl.Expr] = []
    for fmt in DT_FORMATS_WITH_TZ:
        candidates.append(pl.col(col).str.strptime(pl.Datetime, format=fmt, strict=False).dt.convert_time_zone("UTC"))
    for fmt in DT_FORMATS_NAIVE:
        candidates.append(pl.col(col).str.strptime(pl.Datetime, format=fmt, strict=False).dt.replace_time_zone("UTC"))
    return pl.coalesce(candidates).alias("ts_utc")

# ────────────────────── Per-file processing ──────────────────────

def process_one(abfs_path: str) -> tuple[str, pl.DataFrame]:
    name = Path(abfs_path).name
    symbol = name.replace("_raw.csv", "").upper()

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
        print(f"[WARN] {symbol}: missing columns {missing} in {name} — skipping file")
        return symbol, pl.DataFrame()

    df = df.select("Open","High","Low","Close","Volume","Date")

    def clean_num(col: str) -> pl.Expr:
        return (
            pl.col(col)
              .str.strip_chars()
              .str.replace_all(",", "")
              .str.replace_all(r"\s+", "")
        )

    df = df.with_columns([
        clean_num("Open").cast(pl.Float64, strict=False),
        clean_num("High").cast(pl.Float64, strict=False),
        clean_num("Low").cast(pl.Float64, strict=False),
        clean_num("Close").cast(pl.Float64, strict=False),
        clean_num("Volume").cast(pl.Int64,   strict=False),
    ])

    df = (
        df.with_columns([parse_datetime_utc("Date").alias("ts_utc")])
          .drop("Date")
          .with_columns([
              pl.col("ts_utc").dt.convert_time_zone(ASX_TZ).alias("ts_local"),
              pl.col("ts_utc").dt.date().alias("date_utc"),
          ])
          .drop("ts_utc")
          .sort("date_utc")
    )

    if df.is_empty():
        print(f"[WARN] {symbol}: no valid rows after cleaning — skipping file")
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
        .with_columns([(pl.col("EMA_12") - pl.col("EMA_26")).alias("MACD")])
        .with_columns([pl.col("MACD").ewm_mean(span=9, adjust=False, ignore_nulls=True).alias("MACD_signal")])
        .with_columns([(pl.col("MACD") - pl.col("MACD_signal")).alias("MACD_hist")])
        .with_columns([rsi14_expr(close).alias("RSI_14")])
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
            (pl.col("Returns").rolling_std(20) * math.sqrt(252)).alias("Volatility_20"),
            (close / close.shift(20) - 1).alias("Momentum_20"),
            vol.rolling_mean(20).alias("Volume_SMA_20"),
        ])
        .with_columns([(vol / pl.col("Volume_SMA_20")).alias("Volume_Ratio")])
        .with_columns([pl.lit(symbol).alias("symbol")])
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

    def gen_rows():
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
    rows = list(gen_rows())

    for start in range(0, len(rows), BATCH_ROWS):
        batch = rows[start:start + BATCH_ROWS]
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

def merge_stage(conn) -> tuple[int, int]:
    cur = conn.cursor()
    cur.execute("SET LOCK_TIMEOUT 60000;")
    cur.execute("SELECT DB_NAME();")
    dbname = cur.fetchone()[0]
    print(f"[DB] MERGE running on database: {dbname}")

    cur.execute("IF OBJECT_ID('tempdb..#act') IS NOT NULL DROP TABLE #act; "
                "CREATE TABLE #act(action NVARCHAR(10));")

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
    print(f"MERGE summary -> inserted: {inserted or 0}, updated: {updated or 0}")

    cur.execute("DROP TABLE #act;")
    cur.execute("TRUNCATE TABLE dbo.processed_stage;")
    conn.commit()
    return (inserted or 0, updated or 0)

# ───────────────────────────── Main ─────────────────────────────

def main() -> None:
    try:
        import sys
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

    paths = list_paths()
    if not paths:
        print("No RAW files to process.")
        return

    conn = get_conn()

    # Defensive cleanup at the very start
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE dbo.processed_stage;")
    if TRUNCATE_PRICES_BEFORE:
        print("⚠️  TRUNCATE dbo.processed_prices (full reload requested)...")
        cur.execute("TRUNCATE TABLE dbo.processed_prices;")
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

        if DELETE_SOURCE:
            print(f"[DEL] Starting deletes for {len(pending_to_delete)} file(s) …")
            ok = 0
            for p in pending_to_delete:
                if _rm_with_retries(p):
                    ok += 1
            print(f"[DEL] Deleted {ok}/{len(pending_to_delete)} source file(s) from ADLS (post-MERGE).")
        pending_to_delete = []

    try:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futures = {ex.submit(process_one, p): p for p in paths}
            for fut in as_completed(futures):
                try:
                    _, dfp = fut.result()
                except Exception as e:
                    bad = futures[fut]
                    print(f"[WARN] Skipping file due to error: {bad} → {e}")
                    continue

                path = futures[fut]
                buffer.append((path, dfp))
                processed_files += 1

                # Stage when buffer grows large enough
                staged_now = sum(len(x[1]) for x in buffer if x[1] is not None and not x[1].is_empty())
                if staged_now >= BATCH_ROWS:
                    staged_rows += stage_buffer(buffer)
                    pending_to_delete.extend([p for p, df in buffer if df is not None and not df.is_empty()])
                    buffer.clear()

                # Periodic MERGE
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
