import { getAlphaVantageKey } from '../config/apiKeys';

export interface AlphaVantageCandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AlphaVantageResponse {
  'Meta Data': {
    '1. Information': string;
    '2. Symbol': string;
    '3. Last Refreshed': string;
    '4. Interval': string;
    '5. Output Size': string;
    '6. Time Zone': string;
  };
  'Time Series (Daily)': {
    [date: string]: {
      '1. open': string;
      '2. high': string;
      '3. low': string;
      '4. close': string;
      '5. volume': string;
    };
  };
}

export class AlphaVantageService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://www.alphavantage.co/query';
  private errorLogged = false;
  private rateLimitLogged = false;
  private missingDataLogged = false;
  private networkErrorLogged = false;

  constructor() {
    this.apiKey = getAlphaVantageKey();
  }

  /**
   * Generate mock data for a symbol when API fails
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
   * Fetch daily stock data from Alpha Vantage
   * @param symbol Stock symbol (e.g., 'AAPL', 'MSFT', 'SPY')
   * @param outputSize 'compact' for last 100 data points, 'full' for 20+ years
   */
  async getDailyData(symbol: string, outputSize: 'compact' | 'full' = 'compact'): Promise<AlphaVantageCandleData[]> {
    try {
      const url = `${this.baseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputSize}&apikey=${this.apiKey}`;
      
      const response = await fetch(url);
      const data: AlphaVantageResponse = await response.json();
      
      if (data['Error Message']) {
        // Only log error once per session to reduce noise
        if (!this.errorLogged) {
          console.warn(`Alpha Vantage API Error: ${data['Error Message']}. Using mock data for all symbols.`);
          this.errorLogged = true;
        }
        return this.generateMockData(symbol);
      }
      
      if (data['Note']) {
        // Only log rate limit note once per session
        if (!this.rateLimitLogged) {
          console.warn(`Alpha Vantage API Rate Limit: ${data['Note']}. Using mock data for all symbols.`);
          this.rateLimitLogged = true;
        }
        return this.generateMockData(symbol);
      }
      
      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        // Only log missing data warning once per session
        if (!this.missingDataLogged) {
          console.warn(`No time series data available from Alpha Vantage API. Using mock data for all symbols.`);
          this.missingDataLogged = true;
        }
        return this.generateMockData(symbol);
      }
      
      // Convert Alpha Vantage format to our format
      const candleData: AlphaVantageCandleData[] = Object.entries(timeSeries)
        .map(([date, values]) => ({
          time: date,
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
        }))
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      
      return candleData;
    } catch (error) {
      // Only log network error once per session
      if (!this.networkErrorLogged) {
        console.warn(`Network error connecting to Alpha Vantage API. Using mock data for all symbols.`);
        this.networkErrorLogged = true;
      }
      return this.generateMockData(symbol);
    }
  }

  /**
   * Fetch intraday data (1min, 5min, 15min, 30min, 60min intervals)
   * @param symbol Stock symbol
   * @param interval Time interval
   */
  async getIntradayData(symbol: string, interval: '1min' | '5min' | '15min' | '30min' | '60min' = '5min'): Promise<AlphaVantageCandleData[]> {
    try {
      const url = `${this.baseUrl}?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&outputsize=compact&apikey=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data['Error Message']) {
        // Use existing error logging flags
        if (!this.errorLogged) {
          console.warn(`Alpha Vantage API Error: ${data['Error Message']}. Using mock data for all symbols.`);
          this.errorLogged = true;
        }
        return this.generateMockData(symbol, 10); // Less data for intraday
      }
      
      if (data['Note']) {
        // Use existing rate limit logging flags
        if (!this.rateLimitLogged) {
          console.warn(`Alpha Vantage API Rate Limit: ${data['Note']}. Using mock data for all symbols.`);
          this.rateLimitLogged = true;
        }
        return this.generateMockData(symbol, 10);
      }
      
      const timeSeriesKey = `Time Series (${interval})`;
      const timeSeries = data[timeSeriesKey];
      if (!timeSeries) {
        // Use existing missing data logging flags
        if (!this.missingDataLogged) {
          console.warn(`No time series data available from Alpha Vantage API. Using mock data for all symbols.`);
          this.missingDataLogged = true;
        }
        return this.generateMockData(symbol, 10);
      }
      
      // Convert Alpha Vantage format to our format
      const candleData: AlphaVantageCandleData[] = Object.entries(timeSeries)
        .map(([datetime, values]) => ({
          time: datetime,
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
        }))
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      
      return candleData;
    } catch (error) {
      // Use existing network error logging flags
      if (!this.networkErrorLogged) {
        console.warn(`Network error connecting to Alpha Vantage API. Using mock data for all symbols.`);
        this.networkErrorLogged = true;
      }
      return this.generateMockData(symbol, 10);
    }
  }

  /**
   * Get S&P 500 data (using SPY ETF as proxy)
   */
  async getSP500Data(): Promise<AlphaVantageCandleData[]> {
    return this.getDailyData('SPY', 'compact');
  }

  /**
   * Get popular stock symbols
   */
  getPopularSymbols(): string[] {
    return [
      'AAPL', // Apple
      'MSFT', // Microsoft
      'GOOGL', // Google
      'AMZN', // Amazon
      'TSLA', // Tesla
      'META', // Meta
      'NVDA', // NVIDIA
      'SPY', // S&P 500 ETF
      'QQQ', // NASDAQ ETF
      'IWM', // Russell 2000 ETF
    ];
  }
}

// Export singleton instance
export const alphaVantageService = new AlphaVantageService();
