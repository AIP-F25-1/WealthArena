/**
 * AI Signal Type Definitions
 * Comprehensive type structure for AI trading signals
 */

export interface AITradingSignal {
  symbol: string;
  prediction_date: string;
  asset_type: 'stock' | 'crypto' | 'forex' | 'commodity' | 'etf';
  
  trading_signal: {
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    model_version: string;
  };
  
  entry_strategy: {
    price: number;
    price_range: [number, number];
    timing: 'immediate' | 'limit' | 'market_open' | 'market_close';
    reasoning: string;
  };
  
  take_profit_levels: TakeProfitLevel[];
  
  stop_loss: {
    price: number;
    percent_loss: number;
    type: 'fixed' | 'trailing' | 'time-based';
    trail_amount?: number;
    reasoning: string;
  };
  
  risk_management: {
    risk_reward_ratio: number;
    max_risk_per_share: number;
    max_reward_per_share: number;
    win_probability: number;
    expected_value: number;
  };
  
  position_sizing: {
    recommended_percent: number;
    dollar_amount: number;
    shares: number;
    max_loss: number;
    method: 'Kelly Criterion' | 'Fixed Percent' | 'Volatility Based' | 'Risk Parity';
    kelly_fraction?: number;
    volatility_adjusted: boolean;
  };
  
  model_metadata: {
    model_type: string;
    agents_used: string[];
    training_date: string;
    backtest_sharpe: number;
    feature_importance: Record<string, number>;
  };
  
  indicators_state: {
    rsi: IndicatorState;
    macd: IndicatorState;
    atr: IndicatorState;
    volume: IndicatorState;
    trend: TrendState;
  };
}

export interface TakeProfitLevel {
  level: number;
  price: number;
  percent_gain: number;
  close_percent: number;
  probability: number;
  reasoning: string;
}

export interface IndicatorState {
  value: number;
  status: 'bullish' | 'bearish' | 'neutral' | 'above_average' | 'below_average' | 'high_volatility' | 'medium_volatility' | 'low_volatility';
}

export interface TrendState {
  direction: 'up' | 'down' | 'sideways';
  strength: 'strong' | 'moderate' | 'weak';
}

/**
 * Legacy signal type for backwards compatibility
 */
export interface LegacySignalData {
  symbol: string;
  name: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  target: number;
  change: number;
  candleData?: CandleData[];
}

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Top 3 symbols response type
 */
export interface Top3SignalsResponse {
  signals: AITradingSignal[];
  timestamp: string;
  market_session: 'pre-market' | 'market-open' | 'market-close' | 'after-hours';
}

