import { alphaVantageService, AlphaVantageCandleData } from './alphaVantageService';

export interface PortfolioItem {
  symbol: string;
  name: string;
  shares: number;
  value: number;
  change: number;
  data?: AlphaVantageCandleData[];
}

export interface PortfolioData {
  items: PortfolioItem[];
  totalValue: number;
  totalChange: number;
}

class PortfolioService {
  /**
   * Get portfolio data with real-time market data for each asset
   * Fetches actual user holdings from backend API
   */
  async getPortfolioData(): Promise<PortfolioData> {
    try {
      // Fetch real portfolio items from backend API
      const { apiService } = await import('./apiService');
      const portfolioResponse = await apiService.getPortfolio();
      const itemsResponse = await apiService.getPortfolioItems();
      
      if (!itemsResponse.success || !itemsResponse.data || !Array.isArray(itemsResponse.data)) {
        // No portfolio items, return empty portfolio
        return {
          items: [],
          totalValue: portfolioResponse.data?.TotalValue || portfolioResponse.data?.current_value || 0,
          totalChange: 0,
        };
      }

      const positions = itemsResponse.data;
      
      // Convert backend positions to frontend PortfolioItem format with real-time data
      const portfolioWithData = await Promise.all(
        positions.map(async (position: any) => {
          const symbol = position.symbol || position.Symbol;
          const quantity = position.quantity || position.Quantity || 0;
          const averagePrice = position.average_price || position.AveragePrice || 0;
          
          try {
            // Fetch real-time market data
            const marketData = await alphaVantageService.getDailyData(symbol, 'compact');
            const latestPrice = marketData[marketData.length - 1]?.close || position.current_price || averagePrice;
            const previousPrice = marketData.length > 1 ? marketData[marketData.length - 2]?.close : latestPrice;
            
            // Calculate current value
            const currentValue = latestPrice * quantity;
            
            // Calculate change percentage (from previous day)
            const change = previousPrice ? ((latestPrice - previousPrice) / previousPrice) * 100 : 0;
            
            // Get asset name (try multiple fields)
            const name = position.name || position.Name || position.asset_name || `${symbol} - Stock`;
            
            return {
              symbol,
              name,
              shares: quantity,
              value: currentValue,
              change,
              data: marketData.slice(-30), // Last 30 days
            };
          } catch (error) {
            console.warn(`Failed to fetch market data for ${symbol}:`, error);
            // Fallback: use position data from backend
            const currentPrice = position.current_price || position.CurrentPrice || averagePrice;
            const currentValue = currentPrice * quantity;
            
            return {
              symbol,
              name: position.name || position.Name || `${symbol} - Stock`,
              shares: quantity,
              value: currentValue,
              change: 0, // Can't calculate without market data
              data: [],
            };
          }
        })
      );

      // Calculate total value and change
      const totalValue = portfolioWithData.reduce((sum, item) => sum + item.value, 0);
      const portfolioTotalValue = portfolioResponse.data?.TotalValue || portfolioResponse.data?.current_value || totalValue;
      
      // Calculate weighted average change
      const totalChange = portfolioWithData.length > 0
        ? portfolioWithData.reduce((sum, item) => {
            const weight = item.value / totalValue;
            return sum + (item.change * weight);
          }, 0)
        : 0;

      return {
        items: portfolioWithData,
        totalValue: portfolioTotalValue || totalValue,
        totalChange,
      };
    } catch (error) {
      console.error('Failed to fetch portfolio data from backend:', error);
      // Return empty portfolio on error
      return {
        items: [],
        totalValue: 0,
        totalChange: 0,
      };
    }
  }

