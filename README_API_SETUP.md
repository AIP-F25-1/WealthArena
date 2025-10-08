# API Configuration Guide

## Secure API Key Setup

### 📁 File Structure
```
WealthArena/
├── config/
│   ├── apiKeys.ts          # Your actual API keys (GITIGNORED)
│   └── apiKeys.example.ts  # Example template
└── .gitignore              # Configured to exclude apiKeys.ts
```

### 🔐 Your API Key
- **Alpha Vantage API Key**: `5EM9TXSMLJDD83Z8`

### ✅ Setup Complete
The API key is already configured in `config/apiKeys.ts`

### 🚫 Security Notice
- ✅ `config/apiKeys.ts` is added to `.gitignore`
- ✅ This file will **NOT** be committed to GitHub
- ✅ Safe to use in development

### 📝 How to Use

#### In Your Components:
```typescript
import { getAlphaVantageKey } from '@/config/apiKeys';

// Fetch stock data
const fetchStockData = async (symbol: string) => {
  const apiKey = getAlphaVantageKey();
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  return data;
};
```

### 🔧 For Team Members
1. Copy `config/apiKeys.example.ts` to `config/apiKeys.ts`
2. Add your own Alpha Vantage API key
3. The file is automatically gitignored

### 📚 Alpha Vantage API Documentation
- **Docs**: https://www.alphavantage.co/documentation/
- **Rate Limit**: 5 API calls per minute (free tier)
- **25 calls per day** (free tier)

### 🎯 Available Endpoints
```typescript
// Intraday data (1min, 5min, 15min, 30min, 60min)
TIME_SERIES_INTRADAY

// Daily data
TIME_SERIES_DAILY

// Weekly data
TIME_SERIES_WEEKLY

// Monthly data
TIME_SERIES_MONTHLY

// Quote endpoint (latest price)
GLOBAL_QUOTE

// Search symbols
SYMBOL_SEARCH
```

### 📊 Example API Call
```bash
https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=AAPL&interval=5min&apikey=5EM9TXSMLJDD83Z8
```

## ⚠️ Important
- Never commit `config/apiKeys.ts` to GitHub
- For production, use environment variables
- Keep API keys secure and private

