/**
 * Trading Simulation Engine
 * Handles playback control, time progression, and event emissions for trade simulators
 */

export type PlaybackSpeed = 1 | 2 | 5 | 10;
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'completed';

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeEvent {
  id: string;
  timestamp: number;
  type: 'user_buy' | 'user_sell' | 'ai_buy' | 'ai_sell' | 'system' | 'commentary';
  message: string;
  price?: number;
  quantity?: number;
  trader: 'user' | 'ai' | 'system';
}

export interface Position {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  timestamp: number;
}

export interface TraderState {
  balance: number;
  positions: Position[];
  pnl: number;
  trades: TradeEvent[];
}

export class SimulationEngine {
  private candles: CandleData[];
  private currentIndex: number = 0;
  private playbackSpeed: PlaybackSpeed = 1;
  private playbackState: PlaybackState = 'idle';
  private intervalId: NodeJS.Timeout | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private baseTickInterval: number = 1000; // 1 second per candle at 1x speed

  constructor(candles: CandleData[]) {
    this.candles = candles;
  }

  // Playback Controls
  play() {
    if (this.playbackState === 'playing') return;
    
    this.playbackState = 'playing';
    this.emit('stateChange', this.playbackState);
    
    const interval = this.baseTickInterval / this.playbackSpeed;
    this.intervalId = setInterval(() => {
      this.tick();
    }, interval);
  }

  pause() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.playbackState = 'paused';
    this.emit('stateChange', this.playbackState);
  }

  reset() {
    this.pause();
    this.currentIndex = 0;
    this.playbackState = 'idle';
    this.emit('stateChange', this.playbackState);
    this.emit('tick', this.getCurrentCandle());
  }

  rewind(steps: number = 10) {
    const wasPaused = this.playbackState === 'paused';
    this.pause();
    
    this.currentIndex = Math.max(0, this.currentIndex - steps);
    this.emit('tick', this.getCurrentCandle());
    this.emit('indexChange', this.currentIndex);
    
    if (!wasPaused && this.playbackState !== 'completed') {
      this.play();
    }
  }

  fastForward(steps: number = 10) {
    const wasPaused = this.playbackState === 'paused';
    this.pause();
    
    this.currentIndex = Math.min(this.candles.length - 1, this.currentIndex + steps);
    this.emit('tick', this.getCurrentCandle());
    this.emit('indexChange', this.currentIndex);
    
    if (!wasPaused && this.playbackState !== 'completed') {
      this.play();
    }
  }

  setSpeed(speed: PlaybackSpeed) {
    const wasPlaying = this.playbackState === 'playing';
    if (wasPlaying) this.pause();
    
    this.playbackSpeed = speed;
    this.emit('speedChange', speed);
    
    if (wasPlaying) this.play();
  }

  jumpTo(index: number) {
    const wasPaused = this.playbackState === 'paused';
    this.pause();
    
    this.currentIndex = Math.max(0, Math.min(this.candles.length - 1, index));
    this.emit('tick', this.getCurrentCandle());
    this.emit('indexChange', this.currentIndex);
    
    if (!wasPaused && this.playbackState !== 'completed') {
      this.play();
    }
  }

  private tick() {
    if (this.currentIndex >= this.candles.length - 1) {
      this.pause();
      this.playbackState = 'completed';
      this.emit('stateChange', this.playbackState);
      this.emit('completed');
      return;
    }

    this.currentIndex++;
    const currentCandle = this.getCurrentCandle();
    this.emit('tick', currentCandle);
    this.emit('indexChange', this.currentIndex);
  }

  // Getters
  getCurrentCandle(): CandleData | null {
    return this.candles[this.currentIndex] || null;
  }

  getCurrentPrice(): number {
    const candle = this.getCurrentCandle();
    return candle?.close || 0;
  }

  getVisibleCandles(count: number = 50): CandleData[] {
    const end = this.currentIndex + 1;
    const start = Math.max(0, end - count);
    return this.candles.slice(start, end);
  }

  getAllCandles(): CandleData[] {
    return this.candles.slice(0, this.currentIndex + 1);
  }

  getProgress(): number {
    return (this.currentIndex / (this.candles.length - 1)) * 100;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getTotalCandles(): number {
    return this.candles.length;
  }

  getPlaybackState(): PlaybackState {
    return this.playbackState;
  }

  getPlaybackSpeed(): PlaybackSpeed {
    return this.playbackSpeed;
  }

  // Event System
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Cleanup
  destroy() {
    this.pause();
    this.listeners.clear();
  }
}

/**
 * Calculate P&L for a position
 */
export function calculatePnL(
  position: Position,
  currentPrice: number
): number {
  const priceDiff = position.side === 'long' 
    ? currentPrice - position.entryPrice 
    : position.entryPrice - currentPrice;
  
  return priceDiff * position.quantity;
}

/**
 * Calculate total P&L for all positions
 */
export function calculateTotalPnL(
  positions: Position[],
  currentPrice: number
): number {
  return positions.reduce((total, pos) => {
    return total + calculatePnL(pos, currentPrice);
  }, 0);
}

/**
 * Generate a trade ID
 */
export function generateTradeId(): string {
  return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format timestamp to readable time
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
}

