"""
WealthArena Market API
Market data endpoints for mobile SDKs
"""

import yfinance as yf
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import pandas as pd

router = APIRouter()

class Candle(BaseModel):
    """OHLC candle data point"""
    t: int  # timestamp
    o: float  # open
    h: float  # high
    l: float  # low
    c: float  # close
    v: int  # volume

class OHLCResponse(BaseModel):
    """OHLC data response"""
    symbol: str
    candles: List[Candle]

@router.get("/market/ohlc", response_model=OHLCResponse)
async def get_ohlc_data(
    symbol: str = Query(..., description="Stock symbol (e.g., AAPL, MSFT, GOOGL)"),
    period: str = Query("1d", description="Data period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max"),
    interval: str = Query("1m", description="Data interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo")
):
    """
    Get OHLC (Open, High, Low, Close) data for a stock symbol
    
    Args:
        symbol: Stock symbol (e.g., AAPL, MSFT, GOOGL)
        period: Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
        interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
    
    Returns:
        OHLCResponse with symbol and candles data
    """
    try:
        # Create yfinance ticker object
        ticker = yf.Ticker(symbol.upper())
        
        # Get historical data
        hist = ticker.history(period=period, interval=interval)
        
        if hist.empty:
            raise HTTPException(
                status_code=404, 
                detail=f"No data found for symbol '{symbol}'. Please check the symbol and try again."
            )
        
        # Convert to candles format
        candles = []
        for timestamp, row in hist.iterrows():
            # Convert timestamp to Unix timestamp (seconds)
            unix_timestamp = int(timestamp.timestamp())
            
            candle = Candle(
                t=unix_timestamp,
                o=float(row['Open']),
                h=float(row['High']),
                l=float(row['Low']),
                c=float(row['Close']),
                v=int(row['Volume']) if not pd.isna(row['Volume']) else 0
            )
            candles.append(candle)
        
        return OHLCResponse(
            symbol=symbol.upper(),
            candles=candles
        )
        
    except Exception as e:
        if "No data found" in str(e):
            raise HTTPException(
                status_code=404,
                detail=f"No data found for symbol '{symbol}'. Please check the symbol and try again."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching market data: {str(e)}"
            )

@router.get("/market/quote")
async def get_quote(
    symbol: str = Query(..., description="Stock symbol (e.g., AAPL, MSFT, GOOGL)")
):
    """
    Get current quote for a stock symbol
    
    Args:
        symbol: Stock symbol (e.g., AAPL, MSFT, GOOGL)
    
    Returns:
        Current stock quote information
    """
    try:
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info
        
        if not info or 'regularMarketPrice' not in info:
            raise HTTPException(
                status_code=404,
                detail=f"No quote data found for symbol '{symbol}'. Please check the symbol and try again."
            )
        
        return {
            "symbol": symbol.upper(),
            "price": info.get('regularMarketPrice'),
            "change": info.get('regularMarketChange'),
            "changePercent": info.get('regularMarketChangePercent'),
            "volume": info.get('regularMarketVolume'),
            "marketCap": info.get('marketCap'),
            "currency": info.get('currency', 'USD'),
            "exchange": info.get('exchange'),
            "name": info.get('longName', info.get('shortName', symbol.upper())),
            "updated": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching quote data: {str(e)}"
        )
