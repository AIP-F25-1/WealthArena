/**
 * Market Data Routes
 * Real-time and historical market data endpoints
 * Primary source: Database (from data-pipeline raw files)
 * Fallback: External APIs (Alpha Vantage, yfinance)
 */

import express from 'express';
import { executeQuery } from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/responses';
import { getDataPipelineService } from '../services/dataPipelineService';

const router = express.Router();
const dataPipelineService = getDataPipelineService();

/**
 * GET /api/market-data/symbols
 * Get available trading symbols
 */
router.get('/symbols', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { asset_type, exchange, limit = 100 } = req.query;

    let query = `
      SELECT DISTINCT Symbol, AssetType, Exchange, Name, Sector, MarketCap
      FROM MarketData
      WHERE 1=1
    `;

    const params: any = {};

    if (asset_type) {
      query += ` AND AssetType = @assetType`;
      params.assetType = asset_type;
    }

    if (exchange) {
      query += ` AND Exchange = @exchange`;
      params.exchange = exchange;
    }

    query += ` ORDER BY MarketCap DESC`;

    if (limit) {
      query = `SELECT TOP (@limit) * FROM (${query}) as ranked`;
      params.limit = Number.parseInt(limit as string);
    }

    const result = await executeQuery(query, params);

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch symbols', 500, error);
  }
});

/**
 * GET /api/market-data/history/:symbol
 * Get historical data for a symbol
 * Primary: Database (from data-pipeline)
 * Fallback: External APIs
 */
router.get('/history/:symbol', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { symbol } = req.params;
    const { period = '1mo', days } = req.query;

    // Calculate days from period
    let daysToFetch = 60; // default
    if (days) {
      daysToFetch = Number.parseInt(days as string);
    } else if (period === '1d') {
      daysToFetch = 1;
    } else if (period === '5d') {
      daysToFetch = 5;
    } else if (period === '1mo') {
      daysToFetch = 30;
    } else if (period === '3mo') {
      daysToFetch = 90;
    } else if (period === '6mo') {
      daysToFetch = 180;
    } else if (period === '1y') {
      daysToFetch = 365;
    }

    // Try database first (primary source)
    try {
      const dbData = await dataPipelineService.getMarketData(symbol, daysToFetch);
      
      if (dbData && dbData.length > 0) {
        // Convert to API format
        const formattedData = dbData.map(row => {
          const dateValue = row.Date instanceof Date ? row.Date : new Date(row.Date);
          return {
            time: dateValue.toISOString().split('T')[0],
            open: row.Open,
            high: row.High,
            low: row.Low,
            close: row.Close,
            volume: row.Volume,
          };
        });

        return successResponse(res, formattedData);
      } else {
        // Database returned empty - log for debugging
        console.warn(`No data found in database for symbol ${symbol}. Available symbols:`, 
          (await dataPipelineService.getAvailableSymbols()).slice(0, 10));
      }
    } catch (dbError) {
      console.warn(`Database fetch failed for ${symbol}, trying fallback:`, dbError);
      
      // Log available symbols as suggestion
      try {
        const availableSymbols = await dataPipelineService.getAvailableSymbols();
        if (availableSymbols.length > 0) {
          console.warn(`Available symbols in database: ${availableSymbols.slice(0, 10).join(', ')}`);
        }
      } catch (e) {
        // Ignore error getting available symbols
      }
    }

    // Fallback: Try chatbot API (yfinance)
    try {
      const chatbotUrl = process.env.CHATBOT_URL || 'http://localhost:8000';
      const response = await fetch(
        `${chatbotUrl}/v1/market/ohlc?symbol=${symbol}&period=${period}&interval=1d`
      );

      if (response.ok) {
        const ohlcData = await response.json() as {
          candles?: Array<{
            t: number;
            o: number;
            h: number;
            l: number;
            c: number;
            v?: number;
          }>;
        };
        if (ohlcData.candles && ohlcData.candles.length > 0) {
          const formattedData = ohlcData.candles.map((candle) => ({
            time: new Date(candle.t * 1000).toISOString().split('T')[0],
            open: candle.o,
            high: candle.h,
            low: candle.l,
            close: candle.c,
            volume: candle.v || 0,
          }));

          return successResponse(res, formattedData);
        }
      }
    } catch (chatbotError) {
      console.warn(`Chatbot API fallback failed for ${symbol}:`, chatbotError);
    }

    // No data available
    return errorResponse(res, `No market data available for ${symbol}`, 404);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch historical data', 500, error);
  }
});

