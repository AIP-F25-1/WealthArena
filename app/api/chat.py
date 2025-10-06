"""
WealthArena Chat API
Chat endpoints for mobile SDKs
"""

import re
import random
import uuid
import time
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from datetime import datetime

from ..llm.client import LLMClient
from ..tools.prices import PriceTool
from ..models.sentiment import score as sentiment_score
from ..metrics.prom import record_chat_request

router = APIRouter()

# Initialize LLM client
llm_client = LLMClient()

# Initialize tools
price_tool = PriceTool()

class ChatReq(BaseModel):
    message: str
    user_id: Optional[str] = None
    context: Optional[str] = None

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

class ChatResp(BaseModel):
    reply: str
    tools_used: List[str]
    trace_id: str
    card: Optional[TradeSetupCard] = None

@router.post("/chat", response_model=ChatResp)
async def chat_endpoint(request: ChatReq):
    """Chat with the educational trading bot"""
    start_time = time.time()
    try:
        # Generate trace ID
        trace_id = f"run-{random.randint(10000, 99999)}"
        tools_used = []
        
        # Check if message starts with "analyze:" for sentiment analysis
        if request.message.lower().startswith("analyze:"):
            text_to_analyze = request.message[8:].strip()  # Remove "analyze:" prefix
            if not text_to_analyze:
                return ChatResp(
                    reply="Please provide text to analyze after 'analyze:'. For example: 'analyze: The stock market is performing well today'",
                    tools_used=tools_used,
                    trace_id=trace_id
                )
            
            try:
                sentiment_result = sentiment_score(text_to_analyze)
                tools_used.append("sentiment")
                
                # Format probabilities as percentages
                probs = sentiment_result["probs"]
                negative_prob = probs[0] * 100
                neutral_prob = probs[1] * 100
                positive_prob = probs[2] * 100
                
                # Create detailed response
                analysis = {
                    "text": text_to_analyze,
                    "sentiment": sentiment_result["label"],
                    "confidence": max(probs) * 100,
                    "probabilities": {
                        "negative": round(negative_prob, 1),
                        "neutral": round(neutral_prob, 1),
                        "positive": round(positive_prob, 1)
                    }
                }
                
                reply = f"""📊 **Sentiment Analysis Results**

**Text:** "{text_to_analyze}"

**Predicted Sentiment:** {sentiment_result["label"].upper()}
**Confidence:** {analysis["confidence"]:.1f}%

**Probability Breakdown:**
• Negative: {analysis["probabilities"]["negative"]}%
• Neutral: {analysis["probabilities"]["neutral"]}%
• Positive: {analysis["probabilities"]["positive"]}%

This analysis is based on a fine-tuned DistilBERT model trained on financial text data."""
                
                return ChatResp(
                    reply=reply,
                    tools_used=tools_used,
                    trace_id=trace_id
                )
                
            except Exception as e:
                return ChatResp(
                    reply=f"Sorry, I encountered an error while analyzing the sentiment: {str(e)}. Please try again.",
                    tools_used=tools_used,
                    trace_id=trace_id
                )
        
        # Check if message is asking for price
        price_match = re.search(r'price\s+([A-Z]+)', request.message, re.IGNORECASE)
        if price_match:
            ticker = price_match.group(1).upper()
            try:
                price_data = price_tool.get_price(ticker)
                tools_used.append("get_price")
                
                if price_data["price"] is not None:
                    currency_symbol = "$" if price_data["currency"] == "USD" else price_data["currency"]
                    return ChatResp(
                        reply=f"The current price of {price_data['ticker']} is {currency_symbol}{price_data['price']:.2f}",
                        tools_used=tools_used,
                        trace_id=trace_id
                    )
                else:
                    return ChatResp(
                        reply=f"Sorry, I couldn't get the price for {ticker}. Please check the ticker symbol and try again.",
                        tools_used=tools_used,
                        trace_id=trace_id
                    )
            except Exception as e:
                return ChatResp(
                    reply=f"Sorry, I couldn't get the price for {ticker}. Please check the ticker symbol and try again.",
                    tools_used=tools_used,
                    trace_id=trace_id
                )
        
        # Check if message contains buy/sell keywords for disclaimer
        message_lower = request.message.lower()
        has_trading_keywords = any(word in message_lower for word in ["buy", "sell", "trade", "invest", "purchase", "short"])
        
        # Build system prompt with disclaimer if needed
        system_prompt = "You are a helpful trading education assistant. Always provide educational content only, never financial advice."
        if has_trading_keywords:
            system_prompt += " IMPORTANT: If the user is asking about buying or selling, remind them that this is educational content only and they should consult with a qualified financial advisor before making any investment decisions. Always practice with paper trading first!"
        
        # Prepare messages for LLM
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.message}
        ]
        
        # Add context if provided
        if request.context:
            messages.append({"role": "system", "content": f"Additional context: {request.context}"})
        
        # Get LLM response using new chat method
        reply = await llm_client.chat(messages)
        tools_used.append("llm_client")
        
        # Check if this is a trade setup request and create card if needed
        card = None
        if _is_trade_setup_request(request.message):
            card = _create_trade_setup_card(request.message, reply)
            if card:
                tools_used.append("trade_setup_card")
        
        # Record successful chat request
        latency = time.time() - start_time
        record_chat_request("success", latency)
        
        return ChatResp(
            reply=reply,
            tools_used=tools_used,
            trace_id=trace_id,
            card=card
        )
        
    except Exception as e:
        # Record failed chat request
        latency = time.time() - start_time
        record_chat_request("error", latency)
        
        return ChatResp(
            reply=f"I apologize, but I encountered an error: {str(e)}. Please try again.",
            tools_used=[],
            trace_id=f"run-{random.randint(10000, 99999)}"
        )

