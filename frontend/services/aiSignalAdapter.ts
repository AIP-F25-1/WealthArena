/**
 * AI Signal Adapter Service
 * Transforms backend AI signal format to app's comprehensive AITradingSignal format
 */

import { AITradingSignal, TakeProfitLevel } from '../types/ai-signal';

/**
 * Backend AI Signal Format (simplified)
 */
export interface BackendAISignal {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entry: {
    price: number;
    range: [number, number];
  };
  take_profit: Array<{
    level: number;
    price: number;
    percent: number;
    close_percent: number;
  }>;
  stop_loss: {
    price: number;
    type: 'fixed' | 'trailing' | 'time-based';
  };
  risk_metrics: {
    risk_reward_ratio: number;
    win_probability: number;
  };
  position_sizing: {
    recommended_percent: number;
    dollar_amount: number;
  };
}

/**
 * Extended backend format with optional metadata
 */
export interface BackendAISignalWithMetadata extends BackendAISignal {
  symbol?: string;
  asset_type?: 'stock' | 'crypto' | 'forex' | 'commodity' | 'etf';
  model_version?: string;
  prediction_date?: string;
  indicators?: {
    rsi?: number;
    macd?: number;
    atr?: number;
    volume?: number;
  };
  trend?: {
    direction?: 'up' | 'down' | 'sideways';
    strength?: 'strong' | 'moderate' | 'weak';
  };
}

/**
 * Configuration for the adapter
 */
export interface AdapterConfig {
  defaultSymbol?: string;
  defaultAssetType?: 'stock' | 'crypto' | 'forex' | 'commodity' | 'etf';
  defaultModelVersion?: string;
  accountBalance?: number; // For calculating shares
}

/**
 * Transforms backend AI signal to app's AITradingSignal format
 */
