-- WealthArena Azure SQL Database Schema
-- This schema defines all tables for market data, signals, trades, and analytics

-- Enable necessary features
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Create database if not exists (this will be handled by Azure CLI)
-- USE wealtharena_db;
-- GO

-- =============================================
-- Market Data Tables
-- =============================================

-- Raw market data from various sources
CREATE TABLE market_data_raw (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    symbol NVARCHAR(20) NOT NULL,
    source NVARCHAR(50) NOT NULL, -- 'yahoo', 'alpha_vantage', 'asx'
    date_time DATETIME2 NOT NULL,
    open_price DECIMAL(18,6),
    high_price DECIMAL(18,6),
    low_price DECIMAL(18,6),
    close_price DECIMAL(18,6),
    volume BIGINT,
    adjusted_close DECIMAL(18,6),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    INDEX IX_market_data_raw_symbol_date (symbol, date_time),
    INDEX IX_market_data_raw_source (source)
);

-- Processed OHLCV data
CREATE TABLE market_data_ohlcv (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    symbol NVARCHAR(20) NOT NULL,
    date_time DATETIME2 NOT NULL,
    open_price DECIMAL(18,6) NOT NULL,
    high_price DECIMAL(18,6) NOT NULL,
    low_price DECIMAL(18,6) NOT NULL,
    close_price DECIMAL(18,6) NOT NULL,
    volume BIGINT NOT NULL,
    adjusted_close DECIMAL(18,6),
    returns_1d DECIMAL(18,8),
    returns_5d DECIMAL(18,8),
    returns_30d DECIMAL(18,8),
    volatility_30d DECIMAL(18,8),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_market_data_ohlcv_symbol_date UNIQUE (symbol, date_time),
    INDEX IX_market_data_ohlcv_symbol_date (symbol, date_time),
    INDEX IX_market_data_ohlcv_date (date_time)
);

-- Technical indicators computed from OHLCV data
CREATE TABLE technical_indicators (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    symbol NVARCHAR(20) NOT NULL,
    date_time DATETIME2 NOT NULL,
    
    -- Moving Averages
    sma_5 DECIMAL(18,6),
    sma_10 DECIMAL(18,6),
    sma_20 DECIMAL(18,6),
    sma_50 DECIMAL(18,6),
    sma_200 DECIMAL(18,6),
    ema_5 DECIMAL(18,6),
    ema_10 DECIMAL(18,6),
    ema_20 DECIMAL(18,6),
    ema_50 DECIMAL(18,6),
    ema_200 DECIMAL(18,6),
    
    -- Momentum Indicators
    rsi_14 DECIMAL(18,6),
    rsi_21 DECIMAL(18,6),
    macd_line DECIMAL(18,6),
    macd_signal DECIMAL(18,6),
    macd_histogram DECIMAL(18,6),
    stochastic_k DECIMAL(18,6),
    stochastic_d DECIMAL(18,6),
    williams_r DECIMAL(18,6),
    
    -- Volatility Indicators
    atr_14 DECIMAL(18,6),
    bollinger_upper DECIMAL(18,6),
    bollinger_middle DECIMAL(18,6),
    bollinger_lower DECIMAL(18,6),
    bollinger_width DECIMAL(18,6),
    bollinger_position DECIMAL(18,6),
    
    -- Volume Indicators
    volume_sma_20 BIGINT,
    volume_ratio DECIMAL(18,6),
    obv DECIMAL(18,6),
    ad_line DECIMAL(18,6),
    
    -- Trend Indicators
    adx DECIMAL(18,6),
    di_plus DECIMAL(18,6),
    di_minus DECIMAL(18,6),
    parabolic_sar DECIMAL(18,6),
    
    -- Support/Resistance
    support_level DECIMAL(18,6),
    resistance_level DECIMAL(18,6),
    
    -- Custom Features
    price_position_20d DECIMAL(18,6), -- Position within 20-day range
    price_position_50d DECIMAL(18,6), -- Position within 50-day range
    trend_strength DECIMAL(18,6),    -- Overall trend strength
    momentum_score DECIMAL(18,6),    -- Combined momentum score
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT UQ_technical_indicators_symbol_date UNIQUE (symbol, date_time),
    INDEX IX_technical_indicators_symbol_date (symbol, date_time),
    INDEX IX_technical_indicators_date (date_time)
);

