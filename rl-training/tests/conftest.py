"""Shared pytest fixtures for the Agentic RL Trading System."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from src.data import collectors


@pytest.fixture(scope="session")
def mock_ohlcv_df() -> pd.DataFrame:
    index = pd.date_range("2024-01-01", periods=64, freq="H", tz="UTC")
    return pd.DataFrame(
        {
            "open": pd.Series(range(100, 100 + len(index)), index=index, dtype=float),
            "high": pd.Series(range(101, 101 + len(index)), index=index, dtype=float),
            "low": pd.Series(range(99, 99 + len(index)), index=index, dtype=float),
            "close": pd.Series(range(100, 100 + len(index)), index=index, dtype=float),
            "volume": pd.Series([1_000 + i * 10 for i in range(len(index))], index=index, dtype=float),
        }
    )


@pytest.fixture()
def tmp_data_path(tmp_path: Path) -> Path:
    path = tmp_path / "data"
    path.mkdir()
    return path


@pytest.fixture()
def monkeypatch_yfinance(monkeypatch, mock_ohlcv_df: pd.DataFrame) -> None:
    base = mock_ohlcv_df.copy()
    yahoo_frame = pd.concat(
        {
            "AAPL": pd.DataFrame(
                {
                    "Open": base["open"],
                    "High": base["high"],
                    "Low": base["low"],
                    "Close": base["close"],
                    "Adj Close": base["close"],
                    "Volume": base["volume"].astype(int),
                }
            )
        },
        axis=1,
    )

    class _FakeYFinance:
        @staticmethod
        def download(*args, **kwargs):  # type: ignore[no-untyped-def]
            _ = (args, kwargs)
            return yahoo_frame

    monkeypatch.setattr(collectors, "yf", _FakeYFinance)
