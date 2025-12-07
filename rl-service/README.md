# WealthArena RL Inference Service

The RL inference service provides REST API endpoints for generating trading signals using reinforcement learning models. It serves as the core AI engine for the WealthArena platform, processing market data and generating actionable trading recommendations.

## Prerequisites

- **Python 3.11+** (Python 3.13 supported)
- **Azure SQL Database** with `processed_prices` table populated (from Phase 2)
- **Model Checkpoints** (optional until Phase 7 - service works with mock predictions)
- **Environment Variables** configured (see Configuration section)

## Installation

### 1. Install Dependencies

```bash
cd rl-service
pip install -r requirements.txt
```

**Key Dependencies:**
- Flask 3.0.0 - Web framework
- PyTorch 2.6.0+ - Deep learning framework
- pandas, numpy - Data processing
- psycopg2-binary - PostgreSQL/Azure SQL connectivity
- google-cloud-storage - GCS model loading (optional)
- prometheus-client - Metrics collection

### 2. Configure Environment

Create a `.env` file in the `rl-service/` directory:

```env
# Database Configuration
DB_TYPE=postgres
DB_HOST=your-server.database.windows.net
DB_NAME=wealtharena_db
DB_USER=your-username
DB_PASSWORD=your-password
DB_PORT=1433

# Service Configuration
PORT=5002
HOST=0.0.0.0
LOG_LEVEL=INFO

# Model Configuration
MODEL_PATH=../../wealtharena_rl/checkpoints/latest
MODEL_MODE=mock  # Use 'production' when models are trained

# GCS Configuration (Optional - for cloud model loading)
GCS_BUCKET=wealtharena-models
GCS_MODEL_PREFIX=latest/

# Azure Storage (Optional - for Azure Blob Storage model loading)
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
```

**Note**: Until Phase 7 (model training) completes, the service operates in mock mode and generates predictions without requiring trained models.

## Running Locally

### Option 1: Using the Batch Script (Windows)

```bash
run_rl_service.bat
```

### Option 2: Direct Python Execution

```bash
cd rl-service/api
python inference_server.py
```

### Option 3: Using Flask Development Server

```bash
cd rl-service/api
flask --app inference_server:app run --port 5002
```

### Service Startup

The service will start on **port 5002** by default (configurable via `PORT` environment variable).

**Expected Output:**
```
Initializing RL inference server...
RL inference server initialized
Starting RL inference server on 0.0.0.0:5002
```

**Health Check:**
```bash
curl http://localhost:5002/health
```

## Key Endpoints

### Health & Status

#### `GET /health`
Health check endpoint. Returns service status and model loading state.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

#### `GET /model/info`
Returns information about the loaded model.

**Response:**
```json
{
  "model_path": "../../wealtharena_rl/checkpoints/latest",
  "model_loaded": true,
  "model_type": "PPO",
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

### Prediction Endpoints

#### `POST /predict`
Generate trading signals for a specific symbol.

**Request:**
```json
{
  "market_state": [[0.1, 0.2, 0.3, 0.4, 0.5]],
  "symbol": "BHP.AX",
  "asset_type": "stock"
}
```

**Response:**
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
    }
  ],
  "stop_loss": {
    "price": 43.15,
    "percent": -4.60,
    "type": "fixed"
  },
  "risk_metrics": {
    "risk_reward_ratio": 2.35,
    "max_risk_per_share": 2.08,
    "win_probability": 0.66
  },
  "position_sizing": {
    "recommended_percent": 4.5,
    "dollar_amount": 4500.00,
    "method": "Kelly Criterion + Volatility Adjusted"
  },
  "indicators": {
    "rsi": {"value": 52.3, "status": "neutral"},
    "macd": {"value": 0.45, "status": "bullish"}
  },
  "chart_data": [...]
}
```

### Top Setups & Portfolio Analysis

#### `POST /api/top-setups`
Get top-ranked trading setups for an asset type.

**Request:**
```json
{
  "asset_type": "stocks",
  "count": 3,
  "risk_tolerance": "medium"
}
```

