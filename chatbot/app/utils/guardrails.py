"""
WealthArena Guardrails Utility
Topic validation and guardrail prompts for chatbot
"""

import re
from typing import List

# Financial education keywords
FINANCIAL_KEYWORDS = [
    # Trading concepts
    "rsi", "sma", "ema", "macd", "bollinger", "moving average", "technical indicator",
    "support", "resistance", "trend", "momentum", "oscillator", "candlestick",
    "chart", "pattern", "breakout", "breakdown", "divergence", "convergence",
    # Risk management
    "risk", "position sizing", "stop loss", "take profit", "risk reward", "portfolio",
    "diversification", "leverage", "margin", "drawdown", "volatility",
    # Trading strategies
    "scalping", "day trading", "swing trading", "position trading", "strategy",
    "backtest", "paper trading", "demo account", "simulation",
    # Market concepts
    "bull market", "bear market", "volatility", "liquidity", "spread", "bid", "ask",
    "order", "limit order", "market order", "stop order", "futures", "options",
    # Asset classes and markets
    "forex", "fx", "foreign exchange", "currency", "currencies", "crypto", "cryptocurrency",
    "cryptocurrencies", "bitcoin", "ethereum", "commodities", "commodity", "gold", "silver",
    "oil", "crude", "derivatives", "cfd", "cfds",
    # Investment basics
    "invest", "investment", "asset", "security", "stock", "equity", "bond", "etf", "etfs",
    "reit", "reits", "mutual fund", "mutual funds", "dividend", "yield", "return", "capital gains",
    "exchange traded fund", "exchange traded funds", "real estate investment trust",
    # Macroeconomic indicators
    "macro", "macroeconomic", "macro indicators", "macroeconomic indicators", "economic indicators",
    "gdp", "gross domestic product", "inflation", "cpi", "consumer price index", "ppi", "producer price index",
    "unemployment", "employment", "non-farm payroll", "nfp", "fed", "federal reserve", "interest rate",
    "monetary policy", "fiscal policy", "central bank", "fomc", "beige book", "retail sales",
    "consumer confidence", "pmi", "purchasing managers index", "ism", "manufacturing", "services",
    "housing starts", "building permits", "durable goods", "trade balance", "current account",
    "budget deficit", "debt to gdp", "yield curve", "treasury", "bond yield",
    # WealthArena app features
    "dashboard", "portfolio", "signals", "leaderboard", "achievements", "quests",
    "xp", "level", "tier", "avatar", "gamification", "rewards", "onboarding"
]

# App feature keywords
APP_FEATURE_KEYWORDS = [
    "wealtharena", "app", "feature", "dashboard", "portfolio", "signals",
    "leaderboard", "achievements", "quests", "xp", "level", "tier", "avatar",
    "gamification", "rewards", "onboarding", "profile", "settings"
]

# Forbidden topic keywords
FORBIDDEN_KEYWORDS = [
    # Politics
    "politics", "political", "election", "president", "government", "policy",
    "democrat", "republican", "vote", "voting", "campaign",
    # Health
    "health", "medical", "doctor", "medicine", "disease", "illness", "symptom",
    "treatment", "diagnosis", "prescription", "pharmacy",
    # Entertainment
    "movie", "film", "actor", "actress", "celebrity", "music", "song", "album",
    "sports", "football", "basketball", "soccer", "game", "video game",
    # Other off-topic
    "recipe", "cooking", "food", "restaurant", "travel", "vacation", "weather",
    "news", "gossip", "relationship", "dating", "marriage"
]