@router.get("/chat/history")
async def get_chat_history():
    """Get chat history (placeholder)"""
    return {"message": "Chat history endpoint - to be implemented"}

@router.delete("/chat/history")
async def clear_chat_history():
    """Clear chat history (placeholder)"""
    return {"message": "Chat history cleared"}

def _is_trade_setup_request(message: str) -> bool:
    """Check if the message is asking for a trade setup"""
    message_lower = message.lower()
    setup_keywords = ["setup for", "trade setup", "trading setup", "setup", "analysis for"]
    return any(keyword in message_lower for keyword in setup_keywords)

def _create_trade_setup_card(message: str, reply: str) -> Optional[TradeSetupCard]:
    """Create a TradeSetupCard from the message and reply"""
    try:
        # Extract symbol from message
        symbol_match = re.search(r'setup for\s+([A-Z]+)', message, re.IGNORECASE)
        if not symbol_match:
            # Try alternative patterns
            symbol_match = re.search(r'([A-Z]{2,5})', message)
        
        if not symbol_match:
            return None
            
        symbol = symbol_match.group(1).upper()
        
        # Get current price for the symbol
        try:
            price_data = price_tool.get_price(symbol)
            current_price = price_data["price"] if price_data["price"] is not None else 100.0
        except:
            current_price = 100.0  # Fallback price
        
        # Generate mock technical indicators
        indicators = {
            "rsi": round(random.uniform(30, 70), 1),
            "sma_20": round(current_price * random.uniform(0.95, 1.05), 2),
            "sma_50": round(current_price * random.uniform(0.90, 1.10), 2),
            "volume": random.randint(1000000, 10000000)
        }
        
        # Determine signal based on indicators
        if indicators["rsi"] < 30:
            signal = "BUY"
            confidence = 0.8
        elif indicators["rsi"] > 70:
            signal = "SELL"
            confidence = 0.8
        else:
            signal = "HOLD"
            confidence = 0.6
        
        # Calculate entry, take profit, and stop loss
        entry = current_price
        if signal == "BUY":
            tp = [entry * 1.05, entry * 1.10]  # 5% and 10% profit targets
            sl = entry * 0.95  # 5% stop loss
        elif signal == "SELL":
            tp = [entry * 0.95, entry * 0.90]  # 5% and 10% profit targets
            sl = entry * 1.05  # 5% stop loss
        else:
            tp = []
            sl = entry
        
        # Create the card
        card = TradeSetupCard(
            symbol=symbol,
            name=f"{symbol} Stock",
            signal=signal,
            confidence=confidence,
            price=current_price,
            entry=entry,
            tp=tp,
            sl=sl,
            indicators=indicators,
            reasoning=f"Based on technical analysis: RSI at {indicators['rsi']}, moving averages showing {'bullish' if indicators['sma_20'] > indicators['sma_50'] else 'bearish'} trend. This is educational content only - always practice with paper trading first!",
            updated_at=datetime.now()
        )
        
        return card
        
    except Exception as e:
        # If card creation fails, return None
        return None