-- RL Model generated trading signals
CREATE TABLE rl_signals (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    symbol NVARCHAR(20) NOT NULL,
    date_time DATETIME2 NOT NULL,
    model_version NVARCHAR(50) NOT NULL,
    
    -- Signal Details
    signal_type NVARCHAR(10) NOT NULL, -- 'BUY', 'SELL', 'HOLD'
    confidence_score DECIMAL(18,6) NOT NULL, -- 0.0 to 1.0
    position_size DECIMAL(18,6) NOT NULL, -- 0.0 to 1.0 (percentage of portfolio)
    
    -- Price Targets
    entry_price DECIMAL(18,6),
    take_profit_1 DECIMAL(18,6),
    take_profit_2 DECIMAL(18,6),
    take_profit_3 DECIMAL(18,6),
    stop_loss DECIMAL(18,6),
    
    -- Risk Metrics
    risk_reward_ratio DECIMAL(18,6),
    max_risk_percentage DECIMAL(18,6),
    expected_return DECIMAL(18,6),
    expected_volatility DECIMAL(18,6),
    
    -- Model Features (for explainability)
    feature_importance NVARCHAR(MAX),
    model_reasoning NVARCHAR(MAX),
    CONSTRAINT CK_rl_signals_feature_importance_json CHECK (ISJSON(feature_importance) = 1 OR feature_importance IS NULL),
    
    -- Metadata
    asset_class NVARCHAR(20), -- 'stocks', 'etf', 'crypto', 'forex', 'commodities'
    market_cap_category NVARCHAR(20), -- 'large', 'mid', 'small', 'micro'
    sector NVARCHAR(50),
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_rl_signals_symbol_date (symbol, date_time),
    INDEX IX_rl_signals_date (date_time),
    INDEX IX_rl_signals_confidence (confidence_score),
    INDEX IX_rl_signals_asset_class (asset_class)
);

-- News sentiment analysis
CREATE TABLE news_sentiment (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    symbol NVARCHAR(20),
    headline NVARCHAR(500) NOT NULL,
    content NVARCHAR(MAX),
    source NVARCHAR(100) NOT NULL,
    published_date DATETIME2 NOT NULL,
    
    -- Sentiment Analysis
    sentiment_score DECIMAL(18,6) NOT NULL, -- -1.0 to 1.0
    sentiment_label NVARCHAR(20) NOT NULL, -- 'positive', 'negative', 'neutral'
    confidence DECIMAL(18,6) NOT NULL,
    
    -- Entity Extraction
    entities NVARCHAR(MAX), -- Named entities extracted
    keywords NVARCHAR(MAX), -- Key terms
    CONSTRAINT CK_news_sentiment_entities_json CHECK (ISJSON(entities) = 1 OR entities IS NULL),
    
    -- Impact Assessment
    market_impact_score DECIMAL(18,6), -- Predicted market impact
    relevance_score DECIMAL(18,6), -- Relevance to symbol
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_news_sentiment_symbol (symbol),
    INDEX IX_news_sentiment_published_date (published_date),
    INDEX IX_news_sentiment_sentiment (sentiment_score)
);

-- =============================================
-- User and Portfolio Tables
-- =============================================

-- User portfolios
CREATE TABLE portfolios (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(50) NOT NULL, -- Cosmos DB user ID
    portfolio_name NVARCHAR(100) NOT NULL,
    portfolio_type NVARCHAR(20) NOT NULL, -- 'paper', 'simulation', 'game'
    
    -- Portfolio Settings
    initial_capital DECIMAL(18,2) NOT NULL,
    current_value DECIMAL(18,2) NOT NULL,
    cash_balance DECIMAL(18,2) NOT NULL,
    total_invested DECIMAL(18,2) NOT NULL,
    
    -- Risk Settings
    max_position_size DECIMAL(18,6) NOT NULL, -- Max % per position
    max_drawdown DECIMAL(18,6) NOT NULL, -- Max drawdown %
    risk_tolerance NVARCHAR(20) NOT NULL, -- 'conservative', 'moderate', 'aggressive'
    
    -- Performance Metrics
    total_return DECIMAL(18,6),
    annualized_return DECIMAL(18,6),
    sharpe_ratio DECIMAL(18,6),
    sortino_ratio DECIMAL(18,6),
    max_drawdown_actual DECIMAL(18,6),
    win_rate DECIMAL(18,6),
    profit_factor DECIMAL(18,6),
    
    -- Status
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_portfolios_user_id (user_id),
    INDEX IX_portfolios_type (portfolio_type)
);

