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
  private portfolioData: PortfolioItem[] = [
    { symbol: 'AAPL', name: 'Apple Inc.', shares: 50, value: 7882.50, change: +5.13 },
    { symbol: 'TSLA', name: 'Tesla Inc.', shares: 25, value: 5680.00, change: -5.36 },
    { symbol: 'BTC', name: 'Bitcoin', shares: 0.5, value: 24112.50, change: +7.23 },
    { symbol: 'ETH', name: 'Ethereum', shares: 2.0, value: 6616.00, change: +3.45 },
  ];

  /**
   * Get portfolio data with real-time market data for each asset
   */
  async getPortfolioData(): Promise<PortfolioData> {
    const portfolioWithData = await Promise.all(
      this.portfolioData.map(async (item) => {
        try {
          const marketData = await alphaVantageService.getDailyData(item.symbol, 'compact');
          return {
            ...item,
            data: marketData.slice(-30), // Last 30 days
          };
        } catch (error) {
          console.warn(`Failed to fetch data for ${item.symbol}:`, error);
          return item;
        }
      })
    );

    const totalValue = portfolioWithData.reduce((sum, item) => sum + item.value, 0);
    const totalChange = 5.4; // This could be calculated from individual changes

    return {
      items: portfolioWithData,
      totalValue,
      totalChange,
    };
  }

  /**
   * Get specific portfolio item data
   */
  async getPortfolioItem(symbol: string): Promise<PortfolioItem | null> {
    const item = this.portfolioData.find(item => item.symbol === symbol);
    if (!item) return null;

    try {
      const marketData = await alphaVantageService.getDailyData(symbol, 'compact');
      return {
        ...item,
        data: marketData.slice(-30),
      };
    } catch (error) {
      console.warn(`Failed to fetch data for ${symbol}:`, error);
      return item;
    }
  }

  /**
   * Get market opportunities data
   */
  async getMarketOpportunities(): Promise<PortfolioItem[]> {
    const opportunitySymbols = ['NVDA', 'COIN', 'ARKK'];
    
    return Promise.all(
      opportunitySymbols.map(async (symbol, index) => {
        const names = ['NVDA - AI Leader', 'COIN - Crypto Play', 'ARKK - Innovation ETF'];
        
        try {
          const marketData = await alphaVantageService.getDailyData(symbol, 'compact');
          return {
            symbol,
            name: names[index],
            shares: 0,
            value: marketData[marketData.length - 1]?.close || 100,
            change: Math.random() * 10 - 5, // Random change for demo
            data: marketData.slice(-10), // Last 10 days
          };
        } catch (error) {
          console.warn(`Failed to fetch opportunity data for ${symbol}:`, error);
          return {
            symbol,
            name: names[index],
            shares: 0,
            value: 100,
            change: 0,
            data: [],
          };
        }
      })
    );
  }

  /**
   * Add new portfolio item
   */
  addPortfolioItem(item: Omit<PortfolioItem, 'data'>): void {
    this.portfolioData.push(item);
  }

  /**
   * Remove portfolio item
   */
  removePortfolioItem(symbol: string): void {
    this.portfolioData = this.portfolioData.filter(item => item.symbol !== symbol);
  }

  /**
   * Update portfolio item
   */
  updatePortfolioItem(symbol: string, updates: Partial<PortfolioItem>): void {
    const index = this.portfolioData.findIndex(item => item.symbol === symbol);
    if (index !== -1) {
      this.portfolioData[index] = { ...this.portfolioData[index], ...updates };
    }
  }
}

// Export singleton instance
export const portfolioService = new PortfolioService();
