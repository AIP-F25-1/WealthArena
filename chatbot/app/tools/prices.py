"""
WealthArena Price Tools
Tools for price data and analysis
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional
import yfinance as yf

# Try to import pandas for data handling
try:
    import pandas as pd
    _PANDAS_AVAILABLE = True
except ImportError:
    pd = None
    _PANDAS_AVAILABLE = False

class PriceTool:
    """Tool for price data and analysis"""
    
    def __init__(self):
        pass
    
    def get_current_price(self, symbol: str) -> float:
        """Get current price for a symbol using real market data"""
        try:
            price_data = self.get_price(symbol)
            if price_data["price"] is not None:
                return price_data["price"]
            else:
                raise ValueError(f"Price data unavailable for {symbol}")
        except Exception as e:
            raise ValueError(f"Unable to get current price for {symbol}: {str(e)}")
    
    def get_trends(self) -> dict:
        """Get market trends using real market data"""
        try:
            # Get real market data for popular symbols
            symbols = ["SPY", "AAPL"]
            items = []
            
            for symbol in symbols:
                try:
                    ticker_obj = yf.Ticker(symbol)
                    hist = ticker_obj.history(period="5d")
                    
                    if not hist.empty:
                        # Get closing prices for sparkline
                        spark = [round(float(price), 2) for price in hist['Close'].tolist()]
                        items.append({
                            "symbol": symbol,
                            "spark": spark
                        })
                except Exception as e:
                    # Skip symbols that fail, but continue with others
                    continue
            
            if not items:
                raise ValueError("No market trend data available")
            
            return {"mode": "live", "items": items}
            
        except Exception as e:
            raise ValueError(f"Unable to fetch market trends: {str(e)}. Please check your network connection and ensure market data services are available.")
    
    def get_price(self, ticker: str) -> Dict:
        """Get real-time price data for a ticker using yfinance"""
        try:
            # Create ticker object
            ticker_obj = yf.Ticker(ticker.upper())
            
            # Get 1-day history
            hist = ticker_obj.history(period="1d")
            
            if hist.empty:
                return {
                    "ticker": ticker.upper(),
                    "price": None,
                    "currency": "USD"
                }
            
            # Get the latest close price
            latest_price = hist['Close'].iloc[-1]
            
            # Get currency info (default to USD for most stocks)
            info = ticker_obj.info
            currency = info.get('currency', 'USD')
            
            return {
                "ticker": ticker.upper(),
                "price": float(latest_price),
                "currency": currency
            }
            
        except Exception as e:
            # Return None price on error
            return {
                "ticker": ticker.upper(),
                "price": None,
                "currency": "USD"
            }
    
    def generate_ohlcv(self, symbol: str, days: int = 30) -> List[Dict]:
        """Generate OHLCV data for a symbol using real market data from yfinance"""
        try:
            ticker_obj = yf.Ticker(symbol.upper())
            
            # Calculate period based on days
            if days <= 5:
                period = "5d"
            elif days <= 30:
                period = "1mo"
            elif days <= 90:
                period = "3mo"
            elif days <= 180:
                period = "6mo"
            elif days <= 365:
                period = "1y"
            else:
                period = "2y"
            
            # Get historical data
            hist = ticker_obj.history(period=period)
            
            if hist.empty:
                raise ValueError(f"No historical data available for symbol {symbol}")
            
            # Convert to OHLCV format and limit to requested days
            data = []
            for timestamp, row in hist.tail(days).iterrows():
                data.append({
                    "date": timestamp.strftime("%Y-%m-%d"),
                    "open": round(float(row['Open']), 2),
                    "high": round(float(row['High']), 2),
                    "low": round(float(row['Low']), 2),
                    "close": round(float(row['Close']), 2),
                    "volume": int(row['Volume']) if (_PANDAS_AVAILABLE and pd is not None and not pd.isna(row['Volume'])) else int(row['Volume']) if row['Volume'] else 0
                })
            
            return data
            
        except Exception as e:
            raise ValueError(f"Unable to fetch OHLCV data for {symbol}: {str(e)}. Please check the symbol and ensure market data is available.")
    
    def calculate_sma(self, prices: List[float], period: int) -> List[Optional[float]]:
        """Calculate Simple Moving Average"""
        sma = []
        for i in range(len(prices)):
            if i < period - 1:
                sma.append(None)
            else:
                avg = sum(prices[i-period+1:i+1]) / period
                sma.append(round(avg, 2))
        return sma
    
    def calculate_ema(self, prices: List[float], period: int) -> List[Optional[float]]:
        """Calculate Exponential Moving Average"""
        if not prices:
            return []
        
        ema = [None] * (period - 1)
        multiplier = 2 / (period + 1)
        
        # First EMA value is SMA
        first_ema = sum(prices[:period]) / period
        ema.append(round(first_ema, 2))
        
        for i in range(period, len(prices)):
            ema_value = (prices[i] * multiplier) + (ema[-1] * (1 - multiplier))
            ema.append(round(ema_value, 2))
        
        return ema
    
    def calculate_rsi(self, prices: List[float], period: int = 14) -> List[Optional[float]]:
        """Calculate Relative Strength Index"""
        if len(prices) < period + 1:
            return [None] * len(prices)
        
        rsi = [None] * period
        gains = []
        losses = []
        
        for i in range(1, len(prices)):
            change = prices[i] - prices[i-1]
            gains.append(max(change, 0))
            losses.append(max(-change, 0))
        
        for i in range(period, len(prices)):
            period_gains = gains[i-period:i]
            period_losses = losses[i-period:i]
            
            avg_gain = sum(period_gains) / period
            avg_loss = sum(period_losses) / period
            
            if avg_loss == 0:
                rsi.append(100)
            else:
                rs = avg_gain / avg_loss
                rsi_value = 100 - (100 / (1 + rs))
                rsi.append(round(rsi_value, 2))
        
        return rsi
    
    def analyze_symbol(self, symbol: str) -> Dict:
        """Analyze a symbol with technical indicators"""
        # Generate OHLCV data - generate_ohlcv will raise ValueError if symbol is invalid or has no data
        ohlcv_data = self.generate_ohlcv(symbol, 30)
        closes = [candle["close"] for candle in ohlcv_data]
        
        # Calculate indicators
        sma_20 = self.calculate_sma(closes, 20)
        ema_12 = self.calculate_ema(closes, 12)
        rsi = self.calculate_rsi(closes, 14)
        
        # Generate signals
        signals = []
        current_price = closes[-1]
        current_rsi = rsi[-1] if rsi[-1] is not None else 50
        
        # RSI signals
        if current_rsi < 30:
            signals.append({
                "type": "buy",
                "indicator": "RSI",
                "message": f"RSI at {current_rsi:.1f} indicates oversold conditions",
                "explanation": "RSI below 30 suggests the asset may be oversold and could bounce back."
            })
        elif current_rsi > 70:
            signals.append({
                "type": "sell",
                "indicator": "RSI",
                "message": f"RSI at {current_rsi:.1f} indicates overbought conditions",
                "explanation": "RSI above 70 suggests the asset may be overbought and could see a pullback."
            })
        
        # Moving average signals
        if sma_20[-1] and ema_12[-1]:
            if ema_12[-1] > sma_20[-1] and ema_12[-2] <= sma_20[-2]:
                signals.append({
                    "type": "buy",
                    "indicator": "MA Cross",
                    "message": "EMA(12) crossed above SMA(20) - bullish signal",
                    "explanation": "When the faster EMA crosses above the slower SMA, it often indicates a potential uptrend beginning."
                })
            elif ema_12[-1] < sma_20[-1] and ema_12[-2] >= sma_20[-2]:
                signals.append({
                    "type": "sell",
                    "indicator": "MA Cross",
                    "message": "EMA(12) crossed below SMA(20) - bearish signal",
                    "explanation": "When the faster EMA crosses below the slower SMA, it often indicates a potential downtrend beginning."
                })
        
        return {
            "symbol": symbol.upper(),
            "current_price": current_price,
            "indicators": {
                "sma_20": sma_20[-10:],
                "ema_12": ema_12[-10:],
                "rsi": rsi[-10:]
            },
            "signals": signals,
            "timestamp": datetime.now().isoformat()
        }