-- Portfolio positions
CREATE TABLE positions (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    portfolio_id BIGINT NOT NULL,
    symbol NVARCHAR(20) NOT NULL,
    
    -- Position Details
    quantity DECIMAL(18,6) NOT NULL,
    average_price DECIMAL(18,6) NOT NULL,
    current_price DECIMAL(18,6),
    market_value DECIMAL(18,2),
    unrealized_pnl DECIMAL(18,2),
    unrealized_pnl_percentage DECIMAL(18,6),
    
    -- Position Metadata
    position_type NVARCHAR(20) NOT NULL, -- 'long', 'short'
    entry_date DATETIME2 NOT NULL,
    last_updated DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
    INDEX IX_positions_portfolio_id (portfolio_id),
    INDEX IX_positions_symbol (symbol)
);

-- Trade history
CREATE TABLE trades (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    portfolio_id BIGINT NOT NULL,
    symbol NVARCHAR(20) NOT NULL,
    
    -- Trade Details
    trade_type NVARCHAR(10) NOT NULL, -- 'BUY', 'SELL'
    quantity DECIMAL(18,6) NOT NULL,
    price DECIMAL(18,6) NOT NULL,
    total_value DECIMAL(18,2) NOT NULL,
    commission DECIMAL(18,2) DEFAULT 0,
    fees DECIMAL(18,2) DEFAULT 0,
    
    -- Trade Metadata
    trade_date DATETIME2 NOT NULL,
    signal_id BIGINT, -- Reference to rl_signals
    order_type NVARCHAR(20) DEFAULT 'MARKET', -- 'MARKET', 'LIMIT', 'STOP'
    
    -- Performance
    realized_pnl DECIMAL(18,2),
    holding_period_days INT,
    
    -- Trade Context
    trade_reason NVARCHAR(MAX), -- Why this trade was made
    market_conditions NVARCHAR(MAX), -- Market state at time of trade
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
    FOREIGN KEY (signal_id) REFERENCES rl_signals(id),
    INDEX IX_trades_portfolio_id (portfolio_id),
    INDEX IX_trades_symbol (symbol),
    INDEX IX_trades_trade_date (trade_date)
);

-- =============================================
-- Game and Competition Tables
-- =============================================

-- Game sessions
CREATE TABLE game_sessions (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(50) NOT NULL,
    game_type NVARCHAR(20) NOT NULL, -- 'historical', 'tournament', 'vs_ai'
    
    -- Game Settings
    game_name NVARCHAR(100) NOT NULL,
    start_date DATETIME2 NOT NULL,
    end_date DATETIME2 NOT NULL,
    initial_capital DECIMAL(18,2) NOT NULL,
    max_positions INT DEFAULT 10,
    
    -- Historical Context
    historical_start_date DATETIME2 NOT NULL,
    historical_end_date DATETIME2 NOT NULL,
    market_conditions NVARCHAR(MAX), -- Description of historical period
    
    -- Performance
    final_value DECIMAL(18,2),
    total_return DECIMAL(18,6),
    sharpe_ratio DECIMAL(18,6),
    max_drawdown DECIMAL(18,6),
    final_rank INT,
    
    -- Status
    status NVARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'paused'
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    completed_at DATETIME2,
    
    INDEX IX_game_sessions_user_id (user_id),
    INDEX IX_game_sessions_status (status),
    INDEX IX_game_sessions_final_rank (final_rank)
);

