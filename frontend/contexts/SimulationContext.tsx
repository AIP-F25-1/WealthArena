/**
 * Simulation Context
 * Global state management for trading simulators
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { SimulationEngine, TradeEvent, Position, CandleData, PlaybackSpeed, PlaybackState, generateTradeId, calculateTotalPnL } from '@/utils/simulationEngine';

interface SimulationContextType {
  // Engine
  engine: SimulationEngine | null;
  initializeSimulation: (candles: CandleData[], symbol: string, duration: number) => void;
  destroySimulation: () => void;

  // Playback
  playbackState: PlaybackState;
  playbackSpeed: PlaybackSpeed;
  currentCandle: CandleData | null;
  currentIndex: number;
  totalCandles: number;
  progress: number;

  // Playback Controls
  play: () => void;
  pause: () => void;
  reset: () => void;
  rewind: () => void;
  fastForward: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  jumpTo: (index: number) => void;

  // Trading
  executeBuy: (quantity: number) => void;
  executeSell: (quantity: number) => void;
  closePosition: (positionId: string) => void;
  closeAllPositions: () => void;

  // User State
  userBalance: number;
  userPositions: Position[];
  userPnL: number;
  userTrades: TradeEvent[];

  // AI State (for vs AI mode)
  aiBalance: number;
  aiPositions: Position[];
  aiPnL: number;
  aiTrades: TradeEvent[];
  aiEnabled: boolean;
  setAiEnabled: (enabled: boolean) => void;
  executeAITrade: (action: 'buy' | 'sell', quantity: number, reason: string) => void;

  // Events & Logs
  events: TradeEvent[];
  addEvent: (event: Omit<TradeEvent, 'id' | 'timestamp'>) => void;

  // Metadata
  symbol: string;
  duration: number;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  // Engine
  const engineRef = useRef<SimulationEngine | null>(null);
  const [engine, setEngine] = useState<SimulationEngine | null>(null);

  // Playback State
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [currentCandle, setCurrentCandle] = useState<CandleData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCandles, setTotalCandles] = useState(0);
  const [progress, setProgress] = useState(0);

  // User Trading State
  const [userBalance, setUserBalance] = useState(100000);
  const [userPositions, setUserPositions] = useState<Position[]>([]);
  const [userPnL, setUserPnL] = useState(0);
  const [userTrades, setUserTrades] = useState<TradeEvent[]>([]);

  // AI State
  const [aiBalance, setAiBalance] = useState(100000);
  const [aiPositions, setAiPositions] = useState<Position[]>([]);
  const [aiPnL, setAiPnL] = useState(0);
  const [aiTrades, setAiTrades] = useState<TradeEvent[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);

  // Events
  const [events, setEvents] = useState<TradeEvent[]>([]);

  // Metadata
  const [symbol, setSymbol] = useState('');
  const [duration, setDuration] = useState(30);

  // Initialize simulation
  const initializeSimulation = useCallback((candles: CandleData[], sym: string, dur: number) => {
    // Clean up existing engine
    if (engineRef.current) {
      engineRef.current.destroy();
    }

    // Create new engine
    const newEngine = new SimulationEngine(candles);
    engineRef.current = newEngine;
    setEngine(newEngine);

    // Set metadata
    setSymbol(sym);
    setDuration(dur);
    setTotalCandles(candles.length);

    // Reset all state
    setUserBalance(100000);
    setUserPositions([]);
    setUserPnL(0);
    setUserTrades([]);
    setAiBalance(100000);
    setAiPositions([]);
    setAiPnL(0);
    setAiTrades([]);
    setEvents([]);
    setCurrentIndex(0);
    setProgress(0);
    setPlaybackState('idle');
    setPlaybackSpeed(1);
    setCurrentCandle(candles[0] || null);

    // Set up event listeners
    newEngine.on('tick', (candle: CandleData) => {
      setCurrentCandle(candle);
    });

    newEngine.on('indexChange', (index: number) => {
      setCurrentIndex(index);
      setProgress((index / (candles.length - 1)) * 100);
    });

    newEngine.on('stateChange', (state: PlaybackState) => {
      setPlaybackState(state);
    });

    newEngine.on('speedChange', (speed: PlaybackSpeed) => {
      setPlaybackSpeed(speed);
    });

    // Add initial event
    addEvent({
      type: 'system',
      message: `Simulation initialized: ${sym} (${dur} minutes)`,
      trader: 'system'
    });
  }, []);

  // Destroy simulation
  const destroySimulation = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
      setEngine(null);
    }
  }, []);

  // Playback controls
  const play = useCallback(() => engineRef.current?.play(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const reset = useCallback(() => engineRef.current?.reset(), []);
  const rewind = useCallback(() => engineRef.current?.rewind(10), []);
  const fastForward = useCallback(() => engineRef.current?.fastForward(10), []);
  const setSpeed = useCallback((speed: PlaybackSpeed) => engineRef.current?.setSpeed(speed), []);
  const jumpTo = useCallback((index: number) => engineRef.current?.jumpTo(index), []);

  // Add event
  const addEvent = useCallback((event: Omit<TradeEvent, 'id' | 'timestamp'>) => {
    const newEvent: TradeEvent = {
      ...event,
      id: generateTradeId(),
      timestamp: Date.now()
    };
    setEvents(prev => [newEvent, ...prev]);
  }, []);

  // Execute Buy
  const executeBuy = useCallback((quantity: number) => {
    if (!currentCandle) return;

    const cost = quantity * currentCandle.close;
    if (cost > userBalance) {
      addEvent({
        type: 'system',
        message: 'Insufficient balance for buy order',
        trader: 'system'
      });
      return;
    }

    const newPosition: Position = {
      symbol,
      side: 'long',
      quantity,
      entryPrice: currentCandle.close,
      timestamp: currentCandle.timestamp
    };

    setUserPositions(prev => [...prev, newPosition]);
    setUserBalance(prev => prev - cost);

    const trade: TradeEvent = {
      id: generateTradeId(),
      timestamp: currentCandle.timestamp,
      type: 'user_buy',
      message: `Bought ${quantity} @ $${currentCandle.close.toFixed(2)}`,
      price: currentCandle.close,
      quantity,
      trader: 'user'
    };

    setUserTrades(prev => [trade, ...prev]);
    addEvent(trade);
  }, [currentCandle, userBalance, symbol, addEvent]);

  // Execute Sell
  const executeSell = useCallback((quantity: number) => {
    if (!currentCandle) return;

    const newPosition: Position = {
      symbol,
      side: 'short',
      quantity,
      entryPrice: currentCandle.close,
      timestamp: currentCandle.timestamp
    };

    setUserPositions(prev => [...prev, newPosition]);
    setUserBalance(prev => prev + quantity * currentCandle.close);

    const trade: TradeEvent = {
      id: generateTradeId(),
      timestamp: currentCandle.timestamp,
      type: 'user_sell',
      message: `Sold ${quantity} @ $${currentCandle.close.toFixed(2)}`,
      price: currentCandle.close,
      quantity,
      trader: 'user'
    };

    setUserTrades(prev => [trade, ...prev]);
    addEvent(trade);
  }, [currentCandle, symbol, addEvent]);

  // Close Position
  const closePosition = useCallback((positionId: string) => {
    // Implementation for closing specific position
    // For now, we'll implement close all
  }, []);

  // Close All Positions
  const closeAllPositions = useCallback(() => {
    if (!currentCandle || userPositions.length === 0) return;

    let totalPnL = 0;
    userPositions.forEach(pos => {
      const pnl = pos.side === 'long'
        ? (currentCandle.close - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - currentCandle.close) * pos.quantity;
      totalPnL += pnl;
    });

    setUserBalance(prev => prev + totalPnL);
    setUserPositions([]);

    addEvent({
      type: 'system',
      message: `All positions closed. P&L: $${totalPnL.toFixed(2)}`,
      trader: 'system'
    });
  }, [currentCandle, userPositions, addEvent]);

  // Execute AI Trade
  const executeAITrade = useCallback((action: 'buy' | 'sell', quantity: number, reason: string) => {
    if (!currentCandle) return;

    const cost = quantity * currentCandle.close;
    
    if (action === 'buy') {
      if (cost > aiBalance) return;
      
      const newPosition: Position = {
        symbol,
        side: 'long',
        quantity,
        entryPrice: currentCandle.close,
        timestamp: currentCandle.timestamp
      };

      setAiPositions(prev => [...prev, newPosition]);
      setAiBalance(prev => prev - cost);

      const trade: TradeEvent = {
        id: generateTradeId(),
        timestamp: currentCandle.timestamp,
        type: 'ai_buy',
        message: `AI: ${reason} - Bought ${quantity.toFixed(2)} @ $${currentCandle.close.toFixed(2)}`,
        price: currentCandle.close,
        quantity,
        trader: 'ai'
      };

      setAiTrades(prev => [trade, ...prev]);
      addEvent(trade);
    } else {
      const newPosition: Position = {
        symbol,
        side: 'short',
        quantity,
        entryPrice: currentCandle.close,
        timestamp: currentCandle.timestamp
      };

      setAiPositions(prev => [...prev, newPosition]);
      setAiBalance(prev => prev + cost);

      const trade: TradeEvent = {
        id: generateTradeId(),
        timestamp: currentCandle.timestamp,
        type: 'ai_sell',
        message: `AI: ${reason} - Sold ${quantity.toFixed(2)} @ $${currentCandle.close.toFixed(2)}`,
        price: currentCandle.close,
        quantity,
        trader: 'ai'
      };

      setAiTrades(prev => [trade, ...prev]);
      addEvent(trade);
    }
  }, [currentCandle, aiBalance, symbol, addEvent]);

  // Update P&L on price changes
  useEffect(() => {
    if (currentCandle) {
      const newUserPnL = calculateTotalPnL(userPositions, currentCandle.close);
      setUserPnL(newUserPnL);

      const newAiPnL = calculateTotalPnL(aiPositions, currentCandle.close);
      setAiPnL(newAiPnL);
    }
  }, [currentCandle, userPositions, aiPositions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroySimulation();
    };
  }, [destroySimulation]);

  const value = React.useMemo<SimulationContextType>(() => ({
    engine,
    initializeSimulation,
    destroySimulation,
    playbackState,
    playbackSpeed,
    currentCandle,
    currentIndex,
    totalCandles,
    progress,
    play,
    pause,
    reset,
    rewind,
    fastForward,
    setSpeed,
    jumpTo,
    executeBuy,
    executeSell,
    closePosition,
    closeAllPositions,
    userBalance,
    userPositions,
    userPnL,
    userTrades,
    aiBalance,
    aiPositions,
    aiPnL,
    aiTrades,
    aiEnabled,
    setAiEnabled,
    executeAITrade,
    events,
    addEvent,
    symbol,
    duration
  }), [
    engine,
    initializeSimulation,
    destroySimulation,
    playbackState,
    playbackSpeed,
    currentCandle,
    currentIndex,
    totalCandles,
    progress,
    play,
    pause,
    reset,
    rewind,
    fastForward,
    setSpeed,
    jumpTo,
    executeBuy,
    executeSell,
    closePosition,
    closeAllPositions,
    userBalance,
    userPositions,
    userPnL,
    userTrades,
    aiBalance,
    aiPositions,
    aiPnL,
    aiTrades,
    aiEnabled,
    setAiEnabled,
    executeAITrade,
    events,
    addEvent,
    symbol,
    duration
  ]);

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within SimulationProvider');
  }
  return context;
}

