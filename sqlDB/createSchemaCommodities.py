#!/usr/bin/env python3
# File: create_schema_commodities.py
from dbConnection import get_conn

DDL = r"""
IF OBJECT_ID('dbo.commodities_processed_prices','U') IS NULL
CREATE TABLE dbo.commodities_processed_prices (
  symbol         VARCHAR(20)       NOT NULL,
  quote_ccy      VARCHAR(10)       NOT NULL,        -- e.g., AUD or USD
  ts_local       DATETIMEOFFSET(0) NOT NULL,        -- Australia/Sydney label
  date_utc       DATE              NOT NULL,        -- UTC date for PK/joins
  [open]         DECIMAL(18,6)     NULL,
  [high]         DECIMAL(18,6)     NULL,
  [low]          DECIMAL(18,6)     NULL,
  [close]        DECIMAL(18,6)     NULL,
  volume         FLOAT             NULL,            -- commodities: keep as float
  sma_5          DECIMAL(18,6)     NULL,
  sma_10         DECIMAL(18,6)     NULL,
  sma_20         DECIMAL(18,6)     NULL,
  sma_50         DECIMAL(18,6)     NULL,
  sma_200        DECIMAL(18,6)     NULL,
  ema_12         DECIMAL(18,6)     NULL,
  ema_26         DECIMAL(18,6)     NULL,
  rsi_14         DECIMAL(18,6)     NULL,
  macd           DECIMAL(18,6)     NULL,
  macd_signal    DECIMAL(18,6)     NULL,
  macd_hist      DECIMAL(18,6)     NULL,
  bb_middle      DECIMAL(18,6)     NULL,
  bb_upper       DECIMAL(18,6)     NULL,
  bb_lower       DECIMAL(18,6)     NULL,
  returns        DECIMAL(18,9)     NULL,
  log_returns    DECIMAL(18,9)     NULL,
  volatility_20  DECIMAL(18,9)     NULL,
  momentum_20    DECIMAL(18,9)     NULL,
  volume_sma_20  DECIMAL(18,6)     NULL,
  volume_ratio   DECIMAL(18,6)     NULL,
  load_ts        DATETIME2(3)      NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_commodities_processed_prices PRIMARY KEY CLUSTERED (symbol, quote_ccy, date_utc)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_comm_processed_date')
  CREATE INDEX IX_comm_processed_date
  ON dbo.commodities_processed_prices(date_utc)
  INCLUDE (symbol, quote_ccy, [close], volume);

IF OBJECT_ID('dbo.commodities_processed_stage','U') IS NULL
CREATE TABLE dbo.commodities_processed_stage (
  symbol         VARCHAR(20)       NOT NULL,
  quote_ccy      VARCHAR(10)       NOT NULL,
  ts_local       DATETIMEOFFSET(0) NOT NULL,
  date_utc       DATE              NOT NULL,
  [open]         DECIMAL(18,6)     NULL,
  [high]         DECIMAL(18,6)     NULL,
  [low]          DECIMAL(18,6)     NULL,
  [close]        DECIMAL(18,6)     NULL,
  volume         FLOAT             NULL,
  sma_5          DECIMAL(18,6)     NULL,
  sma_10         DECIMAL(18,6)     NULL,
  sma_20         DECIMAL(18,6)     NULL,
  sma_50         DECIMAL(18,6)     NULL,
  sma_200        DECIMAL(18,6)     NULL,
  ema_12         DECIMAL(18,6)     NULL,
  ema_26         DECIMAL(18,6)     NULL,
  rsi_14         DECIMAL(18,6)     NULL,
  macd           DECIMAL(18,6)     NULL,
  macd_signal    DECIMAL(18,6)     NULL,
  macd_hist      DECIMAL(18,6)     NULL,
  bb_middle      DECIMAL(18,6)     NULL,
  bb_upper       DECIMAL(18,6)     NULL,
  bb_lower       DECIMAL(18,6)     NULL,
  returns        DECIMAL(18,9)     NULL,
  log_returns    DECIMAL(18,9)     NULL,
  volatility_20  DECIMAL(18,9)     NULL,
  momentum_20    DECIMAL(18,9)     NULL,
  volume_sma_20  DECIMAL(18,6)     NULL,
  volume_ratio   DECIMAL(18,6)     NULL
);
"""

def main():
    cn = get_conn()
    cn.cursor().execute(DDL)
    cn.commit()
    cn.close()
    print("✅ Commodities schema ready")

if __name__ == "__main__":
    main()