/**
 * GET /api/market-data/real-time/:symbol
 * Get real-time data for a symbol
 * Primary: Database (latest record)
 * Fallback: External APIs
 */
router.get('/real-time/:symbol', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { symbol } = req.params;

    // Try database first
    try {
      const latestPrice = await dataPipelineService.getLatestPrice(symbol);
      
      if (latestPrice !== null) {
        // Get full latest record
        const dbData = await dataPipelineService.getMarketData(symbol, 1);
        if (dbData && dbData.length > 0) {
          const latest = dbData[dbData.length - 1];
          const dateValue = latest.Date instanceof Date ? latest.Date : new Date(latest.Date);
          return successResponse(res, {
            symbol: latest.Symbol,
            price: latest.Close,
            open: latest.Open,
            high: latest.High,
            low: latest.Low,
            close: latest.Close,
            volume: latest.Volume,
            date: dateValue,
            assetType: latest.AssetType || 'stock',
          });
        }
      }
    } catch (dbError) {
      console.warn(`Database fetch failed for ${symbol}, trying fallback:`, dbError);
    }

    // Fallback: Try chatbot API
    try {
      const chatbotUrl = process.env.CHATBOT_URL || 'http://localhost:8000';
      const response = await fetch(`${chatbotUrl}/v1/market/quote?symbol=${symbol}`);

      if (response.ok) {
        const quoteData = await response.json() as any;
        return successResponse(res, quoteData);
      }
    } catch (chatbotError) {
      console.warn(`Chatbot API fallback failed for ${symbol}:`, chatbotError);
    }

    return errorResponse(res, `No data available for ${symbol}`, 404);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch real-time data', 500, error);
  }
});

/**
 * POST /api/market-data/update-database
 * Manually trigger database update from raw CSV files
 * (Also runs automatically daily via scheduler)
 */
router.post('/update-database', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await dataPipelineService.updateDatabaseFromRawFiles();
    
    const loadedSymbols = await dataPipelineService.getAvailableSymbols();
    
    return successResponse(res, {
      message: 'Database update completed',
      ...result,
      loadedSymbols: loadedSymbols.slice(0, 50), // Return first 50 symbols as sample
      totalSymbols: loadedSymbols.length,
    });
  } catch (error) {
    return errorResponse(res, 'Failed to update database', 500, error);
  }
});

/**
 * POST /api/market-data/initialize
 * Initialize database by loading CSV data from raw files
 * Should be called on backend startup or manually triggered
 */
router.post('/initialize', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('Initializing database from raw CSV files...');
    const result = await dataPipelineService.updateDatabaseFromRawFiles();
    
    const loadedSymbols = await dataPipelineService.getAvailableSymbols();
    
    return successResponse(res, {
      message: 'Database initialization completed',
      symbolsLoaded: loadedSymbols.length,
      recordsLoaded: result.totalRecords,
      ...result,
    });
  } catch (error) {
    return errorResponse(res, 'Failed to initialize database', 500, error);
  }
});

/**
 * GET /api/market-data/data-status
 * Check if market data has been loaded into database
 */
router.get('/data-status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const symbols = await dataPipelineService.getAvailableSymbols();
    
    // Get asset type distribution
    const assetTypes = new Set<string>();
    for (const symbol of symbols) {
      // Infer asset type from symbol pattern
      if (symbol.includes('=X')) assetTypes.add('forex');
      else if (symbol.includes('=F')) assetTypes.add('commodity');
      else if (['BTC', 'ETH', 'ADA', 'DOT', 'LINK'].includes(symbol)) assetTypes.add('crypto');
      else if (['SPY', 'QQQ', 'IWM'].includes(symbol)) assetTypes.add('etf');
      else assetTypes.add('stock');
    }
    
    return successResponse(res, {
      hasData: symbols.length > 0,
      symbolCount: symbols.length,
      assetTypes: Array.from(assetTypes),
      sampleSymbols: symbols.slice(0, 20),
      lastUpdate: new Date().toISOString(), // Would track actual last update time
    });
  } catch (error) {
    return errorResponse(res, 'Failed to check data status', 500, error);
  }
});

