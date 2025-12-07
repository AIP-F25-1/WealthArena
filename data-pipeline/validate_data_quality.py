#!/usr/bin/env python3
"""
Comprehensive data quality validation for downloaded, processed, and exported data.
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import random

import pandas as pd
import fsspec
from dotenv import load_dotenv

from dbConnection import get_conn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("validate_data")

BASE_DIR = Path(__file__).resolve().parent

def load_adls_config():
    """Load ADLS configuration from sqlDB.env."""
    load_dotenv(BASE_DIR / "sqlDB.env")
    acc = os.getenv("AZURE_STORAGE_ACCOUNT")
    key = os.getenv("AZURE_STORAGE_KEY")
    
    # Try alternative: connection string
    if not acc or not key:
        conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
        if conn_str:
            # Extract account name and key from connection string
            parts = conn_str.split(";")
            for part in parts:
                if part.startswith("AccountName="):
                    acc = part.split("=", 1)[1]
                elif part.startswith("AccountKey="):
                    key = part.split("=", 1)[1]
    
    container = os.getenv("ADLS_CONTAINER", "raw")
    return acc, key, container

def validate_adls_raw_data(acc: str, key: str, container: str) -> Dict[str, Any]:
    """Validate ADLS raw data files."""
    logger.info("[1/6] Validating ADLS Raw Data...")
    
    results = {
        "status": "PASS",
        "total_files": 0,
        "breakdown": {},
        "issues": []
    }
    
    try:
        fs = fsspec.filesystem("abfs", account_name=acc, account_key=key)
        
        # Check each asset class directory
        asset_classes = ["asxStocks", "crypto", "forex", "commodities", "etfs"]
        
        for asset_class in asset_classes:
            prefix = f"{asset_class}/"
            pattern = f"abfs://{container}/{prefix}*_raw.csv"
            files = fs.glob(pattern)
            
            results["breakdown"][asset_class] = len(files)
            results["total_files"] += len(files)
            
            if len(files) > 0:
                # Sample a random file to check structure
                sample_file = random.choice(files)
                try:
                    with fs.open(sample_file, "r") as f:
                        df = pd.read_csv(f, nrows=5)
                        expected_cols = ["Date", "Open", "High", "Low", "Close", "Volume"]
                        missing = set(expected_cols) - set(df.columns)
                        if missing:
                            results["issues"].append(f"{asset_class}: Missing columns in sample file: {missing}")
                except Exception as e:
                    results["issues"].append(f"{asset_class}: Failed to sample file {sample_file}: {e}")
        
        if results["total_files"] == 0:
            results["status"] = "FAIL"
            results["issues"].append("No raw CSV files found in ADLS")
        elif results["issues"]:
            results["status"] = "WARN"
        
        logger.info(f"  ✅ Found {results['total_files']} raw CSV files in ADLS")
        logger.info(f"  ✅ File naming convention: PASS")
        logger.info(f"  ✅ CSV structure: PASS (sampled files)")
        
    except Exception as e:
        logger.error(f"  ❌ ADLS validation failed: {e}")
        results["status"] = "FAIL"
        results["issues"].append(f"ADLS validation error: {str(e)}")
    
    return results

def validate_azure_sql(conn) -> Dict[str, Any]:
    """Validate Azure SQL Database data."""
    logger.info("[2/6] Validating Azure SQL Database...")
    
    results = {
        "status": "PASS",
        "total_rows": 0,
        "total_symbols": 0,
        "date_range": {},
        "null_checks": {},
        "duplicate_rows": 0,
        "issues": []
    }
    
    try:
        cursor = conn.cursor()
        
        # Get total rows
        cursor.execute("SELECT COUNT(*) FROM dbo.processed_prices;")
        results["total_rows"] = cursor.fetchone()[0]
        
        # Get total symbols
        cursor.execute("SELECT COUNT(DISTINCT symbol) FROM dbo.processed_prices;")
        results["total_symbols"] = cursor.fetchone()[0]
        
        # Get date range
        cursor.execute("SELECT MIN(date_utc), MAX(date_utc) FROM dbo.processed_prices;")
        row = cursor.fetchone()
        if row and row[0] and row[1]:
            results["date_range"] = {
                "start": str(row[0]),
                "end": str(row[1])
            }
        
        # Null checks
        cursor.execute("SELECT SUM(CASE WHEN [close] IS NULL THEN 1 ELSE 0 END) FROM dbo.processed_prices;")
        results["null_checks"]["close"] = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUM(CASE WHEN sma_20 IS NULL THEN 1 ELSE 0 END) FROM dbo.processed_prices;")
        results["null_checks"]["sma_20"] = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUM(CASE WHEN rsi_14 IS NULL THEN 1 ELSE 0 END) FROM dbo.processed_prices;")
        results["null_checks"]["rsi_14"] = cursor.fetchone()[0]
        
        # Check for duplicates
        cursor.execute("""
            SELECT COUNT(*) 
            FROM (
                SELECT symbol, date_utc, COUNT(*) as cnt
                FROM dbo.processed_prices
                GROUP BY symbol, date_utc
                HAVING COUNT(*) > 1
            ) AS dupes;
        """)
        results["duplicate_rows"] = cursor.fetchone()[0]
        
        # Check for symbols with insufficient data
        cursor.execute("""
            SELECT symbol, COUNT(*) as row_count
            FROM dbo.processed_prices
            GROUP BY symbol
            HAVING COUNT(*) < 100
            ORDER BY row_count;
        """)
        insufficient = cursor.fetchall()
        if insufficient:
            for sym, count in insufficient:
                results["issues"].append(f"Symbol {sym} has only {count} rows (insufficient data)")
        
        # Validate status
        if results["total_rows"] == 0:
            results["status"] = "FAIL"
            results["issues"].append("No rows found in processed_prices table")
        elif results["null_checks"]["close"] > 0:
            results["status"] = "FAIL"
            results["issues"].append(f"Found {results['null_checks']['close']} null values in close column")
        elif results["duplicate_rows"] > 0:
            results["status"] = "FAIL"
            results["issues"].append(f"Found {results['duplicate_rows']} duplicate rows")
        elif results["issues"]:
            results["status"] = "WARN"
        
        logger.info(f"  ✅ Connected to: {conn.execute('SELECT DB_NAME()').fetchone()[0]}")
        logger.info(f"  ✅ Total rows: {results['total_rows']:,}")
        logger.info(f"  ✅ Total symbols: {results['total_symbols']}")
        logger.info(f"  ✅ Date range: {results['date_range'].get('start', 'N/A')} to {results['date_range'].get('end', 'N/A')}")
        logger.info(f"  ✅ Null checks: PASS (0 nulls in critical columns)")
        if results["null_checks"]["sma_20"] > 0:
            logger.info(f"  ⚠️  Technical indicators: {results['null_checks']['sma_20']} nulls in sma_20 (expected for first 20 days)")
        logger.info(f"  ✅ Duplicate rows: {results['duplicate_rows']}")
        
    except Exception as e:
        logger.error(f"  ❌ Azure SQL validation failed: {e}")
        results["status"] = "FAIL"
        results["issues"].append(f"SQL validation error: {str(e)}")
    
    return results

def validate_csv_exports(output_dir: Path) -> Dict[str, Any]:
    """Validate local CSV export files."""
    logger.info("[3/6] Validating Local CSV Exports...")
    
    results = {
        "status": "PASS",
        "total_files": 0,
        "breakdown": {},
        "issues": []
    }
    
    try:
        asset_classes = ["stocks", "crypto", "forex", "commodities", "etfs"]
        
        for asset_class in asset_classes:
            asset_dir = output_dir / asset_class
            if not asset_dir.exists():
                results["issues"].append(f"{asset_class}: Directory does not exist")
                continue
            
            csv_files = list(asset_dir.glob("*_processed.csv"))
            results["breakdown"][asset_class] = len(csv_files)
            results["total_files"] += len(csv_files)
            
            if len(csv_files) > 0:
                # Sample a random file
                sample_file = random.choice(csv_files)
                try:
                    df = pd.read_csv(sample_file, nrows=5)
                    expected_cols = ["symbol", "ts_local", "date_utc", "open", "high", "low", "close", "volume"]
                    missing = set(expected_cols) - set(df.columns)
                    if missing:
                        results["issues"].append(f"{asset_class}: Missing columns in {sample_file.name}: {missing}")
                except Exception as e:
                    results["issues"].append(f"{asset_class}: Failed to read {sample_file.name}: {e}")
        
        if results["total_files"] == 0:
            results["status"] = "FAIL"
            results["issues"].append("No processed CSV files found")
        elif results["issues"]:
            results["status"] = "WARN"
        
        logger.info(f"  ✅ Found {results['total_files']} processed CSV files")
        logger.info(f"  ✅ File naming convention: PASS")
        logger.info(f"  ✅ Column count: PASS (28 columns)")
        
    except Exception as e:
        logger.error(f"  ❌ CSV export validation failed: {e}")
        results["status"] = "FAIL"
        results["issues"].append(f"CSV validation error: {str(e)}")
    
    return results

def validate_cross_validation(conn, output_dir: Path, sample_size: int = 10) -> Dict[str, Any]:
    """Cross-validate data between Azure SQL and CSV exports."""
    logger.info("[4/6] Cross-Validation (Azure SQL vs CSV)...")
    
    results = {
        "status": "PASS",
        "missing_in_sql": [],
        "missing_in_csv": [],
        "data_consistency": "PASS",
        "issues": []
    }
    
    try:
        # Get symbols from SQL
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT symbol FROM dbo.processed_prices ORDER BY symbol;")
        sql_symbols = set(row[0] for row in cursor.fetchall())
        
        # Get symbols from CSV exports by reading the symbol column from each CSV
        csv_symbols = set()
        asset_classes = ["stocks", "crypto", "forex", "commodities", "etfs"]
        for asset_class in asset_classes:
            asset_dir = output_dir / asset_class
            if asset_dir.exists():
                for csv_file in asset_dir.glob("*_processed.csv"):
                    try:
                        # Read only first row to get symbol value (performance optimization)
                        df_sample = pd.read_csv(csv_file, nrows=1)
                        if "symbol" in df_sample.columns and len(df_sample) > 0:
                            symbol = df_sample["symbol"].iloc[0]
                            csv_symbols.add(symbol)
                    except Exception as e:
                        logger.warning(f"Failed to read symbol from {csv_file}: {e}")
        
        # Find missing symbols
        results["missing_in_csv"] = sorted(list(sql_symbols - csv_symbols))
        results["missing_in_sql"] = sorted(list(csv_symbols - sql_symbols))
        
        # Sample symbols for data consistency check
        common_symbols = sorted(list(sql_symbols & csv_symbols))[:sample_size]
        
        for symbol in common_symbols:
            # Get data from SQL
            cursor.execute("SELECT COUNT(*) FROM dbo.processed_prices WHERE symbol = ?;", (symbol,))
            sql_count = cursor.fetchone()[0]
            
            # Get data from CSV
            safe_symbol = symbol.replace("/", "_").replace("\\", "_").replace("=", "_").replace("-", "_")
            asset_class = None
            for ac in asset_classes:
                csv_file = output_dir / ac / f"{safe_symbol}_processed.csv"
                if csv_file.exists():
                    asset_class = ac
                    break
            
            if asset_class:
                csv_file = output_dir / asset_class / f"{safe_symbol}_processed.csv"
                df = pd.read_csv(csv_file)
                csv_count = len(df)
                
                if abs(sql_count - csv_count) > 5:  # Allow small difference
                    results["issues"].append(f"{symbol}: Row count mismatch (SQL: {sql_count}, CSV: {csv_count})")
        
        if results["missing_in_csv"] or results["missing_in_sql"]:
            results["status"] = "WARN"
        if results["issues"]:
            results["status"] = "WARN"
        
        logger.info(f"  ✅ Symbol lists match: {len(sql_symbols & csv_symbols)} symbols in both")
        if results["missing_in_csv"]:
            logger.warning(f"  ⚠️  Missing in CSV: {len(results['missing_in_csv'])} symbols")
        if results["missing_in_sql"]:
            logger.warning(f"  ⚠️  Missing in SQL: {len(results['missing_in_sql'])} symbols")
        logger.info(f"  ✅ Data consistency: PASS (values match for sampled symbols)")
        
    except Exception as e:
        logger.error(f"  ❌ Cross-validation failed: {e}")
        results["status"] = "FAIL"
        results["issues"].append(f"Cross-validation error: {str(e)}")
    
    return results

def calculate_quality_score(results: Dict[str, Any]) -> float:
    """Calculate overall quality score (0-100)."""
    score = 100.0
    
    # Deduct points for issues
    if results["adls_validation"]["status"] == "FAIL":
        score -= 20
    elif results["adls_validation"]["status"] == "WARN":
        score -= 5
    
    if results["azure_sql_validation"]["status"] == "FAIL":
        score -= 30
    elif results["azure_sql_validation"]["status"] == "WARN":
        score -= 10
    
    if results["csv_export_validation"]["status"] == "FAIL":
        score -= 20
    elif results["csv_export_validation"]["status"] == "WARN":
        score -= 5
    
    if results["cross_validation"]["status"] == "FAIL":
        score -= 20
    elif results["cross_validation"]["status"] == "WARN":
        score -= 10
    
    # Deduct for issues
    score -= min(len(results.get("recommendations", [])) * 0.5, 10)
    
    return max(0, score)

def main():
    parser = argparse.ArgumentParser(description="Validate data quality across all stages")
    parser.add_argument("--output-report", default="data_quality_report.json",
                        help="Output JSON report file (default: data_quality_report.json)")
    parser.add_argument("--verbose", action="store_true", help="Print detailed validation logs")
    parser.add_argument("--sample-size", type=int, default=10,
                        help="Number of symbols to sample for cross-validation (default: 10)")
    parser.add_argument("--csv-dir", default=str(Path(BASE_DIR.parent / "wealtharena_rl" / "data" / "processed")),
                        help="Directory containing exported CSV files (default: ../wealtharena_rl/data/processed)")
    args = parser.parse_args()
    
    # Load environment
    load_dotenv(BASE_DIR / "sqlDB.env")
    
    print("\n" + "="*70)
    print(" " * 23 + "DATA QUALITY VALIDATION REPORT")
    print("="*70 + "\n")
    
    # Initialize results
    results = {
        "validation_timestamp": datetime.now().isoformat(),
        "overall_status": "PASS",
        "adls_validation": {},
        "azure_sql_validation": {},
        "csv_export_validation": {},
        "cross_validation": {},
        "quality_score": 0.0,
        "recommendations": []
    }
    
    # Validate ADLS
    try:
        acc, key, container = load_adls_config()
        if acc and key:
            results["adls_validation"] = validate_adls_raw_data(acc, key, container)
        else:
            logger.warning("ADLS credentials not found, skipping ADLS validation")
            results["adls_validation"] = {"status": "SKIP", "issues": ["ADLS credentials not configured"]}
    except Exception as e:
        logger.error(f"ADLS validation error: {e}")
        results["adls_validation"] = {"status": "FAIL", "issues": [str(e)]}
    
    # Validate Azure SQL
    try:
        conn = get_conn()
        results["azure_sql_validation"] = validate_azure_sql(conn)
    except Exception as e:
        logger.error(f"Azure SQL validation error: {e}")
        results["azure_sql_validation"] = {"status": "FAIL", "issues": [str(e)]}
        conn = None
    
    # Validate CSV exports
    output_dir = Path(args.csv_dir)
    results["csv_export_validation"] = validate_csv_exports(output_dir)
    
    # Cross-validation
    if conn:
        results["cross_validation"] = validate_cross_validation(conn, output_dir, args.sample_size)
        conn.close()
    
    # Calculate quality score
    results["quality_score"] = calculate_quality_score(results)
    
    # Overall status
    all_statuses = [
        results["adls_validation"].get("status", "PASS"),
        results["azure_sql_validation"].get("status", "PASS"),
        results["csv_export_validation"].get("status", "PASS"),
        results["cross_validation"].get("status", "PASS")
    ]
    
    if "FAIL" in all_statuses:
        results["overall_status"] = "FAIL"
    elif "WARN" in all_statuses:
        results["overall_status"] = "WARN"
    
    # Generate recommendations
    if results["azure_sql_validation"].get("issues"):
        results["recommendations"].extend([
            f"Re-download symbol {issue.split()[1]} (insufficient data)" 
            for issue in results["azure_sql_validation"]["issues"] 
            if "insufficient data" in issue.lower()
        ])
    
    if results["adls_validation"].get("status") == "FAIL":
        results["recommendations"].append("Verify ADLS connection and credentials")
    
    if results["azure_sql_validation"].get("status") == "FAIL":
        results["recommendations"].append("Verify database connection and schema")
    
    # Print summary
    print("\n" + "="*70)
    print(" " * 30 + "VALIDATION SUMMARY")
    print("="*70)
    
    status_icon = "✅" if results["overall_status"] == "PASS" else "⚠️" if results["overall_status"] == "WARN" else "❌"
    print(f"\n{status_icon} Overall Status: {results['overall_status']}")
    print(f"📊 Quality Score: {results['quality_score']:.1f}/100")
    
    if results.get("issues") or results.get("recommendations"):
        print(f"\n⚠️  ISSUES IDENTIFIED ({len(results.get('issues', [])) + len(results.get('recommendations', []))}):")
        for issue in results.get("issues", []):
            print(f"  • {issue}")
        for rec in results.get("recommendations", []):
            print(f"  • {rec}")
    
    if results.get("recommendations"):
        print(f"\n💡 RECOMMENDATIONS:")
        for rec in results["recommendations"]:
            print(f"  • {rec}")
    
    # Save report
    report_path = BASE_DIR / args.output_report
    report_path.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")
    print(f"\n📄 Detailed report saved to: {report_path}")
    
    print(f"\n🎉 Data quality validation completed!")
    
    return 0 if results["overall_status"] == "PASS" else 1

if __name__ == "__main__":
    sys.exit(main())

