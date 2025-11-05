#!/usr/bin/env python3
from __future__ import annotations

import os
import math
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Tuple

import polars as pl

# ───────────────────────────── Config (LOCAL ONLY) ─────────────────────────────
BASE_DIR       = Path(__file__).resolve().parent
DATA_DIR       = BASE_DIR / "data" / "forex"
RAW_DIR        = DATA_DIR / "raw"
PROCESSED_DIR  = DATA_DIR / "processed"
LOG_DIR        = BASE_DIR / "logs"

for p in (RAW_DIR, PROCESSED_DIR, LOG_DIR):
    p.mkdir(parents=True, exist_ok=True)

# Parallelism + batching (local; tune as needed)
MAX_WORKERS        = min(8, (os.cpu_count() or 4))
BATCH_ROWS_TO_WRITE= 200_000        # write-to-disk every ~N rows in consolidated build

# Destination “local” tz label for ts_local; FX is daily so label is informational
LOCAL_TZ = "Australia/Sydney"

# ───────────────────────────── Utilities ─────────────────────────────
def list_local_raw() -> List[Path]:
    paths = sorted(RAW_DIR.glob("*_fx_raw.csv"))
    return paths

def rsi14_expr(close_expr: pl.Expr) -> pl.Expr:
    """RSI(14) using EMA (Wilder smoothing)."""
    diff = close_expr.diff()
    gain = pl.when(diff > 0).then(diff).otherwise(0.0)
    loss = pl.when(diff < 0).then(-diff).otherwise(0.0)
    ag = gain.ewm_mean(alpha=1/14, adjust=False, ignore_nulls=True)
    al = loss.ewm_mean(alpha=1/14, adjust=False, ignore_nulls=True)
    rs = ag / pl.when(al == 0).then(None).otherwise(al)
    return 100 - (100 / (1 + rs))

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
    """Parse string timestamps to UTC Datetime; tz-aware→UTC; naive→UTC."""
    candidates: list[pl.Expr] = []
    for fmt in DT_FORMATS_WITH_TZ:
        candidates.append(pl.col(col).str.strptime(pl.Datetime, format=fmt, strict=False).dt.convert_time_zone("UTC"))
    for fmt in DT_FORMATS_NAIVE:
        candidates.append(pl.col(col).str.strptime(pl.Datetime, format=fmt, strict=False).dt.replace_time_zone("UTC"))
    return pl.coalesce(candidates)

def _clean_num(col: str) -> pl.Expr:
    return (
        pl.col(col)
          .cast(pl.Utf8, strict=False)
          .str.strip_chars()
          .str.replace_all(",", "")
          .str.replace_all(r"\s+", "")
          .cast(pl.Float64, strict=False)
    )

# ───────────────────────────── Per-file processing ─────────────────────────────
def process_one_local(csv_path: Path) -> Tuple[str, pl.DataFrame]:
    """
    Read a *_fx_raw.csv (columns: Open,High,Low,Close,Volume,Date),
    compute indicators, and return processed Polars DataFrame.
    """
    name = csv_path.name
    symbol = name.replace("_fx_raw.csv", "").upper()  # e.g., AUDUSD

    try:
        df = pl.read_csv(
            csv_path,
            infer_schema_length=0,
            try_parse_dates=False,
            ignore_errors=True,
            null_values=["", "null", "None"],
        )
    except Exception as e:
        print(f"[WARN] {name}: read failed → {e}")
        return symbol, pl.DataFrame()

    df = df.rename({c: c.strip().title() for c in df.columns})
    expected = {"Open","High","Low","Close","Volume","Date"}
    missing = expected - set(df.columns)
    if missing:
        print(f"[WARN] {symbol}: missing {missing} — skipping")
        return symbol, pl.DataFrame()

    # Clean nums & parse time
    df = (
        df.with_columns([
            _clean_num("Open").alias("Open"),
            _clean_num("High").alias("High"),
            _clean_num("Low").alias("Low"),
            _clean_num("Close").alias("Close"),
            pl.col("Volume").cast(pl.Int64, strict=False),
            parse_datetime_utc("Date").alias("ts_utc")
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
            (pl.col("Returns").rolling_std(20) * math.sqrt(252)).alias("Volatility_20"),
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

def save_processed_per_pair(symbol: str, df_pl: pl.DataFrame) -> Path:
    """Write one processed CSV per pair under data/forex/processed/."""
    out_path = PROCESSED_DIR / f"{symbol}_fx_processed.csv"
    df_pl.write_csv(out_path)
    return out_path

# ───────────────────────────── Main ─────────────────────────────
def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Preprocess local FOREX CSVs (no Azure, Polars, indicators).")
    parser.add_argument("--make-parquet", action="store_true",
                        help="Also build a consolidated Parquet with all pairs.")
    parser.add_argument("--max-workers", type=int, default=MAX_WORKERS)
    args = parser.parse_args()

    paths = list_local_raw()
    print(f"Found {len(paths)} RAW forex file(s) in {RAW_DIR}")
    if not paths:
        return

    processed: int = 0
    written: int = 0
    outputs: List[Path] = []
    empty_or_skipped: int = 0

    # Parallel per-file transforms
    with ThreadPoolExecutor(max_workers=int(args.max_workers)) as ex:
        futs = {ex.submit(process_one_local, p): p for p in paths}
        for i, fut in enumerate(as_completed(futs), 1):
            src = futs[fut]
            try:
                symbol, dfp = fut.result()
            except Exception as e:
                print(f"[WARN] {src.name}: processing failed → {e}")
                empty_or_skipped += 1
                continue

            processed += 1
            if dfp.is_empty():
                empty_or_skipped += 1
                continue

            out_path = save_processed_per_pair(symbol, dfp)
            outputs.append(out_path)
            written += len(dfp)
            if processed % 50 == 0:
                print(f"Processed {processed}/{len(paths)} files …")

    print(f"\nPer-pair CSVs written: {len(outputs)}   rows: ~{written:,}")
    print(f"Skipped/empty files:   {empty_or_skipped}")

    # Optional consolidated Parquet
    if args.make_parquet and outputs:
        print("Building consolidated Parquet …")
        total_rows = 0
        sink_path = PROCESSED_DIR / "all_pairs_processed.parquet"
        # Stream-write in chunks to keep memory reasonable
        with pl.StringCache():
            # Collect frames in manageable batches
            batch: List[pl.DataFrame] = []
            for out_csv in outputs:
                df = pl.read_csv(out_csv, try_parse_dates=False)
                # Re-parse ts_local to Polars Datetime with tz label for consistency
                df = df.with_columns(
                    pl.col("ts_local").str.strptime(pl.Datetime, strict=False).dt.replace_time_zone(LOCAL_TZ)
                )
                batch.append(df)
                total_rows += df.height

                if sum(x.height for x in batch) >= BATCH_ROWS_TO_WRITE:
                    big = pl.concat(batch, how="vertical_relaxed")
                    mode = "wb" if not sink_path.exists() else "ab"
                    big.write_parquet(sink_path, compression="zstd", maintain_order=True, use_statistics=True, append=sink_path.exists())
                    batch.clear()

            if batch:
                big = pl.concat(batch, how="vertical_relaxed")
                big.write_parquet(sink_path, compression="zstd", maintain_order=True, use_statistics=True, append=sink_path.exists())

        print(f"Consolidated Parquet: {sink_path}  (~{total_rows:,} rows)")

    print("\n✅ Done.")

if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        raise
