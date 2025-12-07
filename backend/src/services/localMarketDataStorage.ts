/**
 * Local Market Data Storage
 * Stores market data in JSON files for local development (when USE_MOCK_DB=true)
 * This allows testing without Azure SQL or any database
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MarketDataRecord {
  Symbol: string;
  Date: string; // ISO date string
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  AssetType: string;
}

interface LocalMarketDataFile {
  data: Record<string, MarketDataRecord[]>;
  lastUpdateDate?: string; // ISO date string
}

class LocalMarketDataStorage {
  private dataDir: string;
  private dataFile: string;

  constructor() {
    // Store in backend/data/local-market-data.json
    const backendDir = path.join(__dirname, '../..');
    this.dataDir = path.join(backendDir, 'data');
    this.dataFile = path.join(this.dataDir, 'local-market-data.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Initialize file if it doesn't exist
    if (!fs.existsSync(this.dataFile)) {
      this.saveData({});
    }
  }

  /**
   * Load all market data from file
   */
  private loadData(): LocalMarketDataFile {
    try {
      const content = fs.readFileSync(this.dataFile, 'utf-8');
      const parsed = JSON.parse(content);
      
      // Handle old format (just data object) and new format (with metadata)
      if (parsed.data) {
        return parsed as LocalMarketDataFile;
      } else {
        // Old format - migrate to new format
        return {
          data: parsed as Record<string, MarketDataRecord[]>,
          lastUpdateDate: undefined
        };
      }
    } catch (error) {
      console.warn('Error loading local market data, initializing empty:', error);
      return { data: {} };
    }
  }

  /**
   * Save all market data to file
   */
  private saveData(data: Record<string, MarketDataRecord[]>, updateDate: boolean = true): void {
    try {
      const fileData: LocalMarketDataFile = {
        data,
        ...(updateDate && { lastUpdateDate: new Date().toISOString() })
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(fileData, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving local market data:', error);
      throw error;
    }
  }

  /**
   * Get last update date
   */
  getLastUpdateDate(): Date | null {
    const fileData = this.loadData();
    if (fileData.lastUpdateDate) {
      return new Date(fileData.lastUpdateDate);
    }
    return null;
  }

  /**
   * Insert or update market data for a symbol
   */
  insertOrUpdate(symbol: string, records: MarketDataRecord[]): void {
    const fileData = this.loadData();
    const data = fileData.data;
    
    // Get existing records for this symbol
    const existing = data[symbol] || [];
    
    // Create a map of existing records by date for quick lookup
    const existingMap = new Map<string, MarketDataRecord>();
    existing.forEach(record => {
      existingMap.set(record.Date, record);
    });
    
    // Merge new records (newer data overwrites older)
    records.forEach(record => {
      existingMap.set(record.Date, record);
    });
    
    // Convert back to array and sort by date
    data[symbol] = Array.from(existingMap.values()).sort((a, b) => 
      new Date(a.Date).getTime() - new Date(b.Date).getTime()
    );
    
    this.saveData(data, true); // Update timestamp when data changes
  }

  /**
   * Get market data for a symbol (last N days)
   */
  getMarketData(symbol: string, days: number = 60): MarketDataRecord[] {
    const fileData = this.loadData();
    const symbolData = fileData.data[symbol] || [];
    
    if (symbolData.length === 0) {
      return [];
    }
    
    // Get last N days (most recent)
    const sorted = symbolData.sort((a, b) => 
      new Date(b.Date).getTime() - new Date(a.Date).getTime()
    );
    
    return sorted.slice(0, days).reverse(); // Return in chronological order
  }

  /**
   * Get latest price for a symbol
   */
  getLatestPrice(symbol: string): number | null {
    const fileData = this.loadData();
    const symbolData = fileData.data[symbol] || [];
    
    if (symbolData.length === 0) {
      return null;
    }
    
    // Get most recent record
    const sorted = symbolData.sort((a, b) => 
      new Date(b.Date).getTime() - new Date(a.Date).getTime()
    );
    
    return sorted[0]?.Close || null;
  }

  /**
   * Get all available symbols
   */
  getAvailableSymbols(assetType?: string): string[] {
    const fileData = this.loadData();
    const symbols = Object.keys(fileData.data);
    
    if (assetType) {
      // Filter by asset type if provided
      return symbols.filter(symbol => {
        const symbolData = fileData.data[symbol];
        if (symbolData.length === 0) return false;
        return symbolData[0].AssetType === assetType;
      });
    }
    
    return symbols;
  }

  /**
   * Get count of records
   */
  getRecordCount(): number {
    const fileData = this.loadData();
    let count = 0;
    Object.values(fileData.data).forEach(records => {
      count += records.length;
    });
    return count;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.saveData({});
  }
}

// Singleton instance
let storageInstance: LocalMarketDataStorage | null = null;

export function getLocalMarketDataStorage(): LocalMarketDataStorage {
  if (!storageInstance) {
    storageInstance = new LocalMarketDataStorage();
  }
  return storageInstance;
}

