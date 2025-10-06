"""
WealthArena Game API
Game endpoints for trading simulation episodes
"""

import json
import uuid
import math
import time
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import yfinance as yf
import pandas as pd
from ..metrics.prom import record_game_tick, record_game_trade

router = APIRouter()

# In-memory state storage
game_states: Dict[str, Dict[str, Any]] = {}
active_games: Dict[str, Dict[str, Any]] = {}
historical_data_cache: Dict[str, pd.DataFrame] = {}

# Game episodes data
EPISODES = [
    {
        "id": "covid_crash_2020",
        "name": "COVID-19 Market Crash 2020",
        "start": "2020-02-19",
        "end": "2020-04-07",
        "description": "Experience the dramatic market crash and recovery during the COVID-19 pandemic"
    },
    {
        "id": "dotcom_bubble_2000",
        "name": "Dot-com Bubble Burst 2000",
        "start": "2000-03-10",
        "end": "2000-10-09",
        "description": "Navigate the collapse of the dot-com bubble and tech stock crash"
    },
    {
        "id": "financial_crisis_2008",
        "name": "Financial Crisis 2008",
        "start": "2008-09-15",
        "end": "2009-03-09",
        "description": "Trade through the 2008 financial crisis and market turmoil"
    },
    {
        "id": "tech_boom_2021",
        "name": "Tech Boom 2021",
        "start": "2021-01-01",
        "end": "2021-12-31",
        "description": "Experience the tech stock boom and subsequent correction"
    }
]

# Difficulty levels
DIFFICULTY_LEVELS = {
    "easy": {
        "starting_cash": 100000,
        "transaction_fee": 0.001,  # 0.1%
        "margin_multiplier": 1.0
    },
    "medium": {
        "starting_cash": 50000,
        "transaction_fee": 0.002,  # 0.2%
        "margin_multiplier": 1.5
    },
    "hard": {
        "starting_cash": 25000,
        "transaction_fee": 0.005,  # 0.5%
        "margin_multiplier": 2.0
    }
}

class Episode(BaseModel):
    """Game episode schema"""
    id: str
    name: str
    start: str
    end: str
    description: str

class GameStartRequest(BaseModel):
    """Request schema for starting a new game"""
    user_id: str
    episode_id: str
    difficulty: str

class Holding(BaseModel):
    """Portfolio holding schema"""
    symbol: str
    shares: int
    avg_price: float
    current_price: float
    value: float

class Portfolio(BaseModel):
    """Portfolio schema"""
    cash: float
    holdings: List[Holding]
    equity: float
    total_value: float

class GameStartResponse(BaseModel):
    """Response schema for game start"""
    game_id: str
    episode: Episode
    difficulty: str
    portfolio: Portfolio
    created_at: str

class TickRequest(BaseModel):
    """Request schema for advancing game time"""
    game_id: str
    speed: int = 1

class PriceUpdate(BaseModel):
    """Price update schema"""
    symbol: str
    price: float
    change: float
    change_percent: float

class TickResponse(BaseModel):
    """Response schema for tick"""
    game_id: str
    current_date: str
    prices: List[PriceUpdate]
    portfolio: Portfolio
    pnl: float
    total_pnl: float

class TradeRequest(BaseModel):
    """Request schema for trading"""
    game_id: str
    symbol: str
    side: str  # "buy" or "sell"
    qty: int
    type: str  # "market" or "limit"
    limit_price: Optional[float] = None

class TradeResponse(BaseModel):
    """Response schema for trade"""
    game_id: str
    symbol: str
    side: str
    qty: int
    price: float
    total_cost: float
    portfolio: Portfolio
    pnl: float

class GameSummary(BaseModel):
    """Game summary metrics"""
    return_pct: float
    sharpe_est: float
    max_drawdown: float
    trades_count: int
    score: float

@router.get("/game/episodes", response_model=List[Episode])
async def get_episodes():
    """Get available game episodes"""
    return [Episode(**episode) for episode in EPISODES]

