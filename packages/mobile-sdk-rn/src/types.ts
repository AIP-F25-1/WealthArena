/**
 * WealthArena Mobile SDK Types
 * TypeScript definitions for the WealthArena Mobile SDK
 */

export interface ChatRequest {
  message: string;
  symbol?: string;
  mode?: 'teach' | 'analyze' | 'risk';
}

export interface ChatResponse {
  reply: string;
  sources: string[];
  suggestions: string[];
  timestamp: string;
}

export interface AnalyzeRequest {
  symbol: string;
}

export interface AnalyzeResponse {
  symbol: string;
  current_price: number;
  indicators: {
    sma_20: (number | null)[];
    ema_12: (number | null)[];
    rsi: (number | null)[];
  };
  signals: Array<{
    type: 'buy' | 'sell';
    indicator: string;
    message: string;
    explanation: string;
  }>;
  timestamp: string;
}

export interface TradeRequest {
  action: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  price?: number;
}

export interface TradeResponse {
  success: boolean;
  message: string;
  new_balance: number;
  position?: {
    quantity: number;
    avg_price: number;
  };
  timestamp: string;
}

export interface StateResponse {
  balance: number;
  positions: Record<string, {
    quantity: number;
    avg_price: number;
  }>;
  trades: Array<{
    timestamp: string;
    symbol: string;
    action: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  total_pnl: number;
  timestamp: string;
}

export interface LearnResponse {
  lessons: Array<{
    id: string;
    title: string;
    content: string;
    topics: string[];
  }>;
  quizzes: Array<{
    id: string;
    question: string;
    options: string[];
    correct: number;
    explanation: string;
  }>;
  timestamp: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export interface WealthArenaError {
  message: string;
  code?: string;
  status?: number;
}

export interface WealthArenaConfig {
  baseURL: string;
  token?: string;
  timeout?: number;
  retries?: number;
}

export type EventType = 'TradePlaced' | 'SignalGenerated' | 'LessonCompleted';

export interface EventData {
  type: EventType;
  data: Record<string, any>;
  timestamp: string;
}

