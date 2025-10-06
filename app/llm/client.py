"""
WealthArena LLM Client
LLM client for chat functionality
"""

import os
import asyncio
import time
import logging
from typing import Dict, List, Optional
from datetime import datetime
import httpx

class LLMClient:
    """LLM client for chat functionality"""
    
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "groq")
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.groq_model = os.getenv("GROQ_MODEL", "llama3-8b-8192")
        self.sentiment_model_dir = os.getenv("SENTIMENT_MODEL_DIR", "models/sentiment-finetuned")
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
    
    async def chat(self, messages: List[Dict]) -> str:
        """New chat method that takes messages list and returns string"""
        start_time = time.time()
        
        try:
            if self.provider == "groq" and self.groq_api_key:
                response = await self._call_groq(messages)
                latency = time.time() - start_time
                self.logger.info(f"Groq API call completed in {latency:.2f}s")
                return response
            else:
                # Fallback to legacy method
                return await self._legacy_chat_fallback(messages)
                
        except Exception as e:
            latency = time.time() - start_time
            self.logger.error(f"LLM API call failed after {latency:.2f}s: {str(e)}")
            return "I apologize, but I'm having trouble processing your request right now. Please try again later."
    
    async def _call_groq(self, messages: List[Dict]) -> str:
        """Call Groq API using httpx"""
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.groq_model,
            "messages": messages,
            "max_tokens": 500,
            "temperature": 0.7
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    
    async def _legacy_chat_fallback(self, messages: List[Dict]) -> str:
        """Fallback for legacy chat method"""
        # Extract user message from messages
        user_message = ""
        for msg in messages:
            if msg.get("role") == "user":
                user_message = msg.get("content", "")
                break
        
        if not user_message:
            return "I didn't receive a valid message. Please try again."
        
        # Use existing fallback logic
        fallback_response = self._fallback_response(user_message)
        return fallback_response["reply"]
        
    async def legacy_chat(
        self, 
        message: str, 
        symbol: Optional[str] = None, 
        mode: Optional[str] = None
    ) -> Dict:
        """Generate chat response using LLM"""
        
        # Build context based on mode
        context = self._build_context(message, symbol, mode)
        
        # Generate response based on provider
        if self.provider == "openai" and self.api_key:
            response = await self._call_openai(context)
        else:
            response = self._fallback_response(message, symbol, mode)
        
        return {
            "reply": response["reply"],
            "sources": response["sources"],
            "suggestions": response["suggestions"],
            "timestamp": datetime.now().isoformat()
        }
    
    def _build_context(self, message: str, symbol: Optional[str], mode: Optional[str]) -> str:
        """Build context for LLM"""
        context_parts = [message]
        
        if symbol:
            context_parts.append(f"Symbol: {symbol}")
        
        if mode:
            context_parts.append(f"Mode: {mode}")
        
        return " ".join(context_parts)
    
    
    def _fallback_response(self, message: str, symbol: Optional[str] = None, mode: Optional[str] = None) -> Dict:
        """Fallback response when LLM is not available"""
        message_lower = message.lower()
        
        # Safety checks
        if any(word in message_lower for word in ["buy", "sell", "trade", "invest", "money", "profit"]):
            return {
                "reply": "I can only provide educational information about trading concepts. For actual trading decisions, please consult with a qualified financial advisor. Remember to always practice with paper trading first!",
                "sources": ["Safety Guidelines"],
                "suggestions": ["Learn about risk management", "Understand technical indicators", "Practice with paper trading"]
            }
        
        # RSI explanations
        if "rsi" in message_lower:
            return {
                "reply": """RSI (Relative Strength Index) is a momentum oscillator that measures the speed and change of price movements on a scale of 0-100.

Key RSI levels:
- RSI < 30: Oversold conditions - potential buying opportunity (but always use proper risk management)
- RSI > 70: Overbought conditions - potential selling opportunity
- RSI 40-60: Neutral zone

Remember: RSI is just one indicator. Always combine it with other analysis and never risk more than you can afford to lose. Practice with paper trading first!""",
                "sources": ["Technical Indicators"],
                "suggestions": ["Learn about SMA", "Understand risk management", "Practice with paper trading"]
            }
        
        # Moving averages
        if any(word in message_lower for word in ["sma", "ema", "moving average"]):
            return {
                "reply": """Moving averages help smooth out price data to identify trends:

SMA (Simple Moving Average): Average price over a specific period
EMA (Exponential Moving Average): Gives more weight to recent prices

Common strategies:
- SMA(20) crossing above SMA(50): Potential uptrend
- EMA(12) crossing above SMA(20): Potential momentum shift

Remember: These are educational concepts. Always practice with paper trading and never risk more than 1-2% of your account per trade!""",
                "sources": ["Technical Indicators"],
                "suggestions": ["Learn about RSI", "Understand risk management", "Practice with paper trading"]
            }
        
        # Risk management
        if any(word in message_lower for word in ["risk", "position", "sizing", "stop", "loss"]):
            return {
                "reply": """Risk management is crucial for successful trading:

Key principles:
- Never risk more than 1-2% of your account per trade
- Always use stop losses to limit potential losses
- Diversify your portfolio across different assets
- Maintain proper risk-reward ratios (aim for 2:1 or better)

Remember: This is educational content only. Always practice with paper trading first and consult with financial professionals before making real trading decisions!""",
                "sources": ["Risk Management"],
                "suggestions": ["Learn about technical indicators", "Understand position sizing", "Practice with paper trading"]
            }
        
        # Default response
        return {
            "reply": """I'm here to help you learn about trading concepts! I can explain technical indicators like RSI, moving averages, risk management principles, and more.

Remember: This is educational content only. Always practice with paper trading first and never risk more than you can afford to lose!""",
            "sources": ["General Education"],
            "suggestions": ["Explain RSI", "Position sizing 1% rule", "What is a stop-loss?", "Learn about moving averages"]
        }