@router.post("/game/start", response_model=GameStartResponse)
async def start_game(request: GameStartRequest):
    """Start a new game session"""
    
    # Validate episode exists
    episode = next((ep for ep in EPISODES if ep["id"] == request.episode_id), None)
    if not episode:
        raise HTTPException(status_code=404, detail=f"Episode '{request.episode_id}' not found")
    
    # Validate difficulty
    if request.difficulty not in DIFFICULTY_LEVELS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid difficulty '{request.difficulty}'. Must be one of: {list(DIFFICULTY_LEVELS.keys())}"
        )
    
    # Generate unique game ID
    game_id = str(uuid.uuid4())
    
    # Get difficulty settings
    difficulty_settings = DIFFICULTY_LEVELS[request.difficulty]
    
    # Create initial portfolio
    initial_portfolio = {
        "cash": difficulty_settings["starting_cash"],
        "holdings": [],
        "equity": difficulty_settings["starting_cash"],
        "total_value": difficulty_settings["starting_cash"]
    }
    
    # Create game state
    game_state = {
        "game_id": game_id,
        "user_id": request.user_id,
        "episode_id": request.episode_id,
        "difficulty": request.difficulty,
        "portfolio": initial_portfolio,
        "transactions": [],
        "created_at": datetime.now().isoformat(),
        "current_date": episode["start"],
        "status": "active"
    }
    
    # Store in memory
    game_states[game_id] = game_state
    active_games[game_id] = game_state
    
    # Persist to JSON file
    await _save_game_state(game_id, game_state)
    
    # Create response
    portfolio = Portfolio(
        cash=initial_portfolio["cash"],
        holdings=[],
        equity=initial_portfolio["equity"],
        total_value=initial_portfolio["total_value"]
    )
    
    return GameStartResponse(
        game_id=game_id,
        episode=Episode(**episode),
        difficulty=request.difficulty,
        portfolio=portfolio,
        created_at=game_state["created_at"]
    )

@router.get("/game/{game_id}")
async def get_game_state(game_id: str):
    """Get current game state"""
    if game_id not in game_states:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return game_states[game_id]

@router.get("/game/portfolio")
async def get_portfolio(game_id: str = Query(...)):
    """Get current portfolio for a game with P&L"""
    if game_id not in game_states:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game_state = game_states[game_id]
    portfolio = game_state["portfolio"]
    
    # Calculate P&L
    total_pnl = 0
    for holding in portfolio["holdings"]:
        pnl = (holding["current_price"] - holding["avg_price"]) * holding["shares"]
        total_pnl += pnl
    
    return {
        "cash": portfolio["cash"],
        "holdings": [Holding(**holding) for holding in portfolio["holdings"]],
        "equity": portfolio["equity"],
        "total_value": portfolio["total_value"],
        "pnl": total_pnl
    }

@router.post("/game/tick", response_model=TickResponse)
async def tick_game(request: TickRequest):
    """Advance game time by N market days"""
    start_time = time.time()
    if request.game_id not in game_states:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game_state = game_states[request.game_id]
    
    # Get historical data if not cached
    if request.game_id not in historical_data_cache:
        await _load_historical_data(request.game_id, game_state)
    
    # Advance date
    current_date = datetime.strptime(game_state["current_date"], "%Y-%m-%d")
    new_date = current_date + timedelta(days=request.speed)
    game_state["current_date"] = new_date.strftime("%Y-%m-%d")
    
    # Get new prices
    historical_data = historical_data_cache[request.game_id]
    prices = []
    price_updates = []
    
    # Get prices for all holdings
    for holding in game_state["portfolio"]["holdings"]:
        symbol = holding["symbol"]
        new_price = _get_price_for_date(historical_data, symbol, new_date)
        
        if new_price is not None:
            old_price = holding["current_price"]
            change = new_price - old_price
            change_percent = (change / old_price) * 100 if old_price > 0 else 0
            
            # Update holding
            holding["current_price"] = new_price
            holding["value"] = new_price * holding["shares"]
            
            price_updates.append(PriceUpdate(
                symbol=symbol,
                price=new_price,
                change=change,
                change_percent=change_percent
            ))
    
    # Recalculate portfolio
    total_holdings_value = sum(holding["value"] for holding in game_state["portfolio"]["holdings"])
    game_state["portfolio"]["equity"] = game_state["portfolio"]["cash"] + total_holdings_value
    game_state["portfolio"]["total_value"] = game_state["portfolio"]["equity"]
    
    # Calculate P&L
    total_pnl = sum((holding["current_price"] - holding["avg_price"]) * holding["shares"] 
                   for holding in game_state["portfolio"]["holdings"])
    
    # Save state
    await _save_game_state(request.game_id, game_state)
    
    # Record game tick metrics
    latency = time.time() - start_time
    record_game_tick(latency)
    
    return TickResponse(
        game_id=request.game_id,
        current_date=game_state["current_date"],
        prices=price_updates,
        portfolio=Portfolio(
            cash=game_state["portfolio"]["cash"],
            holdings=[Holding(**holding) for holding in game_state["portfolio"]["holdings"]],
            equity=game_state["portfolio"]["equity"],
            total_value=game_state["portfolio"]["total_value"]
        ),
        pnl=total_pnl,
        total_pnl=total_pnl
    )

