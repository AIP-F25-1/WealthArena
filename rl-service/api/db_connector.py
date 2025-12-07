"""
Database Connection Module for RL Inference Service
Provides database connectivity (PostgreSQL or SQL Server) to query processed_prices table
"""

import os
import logging
import time
from typing import Optional, List
import pandas as pd
from dotenv import load_dotenv
from pathlib import Path

# Import metrics module
try:
    from api.metrics import record_db_query, record_db_error
    METRICS_AVAILABLE = True
except ImportError:
    try:
        from metrics import record_db_query, record_db_error
        METRICS_AVAILABLE = True
    except ImportError:
        METRICS_AVAILABLE = False
        def record_db_query(*args, **kwargs): pass
        def record_db_error(*args, **kwargs): pass

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Normalize DB_TYPE to canonical values
# Accepts: 'postgres', 'postgresql', 'pg' -> maps to 'postgres'
# Everything else -> maps to 'sqlserver'
def normalize_db_type(db_type: Optional[str]) -> str:
    """Normalize database type to canonical value."""
    if not db_type:
        return 'sqlserver'
    normalized = db_type.lower().strip()
    if normalized in ('postgres', 'postgresql', 'pg'):
        return 'postgres'
    return 'sqlserver'

# Determine database type
DB_TYPE = normalize_db_type(os.getenv('DB_TYPE', 'sqlserver'))

# Conditional imports
if DB_TYPE == 'postgres':
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        PSYCOPG2_AVAILABLE = True
    except ImportError:
        PSYCOPG2_AVAILABLE = False
        logger = logging.getLogger(__name__)
        logger.warning("psycopg2 not available. PostgreSQL support disabled.")
else:
    try:
        import pyodbc
        PYODBC_AVAILABLE = True
    except ImportError:
        PYODBC_AVAILABLE = False
        logger = logging.getLogger(__name__)
        logger.warning("pyodbc not available. SQL Server support disabled.")

logger = logging.getLogger(__name__)


def get_connection():
    """
    Create database connection (PostgreSQL or SQL Server)
    
    Returns:
        Database connection object
        
    Raises:
        RuntimeError: If connection fails
    """
    try:
        host = os.getenv('DB_HOST')
        database = os.getenv('DB_NAME')
        username = os.getenv('DB_USER')
        password = os.getenv('DB_PASSWORD')
        
        if not all([host, database, username, password]):
            raise RuntimeError("Missing required database credentials in environment")
        
        if DB_TYPE == 'postgres':
            if not PSYCOPG2_AVAILABLE:
                raise RuntimeError("psycopg2 not available for PostgreSQL connections")
            
            # Check if running on GCP (Unix socket)
            if host.startswith('/cloudsql/'):
                # GCP Unix socket connection
                conn = psycopg2.connect(
                    host=host,  # /cloudsql/project:region:instance
                    database=database,
                    user=username,
                    password=password
                )
                logger.info(f"Connecting to PostgreSQL via Unix socket: {host}")
            else:
                # TCP connection
                port = int(os.getenv('DB_PORT', '5432'))
                ssl_mode = 'require' if os.getenv('DB_ENCRYPT', 'true').lower() == 'true' else 'prefer'
                conn = psycopg2.connect(
                    host=host,
                    port=port,
                    database=database,
                    user=username,
                    password=password,
                    sslmode=ssl_mode
                )
                logger.info(f"Connecting to PostgreSQL: {host}:{port}/{database}")
            
            logger.info("✅ PostgreSQL database connection established")
            return conn
        else:
            # SQL Server connection
            if not PYODBC_AVAILABLE:
                raise RuntimeError("pyodbc not available for SQL Server connections")
            
            driver = os.getenv('SQL_DRIVER', 'ODBC Driver 18 for SQL Server')
            port = os.getenv('DB_PORT', '1433')
            encrypt = os.getenv('DB_ENCRYPT', 'true')
            
            conn_str = (
                f"Driver={{{driver}}};"
                f"Server=tcp:{host},{port};"
                f"Database={database};"
                f"Uid={username};"
                f"Pwd={password};"
                f"Encrypt={encrypt};"
                f"TrustServerCertificate=no;"
                f"Connection Timeout=30;"
            )
            
            logger.info(f"Connecting to SQL Server: {host}:{port}/{database}")
            conn = pyodbc.connect(conn_str)
            logger.info("✅ SQL Server database connection established")
            return conn
        
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise RuntimeError(f"Failed to connect to database: {e}")


