# create_schema_crypto.py
from dbConnection import get_conn

DDL = r"""
IF OBJECT_ID('dbo.crypto_processed_prices','U') IS NULL
CREATE TABLE dbo.crypto_processed_prices (
  symbol         VARCHAR(32)        NOT NULL,
  ts_local       DATETIMEOFFSET(0)  NOT NULL,   -- Australia/Sydney label (from pipeline)
  date_utc       DATE               NOT NULL,   -- PK/joins
  [open]         DECIMAL(38,10)     NULL,
  [high]         DECIMAL(38,10)     NULL,
  [low]          DECIMAL(38,10)     NULL,
  [close]        DECIMAL(38,10)     NULL,
  volume         DECIMAL(38,10)     NULL,       -- crypto volumes can be fractional
  sma_5          DECIMAL(38,10)     NULL,
  sma_10         DECIMAL(38,10)     NULL,
  sma_20         DECIMAL(38,10)     NULL,
  sma_50         DECIMAL(38,10)     NULL,
  sma_200        DECIMAL(38,10)     NULL,
  ema_12         DECIMAL(38,10)     NULL,
  ema_26         DECIMAL(38,10)     NULL,
  rsi_14         DECIMAL(38,10)     NULL,
  macd           DECIMAL(38,10)     NULL,
  macd_signal    DECIMAL(38,10)     NULL,
  macd_hist      DECIMAL(38,10)     NULL,
  bb_middle      DECIMAL(38,10)     NULL,
  bb_upper       DECIMAL(38,10)     NULL,
  bb_lower       DECIMAL(38,10)     NULL,
  returns        DECIMAL(38,10)     NULL,
  log_returns    DECIMAL(38,10)     NULL,
  volatility_20  DECIMAL(38,10)     NULL,
  momentum_20    DECIMAL(38,10)     NULL,
  volume_sma_20  DECIMAL(38,10)     NULL,
  volume_ratio   DECIMAL(38,10)     NULL,
  load_ts        DATETIME2(3)       NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_crypto_processed_prices PRIMARY KEY CLUSTERED (symbol, date_utc)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_crypto_processed_date')
  CREATE INDEX IX_crypto_processed_date ON dbo.crypto_processed_prices(date_utc) INCLUDE (symbol,[close],volume);

IF OBJECT_ID('dbo.crypto_processed_stage','U') IS NULL
CREATE TABLE dbo.crypto_processed_stage (
  symbol         VARCHAR(32)        NOT NULL,
  ts_local       DATETIMEOFFSET(0)  NOT NULL,
  date_utc       DATE               NOT NULL,
  [open]         DECIMAL(38,10)     NULL,
  [high]         DECIMAL(38,10)     NULL,
  [low]          DECIMAL(38,10)     NULL,
  [close]        DECIMAL(38,10)     NULL,
  volume         DECIMAL(38,10)     NULL,
  sma_5          DECIMAL(38,10)     NULL,
  sma_10         DECIMAL(38,10)     NULL,
  sma_20         DECIMAL(38,10)     NULL,
  sma_50         DECIMAL(38,10)     NULL,
  sma_200        DECIMAL(38,10)     NULL,
  ema_12         DECIMAL(38,10)     NULL,
  ema_26         DECIMAL(38,10)     NULL,
  rsi_14         DECIMAL(38,10)     NULL,
  macd           DECIMAL(38,10)     NULL,
  macd_signal    DECIMAL(38,10)     NULL,
  macd_hist      DECIMAL(38,10)     NULL,
  bb_middle      DECIMAL(38,10)     NULL,
  bb_upper       DECIMAL(38,10)     NULL,
  bb_lower       DECIMAL(38,10)     NULL,
  returns        DECIMAL(38,10)     NULL,
  log_returns    DECIMAL(38,10)     NULL,
  volatility_20  DECIMAL(38,10)     NULL,
  momentum_20    DECIMAL(38,10)     NULL,
  volume_sma_20  DECIMAL(38,10)     NULL,
  volume_ratio   DECIMAL(38,10)     NULL
);
"""

def main():
    cn = get_conn()
    cn.cursor().execute(DDL)
    cn.commit()
    cn.close()
    print("✅ Crypto schema ready")

if __name__ == "__main__":
    main()