/**
 * GET /api/market-data/internal/history/:symbol
 * Internal endpoint for service-to-service calls (no auth required)
 * Used by RL training service to get market data
 */
router.get('/internal/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { days = 60 } = req.query;
    const daysToFetch = Number.parseInt(days as string);

    // Get data from data pipeline service
    const dbData = await dataPipelineService.getMarketData(symbol, daysToFetch);
    
    if (dbData && dbData.length > 0) {
      // Convert to DataFrame-like format for RL service
      const formattedData = dbData.map(row => {
        const dateValue = row.Date instanceof Date ? row.Date : new Date(row.Date);
        return {
          Date: dateValue.toISOString().split('T')[0],
          Open: row.Open,
          High: row.High,
          Low: row.Low,
          Close: row.Close,
          Volume: row.Volume,
          AssetType: row.AssetType || 'stock'
        };
      });

      return successResponse(res, formattedData);
    }
    
    return errorResponse(res, `No data found for symbol ${symbol}`, 404);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch market data', 500, error);
  }
});

/**
 * GET /api/market-data/internal/available-symbols
 * Internal endpoint for service-to-service calls (no auth required)
 * Used by RL training service to get available symbols
 */
router.get('/internal/available-symbols', async (req, res) => {
  try {
    const { assetType } = req.query;
    
    const symbols = await dataPipelineService.getAvailableSymbols(
      assetType as string | undefined
    );
    
    return successResponse(res, symbols);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch available symbols', 500, error);
  }
});

/**
 * GET /api/market-data/available-symbols
 * Get all available symbols from database
 */
router.get('/available-symbols', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { assetType } = req.query;
    
    const symbols = await dataPipelineService.getAvailableSymbols(
      assetType as string | undefined
    );
    
    return successResponse(res, symbols);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch available symbols', 500, error);
  }
});

/**
 * GET /api/market-data/trending
 * Get trending symbols based on volume and price changes
 */
router.get('/trending', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { limit = 20, timeframe = '1h' } = req.query;

    let timeFilter = '';
    if (timeframe === '1h') {
      timeFilter = 'AND Timestamp >= DATEADD(hour, -1, GETUTCDATE())';
    } else if (timeframe === '4h') {
      timeFilter = 'AND Timestamp >= DATEADD(hour, -4, GETUTCDATE())';
    } else if (timeframe === '1d') {
      timeFilter = 'AND Timestamp >= DATEADD(day, -1, GETUTCDATE())';
    }

    const query = `
      SELECT TOP (@limit)
        Symbol,
        AssetType,
        AVG(Price) as AvgPrice,
        SUM(Volume) as TotalVolume,
        AVG(PriceChange1m) as AvgPriceChange,
        AVG(Volatility1h) as AvgVolatility,
        COUNT(*) as DataPoints,
        MAX(Timestamp) as LastUpdate
      FROM MarketData
      WHERE 1=1 ${timeFilter}
      GROUP BY Symbol, AssetType
      HAVING COUNT(*) > 10
      ORDER BY TotalVolume DESC, AvgPriceChange DESC
    `;

    const result = await executeQuery(query, { limit: Number.parseInt(limit as string) });

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch trending data', 500, error);
  }
});

/**
 * GET /api/market-data/technical-indicators/:symbol
 * Get technical indicators for a symbol
 */
router.get('/technical-indicators/:symbol', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { symbol } = req.params;
    const { period = '1d' } = req.query;

    let timeFilter = '';
    if (period === '1d') {
      timeFilter = 'AND Timestamp >= DATEADD(day, -1, GETUTCDATE())';
    } else if (period === '1w') {
      timeFilter = 'AND Timestamp >= DATEADD(week, -1, GETUTCDATE())';
    } else if (period === '1m') {
      timeFilter = 'AND Timestamp >= DATEADD(month, -1, GETUTCDATE())';
    }

    const query = `
      SELECT 
        Symbol,
        Timestamp,
        Price,
        RSI14,
        SMA20,
        SignalStrength,
        PriceChange1m,
        PriceChange5m,
        PriceChange15m,
        Volatility1h,
        VolumeAvg1h
      FROM MarketData
      WHERE Symbol = @symbol ${timeFilter}
      ORDER BY Timestamp DESC
    `;

    const result = await executeQuery(query, { symbol });

    // Calculate additional technical indicators
    const indicators = result.recordset.map((row: any, index: number) => {
      const data = result.recordset.slice(index, index + 20); // Last 20 data points
      
      // Calculate moving averages
      const sma5 = data.slice(0, 5).reduce((sum: number, d: any) => sum + d.Price, 0) / Math.min(5, data.length);
      const sma10 = data.slice(0, 10).reduce((sum: number, d: any) => sum + d.Price, 0) / Math.min(10, data.length);
      
      // Calculate Bollinger Bands (simplified)
      const prices = data.map((d: any) => d.Price);
      const mean = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;
      const variance = prices.reduce((sum: number, p: number) => sum + Math.pow(p - mean, 2), 0) / prices.length;
      const stdDev = Math.sqrt(variance);
      
      return {
        ...row,
        SMA5: sma5,
        SMA10: sma10,
        BollingerUpper: mean + (2 * stdDev),
        BollingerLower: mean - (2 * stdDev),
        BollingerMiddle: mean
      };
    });

    return successResponse(res, indicators);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch technical indicators', 500, error);
  }
});

