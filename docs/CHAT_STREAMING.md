# Chat Streaming API

This document describes the new WebSocket streaming chat functionality and TradeSetupCard schema.

## WebSocket Streaming Endpoint

### Endpoint: `/v1/chat/stream`

A WebSocket endpoint that streams Groq LLM tokens as they arrive in real-time.

#### Connection
```javascript
const ws = new WebSocket('ws://localhost:8000/v1/chat/stream');
```

#### Initial Message Format
Send a JSON message on connection:
```json
{
  "message": "What is RSI and how does it work?",
  "context": {
    "user_id": "user123",
    "session_id": "session456"
  }
}
```

#### Response Format
The WebSocket will stream responses in the following format:

**Token messages:**
```json
{
  "type": "token",
  "text": "RSI stands for Relative Strength Index..."
}
```

**Completion message:**
```json
{
  "type": "done"
}
```

**Error messages:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

## TradeSetupCard Schema

The regular chat endpoint now supports structured trade setup responses.

### Schema Definition
```typescript
interface TradeSetupCard {
  symbol: string;           // Stock symbol (e.g., "AAPL")
  name: string;            // Display name (e.g., "AAPL Stock")
  signal: string;          // "BUY", "SELL", or "HOLD"
  confidence: number;      // 0.0 to 1.0
  price: number;           // Current price
  entry: number;           // Entry price
  tp: number[];            // Take profit levels
  sl: number;              // Stop loss
  indicators: {            // Technical indicators
    rsi: number;
    sma_20: number;
    sma_50: number;
    volume: number;
  };
  reasoning: string;       // Explanation
  updated_at: string;      // ISO timestamp
}
```

### Usage

Send a message like "setup for AAPL" to get a structured trade setup card:

```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "setup for AAPL",
    "user_id": "user123"
  }'
```

Response:
```json
{
  "reply": "Here's a technical analysis for AAPL...",
  "tools_used": ["llm_client", "trade_setup_card"],
  "trace_id": "run-12345",
  "card": {
    "symbol": "AAPL",
    "name": "AAPL Stock",
    "signal": "BUY",
    "confidence": 0.8,
    "price": 150.25,
    "entry": 150.25,
    "tp": [157.76, 165.28],
    "sl": 142.74,
    "indicators": {
      "rsi": 45.2,
      "sma_20": 148.50,
      "sma_50": 145.30,
      "volume": 5000000
    },
    "reasoning": "Based on technical analysis: RSI at 45.2, moving averages showing bullish trend...",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

## Implementation Notes

- The WebSocket endpoint requires a Groq API key to be configured
- Trade setup cards are generated automatically when users ask for setups
- All responses include educational disclaimers
- The system uses mock data for demonstration purposes
- Real trading decisions should always be made with proper research and risk management
