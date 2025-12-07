# WealthArena RL Inference Service Testing Guide

> **Note**: This is a testing guide. For setup, installation, and general usage, see [README.md](README.md) as the main entry point.

## Prerequisites
- RL inference service running on `http://localhost:5002`
- Azure SQL Database with `processed_prices` table populated (Phase 2)
- Postman or curl for API testing
- Backend service running on `http://localhost:3000` (for proxy testing)

## Testing Strategy

### Phase 1: Health Check & Service Verification
### Phase 2: Prediction Endpoints (Signal Generation)
### Phase 3: Top Setups & Portfolio Analysis
### Phase 4: Backend Proxy Integration

---

## Phase 1: Health Check & Service Verification

### 1.1 Health Check
**Endpoint:** `GET /health`
**Auth Required:** No

**curl:**
```bash
curl http://localhost:5002/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

**If model_loaded is false:**
```json
{
  "status": "model_not_loaded",
  "model_loaded": false,
  "timestamp": "2025-01-15T10:30:00.000000"
}
```
This is expected until Phase 7 (model training). Service still works with mock predictions.

### 1.2 Model Info
**Endpoint:** `GET /model/info`
**Auth Required:** No

**curl:**
```bash
curl http://localhost:5002/model/info
```

**Expected Response:**
```json
{
  "model_path": "../../wealtharena_rl/checkpoints/latest",
  "model_loaded": true,
  "model_type": "PPO",
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

---

## Phase 2: Prediction Endpoints

### 2.1 Generate Prediction for Symbol
**Endpoint:** `POST /predict`
**Auth Required:** No

**Postman:**
- Method: POST
- URL: `http://localhost:5002/predict`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "market_state": [[0.1, 0.2, 0.3, 0.4, 0.5]],
  "symbol": "BHP.AX",
  "asset_type": "stock"
}
```

**curl:**
```bash
curl -X POST http://localhost:5002/predict \
  -H "Content-Type: application/json" \
  -d '{
    "market_state": [[0.1, 0.2, 0.3, 0.4, 0.5]],
    "symbol": "BHP.AX",
    "asset_type": "stock"
  }'
```

**Expected Response (Enhanced with RLModelService):**
```json
{
  "symbol": "BHP.AX",
  "asset_type": "stock",
  "signal": "BUY",
  "confidence": 0.78,
  "timestamp": "2025-01-15T10:30:00.000000",
  "entry": {
    "price": 45.23,
    "range": [45.09, 45.37],
    "timing": "on_pullback"
  },
  "take_profit": [
    {
      "level": 1,
      "price": 46.85,
      "percent": 3.58,
      "close_percent": 50,
      "probability": 0.75
    },
    {
      "level": 2,
      "price": 48.92,
      "percent": 8.16,
      "close_percent": 30,
      "probability": 0.55
    },
    {
      "level": 3,
      "price": 51.34,
      "percent": 13.51,
      "close_percent": 20,
      "probability": 0.35
    }
  ],
  "stop_loss": {
    "price": 43.15,
    "percent": -4.60,
    "type": "fixed",
    "trail_amount": null
  },
  "risk_metrics": {
    "risk_reward_ratio": 2.35,
    "max_risk_per_share": 2.08,
    "max_reward_per_share": 4.89,
    "win_probability": 0.66,
    "expected_value": 2.52
  },
  "position_sizing": {
    "recommended_percent": 4.5,
    "dollar_amount": 4500.00,
    "method": "Kelly Criterion + Volatility Adjusted",
    "max_risk_percent": 2.25,
    "confidence_factor": 0.78,
    "volatility_factor": 0.025
  },
  "indicators": {
    "rsi": {"value": 52.3, "status": "neutral"},
    "macd": {"value": 0.45, "status": "bullish"},
    "volatility": {"value": 0.025, "status": "medium"},
    "volume": {"status": "normal"},
    "trend": {"direction": "up", "strength": "moderate"}
  },
  "chart_data": [
    {"date": "2025-01-01", "open": 44.50, "high": 45.20, "low": 44.30, "close": 45.00, "volume": 1234567},
    {"date": "2025-01-02", "open": 45.00, "high": 45.80, "low": 44.90, "close": 45.23, "volume": 1456789}
  ]
}
```

**Note:** This enhanced response includes comprehensive trading setup with entry strategy, multiple TP levels, stop loss, risk metrics, position sizing, technical indicators, and chart data for frontend visualization.

---

## Phase 3: Top Setups & Portfolio Analysis

### 3.1 Get Top Trading Setups
**Endpoint:** `POST /api/top-setups`
**Auth Required:** No

**Postman:**
- Method: POST
- URL: `http://localhost:5002/api/top-setups`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "asset_type": "stocks",
  "count": 3,
  "risk_tolerance": "medium"
}
```

**curl:**
```bash
curl -X POST http://localhost:5002/api/top-setups \
  -H "Content-Type: application/json" \
  -d '{
    "asset_type": "stocks",
    "count": 3,
    "risk_tolerance": "medium"
  }'
