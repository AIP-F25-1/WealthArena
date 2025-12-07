# WealthArena Frontend Configuration Update

## Deployment Summary
- **Backend URL**: https://wealtharena-backend-dev.azurewebsites.net
- **Chatbot URL**: https://wealtharena-chatbot-dev.azurewebsites.net
- **Updated**: 2025-10-23 23:04:04

## Files Created/Updated
1. **WealthArena/config/apiConfig.ts** - API configuration
2. **WealthArena/.env** - Environment variables
3. **WealthArena/services/apiService.js** - API service layer
4. **WealthArena/components/ApiTestComponent.js** - API testing component

## Next Steps
1. Import and use ApiTestComponent in your main app
2. Test API connectivity
3. Integrate API calls into your existing components
4. Update your app to use the new API service

## API Endpoints Available
- Backend Health: https://wealtharena-backend-dev.azurewebsites.net/healthz
- Top Signals: https://wealtharena-backend-dev.azurewebsites.net/api/signals/top
- Market Data: https://wealtharena-backend-dev.azurewebsites.net/api/market/{symbol}
- Portfolio: https://wealtharena-backend-dev.azurewebsites.net/api/portfolio/{user_id}
- Analytics: https://wealtharena-backend-dev.azurewebsites.net/api/analytics/performance
- Chatbot Health: https://wealtharena-chatbot-dev.azurewebsites.net/healthz
- Chat: https://wealtharena-chatbot-dev.azurewebsites.net/api/chat
- Knowledge: https://wealtharena-chatbot-dev.azurewebsites.net/api/knowledge/categories

## Usage Example
`javascript
import apiService from './services/apiService';

// Get top trading signals
const signals = await apiService.getTopSignals(10);

// Chat with bot
const response = await apiService.chatWithBot('What is RSI?');

// Get market data
const marketData = await apiService.getMarketData('AAPL', 30);
`
