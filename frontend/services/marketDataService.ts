import { alphaVantageService, AlphaVantageCandleData } from './alphaVantageService';
import { API_CONFIG } from '../config/apiConfig';
import { resolveBackendURL } from '../utils/networkConfig';
import { getAuthHeaders } from './apiService';

export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  data: AlphaVantageCandleData[];
  _isMockData?: boolean; // Internal flag to indicate if data is from mock generator
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

    // PRIMARY: Try backend database first
    try {
      const backendUrl = await resolveBackendURL(3000);
      const response = await fetch(
        `${backendUrl}/api/market-data/history/${symbol}?period=1mo`,
        {
          headers: await getAuthHeaders(),
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          // Convert backend data to AlphaVantageCandleData format
          const data: AlphaVantageCandleData[] = result.data.map((candle: any) => ({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));
          
          const latest = data[data.length - 1];
          const previous = data.length > 1 ? data[data.length - 2] : latest;
          
          const change = latest.close - previous.close;
          const changePercent = (change / previous.close) * 100;

          const marketData: MarketData = {
            symbol,
            name: this.getSymbolName(symbol),
            price: latest.close,
            change,
            changePercent,
            volume: result.data[result.data.length - 1]?.volume || 0,
            data,
            _isMockData: false // Real data from database
          };

          // Cache the data
          this.cache.set(symbol, marketData);
          this.cacheExpiry.set(symbol, Date.now() + this.CACHE_DURATION);

          console.log(`✓ Using database data for ${symbol}`);
          return marketData;
        }
      }
    } catch (dbError) {
      console.warn(`Database fetch failed for ${symbol}, trying Alpha Vantage...`, dbError);
    }

    // FALLBACK 1: Try Alpha Vantage
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
        data,
        _isMockData: false // Real data from Alpha Vantage
      };

      // Cache the data
      this.cache.set(symbol, marketData);
      this.cacheExpiry.set(symbol, Date.now() + this.CACHE_DURATION);

      return marketData;
    } catch (error) {
      console.warn(`Alpha Vantage failed for ${symbol}, trying chatbot API...`);
      
      // Fallback to chatbot market API (uses yfinance)
      try {
        const chatbotUrl = process.env.EXPO_PUBLIC_CHATBOT_URL || 'http://localhost:8000';
        const response = await fetch(
          `${chatbotUrl}/v1/market/ohlc?symbol=${symbol}&period=1mo&interval=1d`
        );
        
        if (response.ok) {
          const ohlcData = await response.json();
          if (ohlcData.candles && ohlcData.candles.length > 0) {
            // Convert candles to AlphaVantage format
            const data: AlphaVantageCandleData[] = ohlcData.candles.map((candle: any) => ({
              time: new Date(candle.t * 1000).toISOString().split('T')[0],
              open: candle.o,
              high: candle.h,
              low: candle.l,
              close: candle.c,
            }));
            
            const latest = data[data.length - 1];
            const previous = data.length > 1 ? data[data.length - 2] : latest;
            
            const change = latest.close - previous.close;
            const changePercent = (change / previous.close) * 100;

            const marketData: MarketData = {
              symbol,
              name: this.getSymbolName(symbol),
              price: latest.close,
              change,
              changePercent,
              volume: 0,
              data,
              _isMockData: false // Real data from chatbot API
            };

            // Cache the data
            this.cache.set(symbol, marketData);
            this.cacheExpiry.set(symbol, Date.now() + this.CACHE_DURATION);

            return marketData;
          }
        }
      } catch (chatbotError) {
        console.warn(`Chatbot API also failed for ${symbol}:`, chatbotError);
      }
      
      // All APIs failed - use mock data as last resort
      console.warn(`All data sources failed for ${symbol}, using mock data as last resort`);
      const mockData = alphaVantageService['generateMockData'] ? 
        (alphaVantageService as any).generateMockData(symbol) : 
        this.generateMockData(symbol);
      
      const latest = mockData[mockData.length - 1];
      const previous = mockData.length > 1 ? mockData[mockData.length - 2] : latest;
      
      const change = latest.close - previous.close;
      const changePercent = (change / previous.close) * 100;

      const marketData: MarketData = {
        symbol,
        name: this.getSymbolName(symbol),
        price: latest.close,
        change,
        changePercent,
        volume: 0,
        data: mockData,
        _isMockData: true // Mark as mock data
      };

      // Cache the data
      this.cache.set(symbol, marketData);
      this.cacheExpiry.set(symbol, Date.now() + this.CACHE_DURATION);

      return marketData;
    }
  }

  /**
   * Generate mock data as last resort when all APIs fail
   */
  private generateMockData(symbol: string, days: number = 30): AlphaVantageCandleData[] {
    const data: AlphaVantageCandleData[] = [];
    const basePrice = this.getBasePriceForSymbol(symbol);
    let currentPrice = basePrice;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const volatility = 0.02; // 2% daily volatility
      const change = (Math.random() - 0.5) * volatility;
      const open = currentPrice;
      const close = open * (1 + change);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      
      data.push({
        time: date.toISOString().split('T')[0],
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
      });
      
      currentPrice = close;
    }
    
    return data;
  }

  /**
   * Get base price for symbol to generate realistic mock data
   */
  private getBasePriceForSymbol(symbol: string): number {
    const basePrices: { [key: string]: number } = {
      'AAPL': 175,
      'TSLA': 250,
      'MSFT': 380,
      'GOOGL': 140,
      'AMZN': 150,
      'META': 320,
      'NVDA': 480,
      'SPY': 450,
      'QQQ': 380,
      'IWM': 200,
      'BTC': 45000,
      'ETH': 2800,
      'COIN': 180,
      'ARKK': 45,
    };
    return basePrices[symbol] || 100;
  }

  /**
   * Get available symbols from backend database
   */
  async getAvailableSymbols(assetType?: string): Promise<string[]> {
    try {
      const backendUrl = await resolveBackendURL(3000);
      const params = assetType ? `?assetType=${assetType}` : '';
      const url = `${backendUrl}/api/market-data/available-symbols${params}`;
      
      console.log(`Fetching available symbols from: ${url}`);
      
      const response = await fetch(url, {
        headers: await getAuthHeaders(),
      });
      
      console.log(`Backend response status: ${response.status}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`Backend response:`, result);
        
        if (result.success && Array.isArray(result.data)) {
          console.log(`✓ Got ${result.data.length} symbols from backend`);
          return result.data;
        } else {
          console.warn('Backend response format invalid:', result);
        }
      } else {
        const errorText = await response.text();
        console.error(`Backend error ${response.status}:`, errorText);
      }
    } catch (error) {
      console.error('Failed to fetch available symbols from backend:', error);
      // Don't fall back to mock data - throw error so caller knows
      throw new Error(`Failed to fetch symbols from backend: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Only fall back to popular symbols if explicitly requested (for testing)
    // In production, we should fail if backend is unavailable
    console.warn('No symbols from backend, returning empty array (not falling back to mock)');
    return [];
  }

  async getMultipleStocks(symbols: string[]): Promise<MarketData[]> {
    const promises = symbols.map(symbol => this.getStockData(symbol));
    return Promise.all(promises);
  }

  /**
   * Check if real data is available for a symbol
   * Returns true if real data was successfully fetched, false if using mock data
   */
  async checkDataAvailability(symbol: string): Promise<boolean> {
    try {
      // Try to get real data (this will use cache if available)
      const data = await this.getStockData(symbol);
      
      // Explicitly check the _isMockData flag first
      if (data._isMockData === true) {
        return false; // Mock data - no real data available
      }
      
      // If flag is explicitly false or undefined, assume real data
      // Also check if we have actual data points
      if (data.data.length > 0) {
        return true; // Real data available
      }
      return false;
    } catch (error) {
      return false;
    }
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
