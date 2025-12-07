#!/usr/bin/env python3
"""
WealthArena - Technical Indicators Computation
Processes raw CSV files from ADLS, computes technical indicators, and loads into Azure SQL.
"""

import os
import sys
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List
from dateutil.parser import parse as parse_datetime

# Add Financial_Assets_Pipeline to path
pipeline_dir = Path(__file__).parent.parent.parent / "Financial_Assets_Pipeline"
sys.path.insert(0, str(pipeline_dir))

# Import existing functions
from processAndStore import process_one, insert_stage, merge_stage, list_paths
from dbConnection import get_conn

# =========================== Configuration ===========================

BASE_DIR = Path(__file__).parent.parent.parent
SCRIPT_DIR = Path(__file__).parent
LOG_DIR = SCRIPT_DIR / "logs"

# Load environment variables
env_path = BASE_DIR / "Financial_Assets_Pipeline" / "sqlDB.env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

env_path = BASE_DIR / "Financial_Assets_Pipeline" / "azureCred.env"
if env_path.exists():
    load_dotenv(env_path)

# =========================== Logging Setup ===========================

LOG_DIR.mkdir(parents=True, exist_ok=True)
log_filename = f"02_technical_indicators_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
log_file = LOG_DIR / log_filename

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("technical_indicators")

# Force line-buffered stdout
try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

# =========================== Incremental Processing ===========================

def get_recent_files(all_paths: List[str], days: int = 7) -> List[str]:
    """Filter files modified in last N days"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    recent = []
    
    for path in all_paths:
        try:
            # Check if ADLS file system is accessible
            from processAndStore import fs
            
            if hasattr(fs, 'info'):
                info = fs.info(path)
                modified = info.get('LastModified') or info.get('last_modified')
                
                if modified:
                    # Normalize to UTC datetime
                    if isinstance(modified, str):
                        try:
                            modified_dt = parse_datetime(modified)
                        except (ValueError, TypeError):
                            logger.warning(f"Could not parse modification time for {path}: {modified}, skipping")
                            continue
                    else:
                        modified_dt = modified
                    
                    # Convert to UTC if timezone-aware, otherwise assume UTC
                    if modified_dt.tzinfo is None:
                        modified_dt = modified_dt.replace(tzinfo=timezone.utc)
                    else:
                        modified_dt = modified_dt.astimezone(timezone.utc)
                    
                    if modified_dt > cutoff:
                        recent.append(path)
                else:
                    # No modification time, skip file
                    logger.warning(f"No modification time found for {path}, skipping")
            else:
                # If can't get modified time, skip file to honor incremental processing
                logger.warning(f"Cannot get modification time for {path} (fs.info not available), skipping")
        except Exception as e:
            logger.warning(f"Could not check modification time for {path}: {e}, skipping")
    
    return recent

def process_asset_class(conn, prefix: str, paths: List[str]) -> dict:
    """Process all files for one asset class prefix"""
    logger.info(f"Processing {prefix}: {len(paths)} files (modified in last 7 days)")
    
    if not paths:
        return {"files_processed": 0, "rows_inserted": 0, "rows_updated": 0}
    
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from processAndStore import MAX_WORKERS, BATCH_ROWS, MERGE_EVERY_ROWS
    
    staged_rows = 0
    processed_files = 0
    buffer = []  # (path, df)
    pending_to_delete = []  # delete sources ONLY after successful MERGE
    
    def stage_buffer(buf) -> int:
        """Insert buffered dfs to stage (no delete here)"""
        if not buf:
            return 0
        
        import polars as pl
        dfs = [df for _, df in buf if df is not None and not df.is_empty()]
        if not dfs:
            return 0
        
        big = pl.concat(dfs, how="vertical_relaxed") if len(dfs) > 1 else dfs[0]
        return insert_stage(conn, big)
    
    def do_merge_and_delete():
        """Run MERGE; if successful, don't delete (incremental mode)"""
        nonlocal pending_to_delete
        if not pending_to_delete:
            return (0, 0)
        
        inserted, updated = merge_stage(conn)
        pending_to_delete = []  # Reset after merge
        return (inserted, updated)
    
    total_inserted = 0
    total_updated = 0
    failed_files = []
    
    try:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futures = {ex.submit(process_one, p): p for p in paths}
            
            for fut in as_completed(futures):
                try:
                    _, dfp = fut.result()
                except Exception as e:
                    bad = futures[fut]
                    logger.warning(f"Skipping file due to error: {bad} → {e}")
                    failed_files.append(bad)
                    continue
                
                path = futures[fut]
                buffer.append((path, dfp))
                processed_files += 1
                
                # Stage when buffer grows large enough
                if sum(len(x[1]) for x in buffer if x[1] is not None and not x[1].is_empty()) >= BATCH_ROWS:
                    staged_rows += stage_buffer(buffer)
                    # collect the sources we just staged
                    pending_to_delete.extend([p for p, df in buffer if df is not None and not df.is_empty()])
                    buffer.clear()
                
                # Periodic MERGE
                if staged_rows >= MERGE_EVERY_ROWS:
                    logger.info(f"MERGE after staging ~{staged_rows} rows …")
                    inserted, updated = do_merge_and_delete()
                    total_inserted += inserted
                    total_updated += updated
                    staged_rows = 0
                
                if processed_files % 100 == 0:
                    logger.info(f"Processed {processed_files}/{len(paths)} files …")
        
        # Flush remainder
        if buffer:
            staged_rows += stage_buffer(buffer)
            pending_to_delete.extend([p for p, df in buffer if df is not None and not df.is_empty()])
            buffer.clear()
        
        # Final MERGE
        if staged_rows > 0 or pending_to_delete:
            logger.info("Final MERGE …")
            inserted, updated = do_merge_and_delete()
            total_inserted += inserted
            total_updated += updated
        
        logger.info(f"✅ {prefix}: {processed_files} files processed")
        return {"files_processed": processed_files, "rows_inserted": total_inserted, "rows_updated": total_updated, "failed_files": failed_files}
        
    except Exception as e:
        logger.error(f"Error processing {prefix}: {e}", exc_info=True)
        return {"files_processed": processed_files, "rows_inserted": total_inserted, "rows_updated": total_updated, "failed_files": failed_files}

