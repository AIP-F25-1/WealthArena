/**
 * RL Agent Service
 * Handles communication with the WealthArena RL Backend API
 */

const RL_API_URL = process.env.EXPO_PUBLIC_RL_SERVICE_URL || 
  process.env.EXPO_PUBLIC_RL_API_URL || 
  (__DEV__ ? 'http://localhost:5002' : 'https://wealtharena-rl-5224.azurewebsites.net');

export interface MarketDataRequest {
  symbols: string[];
  days?: number;
}

export interface MarketDataResponse {
  symbols: string[];
  days: number;
  data: {
    [symbol: string]: {
      data: any[];
      latest_price: number;
      records: number;
      columns: string[];
    };
  };
  timestamp: string;
}

export interface PredictionRequest {
  symbol: string;
  horizon?: number;
}

export interface PredictionResponse {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  current_price: number;
  predicted_return_1d: number;
  target_price?: number;
  stop_loss?: number;
  risk_reward_ratio?: number;
  timestamp: string;
  features_used: string[];
  reasoning?: string;
}

export interface TopSetupsRequest {
  asset_type: 'stocks' | 'currency_pairs' | 'commodities' | 'crypto';
  count?: number;
  risk_tolerance?: 'low' | 'medium' | 'high';
}

export interface TopSetupsResponse {
  asset_type: string;
  timestamp: string;
  count: number;
  setups: PredictionResponse[];
  metadata: {
    symbols_analyzed: number;
    model_version: string;
    risk_tolerance: string;
  };
}

export interface PortfolioRequest {
  symbols: string[];
  weights: number[];
}

export interface PortfolioResponse {
  portfolio: {
    symbols: string[];
    weights: number[];
    holdings: Array<{
      symbol: string;
      weight: number;
      current_price: number;
      allocation: string;
    }>;
  };
  metrics: {
    total_return: number;
    annualized_return: number;
    volatility: number;
    sharpe_ratio: number;
    max_drawdown: number;
    period_days: number;
    timestamp: string;
  };
  recommendations: {
    rebalance_needed: boolean;
    risk_level: string;
    diversification_score: number;
  };
  timestamp: string;
}

export interface SystemMetrics {
  system: {
    status: string;
    uptime: string;
    last_data_update: string;
    database_type: string;
  };
  data: {
    symbols_tracked: number;
    symbols: string[];
    last_fetch: string;
  };
  models: {
    active_models: number;
    loaded_models: number;
    model_types: string[];
  };
  users: {
    active_users: number;
    games_in_progress: number;
  };
}

export interface GameLeaderboard {
  leaderboard: Array<{
    rank: number;
    username: string;
    score: number;
    sharpe: number;
    games: number;
  }>;
  period: string;
  last_updated: string;
}

