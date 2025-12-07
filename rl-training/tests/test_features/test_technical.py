"""Validate technical indicator computations."""

import pytest

from src.features import TechnicalIndicators


def test_compute_sma_matches_expected(mock_ohlcv_df):
    indicators = TechnicalIndicators()
    window = 20
    expected = mock_ohlcv_df["close"].rolling(window).mean()
    result = indicators.compute_sma(mock_ohlcv_df["close"], window)
    assert pytest.approx(expected.iloc[-1], rel=1e-9) == result.iloc[-1]


def test_compute_ema_matches_expected(mock_ohlcv_df):
    indicators = TechnicalIndicators()
    window = 20
    expected = mock_ohlcv_df["close"].astype(float).ewm(span=window, adjust=False).mean()
    result = indicators.compute_ema(mock_ohlcv_df["close"], window)
    assert pytest.approx(expected.iloc[-1], rel=1e-9) == result.iloc[-1]


def test_compute_macd_matches_pandas_definition(mock_ohlcv_df):
    indicators = TechnicalIndicators()
    series = mock_ohlcv_df["close"].astype(float)
    macd = indicators.compute_macd(series)

    ema_fast = series.ewm(span=12, adjust=False).mean()
    ema_slow = series.ewm(span=26, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    hist_line = macd_line - signal_line

    assert pytest.approx(macd_line.iloc[-1], rel=1e-9) == macd["macd_line"].iloc[-1]
    assert pytest.approx(signal_line.iloc[-1], rel=1e-9) == macd["macd_signal"].iloc[-1]
    assert pytest.approx(hist_line.iloc[-1], rel=1e-9) == macd["macd_hist"].iloc[-1]