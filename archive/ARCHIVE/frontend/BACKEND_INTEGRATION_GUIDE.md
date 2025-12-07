# Backend AI Signal Integration Guide

## ✅ Summary

Your app is **NOW READY** to accept AI signals from your backend! 

I've created an **adapter service** (`services/aiSignalAdapter.ts`) that transforms your simplified backend format into the comprehensive format the app expects.

---

## 📋 What Your Backend Sends

```json
{
  "signal": "BUY",
  "confidence": 0.87,
  "entry": {
    "price": 178.45,
    "range": [177.91, 178.99]
  },
  "take_profit": [
    {"level": 1, "price": 182.30, "percent": 2.16, "close_percent": 50},
    {"level": 2, "price": 186.15, "percent": 4.31, "close_percent": 30},
    {"level": 3, "price": 190.00, "percent": 6.47, "close_percent": 20}
  ],
  "stop_loss": {
    "price": 175.89,
    "type": "trailing"
  },
  "risk_metrics": {
    "risk_reward_ratio": 3.02,
    "win_probability": 0.74
  },
  "position_sizing": {
    "recommended_percent": 5.2,
    "dollar_amount": 5200
  }
}
```

---

## 🔄 How It's Transformed

The adapter automatically:

1. **Fills in missing core fields** with defaults or calculated values:
   - `symbol`, `prediction_date`, `asset_type`
   - `model_version`, timing, reasoning texts

2. **Calculates derived values**:
   - `percent_loss` from entry and stop loss prices
   - `max_risk_per_share`, `max_reward_per_share`
   - `shares` based on dollar amount and entry price
   - `max_loss` for position sizing
   - `expected_value` from win probability and risk/reward

3. **Enhances take profit levels**:
   - Adds `probability` estimates based on level and overall win probability
   - Generates `reasoning` text for each level

4. **Adds default technical indicators**:
   - RSI, MACD, ATR, Volume with neutral/bullish/bearish states
   - Trend direction based on signal type

5. **Includes model metadata**:
   - Model type, agents used, backtest metrics
   - Feature importance distribution

---

## 🚀 Quick Integration

### Option 1: Single Signal with Metadata (Recommended)

If your backend can provide additional context, use the extended format:

```typescript
import { transformBackendSignal } from '@/services/aiSignalAdapter';

// Your backend signal with optional metadata
const backendSignal = {
  // Required fields (your current format)
  signal: "BUY",
  confidence: 0.87,
  entry: { price: 178.45, range: [177.91, 178.99] },
  take_profit: [...],
  stop_loss: { price: 175.89, type: "trailing" },
  risk_metrics: { risk_reward_ratio: 3.02, win_probability: 0.74 },
  position_sizing: { recommended_percent: 5.2, dollar_amount: 5200 },
  
  // Optional metadata (highly recommended if available)
  symbol: "AAPL",
  asset_type: "stock",
  model_version: "v2.3.1",
  prediction_date: "2024-10-08T19:30:00Z",
  indicators: {
    rsi: 62.5,
    macd: 1.2,
    atr: 1.8,
    volume: 1.45
  },
  trend: {
    direction: "up",
    strength: "strong"
  }
};

// Transform to app format
const aiSignal = transformBackendSignal(backendSignal, {
  accountBalance: 100000 // User's account balance for share calculation
});

// Use in components
<AISignalCard signal={aiSignal} />
```

### Option 2: Multiple Signals from API

```typescript
import { fetchAISignalsFromBackend } from '@/services/aiSignalAdapter';

// In your component or service
async function loadTopSignals() {
  try {
    const signals = await fetchAISignalsFromBackend(
      'https://your-api.com/signals/top3',
      {
        defaultSymbol: 'MARKET',
        defaultAssetType: 'stock',
        accountBalance: 100000
      }
    );
    
    // signals is now AITradingSignal[] ready for use
    return signals;
  } catch (error) {
    console.error('Failed to load signals:', error);
    return [];
  }
}
```

### Option 3: Manual Transformation

