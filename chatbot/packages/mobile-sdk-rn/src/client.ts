/**
 * WealthArena Mobile SDK Client
 * Main client class for React Native integration
 */

import { z } from 'zod';
import {
  ChatRequest,
  ChatResponse,
  AnalyzeRequest,
  AnalyzeResponse,
  TradeRequest,
  TradeResponse,
  StateResponse,
  LearnResponse,
  HealthResponse,
  WealthArenaError,
  WealthArenaConfig,
  EventData
} from './types';

// Response validation schemas
const ChatResponseSchema = z.object({
  reply: z.string(),
  sources: z.array(z.string()),
  suggestions: z.array(z.string()),
  timestamp: z.string()
});

const AnalyzeResponseSchema = z.object({
  symbol: z.string(),
  current_price: z.number(),
  indicators: z.object({
    sma_20: z.array(z.number().nullable()),
    ema_12: z.array(z.number().nullable()),
    rsi: z.array(z.number().nullable())
  }),
  signals: z.array(z.object({
    type: z.enum(['buy', 'sell']),
    indicator: z.string(),
    message: z.string(),
    explanation: z.string()
  })),
  timestamp: z.string()
});

const TradeResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  new_balance: z.number(),
  position: z.object({
    quantity: z.number(),
    avg_price: z.number()
  }).optional(),
  timestamp: z.string()
});

const StateResponseSchema = z.object({
  balance: z.number(),
  positions: z.record(z.object({
    quantity: z.number(),
    avg_price: z.number()
  })),
  trades: z.array(z.object({
    timestamp: z.string(),
    symbol: z.string(),
    action: z.string(),
    quantity: z.number(),
    price: z.number(),
    total: z.number()
  })),
  total_pnl: z.number(),
  timestamp: z.string()
});

const LearnResponseSchema = z.object({
  lessons: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    topics: z.array(z.string())
  })),
  quizzes: z.array(z.object({
    id: z.string(),
    question: z.string(),
    options: z.array(z.string()),
    correct: z.number(),
    explanation: z.string()
  })),
  timestamp: z.string()
});

const HealthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  version: z.string(),
  timestamp: z.string()
});

export class WealthArenaError extends Error {
  public code?: string;
  public status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'WealthArenaError';
    this.code = code;
    this.status = status;
  }
}

export class WealthArenaClient {
  private baseURL: string;
  private token?: string;
  private timeout: number;
  private retries: number;

  constructor(config: WealthArenaConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.token = config.token;
    this.timeout = config.timeout || 30000; // 30 seconds
    this.retries = config.retries || 3;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    const url = `${this.baseURL}/v1${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const requestOptions: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new WealthArenaError(
            `HTTP ${response.status}: ${errorText}`,
            'HTTP_ERROR',
            response.status
          );
        }

        const data = await response.json();

        if (schema) {
          const validatedData = schema.parse(data);
          return validatedData;
        }

        return data as T;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.retries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new WealthArenaError('Request failed after retries');
  }

  /**
   * Chat with the educational trading bot
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.makeRequest('/chat', 'POST', request, ChatResponseSchema);
  }

  /**
   * Analyze an asset with technical indicators
   */
  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    return this.makeRequest('/analyze', 'POST', request, AnalyzeResponseSchema);
  }

  /**
   * Get current trading state
   */
  async state(): Promise<StateResponse> {
    return this.makeRequest('/state', 'GET', undefined, StateResponseSchema);
  }

  /**
   * Execute a paper trade
   */
  async paperTrade(request: TradeRequest): Promise<TradeResponse> {
    return this.makeRequest('/papertrade', 'POST', request, TradeResponseSchema);
  }

  /**
   * Get educational content and quizzes
   */
  async learn(): Promise<LearnResponse> {
    return this.makeRequest('/learn', 'GET', undefined, LearnResponseSchema);
  }

  /**
   * Health check
   */
  async health(): Promise<HealthResponse> {
    return this.makeRequest('/healthz', 'GET', undefined, HealthResponseSchema);
  }
}

/**
 * Create a WealthArena client instance
 */
export function createWealthArenaClient(
  baseURL: string,
  token?: string
): WealthArenaClient {
  return new WealthArenaClient({
    baseURL,
    token,
    timeout: 30000,
    retries: 3
  });
}

// Export types
export * from './types';

