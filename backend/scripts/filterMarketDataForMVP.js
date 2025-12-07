/**
 * Filter market data for MVP - Keep 50 stocks + all other asset types
 * This creates a smaller, more manageable JSON file for development
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../data/local-market-data.json');
const outputFile = path.join(__dirname, '../data/local-market-data.json');

async function filterMarketData() {
  console.log('📊 Filtering market data for MVP...');
  console.log('   Keeping: 50 stocks + all crypto/forex/commodities\n');

  // Read file in chunks to extract symbols and their asset types
  const stream = fs.createReadStream(inputFile, { encoding: 'utf-8', highWaterMark: 64 * 1024 });
  
  let buffer = '';
  let inDataSection = false;
  const symbolInfo = []; // { symbol, assetType, lineStart }
  let currentSymbol = null;
  let currentAssetType = null;
  let lineNumber = 0;
  let bracketDepth = 0;
  let inSymbolArray = false;

  // First pass: collect symbol information
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        lineNumber++;
        
        if (line.includes('"data":')) {
          inDataSection = true;
        }
        
        if (inDataSection) {
          // Match symbol key: "SYMBOL": [
          const symbolMatch = line.match(/^\s+"([^"]+)":\s*\[/);
          if (symbolMatch) {
            currentSymbol = symbolMatch[1];
            inSymbolArray = true;
            bracketDepth = 1;
          }
          
          // Check for asset type in records
          if (inSymbolArray && currentSymbol && !currentAssetType) {
            const assetTypeMatch = line.match(/"AssetType"\s*:\s*"([^"]+)"/);
            if (assetTypeMatch) {
              currentAssetType = assetTypeMatch[1];
              symbolInfo.push({
                symbol: currentSymbol,
                assetType: currentAssetType,
                lineStart: lineNumber
              });
            }
          }
          
          // Track bracket depth to know when symbol array ends
          if (inSymbolArray) {
            bracketDepth += (line.match(/\[/g) || []).length;
            bracketDepth -= (line.match(/\]/g) || []).length;
            if (bracketDepth === 0) {
              inSymbolArray = false;
              currentSymbol = null;
              currentAssetType = null;
            }
          }
        }
      }
    });

    stream.on('end', resolve);
    stream.on('error', reject);
  });

  console.log(`   Found ${symbolInfo.length} total symbols`);
  
  // Separate by asset type
  const stocks = symbolInfo.filter(s => s.assetType === 'stock');
  const cryptos = symbolInfo.filter(s => s.assetType === 'crypto');
  const forex = symbolInfo.filter(s => s.assetType === 'forex');
  const commodities = symbolInfo.filter(s => s.assetType === 'commodity');
  
  console.log(`   - Stocks: ${stocks.length}`);
  console.log(`   - Crypto: ${cryptos.length}`);
  console.log(`   - Forex: ${forex.length}`);
  console.log(`   - Commodities: ${commodities.length}\n`);

  // Select 50 stocks (prefer Australian stocks if available)
  const selectedStocks = stocks
    .filter(s => s.symbol.includes('.AX')) // Prefer Australian stocks
    .slice(0, 30)
    .concat(
      stocks
        .filter(s => !s.symbol.includes('.AX'))
        .slice(0, 20)
    )
    .slice(0, 50);

  // Keep all non-stock assets
  const selectedSymbols = new Set([
    ...selectedStocks.map(s => s.symbol),
    ...cryptos.map(s => s.symbol),
    ...forex.map(s => s.symbol),
    ...commodities.map(s => s.symbol)
  ]);

  console.log(`   Selected ${selectedStocks.length} stocks for MVP`);
  console.log(`   Keeping all ${cryptos.length + forex.length + commodities.length} non-stock assets`);
  console.log(`   Total symbols for MVP: ${selectedSymbols.size}\n`);

  // Now read the file again and extract only selected symbols
  console.log('   Extracting selected symbols...');
  
  const writeStream = fs.createWriteStream(outputFile + '.tmp', { encoding: 'utf-8' });
  const readStream = fs.createReadStream(inputFile, { encoding: 'utf-8', highWaterMark: 64 * 1024 });
  
  let readBuffer = '';
  let writeBuffer = '';
  let inDataSection2 = false;
  let currentSymbol2 = null;
  let inSymbolArray2 = false;
  let bracketDepth2 = 0;
  let keepCurrentSymbol = false;
  let lastUpdateDate = null;
  let isFirstSymbol = true;

  await new Promise((resolve, reject) => {
    readStream.on('data', (chunk) => {
      readBuffer += chunk;
      const lines = readBuffer.split('\n');
      readBuffer = lines.pop() || '';

      for (const line of lines) {
        // Extract lastUpdateDate
        if (!lastUpdateDate && line.includes('"lastUpdateDate"')) {
          const match = line.match(/"lastUpdateDate":\s*"([^"]+)"/);
          if (match) {
            lastUpdateDate = match[1];
          }
        }

        if (line.includes('"data":')) {
          inDataSection2 = true;
          writeStream.write('{\n');
          writeStream.write(`  "lastUpdateDate": "${lastUpdateDate || new Date().toISOString()}",\n`);
          writeStream.write('  "data": {\n');
          continue;
        }

        if (inDataSection2) {
          // Check if this is a symbol key
          const symbolMatch = line.match(/^\s+"([^"]+)":\s*\[/);
          if (symbolMatch) {
            // Close previous symbol if needed
            if (currentSymbol2 && keepCurrentSymbol) {
              writeStream.write('\n    ]');
              if (!isFirstSymbol) {
                // Already wrote comma in previous iteration
              }
              isFirstSymbol = false;
            }

            currentSymbol2 = symbolMatch[1];
            keepCurrentSymbol = selectedSymbols.has(currentSymbol2);
            inSymbolArray2 = true;
            bracketDepth2 = 1;

            if (keepCurrentSymbol) {
              if (!isFirstSymbol) {
                writeStream.write(',\n');
              }
              writeStream.write(`    "${currentSymbol2}": [\n`);
            }
            continue;
          }

          // If we're keeping this symbol, write its data
          if (keepCurrentSymbol && inSymbolArray2) {
            writeStream.write(line + '\n');
          }

          // Track bracket depth
          if (inSymbolArray2) {
            bracketDepth2 += (line.match(/\[/g) || []).length;
            bracketDepth2 -= (line.match(/\]/g) || []).length;
            if (bracketDepth2 === 0) {
              inSymbolArray2 = false;
              if (keepCurrentSymbol) {
                // Remove trailing comma/newline and close properly
                // The array closing bracket is already in the line
              }
              currentSymbol2 = null;
              keepCurrentSymbol = false;
            }
          }
        } else {
          // Before data section, just write metadata
          if (line.includes('"lastUpdateDate"')) {
            // Already handled
          }
        }
      }
    });

    readStream.on('end', () => {
      // Close last symbol if needed
      if (currentSymbol2 && keepCurrentSymbol) {
        writeStream.write('\n    ]');
      }
      writeStream.write('\n  }\n');
      writeStream.write('}\n');
      writeStream.end();
      resolve();
    });

    readStream.on('error', reject);
    writeStream.on('error', reject);
  });

  // Wait for write to finish
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  // Replace original file
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }
  fs.renameSync(outputFile + '.tmp', outputFile);

  // Get final file size
  const stats = fs.statSync(outputFile);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('✅ MVP data filtering completed!');
  console.log(`   - Symbols kept: ${selectedSymbols.size}`);
  console.log(`   - Output file: ${outputFile}`);
  console.log(`   - File size: ${fileSizeMB} MB\n`);

  return {
    success: true,
    symbolsKept: selectedSymbols.size,
    fileSizeMB: parseFloat(fileSizeMB)
  };
}

// Run if executed directly
if (require.main === module) {
  (async () => {
    try {
      const result = await filterMarketData();
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  })();
}

module.exports = { filterMarketData };

