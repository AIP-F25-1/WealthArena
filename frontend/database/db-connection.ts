/**
 * Azure SQL Database Connection Helper
 * WealthArena - Database Connection Utility
 */

import sql from 'mssql';

// Database configuration interface
interface DatabaseConfig {
  user: string;
  password: string;
  server: string;
  database: string;
  port?: number;
  options?: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    enableArithAbort: boolean;
    connectionTimeout?: number;
    requestTimeout?: number;
  };
  pool?: {
    max: number;
    min: number;
    idleTimeoutMillis: number;
  };
}

// Environment-based configuration
const config: DatabaseConfig = {
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_HOST || '',
  database: process.env.DB_NAME || 'WealthArenaDB',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: true, // Azure SQL requires encryption
    trustServerCertificate: false,
    enableArithAbort: true,
    connectionTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Connection pool instance
let pool: sql.ConnectionPool | null = null;

/**
 * Get database connection pool
 * Creates pool if it doesn't exist, reuses existing pool
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    try {
      pool = await new sql.ConnectionPool(config).connect();
      console.log('✅ Connected to Azure SQL Database');
      
      // Handle connection errors
      pool.on('error', (err) => {
        console.error('❌ Database pool error:', err);
        pool = null;
      });
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }
  return pool;
}

/**
 * Execute a query with parameters
 * @param query - SQL query string
 * @param params - Query parameters
 */
export async function executeQuery<T = any>(
  query: string,
  params?: Record<string, any>
): Promise<sql.IResult<T>> {
  try {
    const pool = await getPool();
    const request = pool.request();

    // Add parameters if provided
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }

    const result = await request.query<T>(query);
    return result;
  } catch (error) {
    console.error('❌ Query execution error:', error);
    throw error;
  }
}

/**
 * Execute a stored procedure
 * @param procedureName - Name of stored procedure
 * @param params - Procedure parameters
 */
export async function executeProcedure<T = any>(
  procedureName: string,
  params?: Record<string, any>
): Promise<sql.IResult<T>> {
  try {
    const pool = await getPool();
    const request = pool.request();

    // Add parameters if provided
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }

    const result = await request.execute<T>(procedureName);
    return result;
  } catch (error) {
    console.error('❌ Procedure execution error:', error);
    throw error;
  }
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      console.log('✅ Database connection pool closed');
    } catch (error) {
      console.error('❌ Error closing pool:', error);
      throw error;
    }
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await executeQuery('SELECT 1 AS test');
    return result.recordset[0].test === 1;
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
}

// =============================================
// EXAMPLE USAGE FUNCTIONS
// =============================================

/**
 * Example: Get user by ID
 */
export async function getUserById(userId: number) {
  const query = `
    SELECT u.*, up.*
    FROM Users u
    INNER JOIN UserProfiles up ON u.UserID = up.UserID
    WHERE u.UserID = @userId
  `;
  
  const result = await executeQuery(query, { userId });
  return result.recordset[0];
}

/**
 * Example: Create new user
 */
export async function createUser(
  email: string,
  passwordHash: string,
  username: string,
  firstName?: string,
  lastName?: string,
  displayName?: string
) {
  const result = await executeProcedure('sp_CreateUser', {
    Email: email,
    PasswordHash: passwordHash,
    Username: username,
    FirstName: firstName,
    LastName: lastName,
    DisplayName: displayName,
  });
  
  return result.recordset[0];
}

/**
 * Example: Get top trading signals
 */
export async function getTopTradingSignals(limit: number = 10) {
  const query = `
    SELECT TOP (@limit) *
    FROM vw_TopTradingSignals
  `;
  
  const result = await executeQuery(query, { limit });
  return result.recordset;
}

/**
 * Example: Update user XP
 */
export async function updateUserXP(userId: number, xpToAdd: number) {
  const result = await executeProcedure('sp_UpdateUserXP', {
    UserID: userId,
    XPToAdd: xpToAdd,
  });
  
  return result.recordset[0];
}

/**
 * Example: Get user's portfolio
 */
export async function getUserPortfolio(userId: number) {
  const query = `
    SELECT p.*, pi.*
    FROM Portfolios p
    LEFT JOIN PortfolioItems pi ON p.PortfolioID = pi.PortfolioID
    WHERE p.UserID = @userId AND p.IsDefault = 1
  `;
  
  const result = await executeQuery(query, { userId });
  return result.recordset;
}