-- Leaderboard entries
CREATE TABLE leaderboard_entries (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(50) NOT NULL,
    game_session_id BIGINT,
    portfolio_id BIGINT,
    
    -- Performance Metrics
    total_return DECIMAL(18,6) NOT NULL,
    sharpe_ratio DECIMAL(18,6) NOT NULL,
    max_drawdown DECIMAL(18,6) NOT NULL,
    win_rate DECIMAL(18,6) NOT NULL,
    profit_factor DECIMAL(18,6) NOT NULL,
    
    -- Ranking
    overall_rank INT,
    category_rank INT, -- Rank within category (e.g., 'stocks', 'crypto')
    tier NVARCHAR(20), -- 'bronze', 'silver', 'gold', 'platinum', 'diamond'
    
    -- Metadata
    period_start DATETIME2 NOT NULL,
    period_end DATETIME2 NOT NULL,
    asset_class NVARCHAR(20), -- 'stocks', 'crypto', 'forex', 'mixed'
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id),
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id),
    INDEX IX_leaderboard_entries_overall_rank (overall_rank),
    INDEX IX_leaderboard_entries_category_rank (category_rank),
    INDEX IX_leaderboard_entries_tier (tier)
);

-- =============================================
-- Analytics and Reporting Tables
-- =============================================

-- Feature snapshots for ML model training
CREATE TABLE feature_snapshots (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    snapshot_date DATETIME2 NOT NULL,
    symbol NVARCHAR(20) NOT NULL,
    
    -- Market Features
    price_features NVARCHAR(MAX), -- OHLCV and derived price features
    technical_features NVARCHAR(MAX), -- All technical indicators
    fundamental_features NVARCHAR(MAX), -- Fundamental data if available
    sentiment_features NVARCHAR(MAX), -- News sentiment features
    CONSTRAINT CK_feature_snapshots_price_features_json CHECK (ISJSON(price_features) = 1 OR price_features IS NULL),
    CONSTRAINT CK_feature_snapshots_technical_features_json CHECK (ISJSON(technical_features) = 1 OR technical_features IS NULL),
    CONSTRAINT CK_feature_snapshots_fundamental_features_json CHECK (ISJSON(fundamental_features) = 1 OR fundamental_features IS NULL),
    CONSTRAINT CK_feature_snapshots_sentiment_features_json CHECK (ISJSON(sentiment_features) = 1 OR sentiment_features IS NULL),
    
    -- Target Variables
    future_return_1d DECIMAL(18,6),
    future_return_5d DECIMAL(18,6),
    future_return_30d DECIMAL(18,6),
    future_volatility_30d DECIMAL(18,6),
    
    -- Metadata
    feature_count INT,
    data_quality_score DECIMAL(18,6), -- 0.0 to 1.0
    missing_features NVARCHAR(MAX), -- List of missing features
    CONSTRAINT CK_feature_snapshots_missing_features_json CHECK (ISJSON(missing_features) = 1 OR missing_features IS NULL),
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_feature_snapshots_date (snapshot_date),
    INDEX IX_feature_snapshots_symbol (symbol)
);

-- Model performance tracking
CREATE TABLE model_performance (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    model_name NVARCHAR(100) NOT NULL,
    model_version NVARCHAR(50) NOT NULL,
    evaluation_date DATETIME2 NOT NULL,
    
    -- Performance Metrics
    accuracy DECIMAL(18,6),
    precision_score DECIMAL(18,6),
    recall_score DECIMAL(18,6),
    f1_score DECIMAL(18,6),
    sharpe_ratio DECIMAL(18,6),
    max_drawdown DECIMAL(18,6),
    win_rate DECIMAL(18,6),
    profit_factor DECIMAL(18,6),
    
    -- Training Details
    training_samples INT,
    validation_samples INT,
    training_duration_minutes INT,
    hyperparameters NVARCHAR(MAX),
    
    -- Model Metadata
    model_path NVARCHAR(500), -- Path to model file
    feature_importance NVARCHAR(MAX),
    CONSTRAINT CK_model_performance_hyperparameters_json CHECK (ISJSON(hyperparameters) = 1 OR hyperparameters IS NULL),
    CONSTRAINT CK_model_performance_feature_importance_json CHECK (ISJSON(feature_importance) = 1 OR feature_importance IS NULL),
    model_notes NVARCHAR(MAX),
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_model_performance_model_name (model_name),
    INDEX IX_model_performance_evaluation_date (evaluation_date)
);

