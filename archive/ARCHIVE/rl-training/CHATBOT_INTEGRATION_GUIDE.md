# WealthArena Chatbot Integration Guide

## Overview

Instead of reinventing the wheel, the WealthArena RL system now connects to the existing `wealtharena_chatbot` service for all LLM capabilities. This provides:

- ✅ **Event Extraction** - Through search and explain APIs
- ✅ **Sentiment Analysis** - Fine-tuned DistilBERT model for financial text
- ✅ **Explainable Trade Rationales** - Structured trade setup cards with reasoning
- ✅ **Educational Chat** - Safety-focused trading education
- ✅ **Market Data Integration** - Real-time price fetching

## Architecture

```
WealthArena RL System
        ↓
   Chatbot Integration Layer
        ↓
   wealtharena_chatbot Service
        ↓
   Groq LLM + Fine-tuned Models
```

## Setup Instructions

### 1. Start the Chatbot Service

```bash
# Navigate to the chatbot directory
cd wealtharena_chatbot

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your GROQ_API_KEY

# Start the service
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Configure RL System

The RL system will automatically connect to the chatbot service at `http://localhost:8000`. To change this:

```python
# In wealtharena_rl/src/integration/chatbot_integration.py
chatbot_integration = ChatbotIntegration(chatbot_url="http://your-chatbot-url:8000")
```

## Available LLM Capabilities

### 1. Sentiment Analysis

```python
# Analyze sentiment of financial text
sentiment_result = await chatbot_integration.analyze_sentiment(
    "The stock market is performing exceptionally well today"
)
```

### 2. Trade Rationale Explanation

```python
# Get explainable trade rationale
indicators = {
    "price": 150.0,
    "rsi": 65.0,
    "sma_20": 148.0,
    "volume": 1000000
}
rationale = await chatbot_integration.explain_trade_rationale("AAPL", indicators)
```

### 3. Trade Setup Generation

```python
# Get structured trade setup
trade_setup = await chatbot_integration.get_trade_setup("AAPL")
```

### 4. News Insights

```python
# Analyze news articles for market insights
news_articles = [
    {
        "title": "Tech Stocks Rally",
        "summary": "Technology stocks show strong performance...",
        "url": "https://example.com/news1"
    }
]
insights = await chatbot_integration.generate_news_insights(news_articles)
```

### 5. Knowledge Search

```python
# Search financial knowledge base
results = await chatbot_integration.search_knowledge("RSI trading strategy", k=5)
```

## API Endpoints Used

The integration connects to these existing chatbot endpoints:

- `POST /v1/chat` - Main chat with sentiment analysis
- `POST /v1/explain` - Explainable AI for questions
- `GET /v1/search` - Knowledge search
- `GET /v1/market/ohlc` - Market data
- `GET /v1/market/quote` - Real-time quotes

## Integration Benefits

### ✅ **No Duplication**
- Reuses existing, tested LLM infrastructure
- Leverages fine-tuned financial sentiment models
- Maintains consistent educational messaging

### ✅ **Production Ready**
- Already deployed and tested
- Includes error handling and fallbacks
- Has monitoring and metrics

### ✅ **Educational Focus**
- Safety-first approach to trading education
- Consistent disclaimers and warnings
- Structured learning content

### ✅ **Scalable**
- Handles multiple concurrent requests
- Built-in rate limiting and caching
- Docker containerized for easy deployment

## Usage in RL System

The RL system automatically uses the chatbot integration for:

1. **News Analysis** - Sentiment analysis of market news
2. **Trade Explanations** - Explainable rationales for RL decisions
3. **Risk Communication** - Educational content about risk management
4. **Strategy Insights** - Knowledge base search for strategy validation

## Error Handling

The integration includes robust error handling:

- **Service Unavailable** - Falls back to basic explanations
- **API Timeouts** - Retries with exponential backoff
- **Invalid Responses** - Uses default educational content
- **Network Issues** - Graceful degradation

## Monitoring

The chatbot service provides metrics at `/metrics`:

- API response times
- Error rates
- Sentiment analysis accuracy
- Knowledge search performance

## Next Steps

1. **Deploy Chatbot Service** - Set up the chatbot service in your environment
2. **Configure URLs** - Update the chatbot URL in the RL system
3. **Test Integration** - Run the RL system to verify LLM capabilities
4. **Monitor Performance** - Use the provided metrics to track performance

## Troubleshooting

### Common Issues

1. **Connection Refused** - Ensure chatbot service is running on port 8000
2. **API Key Missing** - Set GROQ_API_KEY in chatbot service environment
3. **Timeout Errors** - Check network connectivity and service health
4. **Empty Responses** - Verify chatbot service is properly configured

### Health Checks

```bash
# Check chatbot service health
curl http://localhost:8000/healthz

# Check metrics
curl http://localhost:8000/metrics

# Test chat endpoint
curl -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "analyze: The market is bullish today"}'
```

This integration approach ensures we leverage the existing, well-tested LLM infrastructure while maintaining the educational focus and safety standards of the WealthArena platform.
