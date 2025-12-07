/**
 * Cached Asset Service
 * Fetches assets from database and caches them to avoid repeated API calls
 */

import { apiService } from './apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TradingAsset {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'commodity' | 'crypto' | 'forex';
  category?: string;
  basePrice?: number;
  risk?: 'low' | 'medium' | 'high';
  description?: string;
  exchange?: string;
  currency?: string;
}

const CACHE_KEY = 'cached_assets';
const CACHE_EXPIRY_KEY = 'cached_assets_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

class CachedAssetService {
  private cache: TradingAsset[] | null = null;
  private cacheExpiry: number = 0;

  /**
   * Get all available symbols from database
   */
  async getAvailableSymbols(assetType?: string): Promise<string[]> {
    try {
      const backendUrl = await import('../utils/networkConfig').then(m => m.resolveBackendURL(3000));
      const token = await AsyncStorage.getItem('authToken');
      
      const params = assetType ? `?assetType=${assetType}` : '';
      const response = await fetch(`${backendUrl}/api/market-data/available-symbols${params}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (response.ok) {
        const result = await response.json();
        return result.success ? result.data : [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching available symbols:', error);
      return [];
    }
  }

  /**
   * Convert database symbols to TradingAsset format
   */
  private async symbolsToAssets(symbols: string[]): Promise<TradingAsset[]> {
    // Map symbols to asset format
    // Try to infer asset type from symbol format
    const assets: TradingAsset[] = symbols.map((symbol, index) => {
      let type: TradingAsset['type'] = 'stock';
      let risk: TradingAsset['risk'] = 'medium';
      
      // Detect asset type from symbol
      if (symbol.endsWith('=X')) {
        type = 'forex';
      } else if (symbol.includes('-USD') || symbol.includes('-USDT')) {
        type = 'crypto';
      } else if (symbol.endsWith('=F')) {
        type = 'commodity';
      } else if (symbol.startsWith('^')) {
        type = 'etf'; // Indices treated as ETFs
      } else if (['SPY', 'QQQ', 'VTI', 'IWM', 'DIA'].includes(symbol)) {
        type = 'etf';
        risk = 'low';
      }

      return {
        id: `asset_${index}`,
        symbol,
        name: this.getSymbolName(symbol),
        type,
        risk,
        category: this.getCategory(type),
      };
    });

    return assets;
  }

  /**
   * Get symbol display name
   */
  private getSymbolName(symbol: string): string {
    // Common symbol names
    const symbolNames: Record<string, string> = {
      'SPY': 'S&P 500 ETF',
      'QQQ': 'Tech ETF',
      'AAPL': 'Apple Inc.',
      'MSFT': 'Microsoft',
      'GOOGL': 'Google/Alphabet',
      'AMZN': 'Amazon',
      'TSLA': 'Tesla',
      'NVDA': 'NVIDIA',
      'META': 'Meta (Facebook)',
      'NFLX': 'Netflix',
      'BTC-USD': 'Bitcoin',
      'ETH-USD': 'Ethereum',
      'EURUSD=X': 'Euro/US Dollar',
      'GBPUSD=X': 'British Pound/US Dollar',
      'GC=F': 'Gold Futures',
      'CL=F': 'Crude Oil Futures',
    };

    return symbolNames[symbol] || symbol;
  }

  /**
   * Get category from asset type
   */
  private getCategory(type: TradingAsset['type']): string {
    const categories: Record<TradingAsset['type'], string> = {
      stock: 'Stocks',
      etf: 'ETFs',
      crypto: 'Cryptocurrency',
      forex: 'Forex',
      commodity: 'Commodities',
    };
    return categories[type] || 'Other';
  }

  /**
   * Load assets from cache or fetch from API
   */
  async getAssets(filters?: { type?: string; limit?: number }): Promise<TradingAsset[]> {
    // Check cache first
    const cached = await this.getCachedAssets();
    if (cached && cached.length > 0) {
      let filtered = cached;
      
      if (filters?.type && filters.type !== 'all') {
        filtered = filtered.filter(asset => asset.type === filters.type);
      }
      
      if (filters?.limit) {
        filtered = filtered.slice(0, filters.limit);
      }
      
      return filtered;
    }

    // Cache miss - fetch from API
    try {
      const symbols = await this.getAvailableSymbols(filters?.type);
      const assets = await this.symbolsToAssets(symbols);
      
      // Cache the results
      await this.setCachedAssets(assets);
      
      // Apply filters
      let filtered = assets;
      if (filters?.limit) {
        filtered = filtered.slice(0, filters.limit);
      }
      
      return filtered;
    } catch (error) {
      console.error('Error fetching assets:', error);
      return [];
    }
  }

  /**
   * Get cached assets from AsyncStorage
   */
  private async getCachedAssets(): Promise<TradingAsset[] | null> {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      const cachedExpiry = await AsyncStorage.getItem(CACHE_EXPIRY_KEY);
      
      if (!cachedData || !cachedExpiry) {
        return null;
      }

      const expiry = parseInt(cachedExpiry, 10);
      if (Date.now() > expiry) {
        // Cache expired
        await AsyncStorage.removeItem(CACHE_KEY);
        await AsyncStorage.removeItem(CACHE_EXPIRY_KEY);
        return null;
      }

      return JSON.parse(cachedData) as TradingAsset[];
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }

  /**
   * Set cached assets in AsyncStorage
   */
  private async setCachedAssets(assets: TradingAsset[]): Promise<void> {
    try {
      const expiry = Date.now() + CACHE_DURATION;
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(assets));
      await AsyncStorage.setItem(CACHE_EXPIRY_KEY, expiry.toString());
    } catch (error) {
      console.error('Error writing cache:', error);
    }
  }

  /**
   * Clear the cache
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      await AsyncStorage.removeItem(CACHE_EXPIRY_KEY);
      this.cache = null;
      this.cacheExpiry = 0;
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Refresh cache by fetching fresh data
   */
  async refreshCache(filters?: { type?: string }): Promise<TradingAsset[]> {
    await this.clearCache();
    return this.getAssets(filters);
  }
}

export const cachedAssetService = new CachedAssetService();

