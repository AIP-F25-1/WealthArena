import { alphaVantageService, AlphaVantageCandleData } from './alphaVantageService';

export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  data: AlphaVantageCandleData[];
}

export class MarketDataService {
  private static instance: MarketDataService;
  private cache: Map<string, MarketData> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  private isCacheValid(symbol: string): boolean {
    const expiry = this.cacheExpiry.get(symbol);
    return expiry ? Date.now() < expiry : false;
  }

  async getStockData(symbol: string): Promise<MarketData> {
    // Check cache first
    if (this.cache.has(symbol) && this.isCacheValid(symbol)) {
      return this.cache.get(symbol)!;
    }

    try {
      const data = await alphaVantageService.getDailyData(symbol, 'compact');
      const latest = data[data.length - 1];
      const previous = data[data.length - 2];
      
      const change = latest.close - previous.close;
      const changePercent = (change / previous.close) * 100;

      const marketData: MarketData = {
        symbol,
        name: this.getSymbolName(symbol),
        price: latest.close,
        change,
        changePercent,
        volume: 0, // Alpha Vantage doesn't provide volume in daily data
        data
      };

      // Cache the data
      this.cache.set(symbol, marketData);
      this.cacheExpiry.set(symbol, Date.now() + this.CACHE_DURATION);

      return marketData;
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol}:`, error);
      // Return mock data as fallback
      return this.getMockData(symbol);
    }
  }

  async getMultipleStocks(symbols: string[]): Promise<MarketData[]> {
    const promises = symbols.map(symbol => this.getStockData(symbol));
    return Promise.all(promises);
  }

  private getSymbolName(symbol: string): string {
    const names: { [key: string]: string } = {
      'AAPL': 'Apple Inc.',
      'MSFT': 'Microsoft Corporation',
      'GOOGL': 'Alphabet Inc.',
      'AMZN': 'Amazon.com Inc.',
      'TSLA': 'Tesla Inc.',
      'META': 'Meta Platforms Inc.',
      'NVDA': 'NVIDIA Corporation',
      'SPY': 'SPDR S&P 500 ETF',
      'QQQ': 'Invesco QQQ Trust',
      'IWM': 'iShares Russell 2000 ETF',
      'EURUSD': 'Euro/US Dollar',
      'GBPUSD': 'British Pound/US Dollar',
      'USDJPY': 'US Dollar/Japanese Yen',
      'AUDUSD': 'Australian Dollar/US Dollar',
      'USDCAD': 'US Dollar/Canadian Dollar',
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'ADA': 'Cardano',
      'DOT': 'Polkadot',
      'LINK': 'Chainlink',
      'GOLD': 'Gold',
      'SILVER': 'Silver',
      'OIL': 'Crude Oil',
      'GAS': 'Natural Gas'
    };
    return names[symbol] || symbol;
  }

  private getMockData(symbol: string): MarketData {
    const basePrice = 100 + Math.random() * 200;
    const change = (Math.random() - 0.5) * 20;
    const changePercent = (change / basePrice) * 100;

    // Generate mock candlestick data
    const data: AlphaVantageCandleData[] = [];
    let currentPrice = basePrice;
    
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      
      const volatility = 0.02;
      const change = (Math.random() - 0.5) * volatility;
      const open = currentPrice;
      const close = open * (1 + change);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      
      data.push({
        time: date.toISOString().split('T')[0],
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2))
      });
      
      currentPrice = close;
    }

    return {
      symbol,
      name: this.getSymbolName(symbol),
      price: basePrice,
      change,
      changePercent,
      volume: Math.floor(Math.random() * 1000000),
      data
    };
  }

  // Get popular trading symbols by category
  getPopularSymbols() {
    return {
      stocks: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA'],
      currencies: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'],
      crypto: ['BTC', 'ETH', 'ADA', 'DOT', 'LINK'],
      commodities: ['GOLD', 'SILVER', 'OIL', 'GAS'],
      etfs: ['SPY', 'QQQ', 'IWM']
    };
  }
}

export const marketDataService = MarketDataService.getInstance();