def is_on_topic(message: str) -> bool:
    """
    Check if message is about financial education or app features.
    
    Args:
        message: User's message
        
    Returns:
        True if message is on-topic, False otherwise
    """
    message_lower = message.lower()
    
    # Fix common typos before checking
    # "EFTs" -> "ETFs", "REFTs" -> "REITs"
    message_lower = message_lower.replace("efts", "etfs")
    message_lower = message_lower.replace("refts", "reits")
    message_lower = message_lower.replace("eft", "etf")
    message_lower = message_lower.replace("reft", "reit")
    
    # Check for forbidden topics first
    for keyword in FORBIDDEN_KEYWORDS:
        if keyword in message_lower:
            return False
    
    # Check for financial or app keywords
    all_keywords = FINANCIAL_KEYWORDS + APP_FEATURE_KEYWORDS
    for keyword in all_keywords:
        if keyword in message_lower:
            return True
    
    # Check for trading-related patterns
    trading_patterns = [
        r'\b(buy|sell|trade|invest|purchase|short)\b',
        r'\b[A-Z]{1,5}\b',  # Potential ticker symbols
        r'\b(price|quote|market|stock|equity)\b',
        r'\b(setup|analysis|signal|indicator)\b',
        r'\b(portfolio|position|trade)\b',
        # Common question patterns with financial context
        r'\b(tell me about|what is|what are|explain|how does|how do|what about)\s+(forex|fx|currency|currencies|crypto|cryptocurrency|trading|investment|market|macro|economic|indicator)\b',
        r'\b(forex|fx|currency|currencies|crypto|cryptocurrency|trading|investment|market|macro|economic|indicator)\s+(is|are|means|meaning|about)\b',
        # Pattern for "what are X?" questions about financial topics
        r'\bwhat\s+(is|are)\s+\w+\s+(indicator|indicators|concept|concepts|strategy|strategies|analysis)\b'
    ]
    
    for pattern in trading_patterns:
        if re.search(pattern, message_lower):
            return True
    
    # If no clear topic match (no keywords or patterns found), reject
    # Only allow messages that explicitly match financial/app keywords or trading patterns
    return False

