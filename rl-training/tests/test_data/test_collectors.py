from __future__ import annotations

import pandas as pd
import pytest

from src.data import collectors


def test_yahoo_fetch_returns_columns(monkeypatch_yfinance: None) -> None:
    collector = collectors.YahooFinanceCollector()
    payload = collector.collect(symbols=["AAPL"], interval="1d")
    assert set(payload.keys()) == {"AAPL"}
    assert {"open", "high", "low", "close", "volume"}.issubset(payload["AAPL"].columns)


def test_ccxt_rate_limit_respected(monkeypatch: pytest.MonkeyPatch) -> None:
    limiter = collectors.RateLimiter(requests_per_interval=1, interval_seconds=10.0)
    limiter._tokens = 0  # pylint: disable=protected-access

    sleep_calls: list[float] = []
    monkeypatch.setattr(collectors.time, "sleep", lambda seconds: sleep_calls.append(seconds))

    class _StubExchange:
        def fetch_ohlcv(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            _ = (args, kwargs)
            epoch = pd.Timestamp("2024-01-01", tz="UTC")
            return [
                [int(epoch.value / 1e6), 100, 101, 99, 102, 1000],
                [int((epoch + pd.Timedelta(hours=1)).value / 1e6), 102, 103, 101, 104, 1200],
            ]

    collector = collectors.CCXTCollector(rate_limiter=limiter, exchange_factory=lambda _: _StubExchange())
    frame = collector._fetch("binance", "BTC/USDT")  # pylint: disable=protected-access
    assert not frame.empty
    assert sleep_calls and sleep_calls[0] >= 0.05


def test_yahoo_collect_writes_partitioned_files(monkeypatch_yfinance: None, tmp_data_path) -> None:
    collector = collectors.YahooFinanceCollector()
    collector.collect(
        symbols=["AAPL"],
        interval="1h",
        bronze_root=tmp_data_path,
        asset_type="stocks",
    )
    parquet_files = list(tmp_data_path.rglob("*.parquet"))
    assert parquet_files, "Expected at least one Parquet file in the Bronze layer."
