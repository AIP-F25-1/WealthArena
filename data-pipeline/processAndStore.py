#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
import io
import json
import math
import time
import re
from datetime import date
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configure UTF-8 encoding for stdout to handle Unicode characters on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except (AttributeError, ValueError):
    # Fallback for older Python versions
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
    except (AttributeError, ValueError):
        pass

import polars as pl
import fsspec
import yaml
from dotenv import load_dotenv

from dbConnection import get_conn

# ───────────────────────────── Config ─────────────────────────────

ENV_PATH = Path(__file__).with_name("sqlDB.env")
load_dotenv(ENV_PATH)

# Optionally load azureCred.env if needed
azure_cred_path = Path(__file__).with_name("azureCred.env")
if azure_cred_path.exists():
    load_dotenv(azure_cred_path)

# Load automation configuration for MVP mode
def load_automation_config():
    """Load automation configuration if available."""
    config_path = Path(__file__).parent.parent / "automation_config.yaml"
    if not config_path.exists():
        config_path = Path(__file__).parent.parent / "automation_config.example.yaml"
    
    if config_path.exists():
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            print(f"Warning: Could not load automation config: {e}")
    return {}

AUTOMATION_CONFIG = load_automation_config()

ACC  = os.getenv("AZURE_STORAGE_ACCOUNT")
KEY  = os.getenv("AZURE_STORAGE_KEY")

# Fallback: derive from connection string if account/key are missing
if not ACC or not KEY:
    conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
    if conn_str:
        # Extract account name and key from connection string
        parts = conn_str.split(";")
        for part in parts:
            if part.startswith("AccountName="):
                ACC = part.split("=", 1)[1]
            elif part.startswith("AccountKey="):
                KEY = part.split("=", 1)[1]

CONT = os.getenv("ADLS_CONTAINER", "raw")
PREF = os.getenv("ADLS_RAW_PREFIX", "asxStocks")

# Delete sources in ADLS ONLY AFTER a successful MERGE
DELETE_SOURCE = os.getenv("ADLS_DELETE_SOURCE", "false").strip().lower() in {"1", "true", "yes"}

# Truncate target table BEFORE processing (full reload)
# Requires both TRUNCATE_PRICES_BEFORE=true AND CONFIRM_TRUNCATE=YES to execute
TRUNCATE_PRICES_BEFORE = os.getenv("TRUNCATE_PRICES_BEFORE", "false").strip().lower() in {"1", "true", "yes"}
CONFIRM_TRUNCATE = os.getenv("CONFIRM_TRUNCATE", "NO").strip().upper() == "YES"

# Parallelism + batching
# Tune MAX_WORKERS based on CPU cores and network bandwidth (12 workers for better I/O-bound performance)
MAX_WORKERS        = min(12, (os.cpu_count() or 4))
BATCH_ROWS         = int(os.getenv("BATCH_ROWS", "150000"))       # stage rows per executemany (increased from 75K)
MERGE_EVERY_ROWS   = int(os.getenv("MERGE_EVERY_ROWS", "500000")) # merge less frequently to reduce overhead (increased from 200K)

# Destination timezone for "local" timestamps
# Will be determined based on symbol prefix/suffix

# ────────────────────── ADLS / Storage access ─────────────────────

# Initialize filesystem only after resolving ACC and KEY values
USE_AZURE = False
fs = None
if ACC and KEY:
    try:
        # Catch any Azure authentication errors
        try:
            from azure.storage.blob._shared.authentication import AzureSigningError
            from azure.core.exceptions import AzureError
        except ImportError:
            AzureSigningError = Exception
            AzureError = Exception
            
        fs = fsspec.filesystem("abfs", account_name=ACC, account_key=KEY)
        # Test connection by trying to list (catches auth errors early)
        try:
            fs.ls(f"abfs://{CONT}/", detail=False)
            USE_AZURE = True
            print("[OK] Using Azure ADLS for data source")
        except (AzureSigningError, AzureError, Exception) as e:
            error_msg = str(e).lower()
            if "padding" in error_msg or "signing" in error_msg or "authentication" in error_msg or "incorrect" in error_msg:
                print(f"[WARNING] Azure ADLS authentication failed (invalid credentials)")
            else:
                print(f"[WARNING] Azure ADLS connection failed: {type(e).__name__}")
            print("[PATH] Falling back to local file system")
            USE_AZURE = False
            fs = None
    except Exception as e:
        error_msg = str(e).lower()
        if "padding" in error_msg or "signing" in error_msg:
            print(f"[WARNING] Azure ADLS authentication failed (invalid credentials)")
        else:
            print(f"[WARNING] Azure ADLS initialization failed: {type(e).__name__}")
        print("[PATH] Falling back to local file system")
        USE_AZURE = False
        fs = None