**Response:**
```json
{
  "setups": [
    {
      "rank": 1,
      "symbol": "BHP.AX",
      "signal": "BUY",
      "confidence": 0.85,
      "ranking_score": 0.7823,
      "entry": {...},
      "take_profit": [...],
      "stop_loss": {...}
    }
  ],
  "count": 3,
  "asset_type": "stocks",
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

#### `POST /api/portfolio`
Analyze a portfolio of symbols.

**Request:**
```json
{
  "symbols": ["BHP.AX", "CBA.AX", "RIO.AX"],
  "weights": [0.4, 0.35, 0.25]
}
```

**Response:**
```json
{
  "portfolio_analysis": {
    "weighted_confidence": 0.81,
    "portfolio_signal": "BUY",
    "combined_risk_reward": 2.45,
    "total_expected_value": 3.12,
    "diversification_score": 0.85
  },
  "individual_signals": [...],
  "recommendations": [...],
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

#### `POST /api/market-data`
Get market data for symbols.

**Request:**
```json
{
  "symbols": ["BHP.AX", "CBA.AX"],
  "days": 30
}
```

### Metrics Endpoints

#### `GET /api/metrics/summary`
Get service metrics summary (request counts, response times, error rates).

## Integration with Backend

The RL service integrates with the backend API through proxy endpoints:

### Backend Proxy Endpoints

The backend service (running on port 3000) provides proxy endpoints that forward requests to the RL service:

- `GET /api/rl-agent/health` - Health check through backend
- `POST /api/rl-agent/predictions` - Get predictions through backend
- `POST /api/rl-agent/top-setups` - Get top setups through backend

**Backend Configuration:**
The backend connects to the RL service at `http://localhost:5002` (configurable via backend environment variables).

**Example Backend Request:**
```bash
curl -X POST http://localhost:3000/api/rl-agent/predictions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "symbol": "BHP.AX",
    "horizon": 1
  }'
```

## Testing

For comprehensive testing instructions, see [TESTING_GUIDE.md](TESTING_GUIDE.md).

**Quick Test:**
```bash
# Health check
curl http://localhost:5002/health

# Generate prediction
curl -X POST http://localhost:5002/predict \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BHP.AX",
    "asset_type": "stock"
  }'
```

## Deployment

### Docker Deployment

Build and run using Docker:

```bash
docker build -t rl-service .
docker run -p 5002:5002 --env-file .env rl-service
```

### Google Cloud Platform (GCP)

The service includes `app.yaml` for GCP App Engine deployment:

```bash
gcloud app deploy app.yaml
```

**GCP Configuration:**
- Runtime: Python 3.11
- Service: rl-service
- Auto-scaling: 0-2 instances
- Cloud SQL connection for database
- GCS bucket for model storage

## Architecture

```
RL Service
├── api/
│   ├── inference_server.py    # Main Flask application
│   ├── db_connector.py         # Database connectivity
│   ├── gcs_model_loader.py     # GCS model loading
│   └── metrics.py              # Metrics collection
├── requirements.txt             # Python dependencies
├── app.yaml                     # GCP deployment config
├── Dockerfile                   # Docker configuration
└── TESTING_GUIDE.md             # Testing documentation
```

## Troubleshooting

### Service Won't Start

1. **Check Python version**: Ensure Python 3.11+ is installed
2. **Verify dependencies**: Run `pip install -r requirements.txt`
3. **Check port availability**: Ensure port 5002 is not in use
4. **Verify .env file**: Ensure all required environment variables are set

### Database Connection Issues

1. **Check firewall rules**: Ensure Azure SQL firewall allows your IP
2. **Verify credentials**: Check DB_HOST, DB_USER, DB_PASSWORD in `.env`
3. **Test connectivity**: Use `sqlcmd` or Azure Data Studio to verify connection

### Model Loading Issues

- **Mock Mode**: Until Phase 7, the service operates in mock mode and doesn't require trained models
- **Model Path**: Verify `MODEL_PATH` points to correct checkpoint directory
- **GCS Access**: If using GCS, ensure service account has storage access

### Performance Issues

- **Database Queries**: Large symbol queries may be slow - consider caching
- **Model Inference**: Production models may require GPU for optimal performance
- **Concurrent Requests**: Use gunicorn with multiple workers for production

## Additional Resources

- **Testing Guide**: [TESTING_GUIDE.md](TESTING_GUIDE.md) - Comprehensive testing instructions
- **API Documentation**: [docs/api/RL_SERVICE_API.md](../docs/api/RL_SERVICE_API.md) - Full API reference
- **Backend Integration**: [backend/README.md](../backend/README.md) - Backend service documentation

## Support

For issues or questions:
1. Check [TESTING_GUIDE.md](TESTING_GUIDE.md) for common issues
2. Review backend logs for proxy-related errors
3. Verify database connectivity and model availability

