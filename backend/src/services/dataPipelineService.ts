/**
 * Data Pipeline Service
 * Reads raw CSV files from data-pipeline/data/raw and updates database
 * Runs daily to keep market data up to date
 */

import { executeQuery, isMockMode } from '../config/db';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { getLocalMarketDataStorage, MarketDataRecord } from './localMarketDataStorage';

interface RawCandleData {
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  Date: string;
}

interface ProcessedMarketData {
  Symbol: string;
  Date: Date;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  AssetType: string;
}

class DataPipelineService {
  private rootPath: string; // Project root path
  private legacyRawDataPath: string; // Old structure path (data-pipeline/data/raw)
  private lastUpdateDate: Date | null = null;

  constructor() {
    // Compute project root path (relative to backend/src or backend/dist)
    this.rootPath = path.join(__dirname, '../../..');
    
    // Compute legacy raw data path for old structure
    this.legacyRawDataPath = path.join(this.rootPath, 'data-pipeline/data/raw');
    
    // Check if new root-level folders exist
    const newStructurePaths = [
      path.join(this.rootPath, 'stockDataRaw&Processed'),
      path.join(this.rootPath, 'cryptoData'),
      path.join(this.rootPath, 'forexData'),
      path.join(this.rootPath, 'commoditiesData'),
    ];
    
    // Check if any new structure folders exist
    const hasNewStructure = newStructurePaths.some(p => fs.existsSync(p));
    
    // If new structure doesn't exist, we'll use legacy paths in updateDatabaseFromRawFiles
    // Both rootPath and legacyRawDataPath are now available for use
  }

  /**
   * Extract symbol from filename (e.g., "AAPL_raw.csv" -> "AAPL")
   */
  private extractSymbol(filename: string, folder: string): string {
    const baseName = filename.replace('_raw.csv', '').replace('.csv', '');
    
    // Handle different folder name patterns
    const folderLower = folder.toLowerCase();
    
    // Handle special cases for forex
    if ((folderLower.includes('forex') || folderLower === 'forex') && !baseName.includes('=')) {
      return `${baseName}=X`;
    }
    
    // Handle special cases for commodities
    if ((folderLower.includes('commodit') || folderLower === 'commodities') && !baseName.includes('=')) {
      return `${baseName}=F`;
    }
    
    return baseName;
  }

  /**
   * Determine asset type from folder name
   */
  private getAssetType(folder: string): string {
    const typeMap: Record<string, string> = {
      'stocks': 'stock',
      'crypto': 'crypto',
      'forex': 'forex',
      'commodities': 'commodity',
      'etfs': 'etf',
    };
    return typeMap[folder] || 'stock';
  }

