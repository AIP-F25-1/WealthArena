# Context and Knowledge APIs

This document describes the context management and knowledge base APIs for WealthArena.

## Context API (`/v1/context`)

The Context API provides information about the user's current trading context, including active symbols, signals, and recent predictions.

### GET `/v1/context/current`
Get current trading context for a user.

**Query Parameters:**
- `user_id` (required): User ID to get context for

**Response:**
```json
{
  "active_symbol": "AAPL",
  "current_signal": "BUY",
  "recent_predictions": [
    {
      "symbol": "AAPL",
      "signal": "BUY",
      "confidence": 0.85,
      "price": 150.25,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Features:**
- Derives context from last TradeSetupCard in chat history
- Falls back to mock data if no real data available
- Returns up to 10 most recent predictions

### GET `/v1/context/symbols`
Get all symbols that user has interacted with.

**Query Parameters:**
- `user_id` (required): User ID to get symbols for

**Response:**
```json
{
  "user_id": "user123",
  "symbols": ["AAPL", "MSFT", "GOOGL"],
  "total_symbols": 3
}
```

### GET `/v1/context/signals`
Get signal history for a user.

**Query Parameters:**
- `user_id` (required): User ID to get signals for
- `symbol` (optional): Filter by specific symbol
- `days` (optional): Number of days to look back (default: 30, max: 365)

**Response:**
```json
{
  "user_id": "user123",
  "symbol_filter": "AAPL",
  "days": 30,
  "signals": [
    {
      "symbol": "AAPL",
      "signal": "BUY",
      "confidence": 0.85,
      "price": 150.25,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total_signals": 1
}
```

### GET `/v1/context/stats`
Get context statistics for a user.

**Query Parameters:**
- `user_id` (required): User ID to get stats for

**Response:**
```json
{
  "user_id": "user123",
  "total_trade_setups": 25,
  "unique_symbols": 5,
  "signal_distribution": {
    "BUY": 15,
    "SELL": 5,
    "HOLD": 5
  },
  "recent_activity_7_days": 8,
  "last_updated": "2024-01-15T10:30:00Z"
}
```

## Knowledge API (`/v1/knowledge`)

The Knowledge API provides access to educational topics and learning content.

### GET `/v1/knowledge/topics`
Get available knowledge topics.

**Query Parameters:**
- `category` (optional): Filter by category
- `difficulty` (optional): Filter by difficulty level
- `search` (optional): Search in topic names and descriptions

**Response:**
```json
{
  "topics": [
    {
      "id": "trading_basics",
      "name": "Trading Basics",
      "description": "Learn the fundamental concepts of trading...",
      "category": "Fundamentals",
      "difficulty": "Beginner",
      "estimated_time": "10 minutes",
      "prerequisites": [],
      "learning_objectives": [
        "Understand what trading is and how markets work",
        "Learn about different types of orders"
      ]
    }
  ],
  "total": 8,
  "categories": ["Fundamentals", "Analysis", "Strategy", "Psychology", "Advanced"]
}
```

### GET `/v1/knowledge/topics/{topic_id}`
Get detailed information about a specific topic.

**Response:**
```json
{
  "id": "trading_basics",
  "name": "Trading Basics",
  "description": "Learn the fundamental concepts of trading...",
  "category": "Fundamentals",
  "difficulty": "Beginner",
  "estimated_time": "10 minutes",
  "prerequisites": [],
  "learning_objectives": [
    "Understand what trading is and how markets work",
    "Learn about different types of orders",
    "Understand basic trading terminology",
    "Learn about market participants"
  ]
}
```

### GET `/v1/knowledge/categories`
Get all available knowledge categories.

**Response:**
```json
{
  "categories": ["Fundamentals", "Analysis", "Strategy", "Psychology", "Advanced"],
  "category_stats": {
    "Fundamentals": 1,
    "Analysis": 2,
    "Strategy": 3,
    "Psychology": 1,
    "Advanced": 1
  },
  "total_categories": 5
}
```

### GET `/v1/knowledge/difficulty-levels`
Get available difficulty levels.

**Response:**
```json
{
  "difficulty_levels": ["Beginner", "Intermediate", "Advanced"],
  "difficulty_stats": {
    "Beginner": 1,
    "Intermediate": 5,
    "Advanced": 2
  },
  "total_levels": 3
}
```

### GET `/v1/knowledge/recommended`
Get recommended topics based on user level.

**Query Parameters:**
- `user_level` (optional): User's current level (default: "Beginner")
- `limit` (optional): Number of recommendations (default: 5, max: 10)

**Response:**
```json
{
  "user_level": "Beginner",
  "recommended_topics": [
    {
      "id": "trading_basics",
      "name": "Trading Basics",
      "description": "Learn the fundamental concepts of trading...",
      "category": "Fundamentals",
      "difficulty": "Beginner",
      "estimated_time": "10 minutes",
      "prerequisites": [],
      "learning_objectives": [...]
    }
  ],
  "total_recommendations": 3
}
```

### GET `/v1/knowledge/search`
Search knowledge topics.

**Query Parameters:**
- `query` (required): Search query
- `category` (optional): Filter by category
- `difficulty` (optional): Filter by difficulty

**Response:**
```json
{
  "query": "RSI",
  "results": [
    {
      "id": "technical_analysis",
      "name": "Technical Analysis",
      "description": "Master technical indicators, chart patterns...",
      "category": "Analysis",
      "difficulty": "Intermediate",
      "estimated_time": "20 minutes",
      "prerequisites": ["Trading Basics"],
      "learning_objectives": [
        "Understand key technical indicators (RSI, MACD, Moving Averages)",
        "Identify chart patterns and trends"
      ]
    }
  ],
  "total_results": 1,
  "filters": {
    "category": null,
    "difficulty": null
  }
}
```

### GET `/v1/knowledge/stats`
Get knowledge base statistics.

**Response:**
```json
{
  "total_topics": 8,
  "category_distribution": {
    "Fundamentals": 1,
    "Analysis": 2,
    "Strategy": 3,
    "Psychology": 1,
    "Advanced": 1
  },
  "difficulty_distribution": {
    "Beginner": 1,
    "Intermediate": 5,
    "Advanced": 2
  },
  "average_learning_time_minutes": 15.2,
  "total_learning_time_hours": 2.0,
  "last_updated": "2024-01-15T10:30:00Z"
}
```

## Available Knowledge Topics

### Trading Basics
- **Category:** Fundamentals
- **Difficulty:** Beginner
- **Time:** 10 minutes
- **Description:** Learn the fundamental concepts of trading, including market types, order types, and basic terminology.

### Technical Analysis
- **Category:** Analysis
- **Difficulty:** Intermediate
- **Time:** 20 minutes
- **Prerequisites:** Trading Basics
- **Description:** Master technical indicators, chart patterns, and price action analysis for better trading decisions.

### Risk Management
- **Category:** Strategy
- **Difficulty:** Intermediate
- **Time:** 15 minutes
- **Prerequisites:** Trading Basics
- **Description:** Essential risk management principles to protect your capital and improve trading performance.

### RL Model Explained
- **Category:** Advanced
- **Difficulty:** Advanced
- **Time:** 25 minutes
- **Prerequisites:** Technical Analysis, Risk Management
- **Description:** Understand how reinforcement learning models work in trading and their applications.

### Market Psychology
- **Category:** Psychology
- **Difficulty:** Intermediate
- **Time:** 12 minutes
- **Prerequisites:** Trading Basics
- **Description:** Understand the psychological aspects of trading and how emotions affect decision-making.

### Portfolio Management
- **Category:** Strategy
- **Difficulty:** Intermediate
- **Time:** 18 minutes
- **Prerequisites:** Risk Management
- **Description:** Learn how to build and manage a diversified trading portfolio.

### Fundamental Analysis
- **Category:** Analysis
- **Difficulty:** Intermediate
- **Time:** 22 minutes
- **Prerequisites:** Trading Basics
- **Description:** Learn to analyze companies and markets using fundamental data and economic indicators.

### Trading Strategies
- **Category:** Strategy
- **Difficulty:** Intermediate
- **Time:** 20 minutes
- **Prerequisites:** Technical Analysis, Risk Management
- **Description:** Explore different trading strategies including day trading, swing trading, and long-term investing.

## Usage Examples

### Get Current Context
```bash
curl "http://localhost:8000/v1/context/current?user_id=user123"
```

### Get Knowledge Topics
```bash
# Get all topics
curl "http://localhost:8000/v1/knowledge/topics"

# Filter by category
curl "http://localhost:8000/v1/knowledge/topics?category=Fundamentals"

# Search for RSI-related topics
curl "http://localhost:8000/v1/knowledge/search?query=RSI"
```

### Get Recommended Topics
```bash
# Get recommendations for beginner
curl "http://localhost:8000/v1/knowledge/recommended?user_level=Beginner"

# Get recommendations for advanced user
curl "http://localhost:8000/v1/knowledge/recommended?user_level=Advanced"
```

## Integration Notes

- **Context API** automatically derives data from chat history when available
- **Mock data** is provided when no real data exists
- **Knowledge API** provides structured educational content
- **Search functionality** supports full-text search across topics
- **Recommendation system** adapts to user skill level
- **All endpoints** include comprehensive error handling
