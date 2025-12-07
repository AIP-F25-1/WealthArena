"""Collect financial news articles for sentiment analysis."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import List

import pandas as pd
import yaml

from src.data import AlphaVantageCollector
from src.data.collectors import RateLimiter
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect financial news data.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--provider", type=str, default="alphavantage")
    parser.add_argument("--tickers", type=str, default=None, help="Optional comma-separated ticker overrides")
    parser.add_argument("--start-date", type=str, default=None)
    parser.add_argument("--end-date", type=str, default=None)
    return parser.parse_args()


def _load_tickers_from_catalog(path: Path) -> List[str]:
    frame = pd.read_csv(path)
    column = None
    for candidate in frame.columns:
        if candidate.lower() in {"symbol", "ticker"}:
            column = candidate
            break
    if column is None:
        column = frame.columns[0]
    tickers = frame[column].dropna().astype(str).str.strip().tolist()
    return sorted({ticker for ticker in tickers if ticker})


def _resolve_catalog_path(catalog_base: Path, reference: str) -> Path:
    reference_path = Path(reference)
    if reference_path.is_absolute():
        return reference_path.resolve()
    parts = list(reference_path.parts)
    if parts and parts[0].lower() == "catalog":
        reference_path = Path(*parts[1:]) if len(parts) > 1 else Path()
    return (catalog_base / reference_path).resolve()


def main() -> None:
    args = parse_args()
    try:
        load_environment()
        raw_config = yaml.safe_load(args.config.read_text())
        config = resolve_env_placeholders(raw_config)

        storage_cfg = config.get("storage", {})
        bronze_root = Path(storage_cfg.get("bronze_path", "./data/bronze"))
        catalog_base = Path(storage_cfg.get("catalog_path", "./data/catalog"))

        news_cfg = config.get("assets", {}).get("news", {})
        catalog_reference = news_cfg.get("tickers_reference")
        tickers: List[str]

        if args.tickers:
            tickers = [ticker.strip().upper() for ticker in args.tickers.split(",") if ticker.strip()]
        elif catalog_reference:
            catalog_path = _resolve_catalog_path(catalog_base, catalog_reference)
            if catalog_path.exists():
                try:
                    tickers = _load_tickers_from_catalog(catalog_path)
                except Exception:  # pylint: disable=broad-except
                    logger.exception("Failed to read news tickers from %s", catalog_path)
                    tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
            else:
                logger.warning("News ticker catalog missing at %s; using defaults.", catalog_path)
                tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
        else:
            tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]

        if not tickers:
            logger.error("No news tickers resolved; aborting collection.")
            raise SystemExit(1)

        provider = args.provider.lower()
        if provider != "alphavantage":
            logger.warning("Provider %s not implemented. Available provider: alphavantage.", provider)
            raise SystemExit(1)

        rate_limit_cfg = config.get("rate_limits", {}).get("alphavantage", {})
        rate_limiter = None
        requests_per_minute = rate_limit_cfg.get("requests_per_minute")
        if requests_per_minute:
            rate_limiter = RateLimiter(requests_per_interval=int(requests_per_minute), interval_seconds=60.0)

        key_candidates = [
            "ALPHA_VANTAGE_API_KEY_PRIMARY",
            "ALPHA_VANTAGE_API_KEY",
            "ALPHAVANTAGE_API_KEY",
            "ALPHA_VANTAGE_API_KEY_SECONDARY",
            "ALPHA_VANTAGE_API_KEY_BACKUP",
        ]
        if not any(os.getenv(candidate) for candidate in key_candidates):
            logger.warning(
                "Alpha Vantage API key not configured. Using demo key which provides limited sample data (AAPL only)."
            )
            os.environ.setdefault("ALPHA_VANTAGE_API_KEY", "demo")

        collector = AlphaVantageCollector(rate_limiter=rate_limiter)

        logger.info("Collecting Alpha Vantage news sentiment for %d tickers.", len(tickers))
        success = 0
        total_articles = 0
        failed_tickers = []
        
        for ticker_idx, ticker in enumerate(tickers, 1):
            logger.info("Processing ticker %d/%d: %s", ticker_idx, len(tickers), ticker)
            try:
                result = collector.collect(
                    function="NEWS_SENTIMENT",
                    tickers=ticker,
                    bronze_root=bronze_root,
                    asset_type="news",
                )
                
                # Validate that data was collected
                if result is not None and not result.empty:
                    article_count = len(result)
                    total_articles += article_count
                    logger.info("Collected %d news articles for %s", article_count, ticker)
                    success += 1
                else:
                    logger.warning("No news articles returned for %s (empty result)", ticker)
                    failed_tickers.append(ticker)
                    
            except RuntimeError as exc:
                message = str(exc)
                if "Quota exceeded" in message or "quota" in message.lower():
                    logger.error("Alpha Vantage quota exceeded: %s", message)
                    logger.error("Stopping collection. %d tickers processed, %d remaining.", ticker_idx, len(tickers) - ticker_idx)
                    raise
                logger.exception("Runtime error while collecting news for %s", ticker)
                failed_tickers.append(ticker)
            except ValueError as exc:
                message = str(exc)
                if "API key" in message.lower() or "invalid" in message.lower():
                    logger.error("Alpha Vantage API key issue: %s", message)
                    raise
                logger.exception("Value error while collecting news for %s: %s", ticker, exc)
                failed_tickers.append(ticker)
            except Exception:  # pylint: disable=broad-except
                logger.exception("Failed to collect news for %s", ticker)
                failed_tickers.append(ticker)
        
        # Validate Bronze data was written
        news_bronze_dir = bronze_root / "news"
        bronze_files = []
        if news_bronze_dir.exists():
            bronze_files = list(news_bronze_dir.rglob("*.parquet"))
        
        if success:
            logger.info("Successfully collected news sentiment for %d tickers (%d total articles).", success, total_articles)
            logger.info("Bronze files created: %d", len(bronze_files))
        else:
            logger.warning("No news sentiment data collected for any ticker.")
        
        if failed_tickers:
            logger.warning("Failed to collect news for %d tickers: %s", len(failed_tickers), failed_tickers[:10])
        
        # Verify Bronze directory structure
        if bronze_files:
            logger.info("Bronze news data structure verified. Files found in: %s", news_bronze_dir)
        else:
            logger.warning("No Bronze files detected for news asset type. Collection may have failed.")
    except Exception:
        logger.exception("Failed to collect news data.")
        raise


if __name__ == "__main__":
    main()