@router.post("/game/trade", response_model=TradeResponse)
async def execute_trade(request: TradeRequest):
    """Execute a trade (buy/sell)"""
    if request.game_id not in game_states:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if request.side not in ["buy", "sell"]:
        raise HTTPException(status_code=400, detail="Side must be 'buy' or 'sell'")
    
    if request.type not in ["market", "limit"]:
        raise HTTPException(status_code=400, detail="Type must be 'market' or 'limit'")
    
    game_state = game_states[request.game_id]
    
    # Get current price
    if request.game_id not in historical_data_cache:
        await _load_historical_data(request.game_id, game_state)
    
    current_date = datetime.strptime(game_state["current_date"], "%Y-%m-%d")
    price = _get_price_for_date(historical_data_cache[request.game_id], request.symbol, current_date)
    
    if price is None:
        raise HTTPException(status_code=400, detail=f"Price not available for {request.symbol} on {game_state['current_date']}")
    
    # Apply limit price if specified
    if request.type == "limit" and request.limit_price:
        if request.side == "buy" and price > request.limit_price:
            raise HTTPException(status_code=400, detail="Market price above limit price")
        elif request.side == "sell" and price < request.limit_price:
            raise HTTPException(status_code=400, detail="Market price below limit price")
        price = request.limit_price
    
    # Calculate costs
    difficulty_settings = DIFFICULTY_LEVELS[game_state["difficulty"]]
    transaction_fee = difficulty_settings["transaction_fee"]
    total_cost = price * request.qty
    fees = total_cost * transaction_fee
    total_with_fees = total_cost + fees
    
    # Check if trade is possible
    if request.side == "buy":
        if game_state["portfolio"]["cash"] < total_with_fees:
            raise HTTPException(status_code=400, detail="Insufficient cash")
    else:  # sell
        # Check if we have enough shares
        current_holding = next((h for h in game_state["portfolio"]["holdings"] if h["symbol"] == request.symbol), None)
        if not current_holding or current_holding["shares"] < request.qty:
            raise HTTPException(status_code=400, detail="Insufficient shares")
    
    # Execute trade
    if request.side == "buy":
        game_state["portfolio"]["cash"] -= total_with_fees
        
        # Add or update holding
        existing_holding = next((h for h in game_state["portfolio"]["holdings"] if h["symbol"] == request.symbol), None)
        if existing_holding:
            # Update existing holding
            total_shares = existing_holding["shares"] + request.qty
            total_cost_basis = (existing_holding["avg_price"] * existing_holding["shares"]) + total_cost
            existing_holding["shares"] = total_shares
            existing_holding["avg_price"] = total_cost_basis / total_shares
            existing_holding["current_price"] = price
            existing_holding["value"] = price * total_shares
        else:
            # Create new holding
            new_holding = {
                "symbol": request.symbol,
                "shares": request.qty,
                "avg_price": price,
                "current_price": price,
                "value": total_cost
            }
            game_state["portfolio"]["holdings"].append(new_holding)
    else:  # sell
        game_state["portfolio"]["cash"] += total_cost - fees
        
        # Update or remove holding
        existing_holding = next((h for h in game_state["portfolio"]["holdings"] if h["symbol"] == request.symbol), None)
        if existing_holding:
            existing_holding["shares"] -= request.qty
            if existing_holding["shares"] <= 0:
                game_state["portfolio"]["holdings"].remove(existing_holding)
            else:
                existing_holding["current_price"] = price
                existing_holding["value"] = price * existing_holding["shares"]
    
    # Recalculate portfolio
    total_holdings_value = sum(holding["value"] for holding in game_state["portfolio"]["holdings"])
    game_state["portfolio"]["equity"] = game_state["portfolio"]["cash"] + total_holdings_value
    game_state["portfolio"]["total_value"] = game_state["portfolio"]["equity"]
    
    # Calculate P&L
    total_pnl = sum((holding["current_price"] - holding["avg_price"]) * holding["shares"] 
                   for holding in game_state["portfolio"]["holdings"])
    
    # Record transaction
    transaction = {
        "timestamp": datetime.now().isoformat(),
        "symbol": request.symbol,
        "side": request.side,
        "qty": request.qty,
        "price": price,
        "total_cost": total_cost,
        "fees": fees
    }
    game_state["transactions"].append(transaction)
    
    # Save state
    await _save_game_state(request.game_id, game_state)
    
    # Record trade metrics
    record_game_trade(request.side)
    
    return TradeResponse(
        game_id=request.game_id,
        symbol=request.symbol,
        side=request.side,
        qty=request.qty,
        price=price,
        total_cost=total_cost,
        portfolio=Portfolio(
            cash=game_state["portfolio"]["cash"],
            holdings=[Holding(**holding) for holding in game_state["portfolio"]["holdings"]],
            equity=game_state["portfolio"]["equity"],
            total_value=game_state["portfolio"]["total_value"]
        ),
        pnl=total_pnl
    )