-- =============================================
-- Chat and Support Tables
-- =============================================

-- Chat sessions with the AI assistant
CREATE TABLE chat_sessions (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(50) NOT NULL,
    session_id NVARCHAR(100) NOT NULL,
    
    -- Session Details
    session_type NVARCHAR(20) NOT NULL, -- 'general', 'signal_explanation', 'education'
    context_data NVARCHAR(MAX), -- Page context, current signals, etc.
    CONSTRAINT CK_chat_sessions_context_data_json CHECK (ISJSON(context_data) = 1 OR context_data IS NULL),
    
    -- Session Metadata
    started_at DATETIME2 NOT NULL,
    ended_at DATETIME2,
    message_count INT DEFAULT 0,
    user_satisfaction_score INT, -- 1-5 rating
    
    -- Session Status
    status NVARCHAR(20) DEFAULT 'active', -- 'active', 'ended', 'archived'
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    INDEX IX_chat_sessions_user_id (user_id),
    INDEX IX_chat_sessions_session_id (session_id),
    INDEX IX_chat_sessions_started_at (started_at)
);

-- Individual chat messages
CREATE TABLE chat_messages (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    session_id BIGINT NOT NULL,
    
    -- Message Details
    message_type NVARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content NVARCHAR(MAX) NOT NULL,
    timestamp DATETIME2 NOT NULL,
    
    -- AI Response Details
    model_used NVARCHAR(50),
    response_time_ms INT,
    tokens_used INT,
    confidence_score DECIMAL(18,6),
    
    -- Context
    context_data NVARCHAR(MAX), -- Additional context for the message
    tools_used NVARCHAR(MAX), -- Tools/functions called by AI
    CONSTRAINT CK_chat_messages_context_data_json CHECK (ISJSON(context_data) = 1 OR context_data IS NULL),
    CONSTRAINT CK_chat_messages_tools_used_json CHECK (ISJSON(tools_used) = 1 OR tools_used IS NULL),
    
    -- User Feedback
    user_rating INT, -- 1-5 rating
    user_feedback NVARCHAR(MAX),
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    INDEX IX_chat_messages_session_id (session_id),
    INDEX IX_chat_messages_timestamp (timestamp)
);

-- =============================================
-- Staging Tables for Data Pipeline
-- =============================================

-- Staging table for processed data (temporary)
CREATE TABLE processed_stage (
    symbol NVARCHAR(20) NOT NULL,
    ts_local DATETIME2 NOT NULL,
    date_utc DATE NOT NULL,
    [open] DECIMAL(18,6),
    [high] DECIMAL(18,6),
    [low] DECIMAL(18,6),
    [close] DECIMAL(18,6),
    volume BIGINT,
    sma_5 DECIMAL(18,6),
    sma_10 DECIMAL(18,6),
    sma_20 DECIMAL(18,6),
    sma_50 DECIMAL(18,6),
    sma_200 DECIMAL(18,6),
    ema_12 DECIMAL(18,6),
    ema_26 DECIMAL(18,6),
    rsi_14 DECIMAL(18,6),
    macd DECIMAL(18,6),
    macd_signal DECIMAL(18,6),
    macd_hist DECIMAL(18,6),
    bb_middle DECIMAL(18,6),
    bb_upper DECIMAL(18,6),
    bb_lower DECIMAL(18,6),
    returns DECIMAL(18,8),
    log_returns DECIMAL(18,8),
    volatility_20 DECIMAL(18,8),
    momentum_20 DECIMAL(18,8),
    volume_sma_20 BIGINT,
    volume_ratio DECIMAL(18,6)
);

