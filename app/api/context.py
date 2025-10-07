"""
WealthArena Context API
Context and knowledge endpoints for mobile SDKs
"""

import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()

class TradeSetupCard(BaseModel):
    """Trade setup card schema for structured responses"""
    symbol: str
    name: str
    signal: str  # "BUY", "SELL", "HOLD"
    confidence: float  # 0.0 to 1.0
    price: float
    entry: float
    tp: List[float]  # Take profit levels
    sl: float  # Stop loss
    indicators: Dict[str, Any]  # Technical indicators
    reasoning: str
    updated_at: datetime

class CurrentContext(BaseModel):
    """Current context derived from last TradeSetupCard"""
    user_id: str
    last_setup: Optional[TradeSetupCard] = None
    context_summary: str
    active_symbols: List[str]
    last_updated: datetime

class KnowledgeTopic(BaseModel):
    """Knowledge topic schema"""
    id: str
    title: str
    description: str
    category: str
    difficulty: str  # "beginner", "intermediate", "advanced"
    tags: List[str]

# Static knowledge topics
KNOWLEDGE_TOPICS = [
    {
        "id": "technical_analysis_basics",
        "title": "Technical Analysis Basics",
        "description": "Learn the fundamentals of reading charts, support/resistance, and basic patterns",
        "category": "Technical Analysis",
        "difficulty": "beginner",
        "tags": ["charts", "patterns", "support", "resistance"]
    },
    {
        "id": "candlestick_patterns",
        "title": "Candlestick Patterns",
        "description": "Master common candlestick patterns like doji, hammer, engulfing patterns",
        "category": "Technical Analysis",
        "difficulty": "beginner",
        "tags": ["candlesticks", "patterns", "reversal", "continuation"]
    },
    {
        "id": "moving_averages",
        "title": "Moving Averages",
        "description": "Understanding SMA, EMA, and how to use them for trend analysis",
        "category": "Technical Analysis",
        "difficulty": "beginner",
        "tags": ["moving_averages", "trend", "sma", "ema"]
    },
    {
        "id": "rsi_oscillator",
        "title": "RSI Oscillator",
        "description": "Learn to use the Relative Strength Index for overbought/oversold signals",
        "category": "Technical Analysis",
        "difficulty": "intermediate",
        "tags": ["rsi", "oscillator", "momentum", "overbought", "oversold"]
    },
    {
        "id": "macd_indicator",
        "title": "MACD Indicator",
        "description": "Master the Moving Average Convergence Divergence for trend changes",
        "category": "Technical Analysis",
        "difficulty": "intermediate",
        "tags": ["macd", "trend", "divergence", "signal_line"]
    },
    {
        "id": "bollinger_bands",
        "title": "Bollinger Bands",
        "description": "Use Bollinger Bands for volatility analysis and mean reversion",
        "category": "Technical Analysis",
        "difficulty": "intermediate",
        "tags": ["bollinger_bands", "volatility", "mean_reversion", "squeeze"]
    },
    {
        "id": "risk_management",
        "title": "Risk Management",
        "description": "Essential principles of position sizing, stop losses, and portfolio protection",
        "category": "Risk Management",
        "difficulty": "beginner",
        "tags": ["risk", "position_sizing", "stop_loss", "portfolio"]
    },
    {
        "id": "position_sizing",
        "title": "Position Sizing",
        "description": "Learn how to calculate appropriate position sizes based on risk tolerance",
        "category": "Risk Management",
        "difficulty": "intermediate",
        "tags": ["position_sizing", "risk_per_trade", "kelly_criterion"]
    },
    {
        "id": "market_psychology",
        "title": "Market Psychology",
        "description": "Understand market sentiment, fear, greed, and behavioral finance",
        "category": "Psychology",
        "difficulty": "intermediate",
        "tags": ["psychology", "sentiment", "fear", "greed", "behavioral_finance"]
    },
    {
        "id": "trading_plan",
        "title": "Trading Plan Development",
        "description": "Create a systematic approach to trading with clear rules and strategies",
        "category": "Strategy",
        "difficulty": "intermediate",
        "tags": ["trading_plan", "strategy", "rules", "systematic"]
    },
    {
        "id": "backtesting",
        "title": "Backtesting Strategies",
        "description": "Learn to test trading strategies on historical data before live trading",
        "category": "Strategy",
        "difficulty": "advanced",
        "tags": ["backtesting", "historical_data", "strategy_testing", "performance"]
    },
    {
        "id": "options_basics",
        "title": "Options Trading Basics",
        "description": "Introduction to options, calls, puts, and basic strategies",
        "category": "Derivatives",
        "difficulty": "intermediate",
        "tags": ["options", "calls", "puts", "derivatives", "strategies"]
    },
    {
        "id": "fundamental_analysis",
        "title": "Fundamental Analysis",
        "description": "Learn to analyze company financials, earnings, and valuation metrics",
        "category": "Fundamental Analysis",
        "difficulty": "intermediate",
        "tags": ["fundamentals", "earnings", "valuation", "financial_statements"]
    },
    {
        "id": "market_cycles",
        "title": "Market Cycles",
        "description": "Understand bull/bear markets, economic cycles, and seasonal patterns",
        "category": "Market Analysis",
        "difficulty": "intermediate",
        "tags": ["cycles", "bull_market", "bear_market", "seasonal", "economic"]
    },
    {
        "id": "news_trading",
        "title": "News Trading",
        "description": "How to trade around earnings, economic data, and market-moving events",
        "category": "Strategy",
        "difficulty": "advanced",
        "tags": ["news", "earnings", "economic_data", "events", "volatility"]
    }
]

