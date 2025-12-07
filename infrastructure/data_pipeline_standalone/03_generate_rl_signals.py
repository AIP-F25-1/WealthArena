#!/usr/bin/env python3
"""
WealthArena - RL Signal Generation
Generates trading signals using RL model inference (or mock predictions) and stores in Azure SQL.
"""

import os
import sys
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
import numpy as np

# Add Financial_Assets_Pipeline to path
pipeline_dir = Path(__file__).parent.parent.parent / "Financial_Assets_Pipeline"
sys.path.insert(0, str(pipeline_dir))

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

# Configuration
LOOKBACK_DAYS = 60
BATCH_SIZE = 100
CONFIDENCE_THRESHOLD = 0.6
MODEL_VERSION = "mock_v1"

# =========================== Logging Setup ===========================

LOG_DIR.mkdir(parents=True, exist_ok=True)
log_filename = f"03_rl_signals_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
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

logger = logging.getLogger("rl_signals")

# =========================== Feature Extraction ===========================

def get_latest_features(conn, symbol: str, lookback_days: int = 60) -> Optional[np.ndarray]:
    """Query latest technical indicators from processed_prices table"""
    query = """
        SELECT [close], sma_20, sma_50, ema_12, ema_26, rsi_14,
            macd, macd_signal, bb_upper, bb_lower,
            returns, volatility_20, momentum_20, volume_ratio
        FROM dbo.processed_prices
        WHERE symbol = ?
        ORDER BY date_utc DESC
        OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY
    """
    
    try:
        cursor = conn.cursor()
        cursor.execute(query, (symbol, lookback_days))
        rows = cursor.fetchall()
        
        if len(rows) < 20:  # Need minimum data for indicators
            logger.debug(f"{symbol}: Insufficient data ({len(rows)} rows)")
            return None
        
        # Convert PyODBC rows to list of tuples first
        tuples = [tuple(r) for r in rows]
        features = np.array(tuples, dtype=np.float32)
        
        # Handle None/null values
        features = np.nan_to_num(features, nan=0.0, posinf=0.0, neginf=0.0)
        
        # Simple normalization: (x - mean) / std
        mean = features.mean(axis=0)
        std = features.std(axis=0) + 1e-8
        features = (features - mean) / std
        
        return features
        
    except Exception as e:
        logger.error(f"{symbol}: Error extracting features: {e}")
        return None

def get_current_price(conn, symbol: str) -> Optional[tuple]:
    """Get current price and timestamp for a symbol"""
    query = """
        SELECT TOP 1 [close], date_utc, ts_local
        FROM dbo.processed_prices
        WHERE symbol = ?
        ORDER BY date_utc DESC
    """
    
    try:
        cursor = conn.cursor()
        cursor.execute(query, (symbol,))
        row = cursor.fetchone()
        if not row:
            return None
        return row
    except Exception as e:
        logger.error(f"{symbol}: Error getting current price: {e}")
        return None

def classify_asset_type(symbol: str) -> str:
    """Classify asset type based on symbol"""
    symbol_upper = symbol.upper()
    
    if symbol_upper.endswith('.AX'):
        return 'stocks'
    elif '-USD' in symbol_upper:
        return 'crypto'
    elif '=X' in symbol_upper:
        return 'forex'
    elif '=F' in symbol_upper:
        return 'commodities'
    else:
        # Check if it's an ETF
        if symbol_upper in ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VEU', 'EFA']:
            return 'etf'
        return 'stocks'

# =========================== Mock Signal Generation ===========================

def generate_mock_prediction(features: np.ndarray, symbol: str, asset_type: str) -> Dict[str, Any]:  # pylint: disable=unused-argument
    """Generate a mock prediction (placeholder until model is loaded)"""
    # Simple heuristics based on features
    avg_feature = float(np.mean(features))
    
    if avg_feature > 0.5:
        signal = "BUY"
        confidence = 0.75
    elif avg_feature < -0.5:
        signal = "SELL"
        confidence = 0.65
    else:
        signal = "HOLD"
        confidence = 0.5
    
    return {
        "signal": signal,
        "confidence": confidence,
        "avg_feature": avg_feature
    }