-- Final processed prices table (with technical indicators)
CREATE TABLE processed_prices (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    symbol NVARCHAR(20) NOT NULL,
    ts_local DATETIME2 NOT NULL,
    date_utc DATE NOT NULL,
    [open] DECIMAL(18,6),
    [high] DECIMAL(18,6),
    [low] DECIMAL(18,6),
    [close] DECIMAL(18,6),
    volume BIGINT,
    sma_5 DECIMAL(18,6),
    sma_10 DECIMAL(18,6),
    sma_20 DECIMAL(18,6),
    sma_50 DECIMAL(18,6),
    sma_200 DECIMAL(18,6),
    ema_12 DECIMAL(18,6),
    ema_26 DECIMAL(18,6),
    rsi_14 DECIMAL(18,6),
    macd DECIMAL(18,6),
    macd_signal DECIMAL(18,6),
    macd_hist DECIMAL(18,6),
    bb_middle DECIMAL(18,6),
    bb_upper DECIMAL(18,6),
    bb_lower DECIMAL(18,6),
    returns DECIMAL(18,8),
    log_returns DECIMAL(18,8),
    volatility_20 DECIMAL(18,8),
    momentum_20 DECIMAL(18,8),
    volume_sma_20 BIGINT,
    volume_ratio DECIMAL(18,6),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT UQ_processed_prices_symbol_date UNIQUE (symbol, date_utc),
    INDEX IX_processed_prices_symbol_date (symbol, date_utc),
    INDEX IX_processed_prices_date (date_utc)
);

-- =============================================
-- Stored Procedures and Functions
-- =============================================
GO

-- Procedure to calculate portfolio performance
CREATE PROCEDURE CalculatePortfolioPerformance
    @PortfolioId BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @TotalReturn DECIMAL(18,6);
    DECLARE @SharpeRatio DECIMAL(18,6);
    DECLARE @MaxDrawdown DECIMAL(18,6);
    DECLARE @WinRate DECIMAL(18,6);
    
    -- Calculate total return
    SELECT @TotalReturn = (current_value - initial_capital) / initial_capital * 100
    FROM portfolios 
    WHERE id = @PortfolioId;
    
    -- Calculate Sharpe ratio (simplified)
    SELECT @SharpeRatio = AVG(returns_1d) / STDEV(returns_1d) * SQRT(252)
    FROM market_data_ohlcv mdo
    INNER JOIN trades t ON t.symbol = mdo.symbol
    WHERE t.portfolio_id = @PortfolioId
    AND t.trade_date = mdo.date_time;
    
    -- Calculate max drawdown
    WITH Drawdowns AS (
        SELECT 
            date_time,
            close_price,
            MAX(close_price) OVER (ORDER BY date_time ROWS UNBOUNDED PRECEDING) as peak,
            (close_price - MAX(close_price) OVER (ORDER BY date_time ROWS UNBOUNDED PRECEDING)) / 
            MAX(close_price) OVER (ORDER BY date_time ROWS UNBOUNDED PRECEDING) * 100 as drawdown
        FROM market_data_ohlcv
        WHERE symbol IN (SELECT DISTINCT symbol FROM trades WHERE portfolio_id = @PortfolioId)
    )
    SELECT @MaxDrawdown = MIN(drawdown)
    FROM Drawdowns;
    
    -- Calculate win rate
    SELECT @WinRate = COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) * 100.0 / COUNT(*)
    FROM trades 
    WHERE portfolio_id = @PortfolioId AND realized_pnl IS NOT NULL;
    
    -- Update portfolio with calculated metrics
    UPDATE portfolios 
    SET 
        total_return = @TotalReturn,
        sharpe_ratio = @SharpeRatio,
        max_drawdown_actual = @MaxDrawdown,
        win_rate = @WinRate,
        updated_at = GETUTCDATE()
    WHERE id = @PortfolioId;
    
    SELECT @TotalReturn as TotalReturn, @SharpeRatio as SharpeRatio, 
           @MaxDrawdown as MaxDrawdown, @WinRate as WinRate;
END;
GO