```

**Expected Response:**
```json
{
  "setups": [
    {
      "rank": 1,
      "symbol": "BHP.AX",
      "signal": "BUY",
      "confidence": 0.85,
      "ranking_score": 0.7823,
      "entry": {"price": 45.23, "timing": "immediate"},
      "take_profit": [...],
      "stop_loss": {...},
      "risk_metrics": {...},
      "position_sizing": {...}
    },
    {
      "rank": 2,
      "symbol": "CBA.AX",
      "signal": "BUY",
      "confidence": 0.82,
      "ranking_score": 0.7456,
      ...
    },
    {
      "rank": 3,
      "symbol": "RIO.AX",
      "signal": "SELL",
      "confidence": 0.79,
      "ranking_score": 0.7234,
      ...
    }
  ],
  "count": 3,
  "asset_type": "stocks",
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

**Ranking Algorithm:**
Setups are ranked by composite score:
- Confidence: 35% weight
- Risk/Reward Ratio: 30% weight
- Win Probability: 20% weight
- Expected Value: 15% weight
- Bonus: 10% for high confidence (>0.85) + high R/R (>3.0)

### 3.2 Analyze Portfolio
**Endpoint:** `POST /api/portfolio`
**Auth Required:** No

**Postman:**
- Method: POST
- URL: `http://localhost:5002/api/portfolio`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "symbols": ["BHP.AX", "CBA.AX", "RIO.AX"],
  "weights": [0.4, 0.35, 0.25]
}
```

**curl:**
```bash
curl -X POST http://localhost:5002/api/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["BHP.AX", "CBA.AX", "RIO.AX"],
    "weights": [0.4, 0.35, 0.25]
  }'