def get_market_data(symbol: str, days: int = 60) -> Optional[pd.DataFrame]:
    """
    Query market data with technical indicators from processed_prices table
    
    Args:
        symbol: Stock/crypto symbol (e.g., "BHP.AX", "BTC-USD")
        days: Number of days of historical data to fetch (default: 60)
        
    Returns:
        pd.DataFrame: Market data with columns: Date, Open, High, Low, Close, Volume,
                     SMA_20, SMA_50, RSI, MACD, Volume_Ratio, Volatility_20
        None: If database error occurred (distinguished from empty result)
        
    Raises:
        RuntimeError: If database connection fails
    """
    conn = None
    try:
        conn = get_connection()
        
        if DB_TYPE == 'postgres':
            # PostgreSQL query syntax
            query = """
            SELECT 
                date_utc,
                "open",
                "high",
                "low",
                "close",
                volume,
                sma_20,
                sma_50,
                rsi_14 AS rsi,
                macd,
                volume_ratio,
                volatility_20
            FROM processed_prices
            WHERE symbol = %s
            ORDER BY date_utc DESC
            LIMIT %s
            """
            params = (symbol, days)
        else:
            # SQL Server query syntax
            query = """
            SELECT TOP (?) 
                date_utc,
                [open],
                [high],
                [low],
                [close],
                volume,
                sma_20,
                sma_50,
                rsi_14 AS rsi,
                macd,
                volume_ratio,
                volatility_20
            FROM dbo.processed_prices
            WHERE symbol = ?
            ORDER BY date_utc DESC
            """
            params = [days, symbol]
        
        # Use parameterized query
        query_start_time = time.time()
        try:
            df = pd.read_sql(
                query,
                conn,
                params=params
            )
            query_duration = time.time() - query_start_time
            if METRICS_AVAILABLE:
                record_db_query(query_duration, 'select')
        except Exception as e:
            query_duration = time.time() - query_start_time
            if METRICS_AVAILABLE:
                record_db_query(query_duration, 'select')
                record_db_error('select')
            raise
        
        if df.empty:
            logger.warning(f"No data found for symbol: {symbol}")
            return pd.DataFrame()  # Empty DataFrame means no data, not a DB error
        
        # Rename columns to match expected format (capitalize)
        df = df.rename(columns={
            'date_utc': 'Date',
            'open': 'Open',
            'high': 'High',
            'low': 'Low',
            'close': 'Close',
            'volume': 'Volume',
            'sma_20': 'SMA_20',
            'sma_50': 'SMA_50',
            'rsi': 'RSI',
            'macd': 'MACD',
            'volume_ratio': 'Volume_Ratio',
            'volatility_20': 'Volatility_20'
        })
        
        # Sort by date ascending (oldest first)
        df = df.sort_values('Date', ascending=True).reset_index(drop=True)
        
        logger.info(f"✅ Retrieved {len(df)} rows for {symbol}")
        return df
        
    except Exception as e:
        logger.error(f"Database query error for {symbol}: {e}")
        raise RuntimeError(f"Database error querying data for {symbol}: {e}")
    finally:
        if conn:
            close_connection(conn)


