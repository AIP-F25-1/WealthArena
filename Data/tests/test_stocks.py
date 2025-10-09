import pandas as pd
import numpy as np
from Data.stocksData.asx_market_data_adls import _classify_from_name, _find_header_index, _parse_asx_csv_bytes, _canonical_company_rows
from Data.sqlDB.processAndStore import compute_features
import io

def make_sample_df():
    # create 30 rows of closing prices increasing
    dates = pd.date_range('2020-01-01', periods=30, freq='D', tz='UTC')
    close = pd.Series(np.linspace(10, 40, 30))
    open_ = close - 0.5
    high = close + 0.5
    low = close - 1.0
    vol = pd.Series(np.random.randint(100, 1000, size=30))
    df = pd.DataFrame({'Open': open_, 'High': high, 'Low': low, 'Close': close, 'Volume': vol, 'Date': dates})
    # processAndStore.read_raw_csv would convert Date -> date (date object); add that here
    df['date'] = df['Date'].dt.date
    return df

def test_compute_features_basic():
    df = make_sample_df()
    out = compute_features(df)
    # basic shape and columns
    assert 'Sma_20' in out.columns
    assert 'Ema_12' in out.columns
    assert 'Macd' in out.columns
    assert out['Returns'].iloc[1] != 0 or out['Returns'].iloc[0] == 0
    # check monotonic dates
    assert out['date'].is_monotonic_increasing

def test_classify_from_name():
    assert _classify_from_name('Vanguard ETF Australia') == 'ETF'
    assert _classify_from_name('Some Trust Name') == 'Trust'
    assert _classify_from_name('') == 'Equity'

def test_find_header_and_parse():
    # create a fake ASX CSV with some leading lines
    text = """
Some banner line
Another line
Company Name,ASX code,GICS Industry Group
Alpha Pty,ALP,Materials
Beta Ltd,BET,Financials
""".encode('utf-8')
    df = _parse_asx_csv_bytes(text)
    assert 'Company Name' in df.columns or 'ASX code' in df.columns
    canon = _canonical_company_rows(df)
    assert '__code__' in canon.columns