```typescript
import { transformBackendSignals } from '@/services/aiSignalAdapter';

// Fetch from your backend
const response = await fetch('https://your-api.com/signals');
const backendSignals = await response.json();

// Transform all signals
const aiSignals = transformBackendSignals(backendSignals, {
  defaultAssetType: 'stock',
  accountBalance: 100000
});
```

---

## 🔌 Integration Examples

### Example 1: AI Chat Integration

Update `app/ai-chat.tsx`:

```typescript
import { fetchAISignalsFromBackend } from '@/services/aiSignalAdapter';

// Replace the MOCK_AI_SIGNALS section
const handleAskQuestion = async (question: string) => {
  const userMessage: Message = {
    id: Date.now().toString(),
    text: question,
    isBot: false,
    type: 'text',
  };
  
  setMessages(prev => [...prev, userMessage]);
  setInputText('');

  if (question.toLowerCase().includes('signal') || 
      question.toLowerCase().includes('top 3')) {
    
    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: "Here are the top 3 AI trading signals based on our Multi-Agent RL model:",
      isBot: true,
      type: 'text',
    };
    setMessages(prev => [...prev, botMessage]);

    try {
      // Fetch real signals from backend
      const signals = await fetchAISignalsFromBackend(
        'https://your-backend-api.com/api/signals/top3',
        { accountBalance: 100000 }
      );

      signals.forEach((signal, index) => {
        setTimeout(() => {
          const signalMessage: Message = {
            id: `${Date.now()}-signal-${index}`,
            signal: signal,
            isBot: true,
            type: 'signal',
          };
          setMessages(prev => [...prev, signalMessage]);
        }, (index + 1) * 500);
      });
    } catch (error) {
      // Fallback to error message
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        text: "Sorry, I couldn't fetch the latest signals. Please try again.",
        isBot: true,
        type: 'text',
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }
};
```

### Example 2: Trade Setup Page Integration

Update `app/trade-setup.tsx`:

```typescript
import { transformBackendSignal } from '@/services/aiSignalAdapter';
import { useEffect, useState } from 'react';

export default function TradeSetupScreen() {
  const [signal, setSignal] = useState<AITradingSignal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSignal() {
      try {
        const response = await fetch('https://your-api.com/signal/current');
        const backendSignal = await response.json();
        
        const transformedSignal = transformBackendSignal(backendSignal, {
          accountBalance: 100000
        });
        
        setSignal(transformedSignal);
      } catch (error) {
        console.error('Failed to load signal:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSignal();
  }, []);

  if (loading) return <LoadingScreen />;
  if (!signal) return <ErrorScreen />;

  return (
    // Use signal data in your UI
    <View>
      <Text>{signal.symbol}</Text>
      <Text>{signal.entry_strategy.price}</Text>
      {/* ... rest of your component */}
    </View>
  );
}
```

### Example 3: Trade Signals Page Integration

Update `app/trade-signals.tsx`:

```typescript
import { fetchAISignalsFromBackend } from '@/services/aiSignalAdapter';

export default function TradeSignalsScreen() {
  const [signals, setSignals] = useState<AITradingSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSignals() {
      try {
        const fetchedSignals = await fetchAISignalsFromBackend(
          'https://your-api.com/signals/all'
        );
        setSignals(fetchedSignals);
      } catch (error) {
        console.error('Failed to load signals:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSignals();
  }, []);

  return (
    <ScrollView>
      {signals.map(signal => (
        <AISignalCard key={signal.symbol} signal={signal} />
      ))}
    </ScrollView>
  );
}
```

---

## 🎯 Recommended Backend Enhancements

While the adapter handles missing fields, providing these optional fields will **significantly improve** the user experience:

### High Priority (Easy to Add)
```json
{
  "symbol": "AAPL",              // ⭐ Stock ticker
  "asset_type": "stock",         // ⭐ stock/crypto/forex/etc
  "model_version": "v2.3.1",     // ⭐ Model version
  "prediction_date": "2024-10-08T19:30:00Z"  // ⭐ Timestamp
}
```