else:
    print("[WARNING] No Azure credentials found")
    print("[PATH] Using local file system for data source")
    USE_AZURE = False
    fs = None

def load_training_symbols(cmdline_symbols: Optional[set[str]] = None) -> set[str]:
    """Load list of symbols to process in MVP mode or from command line."""
    allowed_symbols = set()
    
    # If command-line symbols provided, use those (override MVP mode)
    if cmdline_symbols:
        allowed_symbols = cmdline_symbols
        print(f"Processing {len(allowed_symbols)} specific symbols from command line")
        return allowed_symbols
    
    # Check if MVP mode is enabled
    mvp_mode = AUTOMATION_CONFIG.get('mvp_mode', {})
    if mvp_mode.get('enabled', False) and mvp_mode.get('process_only_training_symbols', False):
        # Try to load from downloaded_symbols.json
        downloaded_symbols_path = Path(__file__).parent / "downloaded_symbols.json"
        if downloaded_symbols_path.exists():
            try:
                with open(downloaded_symbols_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        allowed_symbols = {sym['symbol'].upper() for sym in data if 'symbol' in sym}
                    elif isinstance(data, dict) and 'symbols' in data:
                        allowed_symbols = {sym.upper() for sym in data['symbols'] if isinstance(sym, str)}
                print(f"MVP Mode: Loaded {len(allowed_symbols)} training symbols from downloaded_symbols.json")
            except Exception as e:
                print(f"Warning: Could not load downloaded_symbols.json: {e}")
        else:
            # Fall back to raw_download_summary.json if available
            summary_path = Path(__file__).parent / "raw_download_summary.json"
            if summary_path.exists():
                try:
                    with open(summary_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        if 'symbols' in data:
                            allowed_symbols = {sym.upper() for sym in data['symbols'] if isinstance(sym, str)}
                        print(f"MVP Mode: Loaded {len(allowed_symbols)} symbols from raw_download_summary.json")
                except Exception as e:
                    print(f"Warning: Could not load raw_download_summary.json: {e}")
    
    return allowed_symbols

def list_paths(allowed_symbols: Optional[set[str]] = None) -> list[str]:
    """
    List paths - either from Azure ADLS or local filesystem.
    Supports ADLS_RAW_PREFIX_LIST env var for multiple prefixes (comma-separated).
    If allowed_symbols is provided, filter paths to only include those symbols.
    """
    if USE_AZURE and fs:
        # Check for multiple prefixes
        prefix_list_str = os.getenv("ADLS_RAW_PREFIX_LIST", "").strip()
        if prefix_list_str:
            prefixes = [p.strip() for p in prefix_list_str.split(",") if p.strip()]
            all_paths = []
            for prefix in prefixes:
                # Use recursive glob to find files in subdirectories
                paths = fs.glob(f"abfs://{CONT}/{prefix}/**/*_raw.csv")
                all_paths.extend(paths)
            # Deduplicate and sort
            paths_str = sorted(set(all_paths))
        else:
            # Single prefix (backward compatible)
            paths = fs.glob(f"abfs://{CONT}/{PREF}/*_raw.csv")
            paths_str = sorted(paths)
    else:
        # Use local filesystem - recursively search subdirectories
        local_raw_dir = Path(__file__).parent / "data" / "raw"
        paths = list(local_raw_dir.rglob("*_raw.csv"))
        paths_str = [str(p) for p in sorted(paths)]
    
    # Apply symbol filtering if provided
    if allowed_symbols is None:
        # Load from MVP mode or config
        allowed_symbols = load_training_symbols()
    
    if allowed_symbols:
        original_count = len(paths_str)
        filtered_paths = []
        missing_symbols = set()
        for path in paths_str:
            # Extract symbol from filename
            filename = Path(path).name
            symbol = filename.replace("_raw.csv", "").upper()
            if symbol in allowed_symbols:
                filtered_paths.append(path)
            else:
                missing_symbols.add(symbol)
        paths_str = filtered_paths
        print(f"Filtered to {len(paths_str)} of {original_count} symbols")
        
        # Check if any specified symbols don't have data files
        if missing_symbols:
            specified_not_found = allowed_symbols - {Path(p).name.replace("_raw.csv", "").upper() for p in paths_str}
            if specified_not_found:
                print(f"Warning: {len(specified_not_found)} specified symbols don't have data files: {sorted(list(specified_not_found))[:10]}")
                if len(specified_not_found) > 10:
                    print(f"  ... and {len(specified_not_found) - 10} more")
    
    return paths_str

def _rm_with_retries(path: str, attempts: int = 5, base_sleep: float = 0.25) -> bool:
    """Delete a file (Azure ADLS or local) with exponential backoff."""
    if not USE_AZURE or not fs:
        # Local filesystem - simple delete
        try:
            local_path = Path(path)
            if local_path.exists():
                local_path.unlink()
            return True
        except Exception as e:
            print(f"[WARN] Failed to delete local file {path}: {e}")
            return False
    
    # Azure ADLS delete
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
    """RSI(14) using Wilder's smoothing (EMA with alpha=1/14)."""
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
    """Parse string timestamps to UTC Datetime; tz-aware→UTC; naive→UTC."""
    candidates: list[pl.Expr] = []
    for fmt in DT_FORMATS_WITH_TZ:
        candidates.append(pl.col(col).str.strptime(pl.Datetime, format=fmt, strict=False).dt.convert_time_zone("UTC"))
    for fmt in DT_FORMATS_NAIVE:
        candidates.append(pl.col(col).str.strptime(pl.Datetime, format=fmt, strict=False).dt.replace_time_zone("UTC"))
    return pl.coalesce(candidates).alias("ts_utc")

# ────────────────────── Per-file processing ──────────────────────

def process_one(abfs_path: str) -> tuple[str, pl.DataFrame]:
    """Process one file - supports both Azure ADLS and local filesystem."""
    name = Path(abfs_path).name
    symbol = name.replace("_raw.csv", "").upper()

    if USE_AZURE and fs:
        # Read from Azure ADLS
        with fs.open(abfs_path, "rb") as f:
            df = pl.read_csv(
                f,
                infer_schema_length=0,
                try_parse_dates=False,
                ignore_errors=True,
                null_values=["", "null", "None"],
            )
    else:
        # Read from local filesystem
        local_path = Path(abfs_path)
        df = pl.read_csv(
            local_path,
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
        return symbol, pl.DataFrame()  # empty -> skipped

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

    # Determine timezone based on symbol suffix/prefix
    # Option 1: Use UTC for all (simpler, consistent)
    # Option 2: Branch by prefix/suffix (more accurate per asset)
    # Using Option 1 for consistency as per comment instructions
    df = (
        df.with_columns([parse_datetime_utc("Date").alias("ts_utc")])
          .drop("Date")
          .with_columns([
              # Format ts_local as ISO 8601 offset datetime string for SQL Server DATETIMEOFFSET(0)
              pl.col("ts_utc").dt.strftime("%Y-%m-%dT%H:%M:%S%:z").alias("ts_local"),
              # Ensure date_utc is a proper date type
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
    """Insert rows into dbo.processed_stage in batches."""
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

    def to_sql_value(val):
        """Convert Polars value to SQL-compatible value, handling NaN/None."""
        import math
        if val is None:
            return None
        # Check for NaN (works for both float NaN and Polars null)
        if isinstance(val, float) and (math.isnan(val) or val == float('inf') or val == float('-inf')):
            return None
        # Polars null values sometimes come through as special objects
        try:
            if str(val).lower() in ['nan', 'none', '<na>', 'null']:
                return None
        except:
            pass
        return val

    def gen_rows():
        n = len(df_pl)
        for i in range(n):
            # Format ts_local for SQL Server DATETIMEOFFSET(0)
            # pyodbc accepts strings in format: 'YYYY-MM-DD HH:MM:SS +HH:MM' or 'YYYY-MM-DDTHH:MM:SS+HH:MM'
            # Convert T separator to space and ensure space before timezone offset
            ts_local_val = tbl["ts_local"][i]
            if ts_local_val is not None and str(ts_local_val).lower() not in ['nan', 'none', '<na>', 'null', '']:
                ts_local_str = str(ts_local_val).strip()
                # Convert ISO format (YYYY-MM-DDTHH:MM:SS+HH:MM) to SQL Server preferred format
                # Replace T with space and ensure space before timezone if not present
                if 'T' in ts_local_str:
                    # Format: YYYY-MM-DDTHH:MM:SS+HH:MM -> YYYY-MM-DD HH:MM:SS +HH:MM
                    ts_local_str = ts_local_str.replace('T', ' ', 1)
                # Ensure space before timezone offset if it's directly after time
                # Pattern: YYYY-MM-DD HH:MM:SS+HH:MM -> YYYY-MM-DD HH:MM:SS +HH:MM
                ts_local_str = re.sub(r'(\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2})', r'\1 \2', ts_local_str)
                if not ts_local_str:
                    ts_local_str = None
            else:
                ts_local_str = None
            
            # Format date_utc for SQL Server DATE type
            # Convert Python date objects to strings in YYYY-MM-DD format
            date_utc_val = tbl["date_utc"][i]
            if date_utc_val is not None:
                if isinstance(date_utc_val, str):
                    date_utc_str = date_utc_val.strip()
                else:
                    # Convert Python date object to string in YYYY-MM-DD format
                    if isinstance(date_utc_val, date):
                        date_utc_str = date_utc_val.strftime('%Y-%m-%d')
                    else:
                        date_utc_str = str(date_utc_val)
                if not date_utc_str or date_utc_str.lower() in ['nan', 'none', '<na>', 'null']:
                    date_utc_str = None
            else:
                date_utc_str = None
            
            yield (
                str(tbl["symbol"][i]) if tbl["symbol"][i] is not None else None,
                ts_local_str,
                date_utc_str,
                to_sql_value(tbl["Open"][i]), to_sql_value(tbl["High"][i]), to_sql_value(tbl["Low"][i]), 
                to_sql_value(tbl["Close"][i]), to_sql_value(tbl["Volume"][i]),
                to_sql_value(tbl["SMA_5"][i]), to_sql_value(tbl["SMA_10"][i]), to_sql_value(tbl["SMA_20"][i]), 
                to_sql_value(tbl["SMA_50"][i]), to_sql_value(tbl["SMA_200"][i]),
                to_sql_value(tbl["EMA_12"][i]), to_sql_value(tbl["EMA_26"][i]), to_sql_value(tbl["RSI_14"][i]),
                to_sql_value(tbl["MACD"][i]), to_sql_value(tbl["MACD_signal"][i]), to_sql_value(tbl["MACD_hist"][i]),
                to_sql_value(tbl["BB_middle"][i]), to_sql_value(tbl["BB_upper"][i]), to_sql_value(tbl["BB_lower"][i]),
                to_sql_value(tbl["Returns"][i]), to_sql_value(tbl["Log_Returns"][i]), to_sql_value(tbl["Volatility_20"][i]), 
                to_sql_value(tbl["Momentum_20"][i]),
                to_sql_value(tbl["Volume_SMA_20"][i]), to_sql_value(tbl["Volume_Ratio"][i]),
            )

    cur = conn.cursor()
    cur.fast_executemany = True
    rows = list(gen_rows())

    for start in range(0, len(rows), BATCH_ROWS):
        batch = rows[start:start + BATCH_ROWS]
        try:
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
        except Exception as e:
            # Provide better error information for debugging
            error_msg = str(e)
            print(f"\n[FAILED] ERROR inserting batch starting at row {start}:")
            print(f"   Error: {error_msg}")
            print(f"   Batch size: {len(batch)} rows")
            # Show first row of the problematic batch for debugging
            if batch:
                print(f"   First row sample (first 5 values): {batch[0][:5]}")
                print(f"   First row symbol: {batch[0][0] if batch[0][0] else 'None'}")
            raise
    conn.commit()
    return len(rows)

def merge_stage(conn) -> tuple[int, int]:
    """MERGE stage -> prices, return (inserted, updated), then TRUNCATE stage."""
    cur = conn.cursor()
    # optional: reduce blocking pain
    cur.execute("SET LOCK_TIMEOUT 60000;")

    # identify DB for sanity
    cur.execute("SELECT DB_NAME();")
    dbname = cur.fetchone()[0]
    print(f"[DB] MERGE running on database: {dbname}")

    # temp table for actions
    cur.execute("IF OBJECT_ID('tempdb..#act') IS NOT NULL DROP TABLE #act; "
                "CREATE TABLE #act(action NVARCHAR(10));")

    # MERGE and capture actions
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

    # read counts
    cur.execute("""
        SELECT
          inserted = SUM(CASE WHEN action = 'INSERT' THEN 1 ELSE 0 END),
          updated  = SUM(CASE WHEN action = 'UPDATE' THEN 1 ELSE 0 END)
        FROM #act;
    """)
    row = cur.fetchone()
    inserted, updated = (row or (0, 0))
    print(f"MERGE summary -> inserted: {inserted or 0}, updated: {updated or 0}")

    # cleanup
    cur.execute("DROP TABLE #act;")
    cur.execute("TRUNCATE TABLE dbo.processed_stage;")
    conn.commit()
    return (inserted or 0, updated or 0)

# ───────────────────────────── Main ─────────────────────────────

def main() -> None:
    import argparse
    
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description="Process and store market data locally, then push to Azure SQL")
    parser.add_argument("--symbols", type=str, default=None,
                        help="Process specific symbols only (comma-separated, e.g., BTC-USD,ETH-USD,SPY)")
    parser.add_argument("--min-rows", type=int, default=100,
                        help="Minimum rows required to push to Azure (default: 100)")
    parser.add_argument("--local-only", action="store_true",
                        help="Only process locally, don't push to Azure")
    args = parser.parse_args()
    
    # Parse symbols from command line if provided
    cmdline_symbols = None
    if args.symbols:
        cmdline_symbols = {s.strip().upper() for s in args.symbols.split(",") if s.strip()}
        print(f"Processing {len(cmdline_symbols)} specific symbols: {', '.join(sorted(list(cmdline_symbols))[:10])}")
        if len(cmdline_symbols) > 10:
            print(f"  ... and {len(cmdline_symbols) - 10} more")
    
    # Track execution time for performance monitoring
    overall_start = time.time()
    paths = list_paths(allowed_symbols=cmdline_symbols if cmdline_symbols else None)
    print(f"Found {len(paths)} RAW files.")
    if not paths:
        if cmdline_symbols:
            print(f"Warning: No data files found for specified symbols. Ensure symbols have been downloaded first.")
        return

    # Create local processed directory
    local_processed_dir = Path(__file__).parent / "data" / "processed"
    local_processed_dir.mkdir(parents=True, exist_ok=True)
    print(f"Local processed directory: {local_processed_dir}")
    
    # Process locally first, then push to Azure
    conn = None
    if not args.local_only:
        conn = get_conn()
    # Note: Consider enabling connection pooling in dbConnection.py for better performance
    # Review connection string parameters: Max Pool Size, MultipleActiveResultSets, etc.

    # Early validation: verify database connection and table existence (only if pushing to Azure)
    if conn:
        print("Validating database connection and table structure...")
        cur = conn.cursor()
        try:
            # Verify processed_stage table exists
            cur.execute("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'processed_stage'
            """)
            if cur.fetchone()[0] == 0:
                raise RuntimeError("Table dbo.processed_stage does not exist. Please create it first.")
            
            # Verify processed_prices table exists
            cur.execute("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'processed_prices'
            """)
            if cur.fetchone()[0] == 0:
                raise RuntimeError("Table dbo.processed_prices does not exist. Please create it first.")
            
            print("[OK] Database tables validated")
        except Exception as e:
            conn.close()
            print(f"[FAILED] Database validation failed: {e}")
            raise

        # Defensive cleanup at the very start
        # Skip stage truncate when --symbols is used to avoid conflicts with other workers
        if not cmdline_symbols:
            cur.execute("TRUNCATE TABLE dbo.processed_stage;")
            print("Truncated processed_stage table")
        else:
            print(f"Skipping stage truncate for symbol-scoped run ({len(cmdline_symbols)} symbols)")
        
        if TRUNCATE_PRICES_BEFORE:
            if CONFIRM_TRUNCATE:
                print("[WARNING] TRUNCATE dbo.processed_prices (full reload requested and confirmed)...")
                cur.execute("TRUNCATE TABLE dbo.processed_prices;")
                conn.commit()
            else:
                print("[WARNING] WARNING: TRUNCATE_PRICES_BEFORE is enabled but CONFIRM_TRUNCATE=YES is not set.")
                print("[WARNING] Skipping truncation. Set CONFIRM_TRUNCATE=YES in sqlDB.env to confirm truncation.")
                print("[WARNING] This is a safety guard to prevent accidental data loss.")
                conn.commit()
        else:
            conn.commit()
    else:
        print("[INFO] Local-only mode: Skipping Azure SQL validation")

    staged_rows = 0
    processed_files = 0
    buffer: list[tuple[str, pl.DataFrame]] = []   # (path, df)
    pending_to_delete: list[str] = []             # delete sources ONLY after successful MERGE

    def stage_buffer(buf: list[tuple[str, pl.DataFrame]]) -> int:
        """Insert buffered dfs to stage (no delete here)."""
        if not buf:
            return 0
        dfs = [df for _, df in buf if df is not None and not df.is_empty()]
        if not dfs:
            return 0
        big = pl.concat(dfs, how="vertical_relaxed") if len(dfs) > 1 else dfs[0]
        return insert_stage(conn, big)

    def do_merge_and_delete() -> None:
        """Run MERGE; if successful, validate counts and delete the pending source files."""
        nonlocal pending_to_delete, staged_rows
        if not pending_to_delete:
            return
        
        # Before MERGE, count staged rows for validation
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM dbo.processed_stage;")
        staged_count = cur.fetchone()[0]
        cur.close()
        
        # Run MERGE
        inserted, updated = merge_stage(conn)
        merged_total = (inserted or 0) + (updated or 0)
        
        # Validate merged counts match expectations (allow some tolerance for existing data updates)
        if staged_count > 0 and merged_total < staged_count * 0.9:  # Allow 10% tolerance
            print(f"[WARNING] WARNING: MERGE counts may not match staged rows.")
            print(f"   Staged: {staged_count}, Merged (inserted+updated): {merged_total}")
            print(f"   Proceeding with deletion after validation (tolerance: 10%)")
        
        # Only delete the pending sources if MERGE succeeded and counts are reasonable
        if DELETE_SOURCE:
            if merged_total > 0 or staged_count == 0:  # Only delete if data was merged or no data was staged
                ok = 0
                for p in pending_to_delete:
                    if _rm_with_retries(p):
                        ok += 1
                print(f"Deleted {ok}/{len(pending_to_delete)} source file(s) from ADLS (post-MERGE validation).")
            else:
                print(f"[WARNING] Skipping source deletion: MERGE validation failed (merged: {merged_total}, staged: {staged_count})")
        pending_to_delete = []

    try:
        failed_files = []
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futures = {ex.submit(process_one, p): p for p in paths}
            for fut in as_completed(futures):
                try:
                    symbol, dfp = fut.result()
                except Exception as e:
                    bad = futures[fut]
                    failed_files.append((bad, str(e)))
                    print(f"[WARN] {Path(bad).name}: Failed → {type(e).__name__}: {str(e)[:100]}")
                    continue

                path = futures[fut]
                processed_files += 1
                
                # Save processed data locally first
                if dfp is not None and not dfp.is_empty():
                    # Save to local processed directory
                    safe_symbol = symbol.replace("/", "_").replace("\\", "_").replace("=", "_").replace("-", "_")
                    local_file = local_processed_dir / f"{safe_symbol}_processed.csv"
                    try:
                        dfp.write_csv(local_file)
                    except Exception as e:
                        print(f"[WARN] {symbol}: Failed to save local file: {e}")
                    
                    # Track row count for filtering
                    row_count = len(dfp)
                    
                    # Only add to buffer if meets minimum row requirement for Azure
                    if row_count >= args.min_rows:
                        buffer.append((path, dfp))
                        print(f"[OK] {symbol}: {row_count} rows - will push to Azure")
                    else:
                        print(f"[SKIP] {symbol}: {row_count} rows (< {args.min_rows}) - skipping Azure push")
                else:
                    print(f"[SKIP] {symbol}: Empty or invalid data")

                # Stage when buffer grows large enough
                if conn and sum(len(x[1]) for x in buffer if x[1] is not None and not x[1].is_empty()) >= BATCH_ROWS:
                    staged_rows += stage_buffer(buffer)
                    # collect the sources we just staged; we will delete them AFTER MERGE
                    pending_to_delete.extend([p for p, df in buffer if df is not None and not df.is_empty()])
                    buffer.clear()

                # Periodic MERGE with timing
                if conn and staged_rows >= MERGE_EVERY_ROWS:
                    merge_start = time.time()
                    print(f"MERGE after staging ~{staged_rows} rows …")
                    do_merge_and_delete()
                    merge_duration = time.time() - merge_start
                    print(f"[OK] MERGE completed in {int(merge_duration//60)}m {int(merge_duration%60)}s")
                    staged_rows = 0

                # Enhanced progress reporting every 50 files (was 100)
                if processed_files % 50 == 0:
                    elapsed = time.time() - overall_start
                    avg_time_per_file = elapsed / processed_files
                    remaining_files = len(paths) - processed_files
                    estimated_remaining = avg_time_per_file * remaining_files
                    percent_done = (processed_files / len(paths)) * 100
                    print(f"[{time.strftime('%H:%M:%S')}] Progress: {processed_files}/{len(paths)} files ({percent_done:.1f}%) - "
                          f"~{int(estimated_remaining//60)}m remaining")

        # Flush remainder
        if conn and buffer:
            staged_rows += stage_buffer(buffer)
            pending_to_delete.extend([p for p, df in buffer if df is not None and not df.is_empty()])
            buffer.clear()

        if conn:
            print("Final MERGE …")
            do_merge_and_delete()
        
        # Report execution summary
        total_duration = time.time() - overall_start
        hours = int(total_duration // 3600)
        minutes = int((total_duration % 3600) // 60)
        seconds = int(total_duration % 60)
        
        print("\n" + "="*70)
        print("EXECUTION SUMMARY")
        print("="*70)
        print(f"[OK] Total files processed: {processed_files}/{len(paths)}")
        print(f"[OK] Total execution time: {hours}h {minutes}m {seconds}s")
        if failed_files:
            print(f"[WARNING] Failed files: {len(failed_files)}")
            for failed_path, error in failed_files[:5]:  # Show first 5 failures
                print(f"   - {Path(failed_path).name}: {error[:80]}")
            if len(failed_files) > 5:
                print(f"   ... and {len(failed_files) - 5} more")
        print("="*70 + "\n")

    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        
        # Print summary of local files
        local_files = list(local_processed_dir.glob("*_processed.csv"))
        print(f"\n[OK] Local processed files: {len(local_files)}")
        print(f"     Location: {local_processed_dir}")

if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        raise