def get_symbols_by_asset_type(asset_type: str, limit: int = 100) -> List[str]:
    """
    Get list of symbols by asset type from processed_prices table
    
    Args:
        asset_type: Asset type ('stocks', 'crypto', 'forex', 'commodities', 'etfs')
        limit: Maximum number of symbols to return (default: 100)
        
    Returns:
        List[str]: List of symbols
    """
    conn = None
    query_start_time = None
    try:
        conn = get_connection()
        query_start_time = time.time()
        
        # Define symbol patterns based on asset type
        # Note: Check for asset_type column first; if not available, use patterns
        patterns = {
            'stocks': ['%.AX'],  # ASX stocks - removed global % to avoid cross-asset contamination
            'crypto': ['%-USD', '%-USDT'],
            'forex': ['%=X'],
            'commodities': ['%=F'],
            'etfs': ['%.AX']  # ASX ETFs - removed global %
        }
        
        if asset_type not in patterns:
            logger.warning(f"Unknown asset type: {asset_type}")
            return []
        
        symbols = []
        
        # First, try to use asset_type column if available (preferred method)
        try:
            if DB_TYPE == 'postgres':
                # PostgreSQL query syntax
                query_asset_type = """
                SELECT symbol
                FROM (
                    SELECT symbol, MAX(date_utc) AS last_date
                    FROM processed_prices
                    WHERE asset_type = %s
                    GROUP BY symbol
                ) t
                ORDER BY t.last_date DESC
                LIMIT %s
                """
                cursor = conn.cursor()
                cursor.execute(query_asset_type, (asset_type, limit))
                results = cursor.fetchall()
                cursor.close()
            else:
                # SQL Server query syntax
                query_asset_type = """
                SELECT TOP (?) symbol
                FROM (
                    SELECT symbol, MAX(date_utc) AS last_date
                    FROM dbo.processed_prices
                    WHERE asset_type = ?
                    GROUP BY symbol
                ) t
                ORDER BY t.last_date DESC
                """
                cursor = conn.cursor()
                cursor.execute(query_asset_type, limit, asset_type)
                results = cursor.fetchall()
                cursor.close()
            
            if results:
                query_duration = time.time() - query_start_time
                if METRICS_AVAILABLE:
                    record_db_query(query_duration, 'select')
                symbols = [row[0] for row in results]
                logger.info(f"✅ Retrieved {len(symbols)} symbols for {asset_type} using asset_type column")
                return symbols[:limit]
        except Exception as e:
            query_duration = time.time() - query_start_time if query_start_time else 0
            if METRICS_AVAILABLE:
                record_db_query(query_duration, 'select')
                record_db_error('select')
            # asset_type column may not exist, fall back to pattern matching
            logger.debug(f"asset_type column not available ({e}), using pattern matching for {asset_type}")
        
        # Fall back to pattern matching if asset_type column is not available
        pattern_list = patterns[asset_type]
        
        # Query distinct symbols matching patterns
        for pattern in pattern_list:
            pattern_query_start = time.time()
            try:
                if DB_TYPE == 'postgres':
                    if '%' in pattern:
                        query = """
                        SELECT symbol
                        FROM (
                            SELECT symbol, MAX(date_utc) AS last_date
                            FROM processed_prices
                            WHERE symbol LIKE %s
                            GROUP BY symbol
                        ) t
                        ORDER BY t.last_date DESC
                        LIMIT %s
                        """
                        cursor = conn.cursor()
                        cursor.execute(query, (pattern, limit))
                        results = cursor.fetchall()
                        cursor.close()
                    else:
                        query = """
                        SELECT symbol
                        FROM (
                            SELECT symbol, MAX(date_utc) AS last_date
                            FROM processed_prices
                            WHERE symbol = %s
                            GROUP BY symbol
                        ) t
                        ORDER BY t.last_date DESC
                        LIMIT %s
                        """
                        cursor = conn.cursor()
                        cursor.execute(query, (pattern, limit))
                        results = cursor.fetchall()
                        cursor.close()
                else:
                    # SQL Server
                    if '%' in pattern:
                        query = """
                        SELECT TOP (?) symbol
                        FROM (
                            SELECT symbol, MAX(date_utc) AS last_date
                            FROM dbo.processed_prices
                            WHERE symbol LIKE ?
                            GROUP BY symbol
                        ) t
                        ORDER BY t.last_date DESC
                        """
                        cursor = conn.cursor()
                        cursor.execute(query, limit, pattern)
                        results = cursor.fetchall()
                        cursor.close()
                    else:
                        query = """
                        SELECT TOP (?) symbol
                        FROM (
                            SELECT symbol, MAX(date_utc) AS last_date
                            FROM dbo.processed_prices
                            WHERE symbol = ?
                            GROUP BY symbol
                        ) t
                        ORDER BY t.last_date DESC
                        """
                        cursor = conn.cursor()
                        cursor.execute(query, limit, pattern)
                        results = cursor.fetchall()
                        cursor.close()
                
                pattern_query_duration = time.time() - pattern_query_start
                if METRICS_AVAILABLE:
                    record_db_query(pattern_query_duration, 'select')
                
                symbols.extend([row[0] for row in results if row[0] not in symbols])
                
                if len(symbols) >= limit:
                    break
            except Exception as e:
                pattern_query_duration = time.time() - pattern_query_start
                if METRICS_AVAILABLE:
                    record_db_query(pattern_query_duration, 'select')
                    record_db_error('select')
                logger.warning(f"Error querying pattern {pattern}: {e}")
        
        # Limit results
        symbols = symbols[:limit]
        
        logger.info(f"✅ Retrieved {len(symbols)} symbols for {asset_type}")
        return symbols
        
    except Exception as e:
        if query_start_time:
            query_duration = time.time() - query_start_time
            if METRICS_AVAILABLE:
                record_db_query(query_duration, 'select')
                record_db_error('select')
        logger.error(f"Database query error for asset_type {asset_type}: {e}")
        return []
    finally:
        if conn:
            close_connection(conn)


def close_connection(conn):
    """
    Safely close database connection
    
    Args:
        conn: pyodbc.Connection object
    """
    try:
        if conn:
            conn.close()
            logger.debug("Database connection closed")
    except Exception as e:
        logger.warning(f"Error closing connection: {e}")

