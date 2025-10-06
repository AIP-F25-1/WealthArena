"""
WealthArena Context API
Current trading context and user state management
"""

import sqlite3
import os
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()

# Database file path (same as history)
DB_PATH = "data/chat_history.db"

class RecentPrediction(BaseModel):
    symbol: str
    signal: str
    confidence: float
    price: float
    created_at: str

class CurrentContext(BaseModel):
    active_symbol: Optional[str]
    current_signal: Optional[str]
    recent_predictions: List[RecentPrediction]

def init_database():
    """Initialize SQLite database with required tables"""
    # Ensure data directory exists
    os.makedirs("data", exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create chat_history table if it doesn't exist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            message TEXT NOT NULL,
            reply TEXT NOT NULL,
            meta TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()

# Initialize database on module load
init_database()

def extract_trade_setup_from_meta(meta_str: str) -> Optional[Dict[str, Any]]:
    """Extract trade setup information from metadata"""
    if not meta_str:
        return None
    
    try:
        meta = json.loads(meta_str)
        if isinstance(meta, dict) and 'card' in meta:
            return meta['card']
    except (json.JSONDecodeError, KeyError):
        pass
    
    return None

def get_last_trade_setup_card(user_id: str) -> Optional[Dict[str, Any]]:
    """Get the last TradeSetupCard from user's chat history"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get the most recent message with metadata
        cursor.execute("""
            SELECT meta, created_at
            FROM chat_history
            WHERE user_id = ? AND meta IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        """, (user_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            meta_str, created_at = result
            trade_setup = extract_trade_setup_from_meta(meta_str)
            if trade_setup:
                return trade_setup
        
        return None
        
    except Exception:
        return None

def get_recent_predictions(user_id: str, days: int = 7) -> List[RecentPrediction]:
    """Get recent predictions from user's chat history"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get recent messages with metadata containing trade setups
        since_date = (datetime.now() - timedelta(days=days)).isoformat()
        cursor.execute("""
            SELECT meta, created_at
            FROM chat_history
            WHERE user_id = ? AND meta IS NOT NULL AND created_at >= ?
            ORDER BY created_at DESC
            LIMIT 20
        """, (user_id, since_date))
        
        rows = cursor.fetchall()
        conn.close()
        
        predictions = []
        for meta_str, created_at in rows:
            trade_setup = extract_trade_setup_from_meta(meta_str)
            if trade_setup and all(key in trade_setup for key in ['symbol', 'signal', 'confidence', 'price']):
                predictions.append(RecentPrediction(
                    symbol=trade_setup['symbol'],
                    signal=trade_setup['signal'],
                    confidence=trade_setup['confidence'],
                    price=trade_setup['price'],
                    created_at=created_at
                ))
        
        return predictions
        
    except Exception:
        return []

def get_mock_context() -> CurrentContext:
    """Generate mock context data for demonstration"""
    return CurrentContext(
        active_symbol="AAPL",
        current_signal="BUY",
        recent_predictions=[
            RecentPrediction(
                symbol="AAPL",
                signal="BUY",
                confidence=0.85,
                price=150.25,
                created_at=(datetime.now() - timedelta(hours=2)).isoformat()
            ),
            RecentPrediction(
                symbol="MSFT",
                signal="HOLD",
                confidence=0.65,
                price=420.50,
                created_at=(datetime.now() - timedelta(days=1)).isoformat()
            ),
            RecentPrediction(
                symbol="GOOGL",
                signal="SELL",
                confidence=0.75,
                price=2800.00,
                created_at=(datetime.now() - timedelta(days=2)).isoformat()
            )
        ]
    )

@router.get("/v1/context/current", response_model=CurrentContext)
async def get_current_context(
    user_id: str = Query(..., description="User ID to get context for")
):
    """Get current trading context for a user"""
    try:
        # Try to get real data from chat history
        last_trade_setup = get_last_trade_setup_card(user_id)
        recent_predictions = get_recent_predictions(user_id)
        
        if last_trade_setup and recent_predictions:
            # Use real data from chat history
            return CurrentContext(
                active_symbol=last_trade_setup.get('symbol'),
                current_signal=last_trade_setup.get('signal'),
                recent_predictions=recent_predictions[:10]  # Limit to 10 most recent
            )
        else:
            # Fall back to mock data if no real data available
            return get_mock_context()
            
    except Exception as e:
        # Return mock data on any error
        return get_mock_context()

@router.get("/v1/context/symbols")
async def get_active_symbols(
    user_id: str = Query(..., description="User ID to get symbols for")
):
    """Get all symbols that user has interacted with"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get all unique symbols from user's trade setups
        cursor.execute("""
            SELECT DISTINCT json_extract(meta, '$.card.symbol') as symbol
            FROM chat_history
            WHERE user_id = ? AND meta IS NOT NULL
            AND json_extract(meta, '$.card.symbol') IS NOT NULL
            ORDER BY symbol
        """, (user_id,))
        
        symbols = [row[0] for row in cursor.fetchall() if row[0]]
        conn.close()
        
        return {
            "user_id": user_id,
            "symbols": symbols,
            "total_symbols": len(symbols)
        }
        
    except Exception as e:
        return {
            "user_id": user_id,
            "symbols": ["AAPL", "MSFT", "GOOGL"],  # Mock data
            "total_symbols": 3
        }

@router.get("/v1/context/signals")
async def get_signal_history(
    user_id: str = Query(..., description="User ID to get signals for"),
    symbol: Optional[str] = Query(None, description="Filter by specific symbol"),
    days: int = Query(30, description="Number of days to look back", ge=1, le=365)
):
    """Get signal history for a user"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        since_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        if symbol:
            # Filter by specific symbol
            cursor.execute("""
                SELECT 
                    json_extract(meta, '$.card.symbol') as symbol,
                    json_extract(meta, '$.card.signal') as signal,
                    json_extract(meta, '$.card.confidence') as confidence,
                    json_extract(meta, '$.card.price') as price,
                    created_at
                FROM chat_history
                WHERE user_id = ? 
                AND meta IS NOT NULL
                AND json_extract(meta, '$.card.symbol') = ?
                AND created_at >= ?
                ORDER BY created_at DESC
            """, (user_id, symbol, since_date))
        else:
            # Get all signals
            cursor.execute("""
                SELECT 
                    json_extract(meta, '$.card.symbol') as symbol,
                    json_extract(meta, '$.card.signal') as signal,
                    json_extract(meta, '$.card.confidence') as confidence,
                    json_extract(meta, '$.card.price') as price,
                    created_at
                FROM chat_history
                WHERE user_id = ? 
                AND meta IS NOT NULL
                AND json_extract(meta, '$.card.symbol') IS NOT NULL
                AND created_at >= ?
                ORDER BY created_at DESC
            """, (user_id, since_date))
        
        rows = cursor.fetchall()
        conn.close()
        
        signals = []
        for row in rows:
            symbol_val, signal, confidence, price, created_at = row
            if all([symbol_val, signal, confidence, price]):
                signals.append({
                    "symbol": symbol_val,
                    "signal": signal,
                    "confidence": confidence,
                    "price": price,
                    "created_at": created_at
                })
        
        return {
            "user_id": user_id,
            "symbol_filter": symbol,
            "days": days,
            "signals": signals,
            "total_signals": len(signals)
        }
        
    except Exception as e:
        return {
            "user_id": user_id,
            "symbol_filter": symbol,
            "days": days,
            "signals": [],
            "total_signals": 0,
            "error": str(e)
        }

@router.get("/v1/context/stats")
async def get_context_stats(
    user_id: str = Query(..., description="User ID to get stats for")
):
    """Get context statistics for a user"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get total trade setups
        cursor.execute("""
            SELECT COUNT(*) 
            FROM chat_history
            WHERE user_id = ? AND meta IS NOT NULL
            AND json_extract(meta, '$.card.symbol') IS NOT NULL
        """, (user_id,))
        total_setups = cursor.fetchone()[0]
        
        # Get unique symbols
        cursor.execute("""
            SELECT COUNT(DISTINCT json_extract(meta, '$.card.symbol'))
            FROM chat_history
            WHERE user_id = ? AND meta IS NOT NULL
            AND json_extract(meta, '$.card.symbol') IS NOT NULL
        """, (user_id,))
        unique_symbols = cursor.fetchone()[0]
        
        # Get signal distribution
        cursor.execute("""
            SELECT 
                json_extract(meta, '$.card.signal') as signal,
                COUNT(*) as count
            FROM chat_history
            WHERE user_id = ? AND meta IS NOT NULL
            AND json_extract(meta, '$.card.signal') IS NOT NULL
            GROUP BY json_extract(meta, '$.card.signal')
        """, (user_id,))
        
        signal_distribution = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Get recent activity (last 7 days)
        cursor.execute("""
            SELECT COUNT(*)
            FROM chat_history
            WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
        """, (user_id,))
        recent_activity = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "user_id": user_id,
            "total_trade_setups": total_setups,
            "unique_symbols": unique_symbols,
            "signal_distribution": signal_distribution,
            "recent_activity_7_days": recent_activity,
            "last_updated": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {
            "user_id": user_id,
            "error": str(e),
            "last_updated": datetime.now().isoformat()
        }