-- Function to get top performing signals
CREATE FUNCTION GetTopSignals(@AssetClass NVARCHAR(20), @Limit INT = 3)
RETURNS TABLE
AS
RETURN
(
    SELECT TOP(@Limit)
        s.id,
        s.symbol,
        s.signal_type,
        s.confidence_score,
        s.entry_price,
        s.take_profit_1,
        s.take_profit_2,
        s.take_profit_3,
        s.stop_loss,
        s.risk_reward_ratio,
        s.expected_return,
        s.model_reasoning,
        mdo.close_price as current_price,
        (s.take_profit_1 - s.entry_price) / s.entry_price * 100 as potential_return_1,
        (s.take_profit_2 - s.entry_price) / s.entry_price * 100 as potential_return_2,
        (s.take_profit_3 - s.entry_price) / s.entry_price * 100 as potential_return_3
    FROM rl_signals s
    INNER JOIN market_data_ohlcv mdo ON s.symbol = mdo.symbol 
        AND mdo.date_time = (SELECT MAX(date_time) FROM market_data_ohlcv WHERE symbol = s.symbol)
    WHERE s.asset_class = @AssetClass
        AND s.date_time >= DATEADD(day, -1, GETUTCDATE()) -- Signals from last 24 hours
        AND s.confidence_score >= 0.7 -- High confidence signals only
    ORDER BY s.confidence_score DESC, s.expected_return DESC
);
GO

-- =============================================
-- Indexes for Performance
-- =============================================

-- Additional indexes for common queries
CREATE INDEX IX_market_data_ohlcv_returns ON market_data_ohlcv (returns_1d, returns_5d, returns_30d);
CREATE INDEX IX_technical_indicators_rsi ON technical_indicators (rsi_14, rsi_21);
CREATE INDEX IX_technical_indicators_macd ON technical_indicators (macd_line, macd_signal);
CREATE INDEX IX_rl_signals_asset_class_confidence ON rl_signals (asset_class, confidence_score);
CREATE INDEX IX_trades_portfolio_date ON trades (portfolio_id, trade_date);
CREATE INDEX IX_positions_portfolio_symbol ON positions (portfolio_id, symbol);

-- =============================================
-- Sample Data Insertion (for testing)
-- =============================================

-- Insert sample symbols
INSERT INTO market_data_ohlcv (symbol, date_time, open_price, high_price, low_price, close_price, volume, adjusted_close, returns_1d)
VALUES 
    ('AAPL', '2024-01-01', 150.00, 155.00, 149.00, 154.00, 1000000, 154.00, 0.0267),
    ('MSFT', '2024-01-01', 300.00, 305.00, 298.00, 303.00, 800000, 303.00, 0.0100),
    ('GOOGL', '2024-01-01', 120.00, 125.00, 119.00, 124.00, 600000, 124.00, 0.0333);

-- Insert sample technical indicators
INSERT INTO technical_indicators (symbol, date_time, sma_20, ema_20, rsi_14, macd_line, macd_signal, atr_14)
VALUES 
    ('AAPL', '2024-01-01', 152.50, 153.20, 65.5, 1.2, 0.8, 2.5),
    ('MSFT', '2024-01-01', 301.00, 301.80, 58.3, 0.5, 0.3, 3.2),
    ('GOOGL', '2024-01-01', 121.50, 122.10, 72.1, 1.8, 1.2, 2.8);

-- Insert sample RL signals
INSERT INTO rl_signals (symbol, date_time, model_version, signal_type, confidence_score, position_size, entry_price, take_profit_1, stop_loss, risk_reward_ratio, asset_class)
VALUES 
    ('AAPL', '2024-01-01', 'v1.0', 'BUY', 0.85, 0.05, 154.00, 160.00, 150.00, 1.2, 'stocks'),
    ('MSFT', '2024-01-01', 'v1.0', 'HOLD', 0.65, 0.0, 303.00, 310.00, 295.00, 0.8, 'stocks'),
    ('GOOGL', '2024-01-01', 'v1.0', 'BUY', 0.92, 0.08, 124.00, 130.00, 120.00, 1.5, 'stocks');

PRINT 'WealthArena Azure SQL Database Schema created successfully!';
PRINT 'Tables created: market_data_raw, market_data_ohlcv, technical_indicators, rl_signals, news_sentiment, portfolios, positions, trades, game_sessions, leaderboard_entries, feature_snapshots, model_performance, chat_sessions, chat_messages';
PRINT 'Stored procedures created: CalculatePortfolioPerformance';
PRINT 'Functions created: GetTopSignals';
PRINT 'Sample data inserted for testing';
