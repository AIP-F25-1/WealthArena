/**
 * Asset Service
 * Fetches trading assets (stocks, ETFs, commodities, etc.) from database
 */

import { apiService } from './apiService';

export interface TradingAsset {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'commodity' | 'crypto' | 'forex';
  category: string;
  basePrice: number;
  risk: 'low' | 'medium' | 'high';
  description?: string;
  exchange?: string;
  currency?: string;
}

export interface AssetFilters {
  type?: string;
  category?: string;
  risk?: string;
  limit?: number;
}

class AssetService {
  private baseUrl = '/api/assets';

  /**
   * Get all available trading assets
   */
  async getAssets(filters?: AssetFilters): Promise<TradingAsset[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters?.type) queryParams.append('type', filters.type);
      if (filters?.category) queryParams.append('category', filters.category);
      if (filters?.risk) queryParams.append('risk', filters.risk);
      if (filters?.limit) queryParams.append('limit', filters.limit.toString());

      const response = await apiService.get(`${this.baseUrl}?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching assets:', error);
      // Return mock data as fallback
      return this.getMockAssets(filters);
    }
  }

  /**
   * Get assets by type
   */
  async getAssetsByType(type: string): Promise<TradingAsset[]> {
    return this.getAssets({ type });
  }

  /**
   * Get popular assets for trading
   */
  async getPopularAssets(): Promise<TradingAsset[]> {
    return this.getAssets({ limit: 20 });
  }

  /**
   * Search assets by symbol or name
   */
  async searchAssets(query: string): Promise<TradingAsset[]> {
    try {
      const response = await apiService.get(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      console.error('Error searching assets:', error);
      return this.getMockAssets().filter(asset => 
        asset.symbol.toLowerCase().includes(query.toLowerCase()) ||
        asset.name.toLowerCase().includes(query.toLowerCase())
      );
    }
  }

  /**
   * Get asset categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const response = await apiService.get(`${this.baseUrl}/categories`);
      return response.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      return ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Industrial', 'Materials', 'Utilities', 'Real Estate', 'Communication'];
    }
  }

  /**
   * Mock data fallback
   */
  private getMockAssets(filters?: AssetFilters): TradingAsset[] {
    const mockAssets: TradingAsset[] = [
      // Stocks
      { id: '1', symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', category: 'Technology', basePrice: 175.43, risk: 'medium', exchange: 'NASDAQ', currency: 'USD' },
      { id: '2', symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock', category: 'Technology', basePrice: 378.85, risk: 'medium', exchange: 'NASDAQ', currency: 'USD' },
      { id: '3', symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', category: 'Technology', basePrice: 142.56, risk: 'medium', exchange: 'NASDAQ', currency: 'USD' },
      { id: '4', symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', category: 'Automotive', basePrice: 248.50, risk: 'high', exchange: 'NASDAQ', currency: 'USD' },
      { id: '5', symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', category: 'Consumer', basePrice: 155.83, risk: 'medium', exchange: 'NASDAQ', currency: 'USD' },
      
      // ETFs
      { id: '6', symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', type: 'etf', category: 'Index', basePrice: 456.78, risk: 'low', exchange: 'NYSE', currency: 'USD' },
      { id: '7', symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', category: 'Technology', basePrice: 389.12, risk: 'medium', exchange: 'NASDAQ', currency: 'USD' },
      { id: '8', symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', type: 'etf', category: 'Index', basePrice: 234.56, risk: 'low', exchange: 'NYSE', currency: 'USD' },
      { id: '9', symbol: 'ARKK', name: 'ARK Innovation ETF', type: 'etf', category: 'Technology', basePrice: 45.67, risk: 'high', exchange: 'NYSE', currency: 'USD' },
      
      // Commodities
      { id: '10', symbol: 'GLD', name: 'SPDR Gold Shares', type: 'commodity', category: 'Precious Metals', basePrice: 185.34, risk: 'medium', exchange: 'NYSE', currency: 'USD' },
      { id: '11', symbol: 'SLV', name: 'iShares Silver Trust', type: 'commodity', category: 'Precious Metals', basePrice: 22.45, risk: 'high', exchange: 'NYSE', currency: 'USD' },
      { id: '12', symbol: 'USO', name: 'United States Oil Fund', type: 'commodity', category: 'Energy', basePrice: 78.90, risk: 'high', exchange: 'NYSE', currency: 'USD' },
      
      // Crypto
      { id: '13', symbol: 'BTC/USD', name: 'Bitcoin', type: 'crypto', category: 'Cryptocurrency', basePrice: 43250.00, risk: 'high', currency: 'USD' },
      { id: '14', symbol: 'ETH/USD', name: 'Ethereum', type: 'crypto', category: 'Cryptocurrency', basePrice: 2650.00, risk: 'high', currency: 'USD' },
      { id: '15', symbol: 'ADA/USD', name: 'Cardano', type: 'crypto', category: 'Cryptocurrency', basePrice: 0.45, risk: 'high', currency: 'USD' },
      
      // Forex
      { id: '16', symbol: 'EUR/USD', name: 'Euro/US Dollar', type: 'forex', category: 'Major Pairs', basePrice: 1.0850, risk: 'medium', currency: 'USD' },
      { id: '17', symbol: 'GBP/USD', name: 'British Pound/US Dollar', type: 'forex', category: 'Major Pairs', basePrice: 1.2650, risk: 'medium', currency: 'USD' },
      { id: '18', symbol: 'USD/JPY', name: 'US Dollar/Japanese Yen', type: 'forex', category: 'Major Pairs', basePrice: 149.50, risk: 'medium', currency: 'JPY' },
    ];

    let filteredAssets = mockAssets;

    if (filters?.type) {
      filteredAssets = filteredAssets.filter(asset => asset.type === filters.type);
    }

    if (filters?.category) {
      filteredAssets = filteredAssets.filter(asset => asset.category === filters.category);
    }

    if (filters?.risk) {
      filteredAssets = filteredAssets.filter(asset => asset.risk === filters.risk);
    }

    if (filters?.limit) {
      filteredAssets = filteredAssets.slice(0, filters.limit);
    }

    return filteredAssets;
  }
}

export const assetService = new AssetService();