/**
 * GET /api/market-data/screener
 * Advanced market data screener
 */
router.get('/screener', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const {
      asset_type,
      min_price,
      max_price,
      min_volume,
      min_market_cap,
      max_market_cap,
      min_rsi,
      max_rsi,
      signal_strength,
      sort_by = 'market_cap',
      sort_order = 'desc',
      limit = 50
    } = req.query;

    let query = `
      SELECT 
        Symbol,
        AssetType,
        Price,
        Volume,
        MarketCap,
        RSI14,
        SignalStrength,
        PriceChange1m,
        PriceChange5m,
        PriceChange15m,
        Volatility1h,
        MAX(Timestamp) as LastUpdate
      FROM MarketData
      WHERE 1=1
    `;

    const params: any = {};

    if (asset_type) {
      query += ` AND AssetType = @assetType`;
      params.assetType = asset_type;
    }

    if (min_price) {
      query += ` AND Price >= @minPrice`;
      params.minPrice = parseFloat(min_price as string);
    }

    if (max_price) {
      query += ` AND Price <= @maxPrice`;
      params.maxPrice = parseFloat(max_price as string);
    }

    if (min_volume) {
      query += ` AND Volume >= @minVolume`;
      params.minVolume = Number.parseInt(min_volume as string);
    }

    if (min_market_cap) {
      query += ` AND MarketCap >= @minMarketCap`;
      params.minMarketCap = Number.parseInt(min_market_cap as string);
    }

    if (max_market_cap) {
      query += ` AND MarketCap <= @maxMarketCap`;
      params.maxMarketCap = Number.parseInt(max_market_cap as string);
    }

    if (min_rsi) {
      query += ` AND RSI14 >= @minRsi`;
      params.minRsi = parseFloat(min_rsi as string);
    }

    if (max_rsi) {
      query += ` AND RSI14 <= @maxRsi`;
      params.maxRsi = parseFloat(max_rsi as string);
    }

    if (signal_strength) {
      query += ` AND SignalStrength = @signalStrength`;
      params.signalStrength = signal_strength;
    }

    query += ` GROUP BY Symbol, AssetType, Price, Volume, MarketCap, RSI14, SignalStrength, PriceChange1m, PriceChange5m, PriceChange15m, Volatility1h`;

    // Apply sorting
    const validSortFields = ['market_cap', 'price', 'volume', 'rsi', 'price_change'];
    const sortField = validSortFields.includes(sort_by as string) ? sort_by : 'market_cap';
    const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';

    if (sortField === 'market_cap') {
      query += ` ORDER BY MarketCap ${sortDirection}`;
    } else if (sortField === 'price') {
      query += ` ORDER BY Price ${sortDirection}`;
    } else if (sortField === 'volume') {
      query += ` ORDER BY Volume ${sortDirection}`;
    } else if (sortField === 'rsi') {
      query += ` ORDER BY RSI14 ${sortDirection}`;
    } else if (sortField === 'price_change') {
      query += ` ORDER BY PriceChange1m ${sortDirection}`;
    }

    query = `SELECT TOP (@limit) * FROM (${query}) as screened`;
    params.limit = Number.parseInt(limit as string);

    const result = await executeQuery(query, params);

    return successResponse(res, result.recordset);
  } catch (error) {
    return errorResponse(res, 'Failed to screen market data', 500, error);
  }
});

export default router;
