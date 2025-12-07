# Data Pipeline Master Plan
## Complete Removal of Mock Data & Data Flow Integration

**Last Updated:** 2024-11-18  
**Status:** In Progress

---

## 🎯 **OBJECTIVE**

Remove ALL mock data from the application and ensure real data flows from:
1. **Data Sources** → **Database** → **Backend APIs** → **Frontend/RL Models/Games**

---

## 📊 **DATA SOURCES**

### 1. **Market Data Sources** (Priority: HIGH)
- ✅ **Alpha Vantage API** - Stock prices, OHLC data
- ✅ **yfinance** (via chatbot API) - Real-time market data
- ✅ **Database** (`data-pipeline/data/raw`) - S&P 500 historical data
- ⚠️ **Daily Data Update Scheduler** - Needs verification

### 2. **News Data Sources** (Priority: HIGH)
- ✅ **Alpha Vantage News & Sentiment API** - Daily/weekly news with dates
- ⚠️ **NewsAPI.org** - Fallback (if needed)
- ⚠️ **RSS Feeds** - For additional sources

### 3. **Trading Signals** (Priority: HIGH)
- ✅ **RL Backend** (`/api/top-setups`) - AI-generated signals
- ✅ **Backend API** (`/api/signals/top`) - Historical signals
- ⚠️ **Database Signals Table** - Needs verification

---

## 🔄 **DATA FLOW ARCHITECTURE**

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Alpha Vantage│  │   yfinance   │  │   Database   │     │
│  │   (API)      │  │  (Chatbot)   │  │  (Raw CSV)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              DATA PIPELINE (Backend)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Daily Data Update Scheduler (Cron Job)              │  │
│  │  - Fetches from sources                               │  │
│  │  - Processes and stores in database                  │  │
│  │  - Updates MarketData & CandleData tables             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ MarketData  │  │  CandleData   │  │   Signals    │     │
│  │   Table     │  │    Table      │  │    Table     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Backend    │ │  RL Backend  │ │   Frontend   │
│     API      │ │   (Inference)│ │   (Display)  │
│              │ │              │ │              │
│ /api/market  │ │ /api/top-    │ │ Opportunities│
│ /api/signals │ │  setups      │ │ Dashboard    │
│ /api/news    │ │              │ │ Games        │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## ✅ **COMPLETED FIXES**

### 1. **News Service** ✅
- ✅ Integrated Alpha Vantage News API
- ✅ Added `getDailyNews()` and `getWeeklyNews()` methods
- ✅ Proper date parsing from Alpha Vantage format (`YYYYMMDDTHHMMSS`)
- ✅ Category, sentiment, and impact mapping
- ✅ Fallback to mock data only when API fails

### 2. **Opportunities Page** ✅
- ✅ Removed mock random change calculation
- ✅ Now fetches from RL backend (`/api/top-setups`)
- ✅ Falls back to backend signals (`/api/signals/top`)
- ✅ Final fallback uses real market data (not mock)
- ✅ Calculates real price changes from market data

### 3. **Alpha Vantage Service** ✅
- ✅ Added `getNews()` method for Alpha Vantage News & Sentiment API
- ✅ Added `getDailyNews()` for last 24 hours
- ✅ Added `getWeeklyNews()` for last 7 days
- ✅ Proper error handling and rate limit detection

### 4. **Syntax Error** ✅
- ✅ Fixed syntax error in `lesson-detail.tsx` (extra blank line)

---

## 🔧 **REMAINING TASKS**

### **HIGH PRIORITY**

#### 1. **Verify Daily Data Update Scheduler**
- [ ] Check if `dailyDataUpdateScheduler.ts` is running
- [ ] Verify it's updating `MarketData` and `CandleData` tables
- [ ] Ensure it reads from `data-pipeline/data/raw` folder
- [ ] Test cron job execution

#### 2. **Remove Mock Data from All Services**
- [ ] `portfolioService.ts` - Remove hardcoded portfolio items
- [ ] `newsService.ts` - Keep mock as fallback only (already done)
- [ ] `alphaVantageService.ts` - Remove `generateMockData()` or make it last resort
- [ ] `marketDataService.ts` - Verify no mock data

#### 3. **Ensure Data Flows to Games**
- [ ] Verify `game-play.tsx` uses real historical data
- [ ] Check if game uses `chatbot/v1/market/ohlc` endpoint
- [ ] Ensure price simulation uses real data, not random

#### 4. **Ensure Data Flows to RL Inference**
- [ ] Verify `rl-training/backend/main.py` uses `LiveDataService`
- [ ] Check if RL models receive real market data
- [ ] Ensure technical indicators are calculated from real data

#### 5. **Backend API Data Verification**
- [ ] Verify `/api/market-data` endpoints return real data
- [ ] Check `/api/signals/top` returns real signals from database
- [ ] Ensure `/api/portfolio` uses real user portfolio data

---

### **MEDIUM PRIORITY**

