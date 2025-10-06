"""
WealthArena Price Tools
Tools for price data and analysis
"""

import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import yfinance as yf

class PriceTool:
    """Tool for price data and analysis"""
    
    def __init__(self):
        self.base_prices = {
            "AAPL": 150.0,
            "TSLA": 200.0,
            "BTC-USD": 45000.0,
            "ETH-USD": 3000.0
        }
    
    def get_current_price(self, symbol: str) -> float:
        """Get current price for a symbol"""
        return self.base_prices.get(symbol.upper(), 100.0)
    
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
        """Generate mock OHLCV data for a symbol"""
        base_price = self.base_prices.get(symbol.upper(), 100.0)
        data = []
        
        for i in range(days):
            date = datetime.now() - timedelta(days=days-i)
            
            # Generate realistic price movement
            volatility = 0.02 if "USD" in symbol else 0.01  # Crypto more volatile
            change = random.uniform(-volatility, volatility)
            price = base_price * (1 + change)
            base_price = price
            
            # Generate OHLC from base price
            high = price * random.uniform(1.001, 1.02)
            low = price * random.uniform(0.98, 0.999)
            open_price = price * random.uniform(0.995, 1.005)
            close = price
            
            volume = random.randint(1000000, 10000000)
            
            data.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(open_price, 2),
                "high": round(high, 2),
                "low": round(low, 2),
                "close": round(close, 2),
                "volume": volume
            })
        
        return data
    
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
        if symbol.upper() not in self.base_prices:
            raise ValueError(f"Symbol {symbol} not supported")
        
        # Generate mock data
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