  /**
   * Read and parse CSV file
   */
  private async readRawCSV(filePath: string): Promise<RawCandleData[]> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Parse CSV - handle different formats
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: (value, context) => {
          // Handle date parsing
          const columnName = String(context.column || '');
          if (columnName === 'Date' || columnName === 'date') {
            return value;
          }
          // Handle numeric values
          if (columnName && ['Open', 'High', 'Low', 'Close', 'Volume'].includes(columnName)) {
            const num = parseFloat(value);
            return isNaN(num) ? 0 : num;
          }
          return value;
        },
      });

      return records.map((row: any) => ({
        Open: parseFloat(row.Open || row.open || '0'),
        High: parseFloat(row.High || row.high || '0'),
        Low: parseFloat(row.Low || row.low || '0'),
        Close: parseFloat(row.Close || row.close || '0'),
        Volume: parseFloat(row.Volume || row.volume || '0'),
        Date: row.Date || row.date || row.timestamp || '',
      }));
    } catch (error) {
      console.error(`Error reading CSV file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Process and store data for a single symbol
   */
  private async processSymbol(
    symbol: string,
    assetType: string,
    data: RawCandleData[]
  ): Promise<number> {
    if (data.length === 0) return 0;

    try {
      // Prepare data for bulk insert
      const values: ProcessedMarketData[] = data
        .filter(row => row.Date && row.Close > 0)
        .map(row => {
          // Parse date - handle different formats
          let date: Date;
          try {
            // Try ISO format first
            if (row.Date.includes('T') || row.Date.includes(' ')) {
              date = new Date(row.Date);
            } else {
              // Try YYYY-MM-DD
              const parts = row.Date.split('-');
              if (parts.length === 3) {
                date = new Date(Number.parseInt(parts[0], 10), Number.parseInt(parts[1], 10) - 1, Number.parseInt(parts[2], 10));
              } else {
                date = new Date(row.Date);
              }
            }
          } catch {
            date = new Date();
          }

          return {
            Symbol: symbol,
            Date: date,
            Open: row.Open,
            High: row.High,
            Low: row.Low,
            Close: row.Close,
            Volume: row.Volume,
            AssetType: assetType,
          };
        });

      if (values.length === 0) return 0;

      // Check if using mock database (local file storage)
      if (isMockMode()) {
        // Use local file storage
        const localStorage = getLocalMarketDataStorage();
        const records: MarketDataRecord[] = values.map(val => ({
          Symbol: val.Symbol,
          Date: val.Date.toISOString().split('T')[0],
          Open: val.Open,
          High: val.High,
          Low: val.Low,
          Close: val.Close,
          Volume: val.Volume,
          AssetType: val.AssetType,
        }));
        
        localStorage.insertOrUpdate(symbol, records);
        return records.length;
      }

      // Use database (Azure SQL or PostgreSQL)
      const batchSize = 100;
      let totalInserted = 0;

      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        
        // For each record, check if exists, then update or insert
        for (const val of batch) {
          try {
            // Use CandleData table for historical OHLCV data (matches schema)
            // Check if record exists
            const checkQuery = `
              SELECT COUNT(*) as count
              FROM CandleData
              WHERE Symbol = @symbol AND Timestamp = @date AND TimeFrame = '1d'
            `;
            
            const checkResult = await executeQuery<{ count: number }>(checkQuery, {
              symbol: val.Symbol,
              date: val.Date,
            });

            if (checkResult.recordset[0]?.count > 0) {
              // Update existing record
              const updateQuery = `
                UPDATE CandleData
                SET 
                  OpenPrice = @open,
                  HighPrice = @high,
                  LowPrice = @low,
                  ClosePrice = @close,
                  Volume = @volume
                WHERE Symbol = @symbol AND Timestamp = @date AND TimeFrame = '1d'
              `;
              
              await executeQuery(updateQuery, {
                symbol: val.Symbol,
                date: val.Date,
                open: val.Open,
                high: val.High,
                low: val.Low,
                close: val.Close,
                volume: val.Volume,
              });
            } else {
              // Insert new record
              const insertQuery = `
                INSERT INTO CandleData (Symbol, TimeFrame, Timestamp, OpenPrice, HighPrice, LowPrice, ClosePrice, Volume, CreatedAt)
                VALUES (@symbol, '1d', @date, @open, @high, @low, @close, @volume, GETUTCDATE())
              `;
              
              await executeQuery(insertQuery, {
                symbol: val.Symbol,
                date: val.Date,
                open: val.Open,
                high: val.High,
                low: val.Low,
                close: val.Close,
                volume: val.Volume,
              });
            }
            
            totalInserted++;
          } catch (error) {
            console.error(`Error processing record for ${val.Symbol} on ${val.Date}:`, error);
          }
        }
      }

      return totalInserted;
    } catch (error) {
      console.error(`Error processing symbol ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * Process all raw CSV files and update database
   */
  async updateDatabaseFromRawFiles(): Promise<{
    success: boolean;
    symbolsProcessed: number;
    totalRecords: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let symbolsProcessed = 0;
    let totalRecords = 0;

    // Safety check: In mock mode, warn if we're about to overwrite a large dataset
    if (isMockMode()) {
      try {
        const { getLocalMarketDataStorage } = await import('./localMarketDataStorage');
        const localStorage = getLocalMarketDataStorage();
        const existingSymbols = localStorage.getAvailableSymbols();
        const existingRecordCount = localStorage.getRecordCount();
        
        if (existingSymbols.length > 100) {
          console.warn(`⚠️  WARNING: JSON file already has ${existingSymbols.length} symbols (${existingRecordCount} records)`);
          console.warn(`⚠️  Processing CSV files will MERGE data, not replace. Only new/updated symbols will be added.`);
          console.warn(`⚠️  If you want to rebuild from scratch, delete the JSON file first.`);
        }
      } catch (error) {
        // Ignore errors in safety check
      }
    }

    try {
      // Process data folders - support both new root-level structure and legacy structure
      // Map folder names: folder path -> asset type
      const dataFolders: Array<{ path: string; type: string }> = [];
      
      // Add new root-level folders (if they exist)
      dataFolders.push(
        { path: path.join(this.rootPath, 'stockDataRaw&Processed'), type: 'stock' },
        { path: path.join(this.rootPath, 'cryptoData'), type: 'crypto' },
        { path: path.join(this.rootPath, 'forexData'), type: 'forex' },
        { path: path.join(this.rootPath, 'commoditiesData'), type: 'commodity' }
      );
      
      // Add legacy structure folders (built relative to project root, not rawDataPath)
      dataFolders.push(
        { path: path.join(this.rootPath, 'data-pipeline/data/raw/stocks'), type: 'stock' },
        { path: path.join(this.rootPath, 'data-pipeline/data/raw/crypto'), type: 'crypto' },
        { path: path.join(this.rootPath, 'data-pipeline/data/raw/forex'), type: 'forex' },
        { path: path.join(this.rootPath, 'data-pipeline/data/raw/commodities'), type: 'commodity' }
      );
      
      for (const folderInfo of dataFolders) {
        const folderPath = folderInfo.path;
        const assetType = folderInfo.type;
        
        if (!fs.existsSync(folderPath)) {
          console.log(`Folder ${folderPath} does not exist, skipping...`);
          continue;
        }

        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.csv'));
        
        if (files.length === 0) {
          console.log(`No CSV files found in ${folderPath}, skipping...`);
          continue;
        }

        console.log(`Found ${files.length} CSV files in ${folderPath}`);

        for (const file of files) {
          try {
            const filePath = path.join(folderPath, file);
            // Extract folder name from path for symbol extraction
            const folderName = path.basename(folderPath);
            const symbol = this.extractSymbol(file, folderName);
            
            console.log(`Processing ${symbol} from ${file}...`);
            
            const rawData = await this.readRawCSV(filePath);
            if (rawData.length === 0) {
              console.warn(`No data found in ${file}`);
              continue;
            }

            const recordsInserted = await this.processSymbol(symbol, assetType, rawData);
            
            if (recordsInserted > 0) {
              symbolsProcessed++;
              totalRecords += recordsInserted;
              console.log(`✓ Processed ${symbol}: ${recordsInserted} records`);
            }
          } catch (error: any) {
            const errorMsg = `Error processing ${file}: ${error.message}`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
        }
      }

      // Update lastUpdateDate (for database mode)
      // For mock mode, the timestamp is stored in the JSON file itself
      if (!isMockMode()) {
        this.lastUpdateDate = new Date();
      }

      return {
        success: errors.length === 0,
        symbolsProcessed,
        totalRecords,
        errors,
      };
    } catch (error: any) {
      errors.push(`Fatal error: ${error.message}`);
      return {
        success: false,
        symbolsProcessed,
        totalRecords,
        errors,
      };
    }
  }

  /**
   * Get market data from database for a symbol
   */
  async getMarketData(
    symbol: string,
    days: number = 60,
    assetType?: string
  ): Promise<ProcessedMarketData[]> {
    try {
      // Check if using mock database (local file storage)
      if (isMockMode()) {
        const localStorage = getLocalMarketDataStorage();
        const records = localStorage.getMarketData(symbol, days);
        
        return records.map(record => ({
          Symbol: record.Symbol,
          Date: new Date(record.Date),
          Open: record.Open,
          High: record.High,
          Low: record.Low,
          Close: record.Close,
          Volume: record.Volume,
          AssetType: record.AssetType,
        } as ProcessedMarketData));
      }

      // Use database (Azure SQL or PostgreSQL)
      let query = `
        SELECT TOP (@days)
          Symbol,
          Timestamp as Date,
          OpenPrice as Open,
          HighPrice as High,
          LowPrice as Low,
          ClosePrice as Close,
          Volume,
          'stock' as AssetType
        FROM CandleData
        WHERE Symbol = @symbol AND TimeFrame = '1d'
      `;

      const params: Record<string, any> = { symbol, days };

      query += ` ORDER BY Timestamp DESC`;

      const result = await executeQuery<any>(query, params);
      // Map database columns to our interface
      return result.recordset.map((row: any) => ({
        Symbol: row.Symbol,
        Date: row.Date instanceof Date ? row.Date : new Date(row.Date),
        Open: row.Open,
        High: row.High,
        Low: row.Low,
        Close: row.Close,
        Volume: row.Volume,
        AssetType: row.AssetType || 'stock',
      } as ProcessedMarketData)).reverse(); // Return in chronological order
    } catch (error) {
      console.error(`Error fetching market data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get latest price for a symbol
   */
  async getLatestPrice(symbol: string): Promise<number | null> {
    try {
      // Check if using mock database (local file storage)
      if (isMockMode()) {
        const localStorage = getLocalMarketDataStorage();
        return localStorage.getLatestPrice(symbol);
      }

      // Use database (Azure SQL or PostgreSQL)
      const query = `
        SELECT TOP 1 ClosePrice as Close
        FROM CandleData
        WHERE Symbol = @symbol AND TimeFrame = '1d'
        ORDER BY Timestamp DESC
      `;

      const result = await executeQuery<{ Close: number }>(query, { symbol });
      
      if (result.recordset.length > 0) {
        return result.recordset[0].Close;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching latest price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get all available symbols from database
   */
  async getAvailableSymbols(assetType?: string): Promise<string[]> {
    try {
      // Check if using mock database (local file storage)
      if (isMockMode()) {
        const localStorage = getLocalMarketDataStorage();
        return localStorage.getAvailableSymbols(assetType);
      }

      // Use database (Azure SQL or PostgreSQL)
      let query = `
        SELECT DISTINCT Symbol
        FROM CandleData
        WHERE TimeFrame = '1d'
      `;

      const params: Record<string, any> = {};

      query += ` ORDER BY Symbol`;

      const result = await executeQuery<{ Symbol: string }>(query, params);
      return result.recordset.map(row => row.Symbol);
    } catch (error) {
      console.error('Error fetching available symbols:', error);
      return [];
    }
  }

  /**
   * Check if data needs updating (last update was more than 24 hours ago or database is empty)
   * Enhanced to check database for emptiness (<10 records)
   */
  async shouldUpdate(): Promise<boolean> {
    // Check database/local storage record count first
    try {
      const recordCount = await this.getDatabaseRecordCount();
      
      // In mock mode, also check symbol count - if we have many symbols, don't overwrite
      if (isMockMode()) {
        const { getLocalMarketDataStorage } = await import('./localMarketDataStorage');
        const localStorage = getLocalMarketDataStorage();
        const symbolCount = localStorage.getAvailableSymbols().length;
        
        // If we have a substantial number of symbols (e.g., >100), don't auto-update
        // This prevents overwriting a fully processed JSON file with partial CSV data
        if (symbolCount > 100) {
          console.log(`Skipping auto-update: JSON file already has ${symbolCount} symbols (${recordCount} records)`);
          return false;
        }
        
        // If we have many records but few symbols, might be a data quality issue
        // But still don't overwrite if we have >50 symbols
        if (symbolCount > 50 && recordCount > 1000) {
          console.log(`Skipping auto-update: JSON file has ${symbolCount} symbols with ${recordCount} records`);
          return false;
        }
      }
      
      // If database has fewer than 10 records, consider it empty and needs update
      if (recordCount < 10) {
        return true;
      }
    } catch (error) {
      // If we can't check database, assume stale
      console.warn('Could not check database record count, assuming stale:', error);
      return true;
    }
    
    // Get last update date (from local storage if in mock mode, or from memory)
    let lastUpdate: Date | null = null;
    
    if (isMockMode()) {
      // In mock mode, get last update date from local storage file
      const { getLocalMarketDataStorage } = await import('./localMarketDataStorage');
      const localStorage = getLocalMarketDataStorage();
      lastUpdate = localStorage.getLastUpdateDate();
    } else {
      // In database mode, use in-memory lastUpdateDate
      lastUpdate = this.lastUpdateDate;
    }
    
    // If no lastUpdateDate tracked, but we have data (>=10 records), don't reload
    if (!lastUpdate) {
      // We already checked record count above - if we have >=10 records, don't reload
      return false;
    }
    
    // Check if last update was more than 24 hours ago
    const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate >= 24) {
      return true;
    }
    
    return false;
  }

  /**
   * Get count of records in CandleData table
   * Used to detect if database is empty
   */
  private async getDatabaseRecordCount(): Promise<number> {
    try {
      // Check if using mock database (local file storage)
      if (isMockMode()) {
        const localStorage = getLocalMarketDataStorage();
        return localStorage.getRecordCount();
      }

      // Use database (Azure SQL or PostgreSQL)
      const query = `
        SELECT COUNT(*) as count
        FROM CandleData
        WHERE TimeFrame = '1d'
      `;
      
      const result = await executeQuery<{ count: number }>(query, {});
      
      if (result.recordset && result.recordset.length > 0) {
        return result.recordset[0].count || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error checking database record count:', error);
      return 0;
    }
  }
}

// Singleton instance
let dataPipelineService: DataPipelineService | null = null;

export function getDataPipelineService(): DataPipelineService {
  if (!dataPipelineService) {
    dataPipelineService = new DataPipelineService();
  }
  return dataPipelineService;
}

