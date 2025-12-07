/**
 * Standalone Market Data Processing Script
 * Processes CSV files and stores them in backend/data/local-market-data.json
 * This can be run independently before backend starts to eliminate startup delay
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Get project root (assuming this script is in backend/scripts/)
const projectRoot = path.join(__dirname, '../..');

// Data folders to process
const dataFolders = [
  { path: path.join(projectRoot, 'stockDataRaw&Processed'), type: 'stock' },
  { path: path.join(projectRoot, 'cryptoData'), type: 'crypto' },
  { path: path.join(projectRoot, 'forexData'), type: 'forex' },
  { path: path.join(projectRoot, 'commoditiesData'), type: 'commodity' },
  // Legacy structure
  { path: path.join(projectRoot, 'data-pipeline/data/raw/stocks'), type: 'stock' },
  { path: path.join(projectRoot, 'data-pipeline/data/raw/crypto'), type: 'crypto' },
  { path: path.join(projectRoot, 'data-pipeline/data/raw/forex'), type: 'forex' },
  { path: path.join(projectRoot, 'data-pipeline/data/raw/commodities'), type: 'commodity' },
];

// Output file
const backendDataDir = path.join(projectRoot, 'backend/data');
const outputFile = path.join(backendDataDir, 'local-market-data.json');

// MVP Mode: Limit stocks to reduce file size (set via environment variable or command line)
const MVP_MODE = process.env.MVP_MODE === 'true' || process.argv.includes('--mvp');
const MAX_STOCKS_FOR_MVP = 50; // Keep 50 stocks + all other asset types

/**
 * Extract symbol from filename (e.g., "AAPL_raw.csv" -> "AAPL")
 */
function extractSymbol(filename, folderName) {
  let baseName = filename.replace('_raw.csv', '').replace('.csv', '');
  
  // Remove folder name prefix if present (e.g., "stocks_AAPL_raw.csv" -> "AAPL")
  if (baseName.includes('_')) {
    const parts = baseName.split('_');
    // Check if first part matches folder name
    if (parts.length > 1 && folderName && parts[0].toLowerCase() === folderName.toLowerCase().replace(/s$/, '')) {
      baseName = parts.slice(1).join('_');
    }
  }
  
  return baseName.toUpperCase();
}

/**
 * Read and parse CSV file
 */
function readCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: (value, context) => {
        // Parse numeric columns
        if (['Open', 'High', 'Low', 'Close', 'Volume'].includes(context.column)) {
          const num = parseFloat(value);
          return isNaN(num) ? 0 : num;
        }
        return value;
      },
    });
    return records;
  } catch (error) {
    console.error(`Error reading CSV file ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Process a single CSV file and return market data records
 */
function processCSVFile(filePath, assetType, folderName) {
  const filename = path.basename(filePath);
  const symbol = extractSymbol(filename, folderName);
  const rawData = readCSV(filePath);
  
  if (rawData.length === 0) {
    return { symbol, records: [] };
  }
  
  // Process records
  const records = rawData
    .filter(row => row.Date && row.Close && parseFloat(row.Close) > 0)
    .map(row => {
      // Parse date
      let dateStr;
      try {
        const date = new Date(row.Date);
        if (isNaN(date.getTime())) {
          // Try YYYY-MM-DD format
          const parts = row.Date.split('-');
          if (parts.length === 3) {
            const parsedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            dateStr = parsedDate.toISOString().split('T')[0];
          } else {
            dateStr = new Date().toISOString().split('T')[0];
          }
        } else {
          dateStr = date.toISOString().split('T')[0];
        }
      } catch {
        dateStr = new Date().toISOString().split('T')[0];
      }
      
      return {
        Symbol: symbol,
        Date: dateStr,
        Open: parseFloat(row.Open || row.open || 0),
        High: parseFloat(row.High || row.high || 0),
        Low: parseFloat(row.Low || row.low || 0),
        Close: parseFloat(row.Close || row.close || 0),
        Volume: parseFloat(row.Volume || row.volume || 0),
        AssetType: assetType,
      };
    })
    .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
  
  return { symbol, records };
}

/**
 * Main processing function
 */
async function processMarketData() {
  console.log('📊 Processing market data from CSV files...');
  console.log('');
  
  // Ensure output directory exists
  if (!fs.existsSync(backendDataDir)) {
    fs.mkdirSync(backendDataDir, { recursive: true });
  }
  
  // Initialize output data structure
  const marketData = {
    data: {},
    lastUpdateDate: new Date().toISOString(),
  };
  
  let totalFiles = 0;
  let totalSymbols = 0;
  let totalRecords = 0;
  const errors = [];
  
  // MVP Mode: Track stock count
  let stockCount = 0;
  const stockSymbols = [];
  
  if (MVP_MODE) {
    console.log(`🎯 MVP Mode: Limiting to ${MAX_STOCKS_FOR_MVP} stocks + all other asset types\n`);
  }
  
  // Process each data folder
  for (const folderInfo of dataFolders) {
    const folderPath = folderInfo.path;
    const assetType = folderInfo.type;
    
    if (!fs.existsSync(folderPath)) {
      continue;
    }
    
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.csv'));
    
    if (files.length === 0) {
      continue;
    }
    
    console.log(`📁 Processing ${files.length} files from ${path.basename(folderPath)}...`);
    const folderName = path.basename(folderPath);
    
    // In MVP mode, prioritize Australian stocks (.AX) for stocks
    let filesToProcess = files;
    if (MVP_MODE && assetType === 'stock') {
      // Sort: Australian stocks first, then others
      filesToProcess = files.sort((a, b) => {
        const aIsAU = a.includes('.AX') || extractSymbol(a, folderName).includes('.AX');
        const bIsAU = b.includes('.AX') || extractSymbol(b, folderName).includes('.AX');
        if (aIsAU && !bIsAU) return -1;
        if (!aIsAU && bIsAU) return 1;
        return 0;
      });
    }
    
    for (const file of filesToProcess) {
      // MVP Mode: Skip additional stocks if we've hit the limit
      if (MVP_MODE && assetType === 'stock' && stockCount >= MAX_STOCKS_FOR_MVP) {
        continue;
      }
      
      try {
        const filePath = path.join(folderPath, file);
        const { symbol, records } = processCSVFile(filePath, assetType, folderName);
        
        if (records.length > 0) {
          // Merge with existing data (newer overwrites older)
          if (!marketData.data[symbol]) {
            marketData.data[symbol] = [];
            totalSymbols++;
            
            // Track stock count for MVP mode
            if (assetType === 'stock') {
              stockCount++;
              stockSymbols.push(symbol);
            }
          }
          
          // Merge records by date
          const existingMap = new Map();
          marketData.data[symbol].forEach(r => existingMap.set(r.Date, r));
          records.forEach(r => existingMap.set(r.Date, r));
          
          marketData.data[symbol] = Array.from(existingMap.values())
            .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
          
          totalRecords += records.length;
          console.log(`  ✓ ${symbol}: ${records.length} records`);
        }
        totalFiles++;
      } catch (error) {
        const errorMsg = `Error processing ${file}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`  ✗ ${errorMsg}`);
      }
    }
    
    if (MVP_MODE && assetType === 'stock' && stockCount >= MAX_STOCKS_FOR_MVP) {
      console.log(`  ⚠ Skipped remaining stocks (MVP limit: ${MAX_STOCKS_FOR_MVP})`);
    }
  }
  
  // Save to output file using streaming to handle large datasets
  try {
    const writeStream = fs.createWriteStream(outputFile, { encoding: 'utf-8' });
    
    // Write opening structure
    writeStream.write('{\n');
    writeStream.write(`  "lastUpdateDate": "${marketData.lastUpdateDate}",\n`);
    writeStream.write('  "data": {\n');
    
    // Write each symbol incrementally to avoid memory issues
    const symbols = Object.keys(marketData.data);
    let isFirstSymbol = true;
    
    for (const symbol of symbols) {
      if (!isFirstSymbol) {
        writeStream.write(',\n');
      }
      isFirstSymbol = false;
      
      // Write symbol key
      writeStream.write(`    "${symbol}": [\n`);
      
      // Write records for this symbol
      const records = marketData.data[symbol];
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const recordJson = JSON.stringify(record);
        writeStream.write(`      ${recordJson}`);
        if (i < records.length - 1) {
          writeStream.write(',\n');
        } else {
          writeStream.write('\n');
        }
      }
      
      writeStream.write('    ]');
    }
    
    // Write closing structure
    writeStream.write('\n  }\n');
    writeStream.write('}\n');
    
    // Wait for stream to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      writeStream.end();
    });
    
    console.log('');
    console.log('✅ Market data processing completed!');
    if (MVP_MODE) {
      console.log(`   - Mode: MVP (${MAX_STOCKS_FOR_MVP} stocks + all other assets)`);
      console.log(`   - Stocks included: ${stockCount}`);
    }
    console.log(`   - Files processed: ${totalFiles}`);
    console.log(`   - Symbols processed: ${totalSymbols}`);
    console.log(`   - Total records: ${totalRecords}`);
    console.log(`   - Output file: ${outputFile}`);
    
    // Get file size for info
    try {
      const stats = fs.statSync(outputFile);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   - File size: ${fileSizeMB} MB`);
    } catch (e) {
      // Ignore stats error
    }
    
    if (errors.length > 0) {
      console.log(`   - Errors: ${errors.length}`);
      errors.slice(0, 5).forEach(err => console.log(`     - ${err}`));
    }
    
    return {
      success: errors.length === 0,
      totalFiles,
      totalSymbols,
      totalRecords,
      errors,
    };
  } catch (error) {
    console.error(`Error saving output file: ${error.message}`);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  (async () => {
    try {
      const result = await processMarketData();
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  })();
}

module.exports = { processMarketData };

