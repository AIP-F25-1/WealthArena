/**
 * Portfolio and Signals Database Views
 * Phase 9: Game, Leaderboard, Signals & Portfolio Pages Integration
 * 
 * Creates views for portfolio performance, top trading signals, and historical signals tracking
 */

-- View: vw_PortfolioPerformance
-- Comprehensive portfolio performance metrics
CREATE VIEW vw_PortfolioPerformance AS
SELECT 
  p.id as PortfolioID,
  p.user_id as UserID,
  p.portfolio_name as PortfolioName,
  p.current_value as TotalValue,
  p.cash_balance as CashBalance,
  p.total_invested as TotalInvested,
  p.total_return as TotalReturn,
  p.sharpe_ratio as SharpeRatio,
  p.max_drawdown_actual as MaxDrawdown,
  p.win_rate as WinRate,
  p.profit_factor as ProfitFactor,
  COUNT(DISTINCT pos.id) as TotalPositions,
  COUNT(DISTINCT t.id) as TotalTrades,
  COALESCE(SUM(pos.unrealized_pnl), 0) as UnrealizedPnL,
  COALESCE(SUM(t.realized_pnl), 0) as RealizedPnL,
  p.updated_at as LastUpdated
FROM portfolios p
LEFT JOIN positions pos ON p.id = pos.portfolio_id
LEFT JOIN trades t ON p.id = t.portfolio_id
GROUP BY p.id, p.user_id, p.portfolio_name, p.current_value, p.cash_balance, p.total_invested, 
         p.total_return, p.sharpe_ratio, p.max_drawdown_actual, p.win_rate, p.profit_factor, p.updated_at;

-- View: vw_TopTradingSignals
-- Top trading signals filtered by confidence and recency
CREATE VIEW vw_TopTradingSignals AS
SELECT 
  id as SignalID,
  symbol as Symbol,
  asset_type as AssetType,
  signal_type as Signal,
  confidence_score as Confidence,
  date_time as PredictionDate,
  entry_price as EntryPrice,
  take_profit_1 as TakeProfit1,
  take_profit_2 as TakeProfit2,
  take_profit_3 as TakeProfit3,
  stop_loss_price as StopLoss,
  CASE 
    WHEN stop_loss_price > 0 AND entry_price > 0 THEN 
      (take_profit_1 - entry_price) / (entry_price - stop_loss_price) 
    ELSE 0 
  END as RiskRewardRatio,
  CASE 
    WHEN entry_price > 0 THEN 
      ((take_profit_1 - entry_price) / entry_price) * 100 
    ELSE 0 
  END as ExpectedReturn,
  model_version as ModelVersion,
  reasoning as Reasoning,
  1 as IsActive,
  CASE WHEN confidence_score >= 0.8 THEN 1 ELSE 0 END as IsTopPick
FROM rl_signals
WHERE confidence_score >= 0.6
  AND date_time >= DATEADD(day, -7, GETUTCDATE());

-- View: vw_HistoricalSignals
-- Historical signals with actual trade outcomes
CREATE VIEW vw_HistoricalSignals AS
SELECT 
  s.id as SignalID,
  s.symbol as Symbol,
  s.asset_type as AssetType,
  s.signal_type as Signal,
  s.confidence_score as Confidence,
  s.date_time as PredictionDate,
  s.entry_price as EntryPrice,
  s.take_profit_1 as TakeProfit1,
  s.take_profit_2 as TakeProfit2,
  s.take_profit_3 as TakeProfit3,
  s.stop_loss_price as StopLoss,
  CASE 
    WHEN s.stop_loss_price > 0 AND s.entry_price > 0 THEN 
      (s.take_profit_1 - s.entry_price) / (s.entry_price - s.stop_loss_price) 
    ELSE 0 
  END as RiskRewardRatio,
  CASE 
    WHEN s.entry_price > 0 THEN 
      ((s.take_profit_1 - s.entry_price) / s.entry_price) * 100 
    ELSE 0 
  END as ExpectedReturn,
  s.model_version as ModelVersion,
  s.reasoning as Reasoning,
  t.entry_price as ActualEntryPrice,
  t.exit_price as ActualExitPrice,
  t.realized_pnl as ActualPnL,
  CASE 
    WHEN t.entry_price > 0 THEN 
      ((t.exit_price - t.entry_price) / t.entry_price) * 100 
    ELSE NULL 
  END as ActualReturn,
  CASE 
    WHEN t.exit_date IS NOT NULL AND t.entry_date IS NOT NULL THEN 
      DATEDIFF(day, t.entry_date, t.exit_date) 
    ELSE NULL 
  END as DaysHeld,
  CASE 
    WHEN t.realized_pnl IS NULL THEN 'pending'
    WHEN t.realized_pnl > 0 THEN 'win'
    WHEN t.realized_pnl < 0 THEN 'loss'
    ELSE 'breakeven'
  END as Outcome,
  t.id as TradeID
FROM rl_signals s
LEFT JOIN trades t ON s.id = t.signal_id
WHERE s.date_time >= DATEADD(day, -90, GETUTCDATE());