@router.get("/game/summary", response_model=GameSummary)
async def get_game_summary(game_id: str = Query(...)):
    """Get game performance summary with metrics"""
    if game_id not in game_states:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game_state = game_states[game_id]
    
    # Get episode info
    episode_id = game_state["episode_id"]
    episode = next((ep for ep in EPISODES if ep["id"] == episode_id), None)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    # Calculate return percentage
    initial_cash = DIFFICULTY_LEVELS[game_state["difficulty"]]["starting_cash"]
    current_value = game_state["portfolio"]["total_value"]
    return_pct = ((current_value - initial_cash) / initial_cash) * 100
    
    # Get trades count
    trades_count = len(game_state["transactions"])
    
    # Calculate Sharpe ratio and max drawdown from equity curve
    sharpe_est, max_drawdown = _calculate_performance_metrics(game_state, episode)
    
    # Calculate composite score
    score = _calculate_score(return_pct, sharpe_est, max_drawdown, trades_count)
    
    return GameSummary(
        return_pct=round(return_pct, 2),
        sharpe_est=round(sharpe_est, 3),
        max_drawdown=round(max_drawdown, 2),
        trades_count=trades_count,
        score=round(score, 1)
    )

def _calculate_performance_metrics(game_state: Dict[str, Any], episode: Dict[str, Any]) -> tuple[float, float]:
    """Calculate Sharpe ratio and max drawdown from equity curve"""
    try:
        # Get historical data for equity curve simulation
        if game_state["game_id"] not in historical_data_cache:
            return 0.0, 0.0
        
        historical_data = historical_data_cache[game_state["game_id"]]
        
        # Create equity curve by simulating portfolio value over time
        start_date = datetime.strptime(episode["start"], "%Y-%m-%d")
        end_date = datetime.strptime(episode["end"], "%Y-%m-%d")
        
        # Get a reference symbol for daily returns (use SPY if available)
        reference_symbol = "SPY"
        if reference_symbol not in historical_data:
            # Use first available symbol
            if not historical_data:
                return 0.0, 0.0
            reference_symbol = list(historical_data.keys())[0]
        
        ref_data = historical_data[reference_symbol]
        
        # Calculate daily returns from reference data
        daily_returns = []
        equity_values = []
        initial_cash = DIFFICULTY_LEVELS[game_state["difficulty"]]["starting_cash"]
        
        # Simulate portfolio value changes based on market movements
        current_date = start_date
        prev_price = None
        
        for date_idx in ref_data.index:
            if date_idx.date() < start_date.date() or date_idx.date() > end_date.date():
                continue
                
            current_price = float(ref_data.loc[date_idx, "Close"])
            
            if prev_price is not None:
                daily_return = (current_price - prev_price) / prev_price
                daily_returns.append(daily_return)
                
                # Simulate portfolio value change (simplified)
                portfolio_return = daily_return * 0.8  # Assume 80% correlation with market
                new_value = equity_values[-1] * (1 + portfolio_return) if equity_values else initial_cash
                equity_values.append(new_value)
            else:
                equity_values.append(initial_cash)
            
            prev_price = current_price
        
        if len(daily_returns) < 2:
            return 0.0, 0.0
        
        # Calculate Sharpe ratio: (mean return / std return) * sqrt(252)
        mean_return = sum(daily_returns) / len(daily_returns)
        std_return = math.sqrt(sum((r - mean_return) ** 2 for r in daily_returns) / len(daily_returns))
        
        if std_return == 0:
            sharpe_ratio = 0.0
        else:
            sharpe_ratio = (mean_return / std_return) * math.sqrt(252)
        
        # Calculate max drawdown from equity curve
        max_drawdown = 0.0
        peak = equity_values[0]
        
        for value in equity_values:
            if value > peak:
                peak = value
            drawdown = (peak - value) / peak
            max_drawdown = max(max_drawdown, drawdown)
        
        max_drawdown *= 100  # Convert to percentage
        
        return sharpe_ratio, max_drawdown
        
    except Exception as e:
        print(f"Error calculating performance metrics: {e}")
        return 0.0, 0.0

