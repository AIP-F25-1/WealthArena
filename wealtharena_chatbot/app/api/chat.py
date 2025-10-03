"""
WealthArena Chat API
Chat endpoints for mobile SDKs
"""

import re
import random
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import os

from ..llm.client import LLMClient
from ..tools.prices import PriceTool
from ..models.sentiment import score as sentiment_score

router = APIRouter()

# Initialize LLM client
llm_client = LLMClient()

# Initialize tools
price_tool = PriceTool()

class ChatReq(BaseModel):
    message: str
    user_id: Optional[str] = None
    context: Optional[str] = None

class ChatResp(BaseModel):
    reply: str
    tools_used: List[str]
    trace_id: str

@router.post("/chat", response_model=ChatResp)
async def chat_endpoint(request: ChatReq):
    """Chat with the educational trading bot"""
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
        
        return ChatResp(
            reply=reply,
            tools_used=tools_used,
            trace_id=trace_id
        )
        
    except Exception as e:
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

