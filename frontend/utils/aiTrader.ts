/**
 * AI Trader Logic
 * Simple rule-based AI trading strategies
 */

import { CandleData, Position } from './simulationEngine';

export type AIStrategy = 'momentum' | 'reversal' | 'random';

export interface AIDecision {
  action: 'buy' | 'sell' | 'hold' | 'close';
  quantity: number;
  reason: string;
}

/**
 * AI Trader class with configurable strategies
 */
export class AITrader {
  private strategy: AIStrategy;
  private lookbackPeriod: number = 5;
  private tradeFrequency: number = 0.3; // 30% chance to trade on any given candle
  private positionSize: number = 1;
  private lastTradeIndex: number = -1;

  constructor(strategy: AIStrategy = 'momentum') {
    this.strategy = strategy;
  }

  /**
   * Make a trading decision based on market data
   */
  makeDecision(
    currentCandle: CandleData,
    previousCandles: CandleData[],
    currentIndex: number,
    balance: number,
    positions: Position[]
  ): AIDecision {
    // Don't trade too frequently
    if (currentIndex - this.lastTradeIndex < 3) {
      return { action: 'hold', quantity: 0, reason: 'Waiting for next opportunity' };
    }

    // Random chance to trade
    if (Math.random() > this.tradeFrequency && positions.length === 0) {
      return { action: 'hold', quantity: 0, reason: 'Monitoring market' };
    }

    // Check if we should close existing positions
    if (positions.length > 0) {
      const closeDecision = this.shouldClosePosition(currentCandle, positions);
      if (closeDecision) {
        this.lastTradeIndex = currentIndex;
        return closeDecision;
      }
    }

    // Make new trading decision based on strategy
    let decision: AIDecision;
    
    switch (this.strategy) {
      case 'momentum':
        decision = this.momentumStrategy(currentCandle, previousCandles, balance);
        break;
      case 'reversal':
        decision = this.reversalStrategy(currentCandle, previousCandles, balance);
        break;
      case 'random':
        decision = this.randomStrategy(currentCandle, balance);
        break;
      default:
        decision = { action: 'hold', quantity: 0, reason: 'No strategy' };
    }

    if (decision.action !== 'hold') {
      this.lastTradeIndex = currentIndex;
    }

    return decision;
  }

  /**
   * Momentum Strategy: Buy uptrends, sell downtrends
   */
  private momentumStrategy(
    currentCandle: CandleData,
    previousCandles: CandleData[],
    balance: number
  ): AIDecision {
    if (previousCandles.length < this.lookbackPeriod) {
      return { action: 'hold', quantity: 0, reason: 'Not enough data' };
    }

    const recentCandles = previousCandles.slice(-this.lookbackPeriod);
    const priceChange = ((currentCandle.close - recentCandles[0].close) / recentCandles[0].close) * 100;

    // Strong upward momentum - buy
    if (priceChange > 2) {
      const quantity = this.calculatePositionSize(currentCandle.close, balance);
      return {
        action: 'buy',
        quantity,
        reason: `Strong momentum: +${priceChange.toFixed(2)}%`
      };
    }

    // Strong downward momentum - sell/short
    if (priceChange < -2) {
      const quantity = this.calculatePositionSize(currentCandle.close, balance);
      return {
        action: 'sell',
        quantity,
        reason: `Bearish momentum: ${priceChange.toFixed(2)}%`
      };
    }

    return { action: 'hold', quantity: 0, reason: 'Weak momentum' };
  }

  /**
   * Reversal Strategy: Buy dips, sell peaks
   */
  private reversalStrategy(
    currentCandle: CandleData,
    previousCandles: CandleData[],
    balance: number
  ): AIDecision {
    if (previousCandles.length < this.lookbackPeriod) {
      return { action: 'hold', quantity: 0, reason: 'Not enough data' };
    }

    const recentCandles = previousCandles.slice(-this.lookbackPeriod);
    const avgPrice = recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length;
    const deviation = ((currentCandle.close - avgPrice) / avgPrice) * 100;

    // Price significantly below average - buy the dip
    if (deviation < -3) {
      const quantity = this.calculatePositionSize(currentCandle.close, balance);
      return {
        action: 'buy',
        quantity,
        reason: `Buying dip: ${deviation.toFixed(2)}% below MA`
      };
    }

    // Price significantly above average - sell the peak
    if (deviation > 3) {
      const quantity = this.calculatePositionSize(currentCandle.close, balance);
      return {
        action: 'sell',
        quantity,
        reason: `Selling peak: ${deviation.toFixed(2)}% above MA`
      };
    }

    return { action: 'hold', quantity: 0, reason: 'Near average price' };
  }

  /**
   * Random Strategy: Make random trades (for testing)
   */
  private randomStrategy(
    currentCandle: CandleData,
    balance: number
  ): AIDecision {
    const rand = Math.random();
    
    if (rand > 0.7) {
      const quantity = this.calculatePositionSize(currentCandle.close, balance);
      return {
        action: 'buy',
        quantity,
        reason: 'Random buy signal'
      };
    }
    
    if (rand < 0.3) {
      const quantity = this.calculatePositionSize(currentCandle.close, balance);
      return {
        action: 'sell',
        quantity,
        reason: 'Random sell signal'
      };
    }

    return { action: 'hold', quantity: 0, reason: 'Waiting' };
  }

  /**
   * Check if we should close existing positions
   */
  private shouldClosePosition(
    currentCandle: CandleData,
    positions: Position[]
  ): AIDecision | null {
    for (const position of positions) {
      const pnl = position.side === 'long'
        ? (currentCandle.close - position.entryPrice) / position.entryPrice
        : (position.entryPrice - currentCandle.close) / position.entryPrice;

      const pnlPercent = pnl * 100;

      // Take profit at 5%
      if (pnlPercent > 5) {
        return {
          action: 'close',
          quantity: position.quantity,
          reason: `Take profit: +${pnlPercent.toFixed(2)}%`
        };
      }

      // Stop loss at -3%
      if (pnlPercent < -3) {
        return {
          action: 'close',
          quantity: position.quantity,
          reason: `Stop loss: ${pnlPercent.toFixed(2)}%`
        };
      }
    }

    return null;
  }

  /**
   * Calculate position size based on balance
   */
  private calculatePositionSize(price: number, balance: number): number {
    const riskPercent = 0.1; // Risk 10% of balance per trade
    const maxCost = balance * riskPercent;
    const quantity = Math.floor(maxCost / price);
    return Math.max(1, quantity);
  }

  /**
   * Set AI strategy
   */
  setStrategy(strategy: AIStrategy) {
    this.strategy = strategy;
  }

  /**
   * Set trade frequency (0-1)
   */
  setTradeFrequency(frequency: number) {
    this.tradeFrequency = Math.max(0, Math.min(1, frequency));
  }

  /**
   * Reset AI state
   */
  reset() {
    this.lastTradeIndex = -1;
  }
}

