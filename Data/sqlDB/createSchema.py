# create_schema.py
from dbConnection import get_conn

DDL = r"""
IF OBJECT_ID('dbo.processed_prices','U') IS NULL
CREATE TABLE dbo.processed_prices (
  symbol        VARCHAR(20)  NOT NULL,
  [date]        DATE         NOT NULL,
  [open]        DECIMAL(18,6) NULL,
  [high]        DECIMAL(18,6) NULL,
  [low]         DECIMAL(18,6) NULL,
  [close]       DECIMAL(18,6) NULL,
  volume        BIGINT        NULL,
  sma_5         DECIMAL(18,6) NULL,
  sma_10        DECIMAL(18,6) NULL,
  sma_20        DECIMAL(18,6) NULL,
  sma_50        DECIMAL(18,6) NULL,
  sma_200       DECIMAL(18,6) NULL,
  ema_12        DECIMAL(18,6) NULL,
  ema_26        DECIMAL(18,6) NULL,
  macd          DECIMAL(18,6) NULL,
  macd_signal   DECIMAL(18,6) NULL,
  macd_hist     DECIMAL(18,6) NULL,
  bb_middle     DECIMAL(18,6) NULL,
  bb_upper      DECIMAL(18,6) NULL,
  bb_lower      DECIMAL(18,6) NULL,
  returns       DECIMAL(18,6) NULL,
  log_returns   DECIMAL(18,6) NULL,
  volatility_20 DECIMAL(18,6) NULL,
  momentum_20   DECIMAL(18,6) NULL,
  volume_sma_20 DECIMAL(18,6) NULL,
  volume_ratio  DECIMAL(18,6) NULL,
  load_ts       DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_processed_prices PRIMARY KEY CLUSTERED (symbol,[date])
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_processed_date')
CREATE INDEX IX_processed_date ON dbo.processed_prices([date]) INCLUDE(symbol,[close],volume);

IF OBJECT_ID('dbo.processed_stage','U') IS NULL
CREATE TABLE dbo.processed_stage (
  symbol        VARCHAR(20)  NOT NULL,
  [date]        DATE         NOT NULL,
  [open]        DECIMAL(18,6) NULL,
  [high]        DECIMAL(18,6) NULL,
  [low]         DECIMAL(18,6) NULL,
  [close]       DECIMAL(18,6) NULL,
  volume        BIGINT        NULL,
  sma_5         DECIMAL(18,6) NULL,
  sma_10        DECIMAL(18,6) NULL,
  sma_20        DECIMAL(18,6) NULL,
  sma_50        DECIMAL(18,6) NULL,
  sma_200       DECIMAL(18,6) NULL,
  ema_12        DECIMAL(18,6) NULL,
  ema_26        DECIMAL(18,6) NULL,
  macd          DECIMAL(18,6) NULL,
  macd_signal   DECIMAL(18,6) NULL,
  macd_hist     DECIMAL(18,6) NULL,
  bb_middle     DECIMAL(18,6) NULL,
  bb_upper      DECIMAL(18,6) NULL,
  bb_lower      DECIMAL(18,6) NULL,
  returns       DECIMAL(18,6) NULL,
  log_returns   DECIMAL(18,6) NULL,
  volatility_20 DECIMAL(18,6) NULL,
  momentum_20   DECIMAL(18,6) NULL,
  volume_sma_20 DECIMAL(18,6) NULL,
  volume_ratio  DECIMAL(18,6) NULL
);
"""

def main():
    cn = get_conn()
    cn.cursor().execute(DDL)
    cn.commit()
    cn.close()
    print("✅ Schema ready.")

if __name__ == "__main__":
    main()