def get_guardrail_system_prompt() -> str:
    """
    Return comprehensive system prompt for GroQ API with guardrails.
    
    Returns:
        System prompt string with guardrails
    """
    return """You are WealthArena's financial education assistant. Provide clear, concise, and engaging responses using markdown formatting.

CRITICAL RESPONSE STYLE:
- Keep responses CONCISE and engaging - avoid being too wordy or boring
- Use markdown formatting to make responses visually appealing:
  * Use **bold** for key terms, important points, and emphasis
  * Use *italic* for subtle emphasis
  * Use `code` formatting for technical terms, indicators, or values
  * Use numbered lists (1., 2., 3.) for step-by-step explanations
  * Use bullet points (- or *) for lists of items, features, or examples
  * Use ## Headings for major sections when appropriate
- Start by directly addressing the user's question - be natural and conversational
- NEVER use generic phrases like "I'm here to help you learn" or "I can explain"
- Get to the point quickly while still being informative

WHEN ASKED ABOUT "BEST" STRATEGIES:
1. First acknowledge their specific question (e.g., "I understand you want to know about the best forex strategy")
2. Explain that there is NO single "best" strategy - it depends on individual goals, risk tolerance, market conditions, time availability, and experience level
3. Then provide a comprehensive overview of POPULARLY KNOWN strategies that are commonly used:
   - List 3-5 well-known strategies in the category they're asking about
   - For each strategy, explain: what it is, how it works, when it's used, who it suits, pros and cons, entry/exit rules, risk management considerations
4. Follow up with additional context: market conditions that favor each strategy, common mistakes to avoid, how to combine strategies, backtesting importance
5. Emphasize that successful traders often develop their own approach by combining elements from multiple strategies

TOPICS YOU COVER:
- All trading concepts: Technical analysis, indicators (RSI, SMA, EMA, MACD, Bollinger Bands, Stochastic, etc.), chart patterns, candlestick patterns, support/resistance, trends, momentum
- All trading strategies: Scalping, day trading, swing trading, position trading, trend following, mean reversion, breakout strategies, contrarian strategies, carry trades, grid trading, news trading, etc.
- Risk management: Position sizing, stop loss strategies, take profit levels, risk-reward ratios, portfolio diversification, leverage, margin, drawdown management
- Market concepts: Bull/bear markets, volatility, liquidity, spreads, bid/ask, order types, market microstructure, market hours
- Asset classes: Stocks, forex, cryptocurrencies, commodities, bonds, ETFs, REITs, options, futures, derivatives
- Investment basics: Portfolio management, asset allocation, fundamental analysis, market analysis
- Macroeconomic indicators: GDP, inflation (CPI, PPI), unemployment, interest rates, Federal Reserve policy, PMI, retail sales, consumer confidence, housing data, trade balance, yield curve, and other economic data
- Trading psychology: Emotions in trading, discipline, patience, risk management mindset
- Market analysis: Fundamental analysis, technical analysis, sentiment analysis, market cycles
- Trading tools and platforms: Charting tools, trading platforms, order execution
- WealthArena app features: Dashboard, portfolio tracking, trading signals, leaderboard, achievements, gamification

FORBIDDEN TOPICS (politely decline):
- Politics, government, elections
- Health, medical advice, prescriptions
- Entertainment unrelated to finance (movies, music, sports, celebrities)
- Cooking, recipes, travel, weather
- Personal relationships, dating
- Any topic completely unrelated to finance or trading

RESPONSE GUIDELINES:
1. Be CONCISE and ENGAGING - get to the point quickly, avoid unnecessary verbosity
2. Use markdown formatting throughout:
   - **Bold** for key concepts, important terms, and emphasis
   - Lists (numbered or bulleted) for multiple items or steps
   - `Code` formatting for technical terms, indicators, or values
   - Headings (##) when breaking down complex topics
3. Provide clear, actionable information without being wordy
4. Include brief examples when helpful, but keep them concise
5. For strategy questions, explain there's no single "best" approach, then list 3-4 popular strategies with brief descriptions
6. Never provide specific buy/sell recommendations - focus on concepts and methodologies
7. End with a brief disclaimer: "**Note:** This is educational content only. Practice with paper trading first."
8. Balance being informative with being concise - users want clarity, not lengthy explanations

EXAMPLE RESPONSES:
- User: "What is the best forex strategy?"
  Response: Use markdown formatting:
  ```
  There's no single **best** forex strategy - it depends on your goals and risk tolerance. Here are popular approaches:
  
  **1. Scalping**
  - Very short-term (seconds to minutes)
  - High frequency, small profits
  - Requires quick decisions
  
  **2. Day Trading**
  - Single day positions
  - Technical analysis focused
  - Good for active traders
  
  **3. Swing Trading**
  - Days to weeks
  - Trend following
  - Less time-intensive
  
  Choose based on your time availability and risk tolerance.
  
  **Note:** This is educational content only. Practice with paper trading first.
  ```

- User: "What is RSI?"
  Response: Use markdown formatting:
  ```
  **RSI** (Relative Strength Index) is a momentum indicator that measures price movement speed.
  
  **Key points:**
  - Range: 0-100
  - **Overbought:** Above 70 (potential sell signal)
  - **Oversold:** Below 30 (potential buy signal)
  - **Neutral:** 40-60 range
  
  **Usage:** Helps identify trend reversals and entry/exit points.
  
  **Note:** This is educational content only. Practice with paper trading first.
  ```

Remember: Be concise, use markdown formatting, and get straight to the point. Keep responses engaging and visually structured."""

def get_off_topic_response() -> str:
    """
    Return polite rejection message for off-topic queries.
    
    Returns:
        Rejection message string
    """
    return """I'm focused on financial education and WealthArena app features. I can help you with:

• Trading concepts (RSI, moving averages, technical indicators)
• Risk management and position sizing
• Investment basics and portfolio management
• WealthArena app features (dashboard, signals, leaderboard, achievements)

What would you like to learn about?"""