def _calculate_score(return_pct: float, sharpe_est: float, max_drawdown: float, trades_count: int) -> float:
    """Calculate composite performance score"""
    # Base score from return percentage (0-100 scale)
    return_score = min(max(return_pct, -100), 100)  # Clamp between -100 and 100
    return_score = (return_score + 100) / 2  # Normalize to 0-100
    
    # Sharpe ratio bonus/penalty (0-20 points)
    sharpe_score = min(max(sharpe_est * 10, 0), 20)  # Scale Sharpe to 0-20
    
    # Max drawdown penalty (0-20 points)
    drawdown_penalty = min(max_drawdown / 5, 20)  # Penalty up to 20 points
    
    # Trading activity bonus (0-10 points)
    activity_bonus = min(trades_count / 10, 10)  # Bonus up to 10 points
    
    # Calculate final score
    score = return_score + sharpe_score - drawdown_penalty + activity_bonus
    score = max(min(score, 100), 0)  # Clamp between 0 and 100
    
    return score

async def _save_game_state(game_id: str, game_state: Dict[str, Any]) -> None:
    """Save game state to JSON file"""
    try:
        data_dir = Path("data/game_state")
        data_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = data_dir / f"{game_id}.json"
        
        with open(file_path, 'w') as f:
            json.dump(game_state, f, indent=2, default=str)
            
    except Exception as e:
        # Log error but don't fail the request
        print(f"Warning: Failed to save game state for {game_id}: {e}")

async def _load_game_state(game_id: str) -> Optional[Dict[str, Any]]:
    """Load game state from JSON file"""
    try:
        data_dir = Path("data/game_state")
        file_path = data_dir / f"{game_id}.json"
        
        if not file_path.exists():
            return None
            
        with open(file_path, 'r') as f:
            return json.load(f)
            
    except Exception as e:
        print(f"Warning: Failed to load game state for {game_id}: {e}")
        return None

async def _load_historical_data(game_id: str, game_state: Dict[str, Any]) -> None:
    """Load historical data for the game episode"""
    try:
        episode_id = game_state["episode_id"]
        episode = next((ep for ep in EPISODES if ep["id"] == episode_id), None)
        
        if not episode:
            raise ValueError(f"Episode {episode_id} not found")
        
        start_date = episode["start"]
        end_date = episode["end"]
        
        # Common symbols to fetch
        symbols = ["SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "NFLX"]
        
        # Fetch data for all symbols
        all_data = {}
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(start=start_date, end=end_date)
                if not hist.empty:
                    all_data[symbol] = hist
            except Exception as e:
                print(f"Warning: Failed to fetch data for {symbol}: {e}")
        
        # Store in cache
        historical_data_cache[game_id] = all_data
        
    except Exception as e:
        print(f"Warning: Failed to load historical data for {game_id}: {e}")
        historical_data_cache[game_id] = {}

def _get_price_for_date(historical_data: Dict[str, pd.DataFrame], symbol: str, target_date: datetime) -> Optional[float]:
    """Get price for a specific symbol and date"""
    try:
        if symbol not in historical_data:
            return None
        
        data = historical_data[symbol]
        target_date_str = target_date.strftime("%Y-%m-%d")
        
        # Find the closest date (forward fill)
        available_dates = data.index.strftime("%Y-%m-%d").tolist()
        
        # Find exact match or next available date
        if target_date_str in available_dates:
            price_date = target_date_str
        else:
            # Find next available date
            future_dates = [d for d in available_dates if d >= target_date_str]
            if not future_dates:
                return None
            price_date = min(future_dates)
        
        # Get the price (use Close price)
        price = data.loc[price_date, "Close"]
        return float(price)
        
    except Exception as e:
        print(f"Warning: Failed to get price for {symbol} on {target_date}: {e}")
        return None