/**
 * Example: Get leaderboard
 */
export async function getLeaderboard(limit: number = 100) {
  const query = `
    SELECT TOP (@limit) *
    FROM vw_Leaderboard
  `;
  
  const result = await executeQuery(query, { limit });
  return result.recordset;
}

/**
 * Example: Get user notifications
 */
export async function getUserNotifications(userId: number, unreadOnly: boolean = false) {
  const query = unreadOnly
    ? `
      SELECT * FROM Notifications
      WHERE UserID = @userId AND IsRead = 0
      ORDER BY CreatedAt DESC
    `
    : `
      SELECT * FROM Notifications
      WHERE UserID = @userId
      ORDER BY CreatedAt DESC
    `;
  
  const result = await executeQuery(query, { userId });
  return result.recordset;
}

/**
 * Example: Mark notification as read
 */
export async function markNotificationAsRead(notificationId: number) {
  const query = `
    UPDATE Notifications
    SET IsRead = 1, ReadAt = GETUTCDATE()
    WHERE NotificationID = @notificationId
  `;
  
  await executeQuery(query, { notificationId });
}

/**
 * Example: Get user's active quests
 */
export async function getUserActiveQuests(userId: number) {
  const query = `
    SELECT q.*, uq.CurrentProgress, uq.IsCompleted
    FROM Quests q
    INNER JOIN UserQuests uq ON q.QuestID = uq.QuestID
    WHERE uq.UserID = @userId AND uq.IsCompleted = 0
    ORDER BY q.QuestType, q.Title
  `;
  
  const result = await executeQuery(query, { userId });
  return result.recordset;
}

/**
 * Example: Get learning progress
 */
export async function getUserLearningProgress(userId: number) {
  const query = `
    SELECT 
      lt.Title AS TopicTitle,
      lt.IconName AS TopicIcon,
      ll.Title AS LessonTitle,
      ulp.ProgressPercent,
      ulp.IsCompleted,
      ulp.CompletedAt
    FROM UserLearningProgress ulp
    INNER JOIN LearningLessons ll ON ulp.LessonID = ll.LessonID
    INNER JOIN LearningTopics lt ON ulp.TopicID = lt.TopicID
    WHERE ulp.UserID = @userId
    ORDER BY lt.DisplayOrder, ll.DisplayOrder
  `;
  
  const result = await executeQuery(query, { userId });
  return result.recordset;
}

/**
 * Example: Insert trading signal
 */
export async function insertTradingSignal(signal: any) {
  const query = `
    INSERT INTO TradingSignals (
      Symbol, PredictionDate, AssetType, Signal, Confidence, ModelVersion,
      EntryPrice, StopLossPrice, StopLossPercent, RiskRewardRatio, 
      WinProbability, ExpectedValue, IsTopPick
    )
    VALUES (
      @Symbol, @PredictionDate, @AssetType, @Signal, @Confidence, @ModelVersion,
      @EntryPrice, @StopLossPrice, @StopLossPercent, @RiskRewardRatio,
      @WinProbability, @ExpectedValue, @IsTopPick
    );
    SELECT SCOPE_IDENTITY() AS SignalID;
  `;
  
  const result = await executeQuery(query, signal);
  return result.recordset[0].SignalID;
}

/**
 * Example: Get news articles
 */
export async function getNewsArticles(
  category?: string,
  impact?: string,
  limit: number = 20
) {
  let query = `
    SELECT TOP (@limit) *
    FROM NewsArticles
    WHERE IsActive = 1
  `;
  
  const params: Record<string, any> = { limit };
  
  if (category) {
    query += ` AND Category = @category`;
    params.category = category;
  }
  
  if (impact) {
    query += ` AND Impact = @impact`;
    params.impact = impact;
  }
  
  query += ` ORDER BY PublishedAt DESC`;
  
  const result = await executeQuery(query, params);
  return result.recordset;
}

// Export all functions
export default {
  getPool,
  executeQuery,
  executeProcedure,
  closePool,
  testConnection,
  getUserById,
  createUser,
  getTopTradingSignals,
  updateUserXP,
  getUserPortfolio,
  getLeaderboard,
  getUserNotifications,
  markNotificationAsRead,
  getUserActiveQuests,
  getUserLearningProgress,
  insertTradingSignal,
  getNewsArticles,
};