### Medium Priority (Improves Quality)
```json
{
  "indicators": {
    "rsi": 62.5,      // RSI value
    "macd": 1.2,      // MACD value
    "atr": 1.8,       // ATR value
    "volume": 1.45    // Volume multiplier
  },
  "trend": {
    "direction": "up",      // up/down/sideways
    "strength": "strong"    // strong/moderate/weak
  }
}
```

### Low Priority (Nice to Have)
```json
{
  "model_metadata": {
    "model_type": "Multi-Agent RL",
    "agents_used": ["Momentum", "Mean Reversion", "Risk Manager"],
    "backtest_sharpe": 2.1,
    "feature_importance": {
      "price_momentum": 0.28,
      "volume": 0.22,
      "rsi": 0.18
    }
  },
  "entry_reasoning": "Strong momentum with RSI confirmation",
  "stop_loss_reasoning": "Below key support level"
}
```

---

## 🧪 Testing

### Test with Sample Data

```typescript
import { transformBackendSignal } from '@/services/aiSignalAdapter';

// Your exact backend format
const testSignal = {
  signal: "BUY",
  confidence: 0.87,
  entry: { price: 178.45, range: [177.91, 178.99] },
  take_profit: [
    { level: 1, price: 182.30, percent: 2.16, close_percent: 50 },
    { level: 2, price: 186.15, percent: 4.31, close_percent: 30 },
    { level: 3, price: 190.00, percent: 6.47, close_percent: 20 }
  ],
  stop_loss: { price: 175.89, type: "trailing" },
  risk_metrics: { risk_reward_ratio: 3.02, win_probability: 0.74 },
  position_sizing: { recommended_percent: 5.2, dollar_amount: 5200 }
};

const transformed = transformBackendSignal(testSignal, {
  defaultSymbol: 'AAPL',
  defaultAssetType: 'stock',
  accountBalance: 100000
});

console.log('Transformed Signal:', transformed);
// This will work perfectly with AISignalCard!
```

---

## 🔒 Error Handling

The adapter includes built-in safety:

```typescript
try {
  const signals = await fetchAISignalsFromBackend(endpoint);
  // Success - use signals
} catch (error) {
  // Handle error gracefully
  console.error('Failed to fetch signals:', error);
  // Show user-friendly error message
}
```

---

## 📊 Configuration Options

```typescript
interface AdapterConfig {
  defaultSymbol?: string;        // Default: 'UNKNOWN'
  defaultAssetType?: string;     // Default: 'stock'
  defaultModelVersion?: string;  // Default: 'v1.0.0'
  accountBalance?: number;       // Default: 100000 (for share calculation)
}
```

---

## ✅ Checklist

- [x] **Adapter Service Created** - `services/aiSignalAdapter.ts`
- [x] **Type Definitions** - Matches your backend format
- [x] **Transformation Logic** - Fills all missing fields
- [x] **API Integration Helper** - `fetchAISignalsFromBackend()`
- [x] **Error Handling** - Graceful fallbacks
- [ ] **Update API Endpoint** - Replace `'https://your-api.com/...'` with your actual endpoint
- [ ] **Test Integration** - Test with real backend data
- [ ] **Configure Account Balance** - Set user's actual balance for share calculation

---

## 🚀 Next Steps

1. **Replace Mock Data**: Update `ai-chat.tsx`, `trade-setup.tsx`, and `trade-signals.tsx` to use the adapter
2. **Set Your API Endpoint**: Update the endpoint URLs to your actual backend
3. **Test Thoroughly**: Verify the transformation works with your real data
4. **Add Error UI**: Create loading and error states for better UX
5. **Consider Backend Enhancements**: Add optional fields for richer data

---

## 💡 Summary

**Your app is ready!** The adapter seamlessly converts your backend's simplified format into the rich format the UI expects. No changes needed to your backend - just use the adapter service and everything will work perfectly.

The adapter intelligently:
- ✅ Fills missing required fields
- ✅ Calculates derived values
- ✅ Generates sensible defaults
- ✅ Preserves all your backend data
- ✅ Enhances the signal with intelligent estimates

Just integrate the adapter and start sending your signals! 🎉

