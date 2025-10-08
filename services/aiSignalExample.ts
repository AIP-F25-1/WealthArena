/**
 * Example: How Your Backend Signal Gets Transformed
 * 
 * This file demonstrates the exact transformation of your backend format
 * to the app's expected format.
 */

import { transformBackendSignal, BackendAISignal } from './aiSignalAdapter';

// ============================================
// YOUR EXACT BACKEND FORMAT
// ============================================
const yourBackendSignal: BackendAISignal = {
  signal: "BUY",
  confidence: 0.87,
  entry: {
    price: 178.45,
    range: [177.91, 178.99]
  },
  take_profit: [
    { level: 1, price: 182.30, percent: 2.16, close_percent: 50 },
    { level: 2, price: 186.15, percent: 4.31, close_percent: 30 },
    { level: 3, price: 190.00, percent: 6.47, close_percent: 20 }
  ],
  stop_loss: {
    price: 175.89,
    type: "trailing"
  },
  risk_metrics: {
    risk_reward_ratio: 3.02,
    win_probability: 0.74
  },
  position_sizing: {
    recommended_percent: 5.2,
    dollar_amount: 5200
  }
};

// ============================================
// TRANSFORMATION
// ============================================
const transformedSignal = transformBackendSignal(yourBackendSignal, {
  defaultSymbol: 'AAPL',      // You should pass this from your backend
  defaultAssetType: 'stock',   // Or this
  accountBalance: 100000       // User's account balance
});

// ============================================
// RESULT
// ============================================
console.log('✅ Your Backend Signal Has Been Transformed!');
console.log('\n📤 Input (Your Backend):');
console.log(JSON.stringify(yourBackendSignal, null, 2));

console.log('\n📥 Output (App Format):');
console.log(JSON.stringify(transformedSignal, null, 2));

console.log('\n✨ Calculated Values:');
console.log(`- Percent Loss: ${transformedSignal.stop_loss.percent_loss.toFixed(2)}%`);
console.log(`- Shares: ${transformedSignal.position_sizing.shares}`);
console.log(`- Max Loss: $${transformedSignal.position_sizing.max_loss.toFixed(2)}`);
console.log(`- Expected Value: $${transformedSignal.risk_management.expected_value.toFixed(2)}`);

console.log('\n📊 Enhanced Fields:');
console.log(`- Entry Reasoning: "${transformedSignal.entry_strategy.reasoning}"`);
console.log(`- Stop Loss Reasoning: "${transformedSignal.stop_loss.reasoning}"`);
console.log(`- Model Type: ${transformedSignal.model_metadata.model_type}`);
console.log(`- Trend: ${transformedSignal.indicators_state.trend.direction} (${transformedSignal.indicators_state.trend.strength})`);

// ============================================
// EXPORT FOR USE IN APP
// ============================================
export const exampleTransformedSignal = transformedSignal;

/**
 * How to use in your components:
 * 
 * import { exampleTransformedSignal } from '@/services/aiSignalExample';
 * 
 * <AISignalCard signal={exampleTransformedSignal} />
 */

/**
 * Production Usage:
 * 
 * async function fetchAndTransformSignal(symbol: string) {
 *   const response = await fetch(`https://your-api.com/signal/${symbol}`);
 *   const backendSignal: BackendAISignal = await response.json();
 *   
 *   return transformBackendSignal(backendSignal, {
 *     defaultSymbol: symbol,
 *     defaultAssetType: 'stock',
 *     accountBalance: getUserAccountBalance()
 *   });
 * }
 */

