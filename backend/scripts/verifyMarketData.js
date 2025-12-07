/**
 * Market Data Verification Script
 * Checks if backend/data/local-market-data.json exists and is valid
 * Displays statistics about the data file without reprocessing
 */

const fs = require('fs');
const path = require('path');

// Get project root (assuming this script is in backend/scripts/)
const projectRoot = path.join(__dirname, '../..');

// Data file path
const backendDataDir = path.join(projectRoot, 'backend/data');
const dataFile = path.join(backendDataDir, 'local-market-data.json');

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date in human-readable format
 */
function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

/**
 * Main verification function
 */
function verifyMarketData() {
  console.log('📊 Verifying market data file...');
  console.log('');

  // Check if file exists
  if (!fs.existsSync(dataFile)) {
    console.error('❌ Error: Market data file not found');
    console.error(`   Expected location: ${dataFile}`);
    console.error('');
    console.error('💡 Run "npm run process-data" to generate the data file.');
    return false;
  }

  // Get file stats
  let stats;
  try {
    stats = fs.statSync(dataFile);
  } catch (error) {
    console.error(`❌ Error: Cannot read file stats: ${error.message}`);
    return false;
  }

  // Check if file is empty
  if (stats.size === 0) {
    console.error('❌ Error: Market data file is empty');
    console.error('💡 Run "npm run process-data" to regenerate the data file.');
    return false;
  }

  // Read and parse JSON with better error handling for large files
  let fileData;
  try {
    // For very large files, we'll read in chunks to validate structure
    // First, check if file is suspiciously large (might indicate corruption)
    const maxReasonableSize = 2 * 1024 * 1024 * 1024; // 2GB
    if (stats.size > maxReasonableSize) {
      console.warn(`⚠️  Warning: File is very large (${formatFileSize(stats.size)})`);
      console.warn('   This might indicate an issue. Proceeding with validation...');
    }
    
    // Read file content
    // For very large files, read in chunks to avoid memory issues
    let content;
    try {
      content = fs.readFileSync(dataFile, 'utf-8');
    } catch (readError) {
      console.error('❌ Error: Cannot read file');
      console.error(`   ${readError.message}`);
      console.error('💡 Check file permissions and disk space.');
      return false;
    }
    
    // Quick validation: Check if file appears to be truncated
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      console.error('❌ Error: JSON file is empty');
      console.error('💡 Run "npm run process-data" to regenerate the data file.');
      return false;
    }
    
    // Check basic structure - should start with { and end with }
    if (!trimmedContent.startsWith('{')) {
      console.error('❌ Error: JSON file does not start with "{"');
      console.error('   File may be corrupted or in wrong format');
      console.error('💡 Run "npm run process-data" to regenerate the data file.');
      return false;
    }
    
    if (!trimmedContent.endsWith('}')) {
      console.error('❌ Error: JSON file appears to be truncated or incomplete');
      console.error('   File does not end with closing brace "}"');
      console.error('💡 The file may have been corrupted during write. Regenerate with "npm run process-data"');
      return false;
    }
    
    // Check for balanced braces (quick check without full parse)
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (Math.abs(openBraces - closeBraces) > 10) {
      console.warn(`⚠️  Warning: Unbalanced braces detected (${openBraces} open, ${closeBraces} close)`);
      console.warn('   File may be corrupted, but attempting to parse anyway...');
    }
    
    // Try to parse JSON
    try {
      fileData = JSON.parse(content);
    } catch (parseError) {
      // Provide more detailed error information
      console.error('❌ Error: Invalid JSON file');
      console.error(`   Parse error: ${parseError.message}`);
      
      // Try to find the approximate location of the error
      if (parseError.message.includes('position')) {
        const positionMatch = parseError.message.match(/position (\d+)/);
        if (positionMatch) {
          const position = parseInt(positionMatch[1]);
          const lineNumber = content.substring(0, position).split('\n').length;
          const columnNumber = position - content.lastIndexOf('\n', position);
          console.error(`   Approximate location: Line ${lineNumber}, Column ${columnNumber}`);
          
          // Show context around the error
          const lines = content.split('\n');
          const startLine = Math.max(0, lineNumber - 3);
          const endLine = Math.min(lines.length - 1, lineNumber + 2);
          console.error('   Context around error:');
          for (let i = startLine; i <= endLine; i++) {
            const marker = i === lineNumber - 1 ? ' >>> ' : '     ';
            console.error(`${marker}${i + 1}: ${lines[i].substring(0, 100)}${lines[i].length > 100 ? '...' : ''}`);
          }
        }
      }
      
      console.error('💡 Run "npm run process-data" to regenerate the data file.');
      return false;
    }
  } catch (error) {
    console.error('❌ Error: Cannot read or parse JSON file');
    console.error(`   ${error.message}`);
    console.error('💡 Run "npm run process-data" to regenerate the data file.');
    return false;
  }

  // Handle old format (just data object) and new format (with metadata)
  let data;
  let lastUpdateDate;
  
  if (fileData.data) {
    // New format with metadata
    data = fileData.data;
    lastUpdateDate = fileData.lastUpdateDate;
  } else if (typeof fileData === 'object' && !Array.isArray(fileData)) {
    // Old format - just data object
    data = fileData;
    lastUpdateDate = null;
  } else {
    console.error('❌ Error: Invalid data structure');
    console.error('   Expected object with "data" property or symbol keys');
    return false;
  }

  // Validate data structure
  if (!data || typeof data !== 'object') {
    console.error('❌ Error: Invalid data structure');
    console.error('   Data property must be an object');
    return false;
  }

  // Calculate statistics
  const symbols = Object.keys(data);
  let totalRecords = 0;
  const symbolSamples = [];
  const assetTypeCounts = {};

  for (const symbol of symbols) {
    const records = data[symbol];
    
    if (!Array.isArray(records)) {
      console.warn(`⚠️  Warning: Symbol "${symbol}" has invalid data (not an array)`);
      continue;
    }

    totalRecords += records.length;

    // Collect sample symbols (first 5)
    if (symbolSamples.length < 5 && records.length > 0) {
      symbolSamples.push({
        symbol,
        recordCount: records.length,
        assetType: records[0].AssetType || 'unknown',
        latestDate: records[records.length - 1]?.Date || 'unknown'
      });
    }

    // Count by asset type
    if (records.length > 0 && records[0].AssetType) {
      const assetType = records[0].AssetType;
      assetTypeCounts[assetType] = (assetTypeCounts[assetType] || 0) + 1;
    }
  }

  // Display results
  console.log('✅ Market data file is valid!');
  console.log('');
  console.log('📋 File Information:');
  console.log(`   Location: ${dataFile}`);
  console.log(`   Size: ${formatFileSize(stats.size)}`);
  
  if (lastUpdateDate) {
    console.log(`   Last Updated: ${formatDate(lastUpdateDate)}`);
  } else {
    console.log(`   Last Updated: (not available - old format)`);
  }
  
  console.log('');
  console.log('📊 Statistics:');
  console.log(`   Total Symbols: ${symbols.length}`);
  console.log(`   Total Records: ${totalRecords.toLocaleString()}`);
  
  if (Object.keys(assetTypeCounts).length > 0) {
    console.log('');
    console.log('   Symbols by Asset Type:');
    for (const [assetType, count] of Object.entries(assetTypeCounts)) {
      console.log(`     - ${assetType}: ${count}`);
    }
  }

  if (symbolSamples.length > 0) {
    console.log('');
    console.log('📝 Sample Symbols (first 5):');
    symbolSamples.forEach(sample => {
      console.log(`     - ${sample.symbol} (${sample.assetType}): ${sample.recordCount} records, latest: ${sample.latestDate}`);
    });
  }

  console.log('');
  console.log('✅ Data file is ready for backend use!');
  
  return true;
}

// Run if executed directly
if (require.main === module) {
  const isValid = verifyMarketData();
  process.exit(isValid ? 0 : 1);
}

module.exports = { verifyMarketData };

