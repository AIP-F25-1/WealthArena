# WealthArena - AI Trading Education Platform

A comprehensive trading education platform with AI-powered chat, sentiment analysis, and financial data integration.

## 🚀 Quick Setup

### 1. Environment Setup
```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Run the API Server
```bash
python -m uvicorn app.main:app --reload
```

The API will be available at: `http://localhost:8000`

## 📡 API Endpoints

### Chat with AI Assistant
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/v1/chat" -Method POST -ContentType "application/json" -Body '{"message": "What is a P/E ratio?"}'

# curl
curl -X POST "http://localhost:8000/v1/chat" -H "Content-Type: application/json" -d '{"message": "What is a P/E ratio?"}'
```

### Get Stock Prices
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/v1/chat" -Method POST -ContentType "application/json" -Body '{"message": "price AAPL"}'

# curl
curl -X POST "http://localhost:8000/v1/chat" -H "Content-Type: application/json" -d '{"message": "price AAPL"}'
```

### Sentiment Analysis
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/v1/chat" -Method POST -ContentType "application/json" -Body '{"message": "analyze: The stock market is performing well today"}'

# curl
curl -X POST "http://localhost:8000/v1/chat" -H "Content-Type: application/json" -d '{"message": "analyze: The stock market is performing well today"}'
```

## 📊 Metrics & Monitoring

### API Metrics
```bash
# Basic API metrics (if implemented)
GET http://localhost:8000/v1/metrics/basic

# RSS scraping metrics
GET http://localhost:8000/v1/metrics/rss
```

### View Metrics
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:8000/v1/metrics/rss" -Method GET

# curl
curl -X GET "http://localhost:8000/v1/metrics/rss"
```

## 🧪 Testing

### Run Tests with Coverage
```bash
# Install test dependencies (if not already installed)
pip install pytest pytest-cov

# Run tests with coverage
pytest --cov=app --cov-report xml
```

### View Coverage Report
- XML report: `coverage.xml`
- HTML report: `pytest --cov=app --cov-report html` (creates `htmlcov/` directory)

## 🤖 Machine Learning Models

### Train Sentiment Analysis Model
1. Open Jupyter notebook:
   ```bash
   jupyter notebook notebooks/02_finetune_sentiment.ipynb
   ```

2. Run all cells to train the DistilBERT sentiment model

3. Copy trained model to API:
   ```bash
   # The notebook saves to models/sentiment-finetuned/
   # The API automatically loads from this location
   ```

### Train Intent Classification Model
1. Open Jupyter notebook:
```bash
   jupyter notebook notebooks/03_finetune_intent.ipynb
   ```

2. Run all cells to train the intent classification model

3. Model saves to `models/intent-finetuned/`

## 📈 Progress Reporting Metrics

### API Performance Metrics
- **Response Time**: Average API response time (ms)
- **Error Rate**: Percentage of failed requests
- **Throughput**: Requests per minute
- **Uptime**: Service availability percentage

### Machine Learning Metrics
- **Accuracy**: Model prediction accuracy (%)
- **F1-Score**: Macro-averaged F1 score
- **Inference Time**: Model prediction speed (ms)
- **Training Loss**: Model training convergence

### Code Quality Metrics
- **Test Coverage**: Percentage of code covered by tests
- **SonarQube Score**: Code quality and security rating
- **Linting Score**: Code style compliance
- **Documentation Coverage**: API and code documentation completeness

### RSS Scraping Metrics
- **Success Rate**: Percentage of successful RSS fetches
- **Pages per Minute**: RSS feed processing throughput
- **Error Rate**: Failed RSS requests percentage
- **Response Time**: Average RSS fetch time

## 🏗️ Project Structure

```
WealthArena/
├── app/                    # FastAPI application
│   ├── api/               # API endpoints
│   ├── models/            # ML model wrappers
│   ├── tools/             # Utility tools (prices, news)
│   └── main.py           # Application entry point
├── notebooks/             # Jupyter notebooks for ML training
├── models/               # Trained ML models
├── data/                 # Training data
└── requirements.txt      # Python dependencies
```

## 🔧 Environment Variables

Create a `.env` file in the project root:

```env
# LLM Configuration (Groq API - Free)
GROQ_API_KEY=your_groq_api_key_here

# Optional: Other API keys
OPENAI_API_KEY=your_openai_key_here
```

## 🚨 Troubleshooting

### Common Issues

1. **Import Errors**: Make sure virtual environment is activated and dependencies installed
2. **Model Not Found**: Train the sentiment model using the notebook first
3. **API Connection**: Ensure server is running on correct port (8000)
4. **RSS Errors**: Some feeds may be blocked - this is normal and tracked in metrics

### Health Check
```bash
# Check if API is running
curl http://localhost:8000/healthz
```

## 📚 Additional Resources

- **API Documentation**: Visit `http://localhost:8000/docs` when server is running
- **Jupyter Notebooks**: Detailed ML training examples in `notebooks/`
- **Model Metrics**: Check `metrics_*.json` files for training results

---

**Happy Trading! 📈🤖**