class RLAgentService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = RL_API_URL;
  }

  /**
   * Get market data for symbols
   */
  async getMarketData(symbols: string[], days: number = 30): Promise<MarketDataResponse> {
    try {
      // Use AbortSignal with timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds

      try {
        const response = await fetch(`${this.baseUrl}/api/market-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbols,
            days,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('RL API endpoint not found. Please check if the service is running.');
          }
          throw new Error(`RL API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // Check if it's a timeout/abort error
        if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('timeout'))) {
          console.warn('Market data request timed out - using fallback data');
          throw new Error('Request timeout - market data service may be slow or unavailable');
        }
        
        throw fetchError;
      }
    } catch (error) {
      // Only log unexpected errors, not timeouts
      if (error instanceof Error && !error.message.includes('timeout')) {
        console.error('Error getting market data:', error);
      }
      
      // Return fallback data
      return {
        symbols,
        days,
        data: {},
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get model prediction for a symbol
   */
  async getPrediction(symbol: string, horizon: number = 1): Promise<PredictionResponse> {
    try {
      // Use AbortSignal with timeout to prevent hanging requests
      // Predictions can take longer, so use 30 seconds timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds

      try {
        const response = await fetch(`${this.baseUrl}/api/predictions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol,
            horizon,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('RL API endpoint not found. Please check if the service is running.');
          }
          throw new Error(`RL API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // Check if it's a timeout/abort error
        if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('timeout'))) {
          console.warn(`Prediction request timed out for ${symbol} - using fallback data`);
          throw new Error('Request timeout - prediction service may be slow or unavailable');
        }
        
        throw fetchError;
      }
    } catch (error) {
      // Only log unexpected errors, not timeouts (which are handled gracefully)
      if (error instanceof Error && !error.message.includes('timeout')) {
        console.error('Error getting prediction:', error);
      }
      
      // Return fallback prediction
      return {
        symbol,
        signal: 'HOLD' as const,
        confidence: 0.5,
        current_price: 100,
        predicted_return_1d: 0,
        timestamp: new Date().toISOString(),
        features_used: ['RSI', 'MACD', 'Volume'],
        reasoning: 'Service unavailable - using fallback data'
      };
    }
  }

  /**
   * Get top trading setups for an asset type
   */
  async getTopSetups(
    asset_type: 'stocks' | 'currency_pairs' | 'commodities' | 'crypto',
    count: number = 3,
    risk_tolerance: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<TopSetupsResponse> {
    try {
      // Use AbortSignal with timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds

      try {
        const response = await fetch(`${this.baseUrl}/api/top-setups`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            asset_type,
            count,
            risk_tolerance,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('RL API endpoint not found. Please check if the service is running.');
          }
          throw new Error(`RL API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // Check if it's a timeout/abort error
        if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('timeout'))) {
          console.warn('Top setups request timed out - using fallback data');
          throw new Error('Request timeout - setup service may be slow or unavailable');
        }
        
        throw fetchError;
      }
    } catch (error) {
      // Only log unexpected errors, not timeouts
      if (error instanceof Error && !error.message.includes('timeout')) {
        console.error('Error getting top setups:', error);
      }
      
      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        console.warn('Network request failed - RL API may be down or unreachable');
      }
      
      // Return a fallback response instead of throwing
      return {
        asset_type,
        timestamp: new Date().toISOString(),
        count: 0,
        setups: [],
        metadata: {
          symbols_analyzed: 0,
          model_version: 'unavailable',
          risk_tolerance
        }
      };
    }
  }

  /**
   * Analyze portfolio
   */
  async analyzePortfolio(symbols: string[], weights: number[]): Promise<PortfolioResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/portfolio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols,
          weights,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('RL API endpoint not found. Please check if the service is running.');
        }
        throw new Error(`RL API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error analyzing portfolio:', error);
      
      // Return fallback portfolio analysis
      return {
        portfolio: {
          symbols,
          weights,
          holdings: symbols.map((symbol, index) => ({
            symbol,
            weight: weights[index],
            current_price: 100 + (index * 10),
            allocation: `${(weights[index] * 100).toFixed(1)}%`
          }))
        },
        metrics: {
          total_return: 0,
          annualized_return: 0,
          volatility: 0,
          sharpe_ratio: 0,
          max_drawdown: 0,
          period_days: 30,
          timestamp: new Date().toISOString()
        },
        recommendations: {
          rebalance_needed: false,
          risk_level: 'Unknown',
          diversification_score: 0
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Chat with RL chatbot
   */
  async chat(message: string, context?: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('RL API endpoint not found. Please check if the service is running.');
        }
        throw new Error(`RL API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error chatting with RL bot:', error);
      
      // Return fallback chat response
      return {
        query: message,
        response: {
          answer: "I'm currently unable to connect to the RL service. Please try again later or contact support if the issue persists.",
          confidence: 0,
          sources: ['Service Unavailable']
        },
        timestamp: new Date().toISOString(),
        model: 'Fallback Response'
      };
    }
  }

  /**
   * Get game leaderboard
   */
  async getGameLeaderboard(): Promise<GameLeaderboard> {
    try {
      const response = await fetch(`${this.baseUrl}/api/game/leaderboard`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('RL API endpoint not found. Please check if the service is running.');
        }
        throw new Error(`RL API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting game leaderboard:', error);
      
      // Return fallback leaderboard
      return {
        leaderboard: [
          { rank: 1, username: 'Service Unavailable', score: 0, sharpe: 0, games: 0 }
        ],
        period: 'unavailable',
        last_updated: new Date().toISOString()
      };
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const response = await fetch(`${this.baseUrl}/api/metrics/summary`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('RL API endpoint not found. Please check if the service is running.');
        }
        throw new Error(`RL API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting system metrics:', error);
      
      // Return fallback metrics
      return {
        system: {
          status: 'unavailable',
          uptime: '0%',
          last_data_update: new Date().toISOString(),
          database_type: 'Unknown'
        },
        data: {
          symbols_tracked: 0,
          symbols: [],
          last_fetch: new Date().toISOString()
        },
        models: {
          active_models: 0,
          loaded_models: 0,
          model_types: []
        },
        users: {
          active_users: 0,
          games_in_progress: 0
        }
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.error('RL API health check failed:', error);
      return false;
    }
  }

  /**
   * Test network connectivity
   */
  async testConnectivity(): Promise<{ connected: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        return { connected: true };
      } else {
        return { 
          connected: false, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }
    } catch (error) {
      console.error('Network connectivity test failed:', error);
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown network error' 
      };
    }
  }
}

// Export singleton instance
export const rlAgentService = new RLAgentService();