#### 6. **Dashboard Data**
- [ ] Verify dashboard uses real S&P 500 data
- [ ] Check news feed uses Alpha Vantage news
- [ ] Ensure portfolio values are calculated from real prices

#### 7. **Trade Signals Page**
- [ ] Verify AI signals come from RL backend
- [ ] Check legacy signals come from database
- [ ] Ensure charts display real data

#### 8. **Portfolio Builder**
- [ ] Verify available assets come from database
- [ ] Check asset prices are real-time
- [ ] Ensure portfolio calculations use real data

---

### **LOW PRIORITY**

#### 9. **Analytics Page**
- [ ] Verify analytics use real portfolio data
- [ ] Check performance metrics are calculated correctly

#### 10. **Risk Dashboard**
- [ ] Verify risk calculations use real positions
- [ ] Check exposure metrics are accurate

---

## 📝 **IMPLEMENTATION CHECKLIST**

### **Phase 1: Data Source Verification** (Current)
- [x] Alpha Vantage News API integrated
- [x] Opportunities page uses real signals
- [ ] Daily data scheduler verified
- [ ] Database tables populated

### **Phase 2: Service Layer Cleanup**
- [ ] Remove all hardcoded mock data
- [ ] Ensure all services have proper fallbacks
- [ ] Add error logging for data fetch failures

### **Phase 3: Frontend Integration**
- [ ] Verify all pages use real data
- [ ] Remove mock data displays
- [ ] Add loading states for data fetching

### **Phase 4: RL & Game Integration**
- [ ] Verify RL models receive real data
- [ ] Ensure games use historical data
- [ ] Test inference with real market conditions

### **Phase 5: Testing & Validation**
- [ ] Test all data flows end-to-end
- [ ] Verify no mock data appears in production
- [ ] Performance testing with real data volumes

---

## 🚨 **CRITICAL FILES TO REVIEW**

### **Frontend Services**
1. `frontend/services/portfolioService.ts` - Remove hardcoded portfolio
2. `frontend/services/newsService.ts` - ✅ Already fixed
3. `frontend/services/alphaVantageService.ts` - ✅ News added
4. `frontend/services/marketDataService.ts` - Verify no mock data

### **Backend Services**
1. `backend/src/services/dailyDataUpdateScheduler.ts` - Verify running
2. `backend/src/routes/market-data.ts` - Verify real data
3. `backend/src/routes/signals.ts` - Verify database queries

### **RL Backend**
1. `rl-training/backend/live_data_service.py` - ✅ Already uses real data
2. `rl-training/backend/main.py` - Verify data flow

### **Frontend Pages**
1. `frontend/app/(tabs)/opportunities.tsx` - ✅ Already fixed
2. `frontend/app/(tabs)/dashboard.tsx` - Verify real data
3. `frontend/app/game-play.tsx` - Verify historical data
4. `frontend/app/trade-signals.tsx` - Verify real signals

---

## 📋 **TESTING PROCEDURE**

### **1. News Data Test**
```bash
# Test Alpha Vantage news
curl "https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=earnings&time_from=20241101T0000&limit=10&apikey=YOUR_KEY"
```

### **2. Market Data Test**
```bash
# Test backend market data endpoint
curl "http://localhost:3000/api/market-data/ohlc?symbol=AAPL&period=1mo"
```

### **3. Signals Test**
```bash
# Test RL backend signals
curl "http://localhost:5002/api/top-setups?asset_type=stocks&limit=5"

# Test backend signals
curl "http://localhost:3000/api/signals/top?limit=5"
```

### **4. Opportunities Test**
- Open opportunities page
- Verify no "random" changes
- Check data comes from RL/backend
- Verify charts show real data

---

## 🔍 **MONITORING & LOGGING**

### **Key Metrics to Monitor**
1. **Data Fetch Success Rate** - Should be > 95%
2. **API Response Times** - Alpha Vantage can be slow
3. **Fallback Usage** - Should be minimal
4. **Database Update Frequency** - Daily at minimum

### **Error Logging**
- Log all API failures
- Log when fallback data is used
- Alert on consecutive failures

---

## 📅 **TIMELINE**

- **Week 1:** Complete Phase 1 & 2 (Data verification & service cleanup)
- **Week 2:** Complete Phase 3 & 4 (Frontend & RL integration)
- **Week 3:** Complete Phase 5 (Testing & validation)

---

## ✅ **SUCCESS CRITERIA**

1. ✅ No mock data in production
2. ✅ All data sources verified and working
3. ✅ Data flows to all components (app, inference, games)
4. ✅ Proper fallbacks in place
5. ✅ Error handling and logging implemented
6. ✅ Performance acceptable with real data

---

## 📞 **SUPPORT & QUESTIONS**

If you encounter issues:
1. Check error logs in console
2. Verify API keys are set
3. Check database connectivity
4. Verify cron jobs are running
5. Review this document for data flow

---

**Last Review:** 2024-11-18  
**Next Review:** After Phase 1 completion

