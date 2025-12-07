-- WealthArena PostgreSQL Database Schema
-- Adapted from Azure SQL Server schema for GCP Cloud SQL
-- PostgreSQL 15 compatible

SET search_path TO public;

-- =============================================
-- Market Data Tables
-- =============================================

-- Raw market data from various sources
CREATE TABLE market_data_raw (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'yahoo', 'alpha_vantage', 'asx'
    date_time TIMESTAMP NOT NULL,
    open_price NUMERIC(18,6),
    high_price NUMERIC(18,6),
    low_price NUMERIC(18,6),
    close_price NUMERIC(18,6),
    volume BIGINT,
    adjusted_close NUMERIC(18,6),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IX_market_data_raw_symbol_date ON market_data_raw(symbol, date_time);
CREATE INDEX IX_market_data_raw_source ON market_data_raw(source);

-- Processed OHLCV data
CREATE TABLE market_data_ohlcv (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    date_time TIMESTAMP NOT NULL,
    open_price NUMERIC(18,6) NOT NULL,
    high_price NUMERIC(18,6) NOT NULL,
    low_price NUMERIC(18,6) NOT NULL,
    close_price NUMERIC(18,6) NOT NULL,
    volume BIGINT NOT NULL,
    adjusted_close NUMERIC(18,6),
    returns_1d NUMERIC(18,8),
    returns_5d NUMERIC(18,8),
    returns_30d NUMERIC(18,8),
    volatility_30d NUMERIC(18,8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT UQ_market_data_ohlcv_symbol_date UNIQUE (symbol, date_time)
);

CREATE INDEX IX_market_data_ohlcv_symbol_date ON market_data_ohlcv(symbol, date_time);
CREATE INDEX IX_market_data_ohlcv_date ON market_data_ohlcv(date_time);

-- Technical indicators computed from OHLCV data
CREATE TABLE technical_indicators (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    date_time TIMESTAMP NOT NULL,
    
    -- Moving Averages
    sma_5 NUMERIC(18,6),
    sma_10 NUMERIC(18,6),
    sma_20 NUMERIC(18,6),
    sma_50 NUMERIC(18,6),
    sma_200 NUMERIC(18,6),
    ema_5 NUMERIC(18,6),
    ema_10 NUMERIC(18,6),
    ema_20 NUMERIC(18,6),
    ema_50 NUMERIC(18,6),
    ema_200 NUMERIC(18,6),
    
    -- Momentum Indicators
    rsi_14 NUMERIC(18,6),
    rsi_21 NUMERIC(18,6),
    macd_line NUMERIC(18,6),
    macd_signal NUMERIC(18,6),
    macd_histogram NUMERIC(18,6),
    stochastic_k NUMERIC(18,6),
    stochastic_d NUMERIC(18,6),
    williams_r NUMERIC(18,6),
    
    -- Volatility Indicators
    atr_14 NUMERIC(18,6),
    bollinger_upper NUMERIC(18,6),
    bollinger_middle NUMERIC(18,6),
    bollinger_lower NUMERIC(18,6),
    bollinger_width NUMERIC(18,6),
    bollinger_position NUMERIC(18,6),
    
    -- Volume Indicators
    volume_sma_20 BIGINT,
    volume_ratio NUMERIC(18,6),
    obv NUMERIC(18,6),
    ad_line NUMERIC(18,6),
    
    -- Trend Indicators
    adx NUMERIC(18,6),
    di_plus NUMERIC(18,6),
    di_minus NUMERIC(18,6),
    parabolic_sar NUMERIC(18,6),
    
    -- Support/Resistance
    support_level NUMERIC(18,6),
    resistance_level NUMERIC(18,6),
    
    -- Custom Features
    price_position_20d NUMERIC(18,6), -- Position within 20-day range
    price_position_50d NUMERIC(18,6), -- Position within 50-day range
    trend_strength NUMERIC(18,6),    -- Overall trend strength
    momentum_score NUMERIC(18,6),    -- Combined momentum score
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT UQ_technical_indicators_symbol_date UNIQUE (symbol, date_time)
);

CREATE INDEX IX_technical_indicators_symbol_date ON technical_indicators(symbol, date_time);
CREATE INDEX IX_technical_indicators_date ON technical_indicators(date_time);

-- RL Model generated trading signals
CREATE TABLE rl_signals (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    date_time TIMESTAMP NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    
    -- Signal Details
    signal_type VARCHAR(10) NOT NULL, -- 'BUY', 'SELL', 'HOLD'
    confidence_score NUMERIC(18,6) NOT NULL, -- 0.0 to 1.0
    position_size NUMERIC(18,6) NOT NULL, -- 0.0 to 1.0 (percentage of portfolio)
    
    -- Price Targets
    entry_price NUMERIC(18,6),
    take_profit_1 NUMERIC(18,6),
    take_profit_2 NUMERIC(18,6),
    take_profit_3 NUMERIC(18,6),
    stop_loss NUMERIC(18,6),
    
    -- Risk Metrics
    risk_reward_ratio NUMERIC(18,6),
    max_risk_percentage NUMERIC(18,6),
    expected_return NUMERIC(18,6),
    expected_volatility NUMERIC(18,6),
    
    -- Model Features (for explainability)
    feature_importance JSONB,
    model_reasoning TEXT,
    
    -- Metadata
    asset_class VARCHAR(20), -- 'stocks', 'etf', 'crypto', 'forex', 'commodities'
    market_cap_category VARCHAR(20), -- 'large', 'mid', 'small', 'micro'
    sector VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IX_rl_signals_symbol_date ON rl_signals(symbol, date_time);
CREATE INDEX IX_rl_signals_date ON rl_signals(date_time);
CREATE INDEX IX_rl_signals_confidence ON rl_signals(confidence_score);
CREATE INDEX IX_rl_signals_asset_class ON rl_signals(asset_class);

-- News sentiment analysis
CREATE TABLE news_sentiment (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20),
    headline VARCHAR(500) NOT NULL,
    content TEXT,
    source VARCHAR(100) NOT NULL,
    published_date TIMESTAMP NOT NULL,
    
    -- Sentiment Analysis
    sentiment_score NUMERIC(18,6) NOT NULL, -- -1.0 to 1.0
    sentiment_label VARCHAR(20) NOT NULL, -- 'positive', 'negative', 'neutral'
    confidence NUMERIC(18,6) NOT NULL,
    
    -- Entity Extraction
    entities JSONB, -- Named entities extracted
    keywords TEXT, -- Key terms
    
    -- Impact Assessment
    market_impact_score NUMERIC(18,6), -- Predicted market impact
    relevance_score NUMERIC(18,6), -- Relevance to symbol
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IX_news_sentiment_symbol ON news_sentiment(symbol);
CREATE INDEX IX_news_sentiment_published_date ON news_sentiment(published_date);
CREATE INDEX IX_news_sentiment_sentiment ON news_sentiment(sentiment_score);

-- =============================================
-- User and Portfolio Tables
-- =============================================

-- User portfolios
CREATE TABLE portfolios (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL, -- Cosmos DB user ID
    portfolio_name VARCHAR(100) NOT NULL,
    portfolio_type VARCHAR(20) NOT NULL, -- 'paper', 'simulation', 'game'
    
    -- Portfolio Settings
    initial_capital NUMERIC(18,2) NOT NULL,
    current_value NUMERIC(18,2) NOT NULL,
    cash_balance NUMERIC(18,2) NOT NULL,
    total_invested NUMERIC(18,2) NOT NULL,
    
    -- Risk Settings
    max_position_size NUMERIC(18,6) NOT NULL, -- Max % per position
    max_drawdown NUMERIC(18,6) NOT NULL, -- Max drawdown %
    risk_tolerance VARCHAR(20) NOT NULL, -- 'conservative', 'moderate', 'aggressive'
    
    -- Performance Metrics
    total_return NUMERIC(18,6),
    annualized_return NUMERIC(18,6),
    sharpe_ratio NUMERIC(18,6),
    sortino_ratio NUMERIC(18,6),
    max_drawdown_actual NUMERIC(18,6),
    win_rate NUMERIC(18,6),
    profit_factor NUMERIC(18,6),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IX_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IX_portfolios_type ON portfolios(portfolio_type);

-- Portfolio positions
CREATE TABLE positions (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    
    -- Position Details
    quantity NUMERIC(18,6) NOT NULL,
    average_price NUMERIC(18,6) NOT NULL,
    current_price NUMERIC(18,6),
    market_value NUMERIC(18,2),
    unrealized_pnl NUMERIC(18,2),
    unrealized_pnl_percentage NUMERIC(18,6),
    
    -- Position Metadata
    position_type VARCHAR(20) NOT NULL, -- 'long', 'short'
    entry_date TIMESTAMP NOT NULL,
    last_updated TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

CREATE INDEX IX_positions_portfolio_id ON positions(portfolio_id);
CREATE INDEX IX_positions_symbol ON positions(symbol);

-- Trade history
CREATE TABLE trades (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    
    -- Trade Details
    trade_type VARCHAR(10) NOT NULL, -- 'BUY', 'SELL'
    quantity NUMERIC(18,6) NOT NULL,
    price NUMERIC(18,6) NOT NULL,
    total_value NUMERIC(18,2) NOT NULL,
    commission NUMERIC(18,2) DEFAULT 0,
    fees NUMERIC(18,2) DEFAULT 0,
    
    -- Trade Metadata
    trade_date TIMESTAMP NOT NULL,
    signal_id BIGINT, -- Reference to rl_signals
    order_type VARCHAR(20) DEFAULT 'MARKET', -- 'MARKET', 'LIMIT', 'STOP'
    
    -- Performance
    realized_pnl NUMERIC(18,2),
    holding_period_days INT,
    
    -- Trade Context
    trade_reason TEXT, -- Why this trade was made
    market_conditions TEXT, -- Market state at time of trade
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
    FOREIGN KEY (signal_id) REFERENCES rl_signals(id)
);

CREATE INDEX IX_trades_portfolio_id ON trades(portfolio_id);
CREATE INDEX IX_trades_symbol ON trades(symbol);
CREATE INDEX IX_trades_trade_date ON trades(trade_date);

-- =============================================
-- Game and Competition Tables
-- =============================================

-- Game sessions
CREATE TABLE game_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    game_type VARCHAR(20) NOT NULL, -- 'historical', 'tournament', 'vs_ai'
    
    -- Game Settings
    game_name VARCHAR(100) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    initial_capital NUMERIC(18,2) NOT NULL,
    max_positions INT DEFAULT 10,
    
    -- Historical Context
    historical_start_date TIMESTAMP NOT NULL,
    historical_end_date TIMESTAMP NOT NULL,
    market_conditions TEXT, -- Description of historical period
    
    -- Performance
    final_value NUMERIC(18,2),
    total_return NUMERIC(18,6),
    sharpe_ratio NUMERIC(18,6),
    max_drawdown NUMERIC(18,6),
    final_rank INT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'paused'
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IX_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IX_game_sessions_status ON game_sessions(status);
CREATE INDEX IX_game_sessions_final_rank ON game_sessions(final_rank);

-- Leaderboard entries
CREATE TABLE leaderboard_entries (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    game_session_id BIGINT,
    portfolio_id BIGINT,
    
    -- Performance Metrics
    total_return NUMERIC(18,6) NOT NULL,
    sharpe_ratio NUMERIC(18,6) NOT NULL,
    max_drawdown NUMERIC(18,6) NOT NULL,
    win_rate NUMERIC(18,6) NOT NULL,
    profit_factor NUMERIC(18,6) NOT NULL,
    
    -- Ranking
    overall_rank INT,
    category_rank INT, -- Rank within category (e.g., 'stocks', 'crypto')
    tier VARCHAR(20), -- 'bronze', 'silver', 'gold', 'platinum', 'diamond'
    
    -- Metadata
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    asset_class VARCHAR(20), -- 'stocks', 'crypto', 'forex', 'mixed'
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id),
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
);

CREATE INDEX IX_leaderboard_entries_overall_rank ON leaderboard_entries(overall_rank);
CREATE INDEX IX_leaderboard_entries_category_rank ON leaderboard_entries(category_rank);
CREATE INDEX IX_leaderboard_entries_tier ON leaderboard_entries(tier);

-- =============================================
-- Analytics and Reporting Tables
-- =============================================

-- Feature snapshots for ML model training
CREATE TABLE feature_snapshots (
    id BIGSERIAL PRIMARY KEY,
    snapshot_date TIMESTAMP NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    
    -- Market Features
    price_features JSONB, -- OHLCV and derived price features
    technical_features JSONB, -- All technical indicators
    fundamental_features JSONB, -- Fundamental data if available
    sentiment_features JSONB, -- News sentiment features
    
    -- Target Variables
    future_return_1d NUMERIC(18,6),
    future_return_5d NUMERIC(18,6),
    future_return_30d NUMERIC(18,6),
    future_volatility_30d NUMERIC(18,6),
    
    -- Metadata
    feature_count INT,
    data_quality_score NUMERIC(18,6), -- 0.0 to 1.0
    missing_features JSONB, -- List of missing features
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IX_feature_snapshots_date ON feature_snapshots(snapshot_date);
CREATE INDEX IX_feature_snapshots_symbol ON feature_snapshots(symbol);

-- Model performance tracking
CREATE TABLE model_performance (
    id BIGSERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    evaluation_date TIMESTAMP NOT NULL,
    
    -- Performance Metrics
    accuracy NUMERIC(18,6),
    precision_score NUMERIC(18,6),
    recall_score NUMERIC(18,6),
    f1_score NUMERIC(18,6),
    sharpe_ratio NUMERIC(18,6),
    max_drawdown NUMERIC(18,6),
    win_rate NUMERIC(18,6),
    profit_factor NUMERIC(18,6),
    
    -- Training Details
    training_samples INT,
    validation_samples INT,
    training_duration_minutes INT,
    hyperparameters JSONB,
    
    -- Model Metadata
    model_path VARCHAR(500), -- Path to model file
    feature_importance JSONB,
    model_notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IX_model_performance_model_name ON model_performance(model_name);
CREATE INDEX IX_model_performance_evaluation_date ON model_performance(evaluation_date);

-- =============================================
-- Chat and Support Tables
-- =============================================

-- Chat sessions with the AI assistant
CREATE TABLE chat_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    
    -- Session Details
    session_type VARCHAR(20) NOT NULL, -- 'general', 'signal_explanation', 'education'
    context_data JSONB, -- Page context, current signals, etc.
    
    -- Session Metadata
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    message_count INT DEFAULT 0,
    user_satisfaction_score INT, -- 1-5 rating
    
    -- Session Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'ended', 'archived'
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IX_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IX_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX IX_chat_sessions_started_at ON chat_sessions(started_at);

-- Individual chat messages
CREATE TABLE chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    
    -- Message Details
    message_type VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    
    -- AI Response Details
    model_used VARCHAR(50),
    response_time_ms INT,
    tokens_used INT,
    confidence_score NUMERIC(18,6),
    
    -- Context
    context_data JSONB, -- Additional context for the message
    tools_used JSONB, -- Tools/functions called by AI
    
    -- User Feedback
    user_rating INT, -- 1-5 rating
    user_feedback TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IX_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IX_chat_messages_timestamp ON chat_messages(timestamp);

-- =============================================
-- Staging Tables for Data Pipeline
-- =============================================

-- Staging table for processed data (temporary)
CREATE TABLE processed_stage (
    symbol VARCHAR(20) NOT NULL,
    ts_local TIMESTAMP NOT NULL,
    date_utc DATE NOT NULL,
    "open" NUMERIC(18,6),
    "high" NUMERIC(18,6),
    "low" NUMERIC(18,6),
    "close" NUMERIC(18,6),
    volume BIGINT,
    sma_5 NUMERIC(18,6),
    sma_10 NUMERIC(18,6),
    sma_20 NUMERIC(18,6),
    sma_50 NUMERIC(18,6),
    sma_200 NUMERIC(18,6),
    ema_12 NUMERIC(18,6),
    ema_26 NUMERIC(18,6),
    rsi_14 NUMERIC(18,6),
    macd NUMERIC(18,6),
    macd_signal NUMERIC(18,6),
    macd_hist NUMERIC(18,6),
    bb_middle NUMERIC(18,6),
    bb_upper NUMERIC(18,6),
    bb_lower NUMERIC(18,6),
    returns NUMERIC(18,8),
    log_returns NUMERIC(18,8),
    volatility_20 NUMERIC(18,8),
    momentum_20 NUMERIC(18,8),
    volume_sma_20 BIGINT,
    volume_ratio NUMERIC(18,6)
);

-- Final processed prices table (with technical indicators)
CREATE TABLE processed_prices (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    ts_local TIMESTAMP NOT NULL,
    date_utc DATE NOT NULL,
    "open" NUMERIC(18,6),
    "high" NUMERIC(18,6),
    "low" NUMERIC(18,6),
    "close" NUMERIC(18,6),
    volume BIGINT,
    sma_5 NUMERIC(18,6),
    sma_10 NUMERIC(18,6),
    sma_20 NUMERIC(18,6),
    sma_50 NUMERIC(18,6),
    sma_200 NUMERIC(18,6),
    ema_12 NUMERIC(18,6),
    ema_26 NUMERIC(18,6),
    rsi_14 NUMERIC(18,6),
    macd NUMERIC(18,6),
    macd_signal NUMERIC(18,6),
    macd_hist NUMERIC(18,6),
    bb_middle NUMERIC(18,6),
    bb_upper NUMERIC(18,6),
    bb_lower NUMERIC(18,6),
    returns NUMERIC(18,8),
    log_returns NUMERIC(18,8),
    volatility_20 NUMERIC(18,8),
    momentum_20 NUMERIC(18,8),
    volume_sma_20 BIGINT,
    volume_ratio NUMERIC(18,6),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT UQ_processed_prices_symbol_date UNIQUE (symbol, date_utc)
);

CREATE INDEX IX_processed_prices_symbol_date ON processed_prices(symbol, date_utc);
CREATE INDEX IX_processed_prices_date ON processed_prices(date_utc);

-- =============================================
-- Functions (Adapted from Stored Procedures)
-- =============================================

-- Function to calculate portfolio performance
CREATE OR REPLACE FUNCTION CalculatePortfolioPerformance(portfolio_id BIGINT)
RETURNS TABLE (
    TotalReturn NUMERIC,
    SharpeRatio NUMERIC,
    MaxDrawdown NUMERIC,
    WinRate NUMERIC
) AS $$
DECLARE
    total_return_val NUMERIC(18,6);
    sharpe_ratio_val NUMERIC(18,6);
    max_drawdown_val NUMERIC(18,6);
    win_rate_val NUMERIC(18,6);
BEGIN
    -- Calculate total return
    SELECT (current_value - initial_capital) / initial_capital * 100
    INTO total_return_val
    FROM portfolios 
    WHERE id = portfolio_id;
    
    -- Calculate Sharpe ratio (simplified)
    SELECT AVG(returns_1d) / NULLIF(STDDEV(returns_1d), 0) * SQRT(252)
    INTO sharpe_ratio_val
    FROM market_data_ohlcv mdo
    INNER JOIN trades t ON t.symbol = mdo.symbol
    WHERE t.portfolio_id = CalculatePortfolioPerformance.portfolio_id
    AND t.trade_date = mdo.date_time;
    
    -- Calculate max drawdown
    WITH Drawdowns AS (
        SELECT 
            date_time,
            close_price,
            MAX(close_price) OVER (ORDER BY date_time ROWS UNBOUNDED PRECEDING) as peak,
            (close_price - MAX(close_price) OVER (ORDER BY date_time ROWS UNBOUNDED PRECEDING)) / 
            NULLIF(MAX(close_price) OVER (ORDER BY date_time ROWS UNBOUNDED PRECEDING), 0) * 100 as drawdown
        FROM market_data_ohlcv
        WHERE symbol IN (SELECT DISTINCT symbol FROM trades WHERE portfolio_id = CalculatePortfolioPerformance.portfolio_id)
    )
    SELECT MIN(drawdown)
    INTO max_drawdown_val
    FROM Drawdowns;
    
    -- Calculate win rate
    SELECT COUNT(CASE WHEN realized_pnl > 0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)
    INTO win_rate_val
    FROM trades 
    WHERE portfolio_id = CalculatePortfolioPerformance.portfolio_id AND realized_pnl IS NOT NULL;
    
    -- Update portfolio with calculated metrics
    UPDATE portfolios 
    SET 
        total_return = total_return_val,
        sharpe_ratio = sharpe_ratio_val,
        max_drawdown_actual = max_drawdown_val,
        win_rate = win_rate_val,
        updated_at = NOW()
    WHERE id = portfolio_id;
    
    -- Return results
    RETURN QUERY SELECT total_return_val, sharpe_ratio_val, max_drawdown_val, win_rate_val;
END;
$$ LANGUAGE plpgsql;

-- Function to get top performing signals
CREATE OR REPLACE FUNCTION GetTopSignals(asset_class VARCHAR, limit_count INT DEFAULT 3)
RETURNS TABLE (
    id BIGINT,
    symbol VARCHAR,
    signal_type VARCHAR,
    confidence_score NUMERIC,
    entry_price NUMERIC,
    take_profit_1 NUMERIC,
    take_profit_2 NUMERIC,
    take_profit_3 NUMERIC,
    stop_loss NUMERIC,
    risk_reward_ratio NUMERIC,
    expected_return NUMERIC,
    model_reasoning TEXT,
    current_price NUMERIC,
    potential_return_1 NUMERIC,
    potential_return_2 NUMERIC,
    potential_return_3 NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
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
        (s.take_profit_1 - s.entry_price) / NULLIF(s.entry_price, 0) * 100 as potential_return_1,
        (s.take_profit_2 - s.entry_price) / NULLIF(s.entry_price, 0) * 100 as potential_return_2,
        (s.take_profit_3 - s.entry_price) / NULLIF(s.entry_price, 0) * 100 as potential_return_3
    FROM rl_signals s
    INNER JOIN market_data_ohlcv mdo ON s.symbol = mdo.symbol 
        AND mdo.date_time = (SELECT MAX(date_time) FROM market_data_ohlcv WHERE symbol = s.symbol)
    WHERE s.asset_class = GetTopSignals.asset_class
        AND s.date_time >= NOW() - INTERVAL '1 day' -- Signals from last 24 hours
        AND s.confidence_score >= 0.7 -- High confidence signals only
    ORDER BY s.confidence_score DESC, s.expected_return DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

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
    ('AAPL', '2024-01-01 00:00:00', 150.00, 155.00, 149.00, 154.00, 1000000, 154.00, 0.0267),
    ('MSFT', '2024-01-01 00:00:00', 300.00, 305.00, 298.00, 303.00, 800000, 303.00, 0.0100),
    ('GOOGL', '2024-01-01 00:00:00', 120.00, 125.00, 119.00, 124.00, 600000, 124.00, 0.0333);

-- Insert sample technical indicators
INSERT INTO technical_indicators (symbol, date_time, sma_20, ema_20, rsi_14, macd_line, macd_signal, atr_14)
VALUES 
    ('AAPL', '2024-01-01 00:00:00', 152.50, 153.20, 65.5, 1.2, 0.8, 2.5),
    ('MSFT', '2024-01-01 00:00:00', 301.00, 301.80, 58.3, 0.5, 0.3, 3.2),
    ('GOOGL', '2024-01-01 00:00:00', 121.50, 122.10, 72.1, 1.8, 1.2, 2.8);

-- Insert sample RL signals
INSERT INTO rl_signals (symbol, date_time, model_version, signal_type, confidence_score, position_size, entry_price, take_profit_1, stop_loss, risk_reward_ratio, asset_class)
VALUES 
    ('AAPL', '2024-01-01 00:00:00', 'v1.0', 'BUY', 0.85, 0.05, 154.00, 160.00, 150.00, 1.2, 'stocks'),
    ('MSFT', '2024-01-01 00:00:00', 'v1.0', 'HOLD', 0.65, 0.0, 303.00, 310.00, 295.00, 0.8, 'stocks'),
    ('GOOGL', '2024-01-01 00:00:00', 'v1.0', 'BUY', 0.92, 0.08, 124.00, 130.00, 120.00, 1.5, 'stocks');

-- =============================================
-- Stored Procedure Equivalents (PostgreSQL Functions)
-- =============================================

-- Function to create user (replaces sp_CreateUser)
CREATE OR REPLACE FUNCTION sp_CreateUser(
    Email VARCHAR,
    PasswordHash VARCHAR,
    Username VARCHAR,
    FirstName VARCHAR DEFAULT NULL,
    LastName VARCHAR DEFAULT NULL,
    DisplayName VARCHAR DEFAULT NULL
)
RETURNS TABLE (UserID INT) AS $$
DECLARE
    new_user_id INT;
BEGIN
    -- Insert into Users table (assuming Users table exists with ID auto-increment)
    -- Note: This is a simplified version - adjust table/column names to match your schema
    INSERT INTO Users (Email, PasswordHash, Username, FirstName, LastName, CreatedAt)
    VALUES (Email, PasswordHash, Username, FirstName, LastName, NOW())
    RETURNING UserID INTO new_user_id;
    
    -- Create user profile
    INSERT INTO UserProfiles (UserID, DisplayName, Tier, TotalXP, CurrentLevel, TotalCoins, CreatedAt)
    VALUES (new_user_id, COALESCE(DisplayName, Username), 'beginner', 0, 1, 0, NOW());
    
    RETURN QUERY SELECT new_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update user XP (replaces sp_UpdateUserXP)
CREATE OR REPLACE FUNCTION sp_UpdateUserXP(
    UserID INT,
    XPToAdd INT
)
RETURNS TABLE (TotalXP INT, CurrentLevel INT, LevelUp BOOLEAN) AS $$
DECLARE
    current_xp INT;
    current_level INT;
    new_level INT;
    level_up BOOLEAN;
BEGIN
    -- Get current XP and level
    SELECT TotalXP, CurrentLevel INTO current_xp, current_level
    FROM UserProfiles
    WHERE UserID = sp_UpdateUserXP.UserID;
    
    -- Calculate new XP
    current_xp := current_xp + XPToAdd;
    
    -- Calculate new level (assuming 1000 XP per level)
    new_level := FLOOR(current_xp / 1000) + 1;
    level_up := new_level > current_level;
    
    -- Update user profile
    UPDATE UserProfiles
    SET TotalXP = current_xp,
        CurrentLevel = new_level,
        UpdatedAt = NOW()
    WHERE UserID = sp_UpdateUserXP.UserID;
    
    RETURN QUERY SELECT current_xp, new_level, level_up;
END;
$$ LANGUAGE plpgsql;

-- Function to update user coins (replaces sp_UpdateUserCoins)
CREATE OR REPLACE FUNCTION sp_UpdateUserCoins(
    UserID INT,
    CoinsToAdd INT
)
RETURNS TABLE (TotalCoins INT) AS $$
DECLARE
    current_coins INT;
    new_coins INT;
BEGIN
    -- Get current coins
    SELECT COALESCE(TotalCoins, 0) INTO current_coins
    FROM UserProfiles
    WHERE UserID = sp_UpdateUserCoins.UserID;
    
    -- Calculate new coins
    new_coins := current_coins + CoinsToAdd;
    
    -- Update user profile
    UPDATE UserProfiles
    SET TotalCoins = new_coins,
        UpdatedAt = NOW()
    WHERE UserID = sp_UpdateUserCoins.UserID;
    
    RETURN QUERY SELECT new_coins;
END;
$$ LANGUAGE plpgsql;

-- Function to update leaderboard (replaces sp_UpdateLeaderboard)
CREATE OR REPLACE FUNCTION sp_UpdateLeaderboard(
    UserID INT
)
RETURNS VOID AS $$
DECLARE
    user_stats RECORD;
BEGIN
    -- Calculate user stats from portfolios and trades
    SELECT 
        p.user_id,
        COALESCE(SUM(t.realized_pnl), 0) as total_returns,
        COUNT(CASE WHEN t.realized_pnl > 0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as win_rate,
        COUNT(*) as total_trades
    INTO user_stats
    FROM portfolios p
    LEFT JOIN trades t ON t.portfolio_id = p.id
    WHERE p.user_id = sp_UpdateLeaderboard.UserID::VARCHAR
    GROUP BY p.user_id;
    
    -- Insert or update leaderboard entry
    INSERT INTO leaderboard_entries (user_id, total_return, sharpe_ratio, max_drawdown, win_rate, profit_factor, period_start, period_end)
    VALUES (
        sp_UpdateLeaderboard.UserID::VARCHAR,
        COALESCE(user_stats.total_returns, 0),
        0.0, -- Sharpe ratio placeholder
        0.0, -- Max drawdown placeholder
        COALESCE(user_stats.win_rate, 0),
        1.0, -- Profit factor placeholder
        NOW() - INTERVAL '30 days',
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET total_return = EXCLUDED.total_return,
        win_rate = EXCLUDED.win_rate,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to join competition (replaces sp_JoinCompetition)
CREATE OR REPLACE FUNCTION sp_JoinCompetition(
    CompetitionID INT,
    UserID INT
)
RETURNS TABLE (ResultCode INT, Message VARCHAR, CompetitionIDOut INT, MaxParticipants INT, CurrentParticipants INT) AS $$
DECLARE
    comp_record RECORD;
    participant_count INT;
    entry_fee_amount NUMERIC;
    user_coins INT;
    result_code INT;
    result_message VARCHAR;
BEGIN
    -- Get competition details
    SELECT * INTO comp_record
    FROM Competitions c
    WHERE c.CompetitionID = CompetitionID;
    
    -- Check if competition exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT -1, 'Competition not found'::VARCHAR, CompetitionID, 0, 0;
        RETURN;
    END IF;
    
    -- Check if competition is active
    IF comp_record.StartDate > NOW() OR comp_record.EndDate < NOW() THEN
        RETURN QUERY SELECT -1, 'Competition is not active'::VARCHAR, CompetitionID, 0, 0;
        RETURN;
    END IF;
    
    -- Check current participants
    SELECT COUNT(*) INTO participant_count
    FROM CompetitionParticipants cp
    WHERE cp.CompetitionID = CompetitionID;
    
    IF participant_count >= comp_record.MaxParticipants THEN
        RETURN QUERY SELECT -2, 'Competition is full'::VARCHAR, CompetitionID, comp_record.MaxParticipants, participant_count;
        RETURN;
    END IF;
    
    -- Check if user already participating
    IF EXISTS (
        SELECT 1 FROM CompetitionParticipants cp
        WHERE cp.CompetitionID = CompetitionID AND cp.UserID = UserID
    ) THEN
        RETURN QUERY SELECT -3, 'User is already participating'::VARCHAR, CompetitionID, comp_record.MaxParticipants, participant_count;
        RETURN;
    END IF;
    
    -- Check entry fee if required
    IF comp_record.EntryFee > 0 THEN
        SELECT TotalCoins INTO user_coins
        FROM UserProfiles
        WHERE UserID = UserID;
        
        IF user_coins < comp_record.EntryFee THEN
            RETURN QUERY SELECT -4, 'Insufficient coins for entry fee'::VARCHAR, CompetitionID, comp_record.MaxParticipants, participant_count;
            RETURN;
        END IF;
        
        -- Deduct entry fee
        UPDATE UserProfiles
        SET TotalCoins = TotalCoins - comp_record.EntryFee
        WHERE UserID = UserID;
    END IF;
    
    -- Add participant
    INSERT INTO CompetitionParticipants (CompetitionID, UserID, JoinedAt)
    VALUES (CompetitionID, UserID, NOW());
    
    -- Update competition participant count
    UPDATE Competitions c
    SET CurrentParticipants = CurrentParticipants + 1
    WHERE c.CompetitionID = CompetitionID;
    
    RETURN QUERY SELECT 0, 'Successfully joined competition'::VARCHAR, CompetitionID, comp_record.MaxParticipants, participant_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create chat session (replaces sp_GetOrCreateChatSession)
CREATE OR REPLACE FUNCTION sp_GetOrCreateChatSession(
    UserID INT,
    SessionType VARCHAR DEFAULT 'general'
)
RETURNS TABLE (SessionID BIGINT) AS $$
DECLARE
    session_id_val BIGINT;
    session_uuid VARCHAR(100);
BEGIN
    -- Generate session UUID
    session_uuid := 'session_' || UserID || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT;
    
    -- Try to get existing active session
    SELECT id INTO session_id_val
    FROM chat_sessions
    WHERE user_id = sp_GetOrCreateChatSession.UserID::VARCHAR
    AND session_type = SessionType
    AND status = 'active'
    ORDER BY started_at DESC
    LIMIT 1;
    
    -- Create new session if not found
    IF session_id_val IS NULL THEN
        INSERT INTO chat_sessions (user_id, session_id, session_type, started_at, status)
        VALUES (sp_GetOrCreateChatSession.UserID::VARCHAR, session_uuid, SessionType, NOW(), 'active')
        RETURNING id INTO session_id_val;
    END IF;
    
    RETURN QUERY SELECT session_id_val;
END;
$$ LANGUAGE plpgsql;

-- Function to get chat history (replaces sp_GetChatHistory)
CREATE OR REPLACE FUNCTION sp_GetChatHistory(
    UserID INT,
    SessionID BIGINT DEFAULT NULL,
    MessageLimit INT DEFAULT 50
)
RETURNS TABLE (
    MessageID BIGINT,
    SessionIDOut BIGINT,
    MessageType VARCHAR,
    Content TEXT,
    MessageTimestamp TIMESTAMP,
    ModelUsed VARCHAR,
    ResponseTimeMs INT
) AS $$
BEGIN
    IF SessionID IS NULL THEN
        -- Get all messages for user
        RETURN QUERY
        SELECT cm.id, cm.session_id, cm.message_type, cm.content, cm.timestamp, cm.model_used, cm.response_time_ms
        FROM chat_messages cm
        INNER JOIN chat_sessions cs ON cm.session_id = cs.id
        WHERE cs.user_id = UserID::VARCHAR
        ORDER BY cm.timestamp DESC
        LIMIT MessageLimit;
    ELSE
        -- Get messages for specific session
        RETURN QUERY
        SELECT cm.id, cm.session_id, cm.message_type, cm.content, cm.timestamp, cm.model_used, cm.response_time_ms
        FROM chat_messages cm
        INNER JOIN chat_sessions cs ON cm.session_id = cs.id
        WHERE cs.user_id = UserID::VARCHAR
        AND cm.session_id = SessionID
        ORDER BY cm.timestamp DESC
        LIMIT MessageLimit;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to save chat message (replaces sp_SaveChatMessage)
CREATE OR REPLACE FUNCTION sp_SaveChatMessage(
    SessionID BIGINT,
    UserID INT,
    SenderType VARCHAR,
    MessageText TEXT,
    MessageType VARCHAR DEFAULT 'text',
    MessageData JSONB DEFAULT NULL,
    AIModelVersion VARCHAR DEFAULT NULL,
    AIConfidence NUMERIC DEFAULT NULL,
    ResponseTime INT DEFAULT NULL,
    UserIntent VARCHAR DEFAULT NULL
)
RETURNS TABLE (MessageID BIGINT) AS $$
DECLARE
    message_id_val BIGINT;
BEGIN
    INSERT INTO chat_messages (
        session_id, message_type, content, timestamp,
        model_used, confidence_score, response_time_ms, context_data
    )
    VALUES (
        SessionID, MessageType, MessageText, NOW(),
        AIModelVersion, AIConfidence, ResponseTime,
        jsonb_build_object(
            'sender_type', SenderType,
            'user_intent', UserIntent,
            'message_data', COALESCE(MessageData, '{}'::jsonb)
        )
    )
    RETURNING id INTO message_id_val;
    
    -- Update session message count
    UPDATE chat_sessions
    SET message_count = message_count + 1,
        updated_at = NOW()
    WHERE id = SessionID;
    
    RETURN QUERY SELECT message_id_val;
END;
$$ LANGUAGE plpgsql;

-- Function to submit chat feedback (replaces sp_SubmitChatFeedback)
CREATE OR REPLACE FUNCTION sp_SubmitChatFeedback(
    MessageID BIGINT,
    UserID INT,
    FeedbackType VARCHAR,
    Rating INT DEFAULT NULL,
    ThumbsUp BOOLEAN DEFAULT NULL,
    ThumbsDown BOOLEAN DEFAULT NULL,
    FeedbackText TEXT DEFAULT NULL,
    WasHelpful BOOLEAN DEFAULT NULL,
    WasAccurate BOOLEAN DEFAULT NULL,
    WasClear BOOLEAN DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE chat_messages
    SET user_rating = Rating,
        user_feedback = FeedbackText,
        updated_at = NOW()
    WHERE id = MessageID;
    
    -- Update session satisfaction if rating provided
    IF Rating IS NOT NULL THEN
        UPDATE chat_sessions
        SET user_satisfaction_score = Rating,
            updated_at = NOW()
        WHERE id = (SELECT session_id FROM chat_messages WHERE id = MessageID);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update topic progress (replaces sp_UpdateTopicProgress)
CREATE OR REPLACE FUNCTION sp_UpdateTopicProgress(
    UserID INT,
    TopicID INT
)
RETURNS VOID AS $$
DECLARE
    total_lessons INT;
    completed_lessons INT;
    progress_pct NUMERIC;
BEGIN
    -- Get total and completed lesson counts
    SELECT COUNT(*) INTO total_lessons
    FROM LearningLessons
    WHERE TopicID = sp_UpdateTopicProgress.TopicID AND IsActive = 1;
    
    SELECT COUNT(*) INTO completed_lessons
    FROM UserLessonProgress ulp
    INNER JOIN LearningLessons l ON ulp.LessonID = l.LessonID
    WHERE l.TopicID = sp_UpdateTopicProgress.TopicID
    AND ulp.UserID = sp_UpdateTopicProgress.UserID
    AND ulp.IsCompleted = 1;
    
    -- Calculate progress percentage
    progress_pct := CASE WHEN total_lessons > 0 THEN (completed_lessons::NUMERIC / total_lessons::NUMERIC * 100) ELSE 0 END;
    
    -- Update or insert user learning progress
    INSERT INTO UserLearningProgress (UserID, TopicID, CurrentLesson, Progress, IsCompleted, UpdatedAt)
    VALUES (sp_UpdateTopicProgress.UserID, sp_UpdateTopicProgress.TopicID, completed_lessons, progress_pct, (completed_lessons >= total_lessons), NOW())
    ON CONFLICT (UserID, TopicID) DO UPDATE
    SET CurrentLesson = completed_lessons,
        Progress = progress_pct,
        IsCompleted = (completed_lessons >= total_lessons),
        UpdatedAt = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to check topic achievements (replaces sp_CheckTopicAchievements)
CREATE OR REPLACE FUNCTION sp_CheckTopicAchievements(
    UserID INT,
    TopicID INT
)
RETURNS VOID AS $$
BEGIN
    -- Check for topic completion achievements
    -- This is a placeholder - adjust based on your achievements schema
    IF EXISTS (
        SELECT 1 FROM UserLearningProgress
        WHERE UserID = sp_CheckTopicAchievements.UserID
        AND TopicID = sp_CheckTopicAchievements.TopicID
        AND IsCompleted = 1
    ) THEN
        -- Award topic completion achievement if not already awarded
        INSERT INTO UserAchievements (UserID, AchievementID, UnlockedAt)
        SELECT sp_CheckTopicAchievements.UserID, AchievementID, NOW()
        FROM Achievements
        WHERE AchievementType = 'topic_completion'
        AND NOT EXISTS (
            SELECT 1 FROM UserAchievements
            WHERE UserID = sp_CheckTopicAchievements.UserID
            AND AchievementID = Achievements.AchievementID
        )
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'WealthArena PostgreSQL Database Schema created successfully!';
    RAISE NOTICE 'Tables created: market_data_raw, market_data_ohlcv, technical_indicators, rl_signals, news_sentiment, portfolios, positions, trades, game_sessions, leaderboard_entries, feature_snapshots, model_performance, chat_sessions, chat_messages, processed_stage, processed_prices';
    RAISE NOTICE 'Functions created: CalculatePortfolioPerformance, GetTopSignals, sp_CreateUser, sp_UpdateUserXP, sp_UpdateUserCoins, sp_UpdateLeaderboard, sp_JoinCompetition, sp_GetOrCreateChatSession, sp_GetChatHistory, sp_SaveChatMessage, sp_SubmitChatFeedback, sp_UpdateTopicProgress, sp_CheckTopicAchievements';
    RAISE NOTICE 'Sample data inserted for testing';
END $$;