# =========================== Main Execution ===========================

def main():
    """Main execution function"""
    start_time = datetime.now()
    logger.info("=" * 70)
    logger.info("Starting technical indicators computation...")
    logger.info("=" * 70)
    
    # Connect to database
    logger.info("Connecting to Azure SQL Database...")
    try:
        conn = get_conn()
        logger.info("✅ Connected to Azure SQL Database")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        return 1
    
    # Truncate stage table (defensive cleanup)
    logger.info("Truncating processed_stage table...")
    try:
        cur = conn.cursor()
        cur.execute("TRUNCATE TABLE dbo.processed_stage;")
        conn.commit()
        logger.info("✅ Truncated processed_stage")
    except Exception as e:
        logger.error(f"Failed to truncate stage table: {e}")
        conn.close()
        return 1
    
    # Process each asset class
    asset_classes = ["asxStocks", "crypto", "forex", "commodities", "etfs"]
    total_files = 0
    total_inserted = 0
    total_updated = 0
    all_failed_files = []
    
    for prefix in asset_classes:
        logger.info("")
        logger.info(f"Processing asset class: {prefix}")
        logger.info("-" * 70)
        
        try:
            # Get all paths for this prefix
            from processAndStore import CONT, fs
            
            pattern = f"{CONT}/{prefix}/*_raw.csv"
            all_paths = fs.glob(f"abfs://{pattern}")
            all_paths.sort()
            
            logger.info(f"Found {len(all_paths)} total files for {prefix}")
            
            # Filter for recent files
            recent_paths = get_recent_files(all_paths, days=7)
            logger.info(f"Filtered to {len(recent_paths)} files modified in last 7 days")
            
            if not recent_paths:
                logger.info(f"No recent files for {prefix}, skipping")
                continue
            
            # Process files
            result = process_asset_class(conn, prefix, recent_paths)
            
            total_files += result["files_processed"]
            total_inserted += result["rows_inserted"]
            total_updated += result["rows_updated"]
            all_failed_files.extend(result.get("failed_files", []))
            
        except Exception as e:
            logger.error(f"Error processing {prefix}: {e}", exc_info=True)
            continue
    
    # Write failed files to file
    if all_failed_files:
        failed_file = LOG_DIR / f"failed_files_{datetime.now().strftime('%Y%m%d')}.txt"
        failed_file.write_text("\n".join(all_failed_files), encoding="utf-8")
        logger.info(f"Saved {len(all_failed_files)} failed files to {failed_file.name}")
    
    # Calculate duration
    duration = datetime.now() - start_time
    duration_seconds = int(duration.total_seconds())
    
    # Print final summary
    logger.info("")
    logger.info("=" * 70)
    logger.info("📊 SUMMARY")
    logger.info("=" * 70)
    logger.info(f"Files processed: {total_files}")
    logger.info(f"Rows inserted: {total_inserted:,}")
    logger.info(f"Rows updated: {total_updated:,}")
    logger.info(f"Duration: {duration_seconds}s")
    logger.info("")
    logger.info("✅ Technical indicators computation completed")
    logger.info("=" * 70)
    
    # Close connection
    try:
        conn.close()
    except Exception:
        pass
    
    return 0

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