```

**Expected Response:**
```json
{
  "portfolio_analysis": {
    "weighted_confidence": 0.81,
    "portfolio_signal": "BUY",
    "combined_risk_reward": 2.45,
    "total_expected_value": 3.12,
    "diversification_score": 0.85
  },
  "individual_signals": [
    {"symbol": "BHP.AX", "signal": "BUY", "confidence": 0.85, "weight": 0.4},
    {"symbol": "CBA.AX", "signal": "BUY", "confidence": 0.82, "weight": 0.35},
    {"symbol": "RIO.AX", "signal": "SELL", "confidence": 0.79, "weight": 0.25}
  ],
  "recommendations": [
    "Portfolio shows strong bullish bias (2 BUY, 1 SELL)",
    "Consider rebalancing to reduce concentration risk",
    "Overall risk/reward ratio is favorable at 2.45:1"
  ],
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

### 3.3 Get Market Data
**Endpoint:** `POST /api/market-data`
**Auth Required:** No

**curl:**
```bash
curl -X POST http://localhost:5002/api/market-data \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["BHP.AX", "CBA.AX"],
    "days": 30
  }'
```

**Expected Response:**
```json
{
  "data": {
    "BHP.AX": [
      {"date": "2025-01-15", "open": 44.50, "high": 45.20, "low": 44.30, "close": 45.23, "volume": 1234567, "rsi": 52.3, "macd": 0.45},
      {"date": "2025-01-14", "open": 44.20, "high": 44.80, "low": 44.00, "close": 44.50, "volume": 1123456, "rsi": 51.8, "macd": 0.42}
    ],
    "CBA.AX": [
      ...
    ]
  },
  "symbols": ["BHP.AX", "CBA.AX"],
  "days": 30,
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

---

## Phase 4: Backend Proxy Integration

### 4.1 Test Backend Proxy - Health Check
**Endpoint:** `GET /api/rl-agent/health`
**Backend Port:** 3000

**curl:**
```bash
curl http://localhost:3000/api/rl-agent/health
```

**Expected Response:**
```json
{
  "success": true,
  "status": "healthy",
  "rl_api": {
    "status": "healthy",
    "model_loaded": true,
    "timestamp": "2025-01-15T10:30:00.000000"
  }
}
```

### 4.2 Test Backend Proxy - Predictions
**Endpoint:** `POST /api/rl-agent/predictions`
**Backend Port:** 3000

**curl:**
```bash
curl -X POST http://localhost:3000/api/rl-agent/predictions \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BHP.AX",
    "horizon": 1
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "BHP.AX",
    "signal": "BUY",
    "confidence": 0.78,
    "entry": {...},
    "take_profit": [...],
    "stop_loss": {...},
    "risk_metrics": {...},
    "position_sizing": {...},
    "indicators": {...},
    "chart_data": [...]
  }
}
```

### 4.3 Test Backend Proxy - Top Setups
**Endpoint:** `POST /api/rl-agent/top-setups`
**Backend Port:** 3000

**curl:**
```bash
curl -X POST http://localhost:3000/api/rl-agent/top-setups \
  -H "Content-Type: application/json" \
  -d '{
    "asset_type": "stocks",
    "count": 3,
    "risk_tolerance": "medium"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "setups": [
      {"rank": 1, "symbol": "BHP.AX", "signal": "BUY", "confidence": 0.85, ...},
      {"rank": 2, "symbol": "CBA.AX", "signal": "BUY", "confidence": 0.82, ...},
      {"rank": 3, "symbol": "RIO.AX", "signal": "SELL", "confidence": 0.79, ...}
    ],
    "count": 3,
    "asset_type": "stocks"
  }
}
```

---

## Common Testing Scenarios

### Scenario 1: Signal Generation Flow
1. Get prediction for BHP.AX → Receive BUY signal with TP/SL levels
2. Get prediction for BTC-USD → Receive crypto signal
3. Get prediction for EURUSD=X → Receive forex signal
4. Verify all signals have proper TP/SL levels and risk metrics

### Scenario 2: Top Setups Flow
1. Get top 3 stock setups → Receive ranked signals
2. Get top 5 crypto setups → Receive ranked crypto signals
3. Verify ranking scores are calculated correctly
4. Verify only BUY/SELL signals included (no HOLD)

### Scenario 3: Portfolio Analysis Flow
1. Analyze portfolio of 3 stocks → Receive portfolio metrics
2. Verify weighted confidence calculation
3. Check diversification score
4. Review recommendations

---

## Error Testing

### Test Missing Symbol
```bash
curl -X POST http://localhost:5002/predict \
  -H "Content-Type: application/json" \
  -d '{"market_state": [[0.1, 0.2]], "asset_type": "stock"}'
```

**Expected Response:**
```json
{
  "error": "symbol is required",
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

### Test Invalid Asset Type
```bash
curl -X POST http://localhost:5002/api/top-setups \
  -H "Content-Type: application/json" \
  -d '{"count": 3}'
```

**Expected Response:**
```json
{
  "error": "asset_type is required",
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

### Test Database Connection Failure
- Temporarily stop Azure SQL Database or use wrong credentials
- Send prediction request
- Service should return error with appropriate message

---

## Performance Testing

### Test Response Times
```bash
# Measure prediction endpoint response time
time curl -X POST http://localhost:5002/predict \
  -H "Content-Type: application/json" \
  -d '{"market_state": [[0.1, 0.2]], "symbol": "AAPL", "asset_type": "stock"}'
```

**Expected Response Time:**
- /health: < 50ms
- /predict: < 500ms (with database query)
- /api/top-setups: < 2 seconds (for 100 symbols)
- /api/portfolio: < 1 second (for 10 symbols)

---

## Success Criteria

✅ **Service Startup:**
- RL service starts on port 5002 without errors
- Health check returns 200 OK
- Model service initializes (mock mode)
- Database connection established

✅ **Prediction Functionality:**
- /predict returns comprehensive signals with TP/SL
- Signals include risk metrics and position sizing
- Technical indicators included in response
- Chart data prepared for frontend

✅ **Top Setups:**
- /api/top-setups returns ranked signals
- Ranking algorithm works correctly
- Only BUY/SELL signals included
- Proper filtering by asset type

✅ **Portfolio Analysis:**
- /api/portfolio analyzes multiple symbols
- Weighted metrics calculated correctly
- Recommendations generated

✅ **Backend Integration:**
- Backend proxy connects to RL service on port 5002
- All proxy endpoints return wrapped responses
- Health check through proxy works
- Error handling works correctly

**All tests passing = RL service ready for frontend integration!**