def calculate_price_levels(entry_price: float, signal: str, asset_type: str) -> Dict[str, float]:
    """Calculate stop loss and take profit levels based on asset type"""
    
    # Different multipliers for different asset types
    if asset_type in ['crypto', 'commodity']:
        stop_loss_pct = 0.10  # 10% for volatile assets
        tp1_pct = 0.05   # 5%
        tp2_pct = 0.10   # 10%
        tp3_pct = 0.20   # 20%
    elif asset_type == 'forex':
        stop_loss_pct = 0.02  # 2% for forex
        tp1_pct = 0.01   # 1%
        tp2_pct = 0.02   # 2%
        tp3_pct = 0.04   # 4%
    else:  # stocks, etf
        stop_loss_pct = 0.05  # 5% for stocks
        tp1_pct = 0.03   # 3%
        tp2_pct = 0.06   # 6%
        tp3_pct = 0.10   # 10%
    
    if signal == "BUY":
        stop_loss = entry_price * (1 - stop_loss_pct)
        take_profit_1 = entry_price * (1 + tp1_pct)
        take_profit_2 = entry_price * (1 + tp2_pct)
        take_profit_3 = entry_price * (1 + tp3_pct)
    elif signal == "SELL":
        stop_loss = entry_price * (1 + stop_loss_pct)
        take_profit_1 = entry_price * (1 - tp1_pct)
        take_profit_2 = entry_price * (1 - tp2_pct)
        take_profit_3 = entry_price * (1 - tp3_pct)
    else:  # HOLD
        stop_loss = entry_price
        take_profit_1 = entry_price
        take_profit_2 = entry_price
        take_profit_3 = entry_price
    
    return {
        "stop_loss": round(stop_loss, 4),
        "take_profit_1": round(take_profit_1, 4),
        "take_profit_2": round(take_profit_2, 4),
        "take_profit_3": round(take_profit_3, 4)
    }

# =========================== Signal Generation ===========================

def generate_signal_for_symbol(conn, symbol: str) -> Optional[Dict[str, Any]]:
    """Generate trading signal for a single symbol"""
    
    # Get asset type
    asset_type = classify_asset_type(symbol)
    
    # Get latest features
    features = get_latest_features(conn, symbol, LOOKBACK_DAYS)
    if features is None:
        return None
    
    # Get current price
    price_row = get_current_price(conn, symbol)
    if not price_row:
        return None
    
    current_price, date_utc, ts_local = price_row
    
    # Generate prediction (mock until models trained)
    prediction = generate_mock_prediction(features, symbol, asset_type)
    
    # Only return if confidence meets threshold
    if prediction['confidence'] < CONFIDENCE_THRESHOLD:
        logger.debug(f"{symbol}: Low confidence ({prediction['confidence']:.2f}), skipping")
        return None
    
    # Calculate price levels
    levels = calculate_price_levels(current_price, prediction['signal'], asset_type)
    
    return {
        'symbol': symbol,
        'signal_type': prediction['signal'],
        'confidence_score': prediction['confidence'],
        'entry_price': float(current_price),
        'stop_loss': levels['stop_loss'],
        'take_profit_1': levels['take_profit_1'],
        'take_profit_2': levels['take_profit_2'],
        'take_profit_3': levels['take_profit_3'],
        'date_time': ts_local if ts_local else date_utc,
        'model_reasoning': f"Mock signal based on {len(features)} days of data (avg_feature={prediction['avg_feature']:.3f})",
        'model_version': MODEL_VERSION,
        'asset_class': asset_type
    }