@router.get("/context/current", response_model=CurrentContext)
async def get_current_context(user_id: str = Query(...)):
    """Get current context derived from last TradeSetupCard in history"""
    try:
        # Load chat history for the user
        chat_history = await _load_chat_history(user_id)
        
        # Find the last TradeSetupCard
        last_setup = None
        active_symbols = []
        
        if chat_history:
            # Look for the most recent TradeSetupCard in the history
            for entry in reversed(chat_history):
                if entry.get("card") and entry["card"].get("symbol"):
                    last_setup = TradeSetupCard(**entry["card"])
                    active_symbols = [last_setup.symbol]
                    break
        
        # Create context summary
        if last_setup:
            context_summary = f"Last analyzed {last_setup.symbol} with {last_setup.signal} signal (confidence: {last_setup.confidence:.1%}). {last_setup.reasoning}"
        else:
            context_summary = "No recent trade setups found. Start by asking for a setup with '/setup for SYMBOL'"
        
        return CurrentContext(
            user_id=user_id,
            last_setup=last_setup,
            context_summary=context_summary,
            active_symbols=active_symbols,
            last_updated=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving context: {str(e)}"
        )

@router.get("/knowledge/topics", response_model=List[KnowledgeTopic])
async def get_knowledge_topics():
    """Get static list of knowledge topics"""
    return [KnowledgeTopic(**topic) for topic in KNOWLEDGE_TOPICS]

@router.get("/knowledge/topics/{topic_id}", response_model=KnowledgeTopic)
async def get_knowledge_topic(topic_id: str):
    """Get a specific knowledge topic by ID"""
    topic = next((t for t in KNOWLEDGE_TOPICS if t["id"] == topic_id), None)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    return KnowledgeTopic(**topic)

@router.get("/knowledge/topics/category/{category}")
async def get_topics_by_category(category: str):
    """Get topics filtered by category"""
    filtered_topics = [t for t in KNOWLEDGE_TOPICS if t["category"].lower() == category.lower()]
    return [KnowledgeTopic(**topic) for topic in filtered_topics]

@router.get("/knowledge/topics/difficulty/{difficulty}")
async def get_topics_by_difficulty(difficulty: str):
    """Get topics filtered by difficulty level"""
    filtered_topics = [t for t in KNOWLEDGE_TOPICS if t["difficulty"].lower() == difficulty.lower()]
    return [KnowledgeTopic(**topic) for topic in filtered_topics]

async def _load_chat_history(user_id: str) -> List[Dict[str, Any]]:
    """Load chat history for a user"""
    try:
        # Create data directory if it doesn't exist
        data_dir = Path("data/chat_history")
        data_dir.mkdir(parents=True, exist_ok=True)
        
        # Load user's chat history
        file_path = data_dir / f"{user_id}.json"
        
        if not file_path.exists():
            return []
        
        with open(file_path, 'r') as f:
            return json.load(f)
            
    except Exception as e:
        print(f"Warning: Failed to load chat history for {user_id}: {e}")
        return []

async def _save_chat_history(user_id: str, chat_history: List[Dict[str, Any]]) -> None:
    """Save chat history for a user"""
    try:
        data_dir = Path("data/chat_history")
        data_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = data_dir / f"{user_id}.json"
        
        with open(file_path, 'w') as f:
            json.dump(chat_history, f, indent=2, default=str)
            
    except Exception as e:
        print(f"Warning: Failed to save chat history for {user_id}: {e}")