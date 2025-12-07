/**
 * Simple script to count symbols in large JSON file without loading entire file
 */

const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../data/local-market-data.json');

console.log('Counting symbols in JSON file...');
console.log('File:', dataFile);

// Read file in chunks and count symbol keys
const stream = fs.createReadStream(dataFile, { encoding: 'utf-8', highWaterMark: 64 * 1024 }); // 64KB chunks

let buffer = '';
let symbolCount = 0;
let inDataSection = false;

stream.on('data', (chunk) => {
  buffer += chunk;
  
  // Process complete lines
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.includes('"data":')) {
      inDataSection = true;
    }
    
    if (inDataSection) {
      // Match pattern: "SYMBOL": [
      const matches = line.match(/"([^"]+)":\s*\[/g);
      if (matches) {
        symbolCount += matches.length;
      }
    }
  }
});

stream.on('end', () => {
  // Process remaining buffer
  if (buffer) {
    const matches = buffer.match(/"([^"]+)":\s*\[/g);
    if (matches) {
      symbolCount += matches.length;
    }
  }
  
  console.log(`\n✅ Total symbols found: ${symbolCount}`);
  
  if (symbolCount === 0) {
    console.log('⚠️  No symbols found - file may be empty or corrupted');
  } else if (symbolCount < 100) {
    console.log(`⚠️  Only ${symbolCount} symbols found - expected ~1938`);
  } else {
    console.log(`✓ File appears to have all symbols (${symbolCount})`);
  }
  
  process.exit(symbolCount > 0 ? 0 : 1);
});

stream.on('error', (error) => {
  console.error('Error reading file:', error.message);
  process.exit(1);
});

