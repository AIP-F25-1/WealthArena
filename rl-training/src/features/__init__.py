"""
Feature engineering package exposing technical, sentiment, macro, and correlation utilities.
"""

from .technical import TechnicalIndicators
from .sentiment import SentimentAnalyzer, SentimentFeatures, TextPreprocessor
from .macro import MacroFeatures, VIXProcessor
from .correlation import CorrelationEstimator, CrossAssetFeatures, CovarianceValidator

__all__ = [
    "TechnicalIndicators",
    "SentimentAnalyzer",
    "SentimentFeatures",
    "TextPreprocessor",
    "MacroFeatures",
    "VIXProcessor",
    "CorrelationEstimator",
    "CrossAssetFeatures",
    "CovarianceValidator",
]