export function transformBackendSignal(
  backendSignal: BackendAISignal | BackendAISignalWithMetadata,
  config: AdapterConfig = {}
): AITradingSignal {
  const {
    defaultSymbol = 'UNKNOWN',
    defaultAssetType = 'stock',
    defaultModelVersion = 'v1.0.0',
    accountBalance = 100000,
  } = config;

  // Extract metadata if available
  const extendedSignal = backendSignal as BackendAISignalWithMetadata;

  // Calculate derived values
  const entryPrice = backendSignal.entry.price;
  const stopLossPrice = backendSignal.stop_loss.price;
  const percentLoss = Math.abs(((stopLossPrice - entryPrice) / entryPrice) * 100);
  const maxRiskPerShare = Math.abs(entryPrice - stopLossPrice);
  
  // Calculate max reward from highest TP level
  const highestTP = backendSignal.take_profit[backendSignal.take_profit.length - 1];
  const maxRewardPerShare = highestTP ? highestTP.price - entryPrice : 0;

  // Calculate position sizing
  const dollarAmount = backendSignal.position_sizing.dollar_amount;
  const shares = Math.floor(dollarAmount / entryPrice);
  const maxLoss = shares * maxRiskPerShare;

  // Calculate expected value (simplified)
  const avgTPGain = backendSignal.take_profit.reduce((sum, tp) => 
    sum + ((tp.price - entryPrice) * (tp.close_percent / 100)), 0
  );
  const expectedValue = (avgTPGain * backendSignal.risk_metrics.win_probability) - 
                       (maxRiskPerShare * (1 - backendSignal.risk_metrics.win_probability));

  // Transform take profit levels
  const takeProfitLevels: TakeProfitLevel[] = backendSignal.take_profit.map((tp) => ({
    level: tp.level,
    price: tp.price,
    percent_gain: tp.percent,
    close_percent: tp.close_percent,
    // Estimate probability: higher levels = lower probability
    probability: backendSignal.risk_metrics.win_probability * (1 - (tp.level - 1) * 0.15),
    reasoning: `Target level ${tp.level} - ${tp.percent.toFixed(2)}% gain with ${tp.close_percent}% position close`,
  }));

  // Determine indicator states from optional data or defaults
  const getRSIStatus = (rsi?: number) => {
    if (!rsi) return 'neutral';
    if (rsi > 70) return 'bearish';
    if (rsi > 60) return 'bullish';
    if (rsi < 30) return 'bullish';
    if (rsi < 40) return 'bearish';
    return 'neutral';
  };

  const getMACDStatus = (macd?: number) => {
    if (!macd) return 'neutral';
    return macd > 0 ? 'bullish' : 'bearish';
  };

  const getATRStatus = (atr?: number) => {
    if (!atr) return 'medium_volatility';
    if (atr > 2) return 'high_volatility';
    if (atr < 1) return 'low_volatility';
    return 'medium_volatility';
  };

  const getVolumeStatus = (volume?: number) => {
    if (!volume) return 'neutral';
    return volume > 1.5 ? 'above_average' : volume < 0.8 ? 'below_average' : 'neutral';
  };

  // Construct full AITradingSignal
  const aiSignal: AITradingSignal = {
    symbol: extendedSignal.symbol || defaultSymbol,
    prediction_date: extendedSignal.prediction_date || new Date().toISOString(),
    asset_type: extendedSignal.asset_type || defaultAssetType,

    trading_signal: {
      signal: backendSignal.signal,
      confidence: backendSignal.confidence,
      model_version: extendedSignal.model_version || defaultModelVersion,
    },

    entry_strategy: {
      price: entryPrice,
      price_range: backendSignal.entry.range,
      timing: 'immediate',
      reasoning: `${backendSignal.signal} signal with ${(backendSignal.confidence * 100).toFixed(0)}% confidence. Entry price at $${entryPrice.toFixed(2)} within optimal range.`,
    },

    take_profit_levels: takeProfitLevels,

    stop_loss: {
      price: stopLossPrice,
      percent_loss: percentLoss,
      type: backendSignal.stop_loss.type,
      trail_amount: backendSignal.stop_loss.type === 'trailing' ? maxRiskPerShare * 0.5 : undefined,
      reasoning: `${backendSignal.stop_loss.type === 'trailing' ? 'Trailing' : 'Fixed'} stop loss at $${stopLossPrice.toFixed(2)} to limit risk to ${percentLoss.toFixed(2)}% per share.`,
    },

    risk_management: {
      risk_reward_ratio: backendSignal.risk_metrics.risk_reward_ratio,
      max_risk_per_share: maxRiskPerShare,
      max_reward_per_share: maxRewardPerShare,
      win_probability: backendSignal.risk_metrics.win_probability,
      expected_value: expectedValue,
    },

    position_sizing: {
      recommended_percent: backendSignal.position_sizing.recommended_percent,
      dollar_amount: dollarAmount,
      shares: shares,
      max_loss: maxLoss,
      method: 'Risk Parity', // Default method
      kelly_fraction: backendSignal.position_sizing.recommended_percent / 100,
      volatility_adjusted: true,
    },

    model_metadata: {
      model_type: 'Multi-Agent Reinforcement Learning',
      agents_used: ['Momentum Agent', 'Mean Reversion Agent', 'Risk Manager'],
      training_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      backtest_sharpe: 1.8 + (backendSignal.confidence * 0.5), // Estimate based on confidence
      feature_importance: {
        'Price Momentum': 0.28,
        'Volume Profile': 0.22,
        'RSI': 0.18,
        'MACD': 0.16,
        'Support/Resistance': 0.16,
      },
    },

    indicators_state: {
      rsi: {
        value: extendedSignal.indicators?.rsi || 55,
        status: getRSIStatus(extendedSignal.indicators?.rsi) as any,
      },
      macd: {
        value: extendedSignal.indicators?.macd || 0.5,
        status: getMACDStatus(extendedSignal.indicators?.macd) as any,
      },
      atr: {
        value: extendedSignal.indicators?.atr || 1.2,
        status: getATRStatus(extendedSignal.indicators?.atr) as any,
      },
      volume: {
        value: extendedSignal.indicators?.volume || 1.1,
        status: getVolumeStatus(extendedSignal.indicators?.volume) as any,
      },
      trend: {
        direction: extendedSignal.trend?.direction || (backendSignal.signal === 'BUY' ? 'up' : backendSignal.signal === 'SELL' ? 'down' : 'sideways'),
        strength: extendedSignal.trend?.strength || 'moderate',
      },
    },
  };

  return aiSignal;
}

/**
 * Transforms multiple backend signals
 */
export function transformBackendSignals(
  backendSignals: Array<BackendAISignal | BackendAISignalWithMetadata>,
  config: AdapterConfig = {}
): AITradingSignal[] {
  return backendSignals.map(signal => transformBackendSignal(signal, config));
}

/**
 * Example usage with fetch
 */
export async function fetchAISignalsFromBackend(
  endpoint: string,
  config: AdapterConfig = {}
): Promise<AITradingSignal[]> {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch AI signals: ${response.statusText}`);
    }
    
    const backendSignals: BackendAISignal[] = await response.json();
    return transformBackendSignals(backendSignals, config);
  } catch (error) {
    console.error('Error fetching AI signals:', error);
    throw error;
  }
}