def insert_signals(conn, signals: List[Dict[str, Any]]) -> int:
    """Batch insert signals to rl_signals table"""
    if not signals:
        return 0
    
    # Map to rl_signals schema columns
    query = """
        INSERT INTO dbo.rl_signals (
            symbol, date_time, model_version, signal_type, confidence_score, position_size,
            entry_price, take_profit_1, take_profit_2, take_profit_3, stop_loss,
            asset_class, model_reasoning
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    rows = [
        (
            s['symbol'],
            s['date_time'],
            s['model_version'],
            s['signal_type'],
            s['confidence_score'],
            round(min(0.05, s['confidence_score'] * 0.08), 6),  # Position size based on confidence
            s['entry_price'],
            s['take_profit_1'],
            s['take_profit_2'],
            s['take_profit_3'],
            s['stop_loss'],
            s['asset_class'],
            s['model_reasoning']
        )
        for s in signals
    ]
    
    try:
        cursor = conn.cursor()
        cursor.fast_executemany = True
        cursor.executemany(query, rows)
        conn.commit()
        return len(rows)
    except Exception as e:
        logger.error(f"Error inserting signals: {e}")
        conn.rollback()
        return 0

# =========================== Main Execution ===========================

def main():
    """Main execution function"""
    start_time = datetime.now()
    logger.info("=" * 70)
    logger.info("Starting RL signal generation...")
    logger.info("=" * 70)
    
    # Connect to database
    logger.info("Connecting to Azure SQL Database...")
    try:
        conn = get_conn()
        logger.info("✅ Connected to Azure SQL Database")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        return 1
    
    # Query all distinct symbols
    logger.info("Querying distinct symbols from processed_prices...")
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT symbol FROM dbo.processed_prices ORDER BY symbol")
        symbols = [row[0] for row in cursor.fetchall()]
        logger.info(f"Found {len(symbols)} symbols to process")
    except Exception as e:
        logger.error(f"Failed to query symbols: {e}")
        conn.close()
        return 1
    
    if not symbols:
        logger.error("No symbols found in database")
        conn.close()
        return 1
    
    # Process symbols in batches
    total_signals = 0
    signal_counts = {"BUY": 0, "SELL": 0, "HOLD": 0}
    failed_symbols = []
    
    num_batches = (len(symbols) + BATCH_SIZE - 1) // BATCH_SIZE
    
    for batch_idx in range(num_batches):
        batch_start = batch_idx * BATCH_SIZE
        batch_end = min(batch_start + BATCH_SIZE, len(symbols))
        batch_symbols = symbols[batch_start:batch_end]
        
        logger.info("")
        logger.info(f"Processing batch {batch_idx + 1}/{num_batches} ({len(batch_symbols)} symbols)")
        logger.info("-" * 70)
        
        batch_signals = []
        
        for symbol in batch_symbols:
            try:
                signal = generate_signal_for_symbol(conn, symbol)
                if signal:
                    batch_signals.append(signal)
                    signal_counts[signal['signal_type']] += 1
                else:
                    logger.debug(f"{symbol}: No signal generated")
            except Exception as e:
                logger.error(f"{symbol}: Error generating signal: {e}")
                failed_symbols.append(symbol)
        
        # Insert batch signals
        if batch_signals:
            inserted = insert_signals(conn, batch_signals)
            total_signals += inserted
            logger.info(f"Generated {len(batch_signals)} signals (confidence ≥ {CONFIDENCE_THRESHOLD})")
            logger.info(f"Inserted {inserted} signals to database")
        else:
            logger.info("No signals generated for this batch")
    
    # Calculate duration
    duration = datetime.now() - start_time
    duration_seconds = int(duration.total_seconds())
    
    # Print final summary
    logger.info("")
    logger.info("=" * 70)
    logger.info("📊 SUMMARY")
    logger.info("=" * 70)
    logger.info(f"Symbols processed: {len(symbols)}")
    logger.info(f"Signals generated: {total_signals}")
    logger.info("")
    logger.info(f"  BUY: {signal_counts['BUY']} signals ({signal_counts['BUY']/max(total_signals, 1)*100:.1f}%)")
    logger.info(f"  SELL: {signal_counts['SELL']} signals ({signal_counts['SELL']/max(total_signals, 1)*100:.1f}%)")
    logger.info(f"  HOLD: {signal_counts['HOLD']} signals ({signal_counts['HOLD']/max(total_signals, 1)*100:.1f}%)")
    logger.info("")
    
    if failed_symbols:
        logger.info(f"Failed symbols: {len(failed_symbols)}")
        # Save failed symbols to file
        failed_file = LOG_DIR / f"failed_signals_{datetime.now().strftime('%Y%m%d')}.txt"
        failed_file.write_text("\n".join(failed_symbols), encoding="utf-8")
        logger.info(f"Saved to: {failed_file.name}")
    
    logger.info(f"Duration: {duration_seconds}s")
    logger.info("")
    logger.info("✅ RL signal generation completed")
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

