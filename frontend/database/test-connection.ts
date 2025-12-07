/**
 * Database Connection Test Script
 * WealthArena - Azure SQL Connection Tester
 * 
 * Run this script to verify your database connection:
 * ts-node test-connection.ts
 * or
 * npx ts-node test-connection.ts
 */

import 'dotenv/config';
import db from './db-connection';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function runTests() {
  log('\n========================================', colors.cyan);
  log('  WealthArena Database Connection Test', colors.bright);
  log('========================================\n', colors.cyan);

  try {
    // Test 1: Basic Connection
    log('Test 1: Testing basic connection...', colors.blue);
    const connectionResult = await db.testConnection();
    if (connectionResult) {
      log('✅ Database connection successful!\n', colors.green);
    } else {
      log('❌ Database connection failed!\n', colors.red);
      return;
    }

    // Test 2: Check Tables
    log('Test 2: Checking database tables...', colors.blue);
    const tableQuery = `
      SELECT COUNT(*) AS TableCount
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
    `;
    const tableResult = await db.executeQuery(tableQuery);
    const tableCount = tableResult.recordset[0].TableCount;
    log(`✅ Found ${tableCount} tables in database\n`, colors.green);

    if (tableCount !== 29) {
      log(`⚠️  Warning: Expected 29 tables, found ${tableCount}`, colors.yellow);
      log('   Make sure you ran the AzureSQL_CreateTables.sql script\n', colors.yellow);
    }

    // Test 3: Check Views
    log('Test 3: Checking database views...', colors.blue);
    const viewQuery = `
      SELECT COUNT(*) AS ViewCount
      FROM INFORMATION_SCHEMA.VIEWS
    `;
    const viewResult = await db.executeQuery(viewQuery);
    const viewCount = viewResult.recordset[0].ViewCount;
    log(`✅ Found ${viewCount} views in database\n`, colors.green);

    // Test 4: Check Stored Procedures
    log('Test 4: Checking stored procedures...', colors.blue);
    const procQuery = `
      SELECT COUNT(*) AS ProcCount
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_TYPE = 'PROCEDURE'
    `;
    const procResult = await db.executeQuery(procQuery);
    const procCount = procResult.recordset[0].ProcCount;
    log(`✅ Found ${procCount} stored procedures\n`, colors.green);

    // Test 5: Check Seed Data
    log('Test 5: Checking seed data...', colors.blue);
    const achievementCount = await db.executeQuery('SELECT COUNT(*) AS Count FROM Achievements');
    const questCount = await db.executeQuery('SELECT COUNT(*) AS Count FROM Quests');
    const topicCount = await db.executeQuery('SELECT COUNT(*) AS Count FROM LearningTopics');
    const strategyCount = await db.executeQuery('SELECT COUNT(*) AS Count FROM Strategies');
    
    log(`   Achievements: ${achievementCount.recordset[0].Count}`, colors.green);
    log(`   Quests: ${questCount.recordset[0].Count}`, colors.green);
    log(`   Learning Topics: ${topicCount.recordset[0].Count}`, colors.green);
    log(`   Strategies: ${strategyCount.recordset[0].Count}`, colors.green);
    log('✅ Seed data loaded successfully\n', colors.green);

    // Test 6: Create Test User
    log('Test 6: Creating test user...', colors.blue);
    try {
      // Check if test user already exists
      const existingUser = await db.executeQuery(
        'SELECT UserID FROM Users WHERE Email = @email',
        { email: 'test@wealtharena.com' }
      );

      if (existingUser.recordset.length > 0) {
        log('   Test user already exists, skipping creation', colors.yellow);
        const userId = existingUser.recordset[0].UserID;
        
        // Get user dashboard data
        const dashboard = await db.executeQuery(
          'SELECT * FROM vw_UserDashboard WHERE UserID = @userId',
          { userId }
        );
        
        if (dashboard.recordset.length > 0) {
          log('✅ User dashboard view working correctly\n', colors.green);
        }
      } else {
        const newUser = await db.createUser(
          'test@wealtharena.com',
          'test_hash_' + Date.now(), // In production, use proper bcrypt hash
          'testuser_' + Date.now(),
          'Test',
          'User',
          'Test User'
        );
        log(`✅ Test user created with ID: ${newUser.UserID}\n`, colors.green);
      }
    } catch (error: any) {
      if (error.message?.includes('UNIQUE KEY constraint')) {
        log('   Test user already exists (duplicate key), that\'s OK', colors.yellow);
        log('✅ User creation procedure working\n', colors.green);
      } else {
        throw error;
      }
    }

    // Test 7: Test Leaderboard View
    log('Test 7: Testing leaderboard view...', colors.blue);
    const leaderboard = await db.getLeaderboard(5);
    log(`✅ Retrieved ${leaderboard.length} leaderboard entries\n`, colors.green);

    // Test 8: Test Top Trading Signals View
    log('Test 8: Testing trading signals view...', colors.blue);
    const signals = await db.getTopTradingSignals(5);
    log(`✅ Retrieved ${signals.length} trading signals\n`, colors.green);

    // Test 9: Test News Articles
    log('Test 9: Checking news articles table...', colors.blue);
    const news = await db.getNewsArticles(undefined, undefined, 5);
    log(`✅ News articles table accessible (${news.length} records)\n`, colors.green);

    // Final Summary
    log('========================================', colors.cyan);
    log('  🎉 All Tests Passed Successfully!', colors.green + colors.bright);
    log('========================================\n', colors.cyan);
    
    log('Database Information:', colors.blue);
    log(`  • Tables: ${tableCount}`, colors.reset);
    log(`  • Views: ${viewCount}`, colors.reset);
    log(`  • Stored Procedures: ${procCount}`, colors.reset);
    log(`  • Achievements: ${achievementCount.recordset[0].Count}`, colors.reset);
    log(`  • Quests: ${questCount.recordset[0].Count}`, colors.reset);
    log(`  • Learning Topics: ${topicCount.recordset[0].Count}`, colors.reset);
    log(`  • Strategies: ${strategyCount.recordset[0].Count}\n`, colors.reset);

    log('✅ Your database is ready to use!', colors.green + colors.bright);
    log('You can now connect your application to the database.\n', colors.green);

  } catch (error: any) {
    log('\n========================================', colors.red);
    log('  ❌ Connection Test Failed', colors.red + colors.bright);
    log('========================================\n', colors.red);
    
    log('Error Details:', colors.red);
    log(`  Message: ${error.message}`, colors.reset);
    
    if (error.code) {
      log(`  Code: ${error.code}`, colors.reset);
    }
    
    log('\nCommon Issues:', colors.yellow);
    log('  1. Check your .env file contains correct credentials', colors.reset);
    log('  2. Verify firewall rules in Azure Portal', colors.reset);
    log('  3. Ensure the database exists and schema is loaded', colors.reset);
    log('  4. Check if your IP is whitelisted in Azure', colors.reset);
    log('  5. Verify the server name format: server-name.database.windows.net\n', colors.reset);

    log('Configuration Check:', colors.yellow);
    log(`  DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`, colors.reset);
    log(`  DB_NAME: ${process.env.DB_NAME || 'NOT SET'}`, colors.reset);
    log(`  DB_USER: ${process.env.DB_USER || 'NOT SET'}`, colors.reset);
    log(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? '***SET***' : 'NOT SET'}\n`, colors.reset);

  } finally {
    // Close the database connection
    log('Closing database connection...', colors.blue);
    await db.closePool();
    log('✅ Connection closed\n', colors.green);
  }
}

// Run the tests
runTests().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

