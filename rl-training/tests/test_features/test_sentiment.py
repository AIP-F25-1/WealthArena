from __future__ import annotations

import pandas as pd

from src.features.sentiment import SentimentFeatures


def test_aggregate_aligns_timestamps() -> None:
    timestamps = pd.date_range("2024-01-01 09:00", periods=4, freq="30min", tz="UTC")
    sentiment = pd.DataFrame(
        {
            "timestamp": timestamps,
            "sentiment": [0.1, 0.2, -0.1, 0.05],
        }
    )
    aggregator = SentimentFeatures(aggregation_windows=["1h"])
    result = aggregator.aggregate_sentiment(sentiment)
    columns = ["net_sentiment_1h", "sentiment_sum_1h", "message_count_1h"]
    assert result[columns].isna().sum().sum() == 0

