from __future__ import annotations

import pandas as pd
import pytest

from src.data.processors import BronzeToSilverProcessor, SilverToGoldProcessor


@pytest.fixture()
def bronze_root(tmp_path):
    return tmp_path / "bronze"


@pytest.fixture()
def silver_root(tmp_path):
    return tmp_path / "silver"


@pytest.fixture()
def gold_root(tmp_path):
    return tmp_path / "gold"


def _write_bronze_price(bronze_root, asset_type: str, symbol: str) -> None:
    prices = pd.DataFrame(
        {
            "open": [100, 101, 102, 103, 104],
            "high": [101, 102, 103, 104, 105],
            "low": [99, 100, 101, 102, 103],
            "close": [100.5, 101.5, 102.5, 103.5, 104.5],
            "adj close": [100.4, 101.4, 102.4, 103.4, 104.4],
            "volume": [1_000_000, 1_100_000, 1_050_000, 1_200_000, 1_250_000],
        },
        index=pd.date_range("2024-01-01", periods=5, freq="D"),
    )
    prices.index = prices.index.tz_localize("UTC")
    partition = bronze_root / asset_type / "yfinance" / symbol / "2024" / "01"
    partition.mkdir(parents=True, exist_ok=True)
    prices.iloc[:3].to_parquet(partition / "01.parquet")
    prices.iloc[3:].to_parquet(partition / "04.parquet")


def test_bronze_to_silver_process_stocks(bronze_root, silver_root):
    _write_bronze_price(bronze_root, "stocks", "AAPL")
    processor = BronzeToSilverProcessor(bronze_path=str(bronze_root), silver_path=str(silver_root))
    outputs = processor.process_stocks(["AAPL"])

    assert "AAPL" in outputs
    result = pd.read_parquet(outputs["AAPL"])
    assert "close" in result.columns
    assert len(result) == 5


def test_silver_to_gold_technical_and_macro(silver_root, gold_root):
    # Prepare Silver price data
    prices = pd.DataFrame(
        {
            "open": [100, 101, 102, 103, 104],
            "high": [101, 102, 103, 104, 105],
            "low": [99, 100, 101, 102, 103],
            "close": [100.5, 101.5, 102.5, 103.5, 104.5],
            "volume": [1_000_000, 1_100_000, 1_050_000, 1_200_000, 1_250_000],
        },
        index=pd.date_range("2024-01-01", periods=5, freq="D", tz="UTC"),
    )
    silver_price_dir = silver_root / "stocks"
    silver_price_dir.mkdir(parents=True, exist_ok=True)
    silver_price_path = silver_price_dir / "AAPL.parquet"
    prices.to_parquet(silver_price_path)

    # Prepare Silver macro data
    macro_dir = silver_root / "macro"
    macro_dir.mkdir(parents=True, exist_ok=True)
    macro_series = pd.DataFrame(
        {"value": [100, 101, 102, 103, 104]},
        index=pd.date_range("2023-01-01", periods=5, freq="M", tz="UTC"),
    )
    macro_series.to_parquet(macro_dir / "DGS10.parquet")

    feature_config = {
        "technical_indicators": {
            "price": {
                "sma_windows": [2],
                "ema_windows": [2],
                "momentum_windows": [1],
                "rate_of_change_windows": [1],
                "macd": {"fast": 2, "slow": 3, "signal": 2},
            },
            "volatility": {"atr_windows": [2], "rolling_std_windows": [2]},
            "bands": {"bollinger": {"window": 2, "std_dev": 2}},
        },
        "macro_features": {"transformations": {"yoy_change": True, "mom_change": True, "zscore_windows": [2]}},
    }

    processor = SilverToGoldProcessor(
        silver_path=str(silver_root),
        gold_path=str(gold_root),
        feature_config=feature_config,
    )

    tech_outputs = processor.compute_technical_features("stocks")
    assert "AAPL" in tech_outputs
    tech_df = pd.read_parquet(tech_outputs["AAPL"])
    assert "sma_2" in tech_df.columns
    assert "ema_2" in tech_df.columns
    assert "bollinger_upper" in tech_df.columns

    macro_path = processor.compute_macro_features()
    macro_df = pd.read_parquet(macro_path)
    assert "DGS10_yoy" in macro_df.columns

