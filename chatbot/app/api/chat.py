"""
WealthArena Chat API
Chat endpoints for mobile SDKs
"""

import re
import random
import secrets
import uuid
import time
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os

from ..llm.client import LLMClient
from ..tools.prices import PriceTool
from ..tools.retrieval import search_kb, search_all_collections
from ..models.sentiment import score as sentiment_score
from ..metrics.prom import record_chat_request
import logging

router = APIRouter()

# Initialize LLM client
llm_client = LLMClient()

# Initialize tools
price_tool = PriceTool()

# Setup logging
logger = logging.getLogger(__name__)

# Lazy load guard prompt
_guard_prompt = None

def _get_guard_prompt() -> str:
    """Lazy load guard prompt with graceful fallback"""
    global _guard_prompt
    if _guard_prompt is None:
        try:
            guard_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "llm", "guard_prompt.txt")
            with open(guard_path, "r", encoding="utf-8") as f:
                _guard_prompt = f.read()
        except Exception as e:
            # Fallback to default guard prompt if file not found
            logger.warning(f"Could not load guard prompt from file: {e}. Using default.")
            _guard_prompt = "You are WealthArena Tutor. Be concise (2–3 sentences). Educational only; no financial advice."
    return _guard_prompt

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
    start_time = time.time()
    try:
        # Generate secure trace ID using cryptographically secure random
        trace_id = f"run-{secrets.randbelow(90000) + 10000}"
        tools_used = []
        
        # Check if tools are enabled (for non-LLM features like sentiment analysis and price queries)
        enable_tools = os.getenv('ENABLE_TOOLS', 'false').lower() in ('true', '1', 'yes')
        
        # Check if message starts with "analyze:" for sentiment analysis
        if request.message.lower().startswith("analyze:"):
            if not enable_tools:
                return ChatResp(
                    reply="Non-LLM tools (sentiment analysis, price queries) are currently disabled. To enable these features, set ENABLE_TOOLS=true in your environment configuration.",
                    tools_used=tools_used,
                    trace_id=trace_id
                )
            
            text_to_analyze = request.message[8:].strip()  # Remove "analyze:" prefix
            if not text_to_analyze:
                return ChatResp(
                    reply="Please provide text to analyze after 'analyze:'. For example: 'analyze: The stock market is performing well today'",
                    tools_used=tools_used,
                    trace_id=trace_id
                )
            
            # Check if sentiment analysis is enabled
            enable_sentiment = os.getenv('ENABLE_SENTIMENT_ANALYSIS', 'false').lower() in ('true', '1', 'yes')
            if not enable_sentiment:
                return ChatResp(
                    reply="Sentiment analysis is currently disabled. To enable this feature, set ENABLE_SENTIMENT_ANALYSIS=true in your environment configuration.",
                    tools_used=tools_used,
                    trace_id=trace_id
                )
            
            # Check if sentiment model is available
            try:
                from ..models.sentiment import get_sentiment_model
                sentiment_model = get_sentiment_model()
                if sentiment_model.model is None or sentiment_model.tokenizer is None:
                    return ChatResp(
                        reply="Sentiment analysis is not available. ML dependencies (torch, transformers) may not be installed, or the model failed to load. Please check your configuration.",
                        tools_used=tools_used,
                        trace_id=trace_id
                    )
            except Exception as e:
                logger.warning(f"Could not check sentiment model availability: {e}")
                return ChatResp(
                    reply="Sentiment analysis is not available. ML dependencies may not be installed or configured correctly.",
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
                
                reply = f"""**Sentiment Analysis Results**

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
        
        # Check if message is asking for price (only if tools are enabled)
        if enable_tools:
            # Support multiple patterns:
            # 1. "price SYMBOL" or "SYMBOL price" (natural phrasing)
            # 2. Forex pairs with optional slash: "EUR/USD" or "EURUSD" (3-6 letters per currency)
            # 3. Case-insensitive matching
            price_patterns = [
                r'price\s+([A-Z]{1,6}(?:/[A-Z]{1,6})?)',  # "price EUR/USD" or "price EURUSD" or "price AAPL"
                r'([A-Z]{1,6}(?:/[A-Z]{1,6})?)\s+price',  # "EUR/USD price" or "EURUSD price" or "AAPL price"
            ]
            price_match = None
            for pattern in price_patterns:
                price_match = re.search(pattern, request.message, re.IGNORECASE)
                if price_match:
                    break
        else:
            price_match = None
        
        if price_match:
            # Normalize: remove slash and uppercase
            # This handles both stock symbols (AAPL) and forex pairs (EUR/USD -> EURUSD)
            ticker = price_match.group(1).upper().replace('/', '')
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
                        reply=f"Sorry, I couldn't get the price for {ticker}. The price data is currently unavailable. Please check the ticker symbol and try again later.",
                        tools_used=tools_used,
                        trace_id=trace_id
                    )
            except Exception as e:
                return ChatResp(
                    reply=f"Sorry, I couldn't get the price for {ticker}. Price data is currently unavailable: {str(e)}. Please check the ticker symbol and try again later.",
                    tools_used=tools_used,
                    trace_id=trace_id
                )
        
        # RAG: Search PDF documents collection for relevant context
        kb_hits = []
        kb_context = ""
        try:
            # Only search PDF documents collection
            kb_hits = await search_all_collections(request.message, k=5, collections=['pdf_documents'])
            if kb_hits:
                # Format context with source attribution
                context_parts = []
                for hit in kb_hits:
                    meta = hit.get("meta", {})
                    filename = meta.get("filename", "PDF Document")
                    source_label = f"PDF: {filename}"
                    context_parts.append(f'[{source_label}]\n{hit["text"]}\n')
                kb_context = "\n\n".join(context_parts)
                tools_used.append("pdf_search")
                logger.info(f"Retrieved {len(kb_hits)} PDF document chunks for chat query")
        except Exception as e:
            logger.warning(f"PDF document search failed: {e}. Continuing without context.")
        
        # Check if message is asking for actual trading advice (not just educational questions)
        # Only flag if it's a direct action request, not educational questions
        message_lower = request.message.lower()
        # Look for action-oriented phrases, not just the word "trade" in educational contexts
        action_phrases = [
            "should i buy", "should i sell", "should i trade", "should i invest",
            "buy now", "sell now", "trade now", "invest now",
            "what should i buy", "what should i sell", "what should i trade",
            "recommend buying", "recommend selling", "recommend trading"
        ]
        has_trading_action = any(phrase in message_lower for phrase in action_phrases)
        
        # Get guard prompt for safety
        guard_prompt = _get_guard_prompt()
        
        # Build system prompt with guard prompt and disclaimer
        system_prompt = guard_prompt
        if has_trading_action:
            system_prompt += "\n\nIMPORTANT: If the user is asking for trading advice or recommendations, remind them that this is educational content only and they should consult with a qualified financial advisor before making any investment decisions. Always practice with paper trading first!"
        
        # Prepare user message with KB context if available
        user_content = request.message
        if kb_context:
            user_content = f"QUESTION: {request.message}\n\nCONTEXT FROM KNOWLEDGE BASE:\n{kb_context}\n\nPlease answer the question using the context provided. If the context doesn't contain relevant information, say so."
        
        # Prepare messages for LLM
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        
        # Add context if provided (from request)
        if request.context:
            messages.append({"role": "system", "content": f"Additional context: {request.context}"})
        
        # Get LLM response using new chat method
        try:
            reply = await llm_client.chat(messages)
            tools_used.append("llm_client")
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise
        
        # Record successful chat request
        latency = time.time() - start_time
        record_chat_request("success", latency)
        
        return ChatResp(
            reply=reply,
            tools_used=tools_used,
            trace_id=trace_id
        )
        
    except Exception as e:
        # Record failed chat request
        latency = time.time() - start_time
        record_chat_request("error", latency)
        
        error_message = str(e)
        if "GROQ_API_KEY" in error_message or "API key" in error_message.lower():
            user_message = "LLM service unavailable. Please check GROQ_API_KEY configuration in your .env file. Get your key from https://console.groq.com/"
        else:
            user_message = f"LLM service unavailable: {error_message}. Please check your configuration and try again."
        
        return ChatResp(
            reply=user_message,
            tools_used=[],
            trace_id=f"run-{secrets.randbelow(90000) + 10000}"
        )

@router.get("/chat/history")
async def get_chat_history():
    """Get chat history (placeholder)"""
    return {"message": "Chat history endpoint - to be implemented"}

@router.delete("/chat/history")
async def clear_chat_history():
    """Clear chat history (placeholder)"""
    return {"message": "Chat history cleared"}

