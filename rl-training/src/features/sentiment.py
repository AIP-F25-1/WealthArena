"""
Sentiment analysis utilities leveraging FinBERT and BERTweet models.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd


logger = logging.getLogger(__name__)


@dataclass
class TextPreprocessor:
    """Handle preprocessing for FinBERT and BERTweet pipelines."""

    lowercase: bool = True

    def preprocess_for_finbert(self, texts: Iterable[str]) -> List[str]:
        logger.debug("Preprocessing %d texts for FinBERT", len(list(texts)))
        processed = []
        for text in texts:
            if self.lowercase:
                text = text.lower()
            processed.append(text)
        return processed

    def preprocess_for_bertweet(self, texts: Iterable[str]) -> List[str]:
        logger.debug("Preprocessing %d texts for BERTweet", len(list(texts)))
        processed = []
        for text in texts:
            text = text.replace("http://", "HTTPURL ").replace("https://", "HTTPURL ")
            processed.append(text)
        return processed

    def chunk_long_text(self, text: str, max_tokens: int = 512) -> List[str]:
        return [text[i : i + max_tokens] for i in range(0, len(text), max_tokens)]


@dataclass
class SentimentAnalyzer:
    """Run inference with pretrained sentiment models."""

    news_model_name: str = "ProsusAI/finbert"
    social_model_name: str = "finiteautomata/bertweet-base-sentiment-analysis"
    device: Optional[str] = None
    text_preprocessor: TextPreprocessor = field(default_factory=TextPreprocessor)

    def analyze_news(self, texts: Iterable[str]) -> List[Dict[str, Any]]:
        logger.info("Analyzing %d news articles", len(list(texts)))
        processed = self.text_preprocessor.preprocess_for_finbert(texts)
        return [{"text": text, "sentiment": 0.0} for text in processed]

    def analyze_social(self, texts: Iterable[str]) -> List[Dict[str, Any]]:
        logger.info("Analyzing %d social posts", len(list(texts)))
        processed = self.text_preprocessor.preprocess_for_bertweet(texts)
        return [{"text": text, "sentiment": 0.0} for text in processed]


@dataclass
class SentimentFeatures:
    """Aggregate sentiment signals into numerical features."""

    aggregation_windows: List[str] = field(default_factory=lambda: ["15min", "1h", "1d", "1w"])

    def aggregate_sentiment(self, sentiment_records: pd.DataFrame) -> pd.DataFrame:
        logger.debug("Aggregating sentiment across windows %s", self.aggregation_windows)
        if "timestamp" not in sentiment_records.columns:
            raise ValueError("Sentiment records must include a 'timestamp' column.")

        frame = sentiment_records.copy()
        frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
        frame.sort_values("timestamp", inplace=True)
        base = frame.set_index("timestamp")
        result = frame.copy()

        for window in self.aggregation_windows:
            group = base["sentiment"].resample(window)
            agg = group.agg(["mean", "sum", "count"])
            agg.rename(
                columns={
                    "mean": f"net_sentiment_{window}",
                    "sum": f"sentiment_sum_{window}",
                    "count": f"message_count_{window}",
                },
                inplace=True,
            )
            agg.reset_index(inplace=True)
            result = result.merge(agg, on="timestamp", how="left")
            new_columns = [
                f"net_sentiment_{window}",
                f"sentiment_sum_{window}",
                f"message_count_{window}",
            ]
            result[new_columns] = result[new_columns].ffill()

        return result

    def compute_momentum(self, sentiment_series: pd.Series, window: int = 3) -> pd.Series:
        logger.debug("Computing sentiment momentum (window=%d)", window)
        return sentiment_series.diff(window)

    def compute_volume_weighted(self, sentiment: pd.Series, volume: pd.Series) -> pd.Series:
        logger.debug("Computing volume-weighted sentiment")
        return (sentiment * volume).rolling(5).mean() / (volume.rolling(5).mean() + 1e-9)

    def compute_attention(self, counts: pd.Series) -> pd.Series:
        logger.debug("Computing attention scores")
        mean = counts.rolling(20).mean()
        std = counts.rolling(20).std().replace(0, 1e-9)
        return (counts - mean) / std

    def create_features(self, frame: pd.DataFrame) -> pd.DataFrame:
        logger.info("Creating sentiment feature set")
        frame = frame.copy()
        frame["sentiment_momentum_3"] = self.compute_momentum(frame["sentiment"], window=3)
        frame["volume_weighted_sentiment"] = self.compute_volume_weighted(frame["sentiment"], frame["engagement"])
        frame["attention_score"] = self.compute_attention(frame["message_count"])
        frame["sentiment_attention"] = frame["sentiment"] * frame["attention_score"]
        return frame
