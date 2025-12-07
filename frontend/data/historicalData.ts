/**
 * Mock Historical Market Data
 * Generates realistic candlestick data for various symbols
 */

import { CandleData } from '@/utils/simulationEngine';

/**
 * Generate mock candlestick data with realistic price movement
 */
function generateHistoricalData(
  symbol: string,
  basePrice: number,
  count: number = 120,
  volatility: number = 0.02
): CandleData[] {
  const candles: CandleData[] = [];
  let currentPrice = basePrice;
  const startTime = Date.now() - count * 60000; // Start from 'count' minutes ago

  for (let i = 0; i < count; i++) {
    const timestamp = startTime + i * 60000; // 1 minute candles
    
    // Random walk with trend
    const trend = Math.sin(i / 20) * 0.001; // Slight wave pattern
    const randomChange = (Math.random() - 0.5) * volatility;
    const priceChange = (trend + randomChange) * currentPrice;
    
    const open = currentPrice;
    const close = currentPrice + priceChange;
    const high = Math.max(open, close) * (1 + Math.random() * volatility / 2);
    const low = Math.min(open, close) * (1 - Math.random() * volatility / 2);
    const volume = Math.floor(Math.random() * 1000000) + 500000;

    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume
    });

    currentPrice = close;
  }

  return candles;
}

/**
 * Available trading symbols
 */
export const TRADING_SYMBOLS = [
  { symbol: 'BTC/USD', name: 'Bitcoin', basePrice: 45000, volatility: 0.03 },
  { symbol: 'ETH/USD', name: 'Ethereum', basePrice: 3200, volatility: 0.035 },
  { symbol: 'AAPL', name: 'Apple Inc.', basePrice: 178.45, volatility: 0.015 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', basePrice: 142.67, volatility: 0.02 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', basePrice: 412.89, volatility: 0.018 },
  { symbol: 'TSLA', name: 'Tesla Inc.', basePrice: 242.15, volatility: 0.04 },
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', basePrice: 1.0856, volatility: 0.008 },
  { symbol: 'GBP/USD', name: 'British Pound / US Dollar', basePrice: 1.2743, volatility: 0.01 },
  { symbol: 'SOL/USD', name: 'Solana', basePrice: 145.32, volatility: 0.045 },
  { symbol: 'ADA/USD', name: 'Cardano', basePrice: 0.58, volatility: 0.038 },
];

/**
 * Get historical data for a specific symbol
 */
export function getHistoricalData(
  symbol: string,
  durationMinutes: number = 30
): CandleData[] {
  const symbolData = TRADING_SYMBOLS.find(s => s.symbol === symbol);
  
  if (!symbolData) {
    throw new Error(`Symbol ${symbol} not found`);
  }

  return generateHistoricalData(
    symbol,
    symbolData.basePrice,
    durationMinutes,
    symbolData.volatility
  );
}

/**
 * Get a random symbol for AI battles
 */
export function getRandomSymbol(): typeof TRADING_SYMBOLS[0] {
  const randomIndex = Math.floor(Math.random() * TRADING_SYMBOLS.length);
  return TRADING_SYMBOLS[randomIndex];
}

/**
 * Generate market commentary based on price action
 */
export function generateMarketCommentary(
  candle: CandleData,
  previousCandle?: CandleData
): string {
  if (!previousCandle) return 'Market session starting...';

  const priceChange = ((candle.close - previousCandle.close) / previousCandle.close) * 100;
  const volatility = ((candle.high - candle.low) / candle.low) * 100;

  const commentaries = [
    // Bullish
    priceChange > 2 && 'Strong bullish momentum building! 📈',
    priceChange > 1 && 'Price pushing higher with solid volume.',
    priceChange > 0.5 && 'Buyers stepping in, steady upward movement.',
    
    // Bearish
    priceChange < -2 && 'Sharp selloff in progress! 📉',
    priceChange < -1 && 'Bearish pressure increasing.',
    priceChange < -0.5 && 'Price drifting lower.',
    
    // High volatility
    volatility > 3 && 'High volatility! Wild price swings detected.',
    volatility > 2 && 'Increased volatility, watch for breakouts.',
    
    // Neutral
    Math.abs(priceChange) < 0.2 && 'Consolidation phase, waiting for direction.',
    Math.abs(priceChange) < 0.5 && 'Choppy price action, low momentum.',
  ].filter(Boolean);

  return commentaries[Math.floor(Math.random() * commentaries.length)] || 'Market moving...';
}

