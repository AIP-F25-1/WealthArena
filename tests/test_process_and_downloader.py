import pandas as pd
from datetime import date
import tempfile
from Data.sqlDB.processAndStore import load_stage, merge_stage
from Data.stocksData.asx_market_data_adls import RawDownloader


class DummyCursor:
    def __init__(self):
        self.executed = []
        self.fast_executemany = False
    def execute(self, sql, *a, **k):
        self.executed.append(sql)
    def executemany(self, sql, rows):
        # record rows for assertion
        self.executed.append(('executemany', len(rows)))
    def fetchone(self):
        return None


class DummyConn:
    def __init__(self):
        self.cur = DummyCursor()
        self._committed = False
    def cursor(self):
        return self.cur
    def commit(self):
        self._committed = True
    def close(self):
        return None


def make_proc_df():
    # create a processed-like DataFrame with required columns and one row
    cols = ["Open","High","Low","Close","Volume","date",
            "Sma_5","Sma_10","Sma_20","Sma_50","Sma_200",
            "Ema_12","Ema_26","Macd","Macd_Signal","Macd_Hist",
            "Bb_Middle","Bb_Upper","Bb_Lower",
            "Returns","Log_Returns","Volatility_20","Momentum_20",
            "Volume_Sma_20","Volume_Ratio"]
    row = [1.0,1.1,0.9,1.05,100, date(2020,1,1)] + [0.0]* (len(cols)-6)
    df = pd.DataFrame([row], columns=cols)
    return df


def test_load_stage_and_merge_stage():
    cn = DummyConn()
    dfp = make_proc_df()
    load_stage(cn, 'TEST.AX', dfp)
    # ensure executemany was called
    assert any(x[0] == 'executemany' for x in cn.cur.executed if isinstance(x, tuple))

    # test merge_stage - should call cursor().execute and commit
    cn2 = DummyConn()
    merge_stage(cn2)
    assert cn2._committed is True


def test_rawdownloader_normalize_and_save(tmp_path):
    # create a sample df with datetime index and lowercase columns to emulate yfinance
    import pandas as pd
    import numpy as np
    idx = pd.date_range('2020-01-01', periods=3, tz='UTC')
    df = pd.DataFrame({'open':[1,2,3],'high':[1,2,3],'low':[1,2,3],'close':[1,2,3],'volume':[10,20,30]}, index=idx)

    dl = RawDownloader(symbols=['AAA.AX'], start_date='2020-01-01', end_date='2020-01-03', batch_size=1, sleep_between=0.0)
    # override raw_dir to tmp path
    dl.raw_dir = tmp_path
    norm = dl._normalize_df(df)
    assert norm is not None
    # ensure Date column was added
    assert 'Date' in norm.columns

    # test save_raw writes file
    dl.save_raw(norm, 'AAA.AX')
    out = tmp_path.glob('AAA.AX_raw.csv')
    files = list(out)
    assert len(files) == 1
