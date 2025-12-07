"""
Data ingestion and processing layer for the Agentic Multi-Agent RL Trading System.

This package exposes collectors, processors, schemas, and validation utilities
for managing the Bronze → Silver → Gold medallion architecture.
"""

from .collectors import (
    BaseCollector,
    YahooFinanceCollector,
    CCXTCollector,
    AlphaVantageCollector,
    FREDCollector,
    SocialMediaCollector,
)
from .processors import (
    BronzeToSilverProcessor,
    SilverToGoldProcessor,
    DataValidator,
)

__all__ = [
    "BaseCollector",
    "YahooFinanceCollector",
    "CCXTCollector",
    "AlphaVantageCollector",
    "FREDCollector",
    "SocialMediaCollector",
    "BronzeToSilverProcessor",
    "SilverToGoldProcessor",
    "DataValidator",
]