  /**
   * Get specific portfolio item data from backend
   */
  async getPortfolioItem(symbol: string): Promise<PortfolioItem | null> {
    try {
      const { apiService } = await import('./apiService');
      const itemsResponse = await apiService.getPortfolioItems();
      
      if (!itemsResponse.success || !itemsResponse.data || !Array.isArray(itemsResponse.data)) {
        return null;
      }

      const position = itemsResponse.data.find((p: any) => 
        (p.symbol || p.Symbol) === symbol
      );
      
      if (!position) {
        return null;
      }

      const quantity = position.quantity || position.Quantity || 0;
      const averagePrice = position.average_price || position.AveragePrice || 0;
      
      try {
        const marketData = await alphaVantageService.getDailyData(symbol, 'compact');
        const latestPrice = marketData[marketData.length - 1]?.close || position.current_price || averagePrice;
        const previousPrice = marketData.length > 1 ? marketData[marketData.length - 2]?.close : latestPrice;
        const change = previousPrice ? ((latestPrice - previousPrice) / previousPrice) * 100 : 0;
        
        return {
          symbol,
          name: position.name || position.Name || `${symbol} - Stock`,
          shares: quantity,
          value: latestPrice * quantity,
          change,
          data: marketData.slice(-30),
        };
      } catch (error) {
        console.warn(`Failed to fetch market data for ${symbol}:`, error);
        const currentPrice = position.current_price || position.CurrentPrice || averagePrice;
        return {
          symbol,
          name: position.name || position.Name || `${symbol} - Stock`,
          shares: quantity,
          value: currentPrice * quantity,
          change: 0,
          data: [],
        };
      }
    } catch (error) {
      console.error(`Failed to fetch portfolio item ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get market opportunities data from RL signals or top setups
   */
  async getMarketOpportunities(): Promise<PortfolioItem[]> {
    try {
      // Try to get real opportunities from RL backend or backend API
      const rlServiceUrl = process.env.EXPO_PUBLIC_RL_SERVICE_URL || 'http://localhost:5002';
      const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      
      // Try RL backend first
      try {
        const rlResponse = await fetch(`${rlServiceUrl}/api/top-setups?asset_type=stocks&limit=5&risk_level=medium`);
        if (rlResponse.ok) {
          const rlData = await rlResponse.json();
          if (rlData.setups && rlData.setups.length > 0) {
            return Promise.all(
              rlData.setups.slice(0, 5).map(async (setup: any) => {
                const symbol = setup.symbol || setup.Symbol;
                try {
                  const marketData = await alphaVantageService.getDailyData(symbol, 'compact');
                  const latestPrice = marketData[marketData.length - 1]?.close || setup.entry_strategy?.price || 100;
                  const previousPrice = marketData.length > 1 ? marketData[marketData.length - 2]?.close : latestPrice;
                  const change = previousPrice ? ((latestPrice - previousPrice) / previousPrice) * 100 : 0;
                  
                  return {
                    symbol,
                    name: setup.name || `${symbol} - ${setup.asset_type || 'Stock'}`,
                    shares: 0,
                    value: latestPrice,
                    change,
                    data: marketData.slice(-30), // Last 30 days
                  };
                } catch (error) {
                  console.warn(`Failed to fetch data for ${symbol}:`, error);
                  return {
                    symbol,
                    name: setup.name || symbol,
                    shares: 0,
                    value: setup.entry_strategy?.price || 100,
                    change: 0,
                    data: [],
                  };
                }
              })
            );
          }
        }
      } catch (rlError) {
        console.warn('RL service unavailable, trying backend signals...', rlError);
      }
      
      // Fallback to backend signals
      try {
        const { apiService } = await import('./apiService');
        const signalsResponse = await apiService.getTopSignals(null, 5);
        if (signalsResponse.success && signalsResponse.data) {
          const signals = Array.isArray(signalsResponse.data) 
            ? signalsResponse.data 
            : signalsResponse.data.signals || [];
          
          if (signals.length > 0) {
            return Promise.all(
              signals.slice(0, 5).map(async (signal: any) => {
                const symbol = signal.Symbol || signal.symbol;
                try {
                  const marketData = await alphaVantageService.getDailyData(symbol, 'compact');
                  const latestPrice = marketData[marketData.length - 1]?.close || signal.EntryPrice || 100;
                  const previousPrice = marketData.length > 1 ? marketData[marketData.length - 2]?.close : latestPrice;
                  const change = previousPrice ? ((latestPrice - previousPrice) / previousPrice) * 100 : (signal.ExpectedReturn || 0);
                  
                  return {
                    symbol,
                    name: signal.Name || `${symbol} - ${signal.AssetType || 'Stock'}`,
                    shares: 0,
                    value: latestPrice,
                    change,
                    data: marketData.slice(-30),
                  };
                } catch (error) {
                  console.warn(`Failed to fetch data for ${symbol}:`, error);
                  return {
                    symbol,
                    name: signal.Name || symbol,
                    shares: 0,
                    value: signal.EntryPrice || 100,
                    change: signal.ExpectedReturn || 0,
                    data: [],
                  };
                }
              })
            );
          }
        }
      } catch (backendError) {
        console.warn('Backend signals unavailable:', backendError);
      }
      
      // Final fallback: Use popular symbols with real data
      const fallbackSymbols = ['NVDA', 'COIN', 'ARKK', 'AAPL', 'MSFT'];
      return Promise.all(
        fallbackSymbols.map(async (symbol) => {
          try {
            const marketData = await alphaVantageService.getDailyData(symbol, 'compact');
            const latestPrice = marketData[marketData.length - 1]?.close || 100;
            const previousPrice = marketData.length > 1 ? marketData[marketData.length - 2]?.close : latestPrice;
            const change = previousPrice ? ((latestPrice - previousPrice) / previousPrice) * 100 : 0;
            
            return {
              symbol,
              name: `${symbol} - Market Opportunity`,
              shares: 0,
              value: latestPrice,
              change,
              data: marketData.slice(-30),
            };
          } catch (error) {
            console.warn(`Failed to fetch fallback data for ${symbol}:`, error);
            return {
              symbol,
              name: `${symbol} - Market Opportunity`,
              shares: 0,
              value: 100,
              change: 0,
              data: [],
            };
          }
        })
      );
    } catch (error) {
      console.error('Failed to fetch market opportunities:', error);
      return [];
    }
  }

  /**
   * Add new portfolio item (creates position via backend API)
   * Note: This should be done through the backend API, not directly
   */
  async addPortfolioItem(item: Omit<PortfolioItem, 'data'>): Promise<boolean> {
    try {
      // This should be handled by the backend API when creating positions
      // For now, just log that this method is deprecated
      console.warn('addPortfolioItem: Use backend API to create positions instead');
      return false;
    } catch (error) {
      console.error('Failed to add portfolio item:', error);
      return false;
    }
  }

  /**
   * Remove portfolio item (removes position via backend API)
   * Note: This should be done through the backend API, not directly
   */
  async removePortfolioItem(symbol: string): Promise<boolean> {
    try {
      // This should be handled by the backend API when closing positions
      console.warn('removePortfolioItem: Use backend API to close positions instead');
      return false;
    } catch (error) {
      console.error('Failed to remove portfolio item:', error);
      return false;
    }
  }

  /**
   * Update portfolio item (updates position via backend API)
   * Note: This should be done through the backend API, not directly
   */
  async updatePortfolioItem(symbol: string, updates: Partial<PortfolioItem>): Promise<boolean> {
    try {
      // This should be handled by the backend API when updating positions
      console.warn('updatePortfolioItem: Use backend API to update positions instead');
      return false;
    } catch (error) {
      console.error('Failed to update portfolio item:', error);
      return false;
    }
  }
}

// Export singleton instance
export const portfolioService = new PortfolioService();
