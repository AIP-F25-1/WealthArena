"""
Deploy Azure SQL Database Schema

This script connects to an Azure SQL Database and deploys the schema
from azure_sql_schema.sql, handling GO statements and verifying deployment.

Usage:
    python deploy_database_schema.py --server <server> --database <database> [--schema <file>]

Requirements:
    pip install pyodbc
"""

import sys
import os
import argparse
import re
from pathlib import Path

try:
    import pyodbc
except ImportError:
    print("ERROR: pyodbc is not installed. Install it with: pip install pyodbc")
    sys.exit(1)


def get_connection_string(server, database, user="wealtharena_admin", password=None):
    """Generate Azure SQL connection string for ODBC Driver 18"""
    if not password:
        raise ValueError("Password is required")
    return (
        f"Driver={{ODBC Driver 18 for SQL Server}};"
        f"Server=tcp:{server},1433;"
        f"Database={database};"
        f"Uid={user};"
        f"Pwd={password};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
        f"Connection Timeout=30;"
    )


def read_schema_file(filepath):
    """Read SQL schema file and return content"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"ERROR: Schema file not found: {filepath}")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Failed to read schema file: {e}")
        sys.exit(1)


def split_sql_batches(sql_content):
    """Split SQL content by GO statements"""
    # Remove BOM if present
    if sql_content.startswith('\ufeff'):
        sql_content = sql_content[1:]
    
    # Normalize line endings to \n for consistent processing
    sql_content = sql_content.replace('\r\n', '\n').replace('\r', '\n')
    
    # Split by GO statements (case-insensitive, line-anchored regex for multiline)
    # Pattern: GO at start of line (optionally after whitespace), followed by optional whitespace/newlines
    batches = re.split(r'(?im)^\s*GO\s*$', sql_content, flags=re.MULTILINE)
    
    # Filter out empty batches and strip whitespace
    filtered_batches = [batch.strip() for batch in batches if batch.strip()]
    
    return filtered_batches


def execute_schema(connection_string, schema_file):
    """Execute SQL schema batches"""
    print("\n" + "=" * 70)
    print("DATABASE SCHEMA DEPLOYMENT")
    print("=" * 70)
    
    # Read and split schema
    print(f"\nReading schema file: {schema_file}")
    sql_content = read_schema_file(schema_file)
    
    print("Splitting SQL into batches...")
    batches = split_sql_batches(sql_content)
    print(f"Found {len(batches)} batches to execute")
    
    # Connect to database
    print("\nConnecting to database...")
    try:
        conn = pyodbc.connect(connection_string)
        cursor = conn.cursor()
        print("✅ Connected successfully")
    except pyodbc.Error as e:
        print(f"❌ Failed to connect: {e}")
        print("\nTroubleshooting:")
        print("1. Check firewall rules allow your IP")
        print("2. Verify server name is correct")
        print("3. Verify credentials are correct")
        sys.exit(1)
    
    # Execute batches
    success_count = 0
    warning_count = 0
    error_count = 0
    
    print("\nExecuting schema batches...")
    print("-" * 70)
    
    for i, batch in enumerate(batches, 1):
        if not batch.strip():
            continue
        
        try:
            # Execute batch
            cursor.execute(batch)
            
            # Check for warnings (e.g., "Object already exists")
            if cursor.messages:
                for msg in cursor.messages:
                    if 'already exists' in str(msg):
                        print(f"Batch {i}: ⚠️  {msg[1]}")
                        warning_count += 1
                        continue
            
            conn.commit()
            success_count += 1
            
            # Print progress for every 5 batches
            if i % 5 == 0:
                print(f"Batch {i}/{len(batches)}: ✅ Executed")
        
        except pyodbc.Error as e:
            error_count += 1
            print(f"Batch {i}: ❌ Error: {e}")
            
            # Show first few lines of failed batch for debugging
            lines = batch.split('\n')[:5]
            print(f"First lines of batch: {' '.join(lines)}")
            
            # Rollback and continue (don't fail immediately)
            conn.rollback()
    
    print("-" * 70)
    print(f"\nBatch execution summary:")
    print(f"  ✅ Successful: {success_count}")
    print(f"  ⚠️  Warnings: {warning_count}")
    print(f"  ❌ Errors: {error_count}")
    
    # Verify deployment
    print("\n" + "=" * 70)
    print("VERIFICATION")
    print("=" * 70)
    
    verification_passed = True
    
    # Check tables
    try:
        cursor.execute("""
            SELECT name FROM sys.tables 
            WHERE schema_name(schema_id) = 'dbo' 
            ORDER BY name
        """)
        tables = [row[0] for row in cursor.fetchall()]
        print(f"\n📊 Tables created: {len(tables)}")
        
        if len(tables) >= 14:
            print("✅ Expected table count (14+) met")
        else:
            print(f"⚠️  Expected at least 14 tables, found {len(tables)}")
            verification_passed = False
        
        # List table names
        for table in tables:
            print(f"  - {table}")
    
    except pyodbc.Error as e:
        print(f"❌ Failed to query tables: {e}")
        verification_passed = False
    
    # Check stored procedures
    try:
        cursor.execute("""
            SELECT name FROM sys.procedures 
            WHERE name = 'CalculatePortfolioPerformance'
        """)
        procs = cursor.fetchall()
        
        if len(procs) > 0:
            print("✅ Stored procedure: CalculatePortfolioPerformance")
        else:
            print("⚠️  Stored procedure not found")
            verification_passed = False
    
    except pyodbc.Error as e:
        print(f"⚠️  Could not verify stored procedure: {e}")
    
    # Check functions
    try:
        cursor.execute("""
            SELECT name FROM sys.objects 
            WHERE name = 'GetTopSignals' AND type = 'IF'
        """)
        funcs = cursor.fetchall()
        
        if len(funcs) > 0:
            print("✅ Function: GetTopSignals")
        else:
            print("⚠️  Function not found")
            verification_passed = False
    
    except pyodbc.Error as e:
        print(f"⚠️  Could not verify function: {e}")
    
    # Check sample data
    try:
        cursor.execute("SELECT COUNT(*) FROM market_data_ohlcv")
        count = cursor.fetchone()[0]
        print(f"📝 Sample data records: {count}")
        
        if count >= 3:
            print("✅ Sample data present")
        else:
            print(f"⚠️  Expected 3+ sample records, found {count}")
    
    except pyodbc.Error as e:
        print(f"⚠️  Could not verify sample data: {e}")
    
    # Close connection
    cursor.close()
    conn.close()
    
    # Final summary
    print("\n" + "=" * 70)
    if verification_passed and error_count == 0:
        print("✅ DATABASE SCHEMA DEPLOYED SUCCESSFULLY!")
        print("\nSummary:")
        print(f"  📊 Tables: {len(tables) if 'tables' in locals() else 'N/A'}")
        print(f"  📝 Batches executed: {success_count}")
        print("\nNext steps:")
        print("  1. Run verification script: verify_setup.ps1")
        print("  2. Generate environment files: generate_env_files.ps1")
        print("  3. Start local services for testing")
        return 0
    else:
        print("⚠️  DEPLOYMENT COMPLETED WITH ISSUES")
        print("\nPlease review the errors above.")
        print("Common issues:")
        print("  1. Object already exists (safe to ignore)")
        print("  2. Foreign key constraints (verify table creation order)")
        print("  3. Permission errors (check database user permissions)")
        return 1


def main():
    parser = argparse.ArgumentParser(description="Deploy Azure SQL Database Schema")
    parser.add_argument("--server", required=True, help="SQL Server name (e.g., server.database.windows.net)")
    parser.add_argument("--database", required=True, help="Database name (e.g., wealtharena_db)")
    parser.add_argument("--user", default="wealtharena_admin", help="Database user (default: wealtharena_admin)")
    parser.add_argument("--password", required=True, help="Database password (required)")
    parser.add_argument("--schema", help="Path to schema file")
    
    args = parser.parse_args()
    
    # Determine schema file path
    if args.schema:
        schema_file = args.schema
    else:
        # Default to database_schemas/azure_sql_schema.sql relative to project root
        script_dir = Path(__file__).parent
        project_root = script_dir.parent.parent
        schema_file = project_root / "database_schemas" / "azure_sql_schema.sql"
    
    if not os.path.exists(schema_file):
        print(f"ERROR: Schema file not found: {schema_file}")
        sys.exit(1)
    
    # Build connection string
    connection_string = get_connection_string(
        args.server, 
        args.database, 
        args.user, 
        args.password
    )
    
    # Execute schema deployment
    exit_code = execute_schema(connection_string, schema_file)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

