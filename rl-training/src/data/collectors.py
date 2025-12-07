"""
Data collectors for the Bronze layer.

Implements extensible collectors for Yahoo Finance, CCXT exchanges, Alpha Vantage,
FRED macro data, and social media sources (Reddit, Twitter).
"""

from __future__ import annotations

import abc
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence

import io
import os
import pandas as pd
import requests

from src.utils.api_keys import ApiKeyManager, DailyQuota

logger = logging.getLogger(__name__)

try:
    import yfinance as yf
except ImportError:  # pragma: no cover - dependency resolution varies in CI
    yf = None

try:
    import ccxt  # type: ignore
except ImportError:  # pragma: no cover
    ccxt = None

try:
    from fredapi import Fred  # type: ignore
except ImportError:  # pragma: no cover
    Fred = None

try:
    import praw  # type: ignore
except ImportError:  # pragma: no cover
    praw = None


def _ensure_list(values: Iterable[str]) -> List[str]:
    sequence = list(values)
    if not sequence:
        raise ValueError("At least one symbol must be provided.")
    return sequence


def _write_partitioned_frame(
    frame: pd.DataFrame,
    bronze_root: Path,
    asset_type: str,
    source_name: str,
    identifier: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    metadata = metadata or {}
    if frame.empty:
        return
    frame = frame.copy()
    if not isinstance(frame.index, pd.DatetimeIndex):
        frame.index = pd.to_datetime(frame.index, utc=True, errors="coerce")
    frame = frame.dropna(how="all")
    frame.sort_index(inplace=True)
    for day, day_frame in frame.groupby(frame.index.date):
        day_frame = day_frame.copy()
        partition_dir = bronze_root / asset_type / source_name / identifier / f"{day:%Y}" / f"{day:%m}"
        partition_dir.mkdir(parents=True, exist_ok=True)
        file_path = partition_dir / f"{day:%d}.parquet"
        day_frame.to_parquet(file_path)
        meta = {
            "source": source_name,
            "identifier": identifier,
            "asset_type": asset_type,
            "start": day_frame.index.min().isoformat(),
            "end": day_frame.index.max().isoformat(),
            "rows": int(day_frame.shape[0]),
        }
        meta.update(metadata)
        (partition_dir / f"{day:%d}.json").write_text(json.dumps(meta, indent=2))


@dataclass
class RateLimiter:
    """Simple token bucket rate limiter."""

    requests_per_interval: int
    interval_seconds: float
    _tokens: int = field(init=False)
    _last_refill: float = field(init=False, default_factory=time.monotonic)

    def __post_init__(self) -> None:
        self._tokens = self.requests_per_interval

    def acquire(self) -> None:
        """Block until a token is available."""
        while True:
            self._refill()
            if self._tokens > 0:
                self._tokens -= 1
                return
            time.sleep(0.05)

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        if elapsed >= self.interval_seconds:
            refill_tokens = int(elapsed / self.interval_seconds) * self.requests_per_interval
            self._tokens = min(self.requests_per_interval, self._tokens + refill_tokens)
            self._last_refill = now


class BaseCollector(abc.ABC):
    """Abstract base class for Bronze layer collectors."""

    source_name: str

    def __init__(self, rate_limiter: Optional[RateLimiter] = None) -> None:
        self.rate_limiter = rate_limiter
        self.logger = logger.getChild(self.__class__.__name__)

    def collect(self, *args: Any, **kwargs: Any) -> Any:
        """Public entry point that wraps fetch/validate/save pipeline."""
        self.logger.debug("Starting collection with args=%s kwargs=%s", args, kwargs)
        bronze_root = kwargs.pop("bronze_root", None)
        asset_type = kwargs.pop("asset_type", None)
        metadata = kwargs.pop("metadata", {})

        fetch_kwargs = dict(kwargs)
        raw = self._fetch(*args, **fetch_kwargs)
        validated = self.validate(raw)

        if bronze_root and asset_type:
            self.save_to_bronze(
                validated,
                bronze_root=Path(bronze_root),
                asset_type=asset_type,
                metadata=metadata,
                **fetch_kwargs,
            )
        else:
            self.logger.debug("Skipping Bronze persistence (asset_type=%s, bronze_root=%s)", asset_type, bronze_root)
        return validated

    @abc.abstractmethod
    def _fetch(self, *args: Any, **kwargs: Any) -> Any:
        """Fetch raw payload from the upstream data source."""

    @abc.abstractmethod
    def save_to_bronze(
        self,
        payload: Any,
        *,
        bronze_root: Path,
        asset_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Persist raw payload into the Bronze layer with metadata."""

    def validate(self, payload: Any) -> Any:
        """Optional payload validation hook."""
        self.logger.debug("Validating payload")
        return payload

    def handle_rate_limits(self) -> None:
        """Enforce configured rate limits before performing an API call."""
        if self.rate_limiter:
            self.rate_limiter.acquire()

    def retry_with_backoff(
        self,
        func: Callable[..., Any],
        *args: Any,
        retries: int = 3,
        backoff_seconds: float = 1.0,
        **kwargs: Any,
    ) -> Any:
        """Execute ``func`` with exponential backoff on transient errors."""
        attempt = 0
        while True:
            try:
                return func(*args, **kwargs)
            except Exception as exc:  # pylint: disable=broad-except
                attempt += 1
                if attempt > retries:
                    self.logger.exception("Exhausted retries for %s", func)
                    raise
                sleep_for = backoff_seconds * (2 ** (attempt - 1))
                self.logger.warning("Retrying after error %s (sleep %.2fs)", exc, sleep_for)
                time.sleep(sleep_for)


class YahooFinanceCollector(BaseCollector):
    """Collector for equities, ETFs, forex, and crypto via yfinance.
    
    Note: Modern yfinance (>=0.2.58) uses curl_cffi internally for browser impersonation
    to bypass Yahoo's stricter authentication requirements. Custom sessions should not
    be passed as they interfere with yfinance's internal authentication flow.
    """

    source_name = "yfinance"

    def __init__(self, rate_limiter: Optional[RateLimiter] = None, session: Optional[requests.Session] = None) -> None:
        super().__init__(rate_limiter=rate_limiter)
        if session is not None:
            import warnings
            warnings.warn(
                "Passing custom session to YahooFinanceCollector is deprecated. "
                "Modern yfinance (>=0.2.58) manages its own curl_cffi session internally. "
                "Custom sessions may break authentication. The session parameter will be ignored.",
                DeprecationWarning,
                stacklevel=2
            )
        # Modern yfinance manages its own session internally - don't store custom session
        self._session = None

    def _fetch(
        self,
        symbols: Iterable[str],
        interval: str = "1d",
        start: Optional[str] = None,
        end: Optional[str] = None,
        auto_adjust: bool = False,
    ) -> Dict[str, pd.DataFrame]:
        symbol_list = _ensure_list(symbols)
        if yf is None:  # pragma: no cover - executed only when dependency missing
            raise ImportError("yfinance is required to collect market data. Install via `pip install yfinance`.")  # noqa: EM101

        self.logger.info("Fetching %d symbols from Yahoo Finance", len(symbol_list))
        self.handle_rate_limits()
        try:
            # Modern yfinance manages its own curl_cffi session - don't pass custom session
            data = self.retry_with_backoff(
                yf.download,  # type: ignore[operator]
                tickers=" ".join(symbol_list),
                interval=interval,
                start=start,
                end=end,
                auto_adjust=auto_adjust,
                group_by="ticker",
                threads=False,
                progress=False,
            )
        except Exception as exc:  # pylint: disable=broad-except
            self.logger.warning("Batch download failed (%s). Falling back to per-symbol retrieval.", exc)
            return self._fetch_per_symbol(symbol_list, interval, start, end, auto_adjust)

        payload = self._extract_payload(data, symbol_list)
        if payload:
            return payload

        self.logger.warning(
            "Batch download returned no usable data for %d symbols. Retrying per symbol.", len(symbol_list)
        )
        payload = self._fetch_per_symbol(symbol_list, interval, start, end, auto_adjust)
        if payload:
            return payload

        self.logger.warning("Per-symbol yfinance retrieval failed; attempting direct chart API fallback.")
        payload = self._fetch_via_chart_api(symbol_list, interval, start, end, auto_adjust)
        if payload:
            return payload

        self.logger.error("Yahoo Finance returned no data for symbols %s after all fallbacks.", symbol_list)
        return {}

    def _extract_payload(self, data: pd.DataFrame, symbols: Sequence[str]) -> Dict[str, pd.DataFrame]:
        payload: Dict[str, pd.DataFrame] = {}
        if data.empty:
            return payload

        if isinstance(data.columns, pd.MultiIndex):
            available = set(data.columns.levels[0])
            for symbol in symbols:
                if symbol not in available:
                    self.logger.warning("Symbol %s not returned by Yahoo Finance.", symbol)
                    continue
                frame = data[symbol].rename(columns=str.lower).dropna(how="all")
                if frame.empty:
                    self.logger.warning("Symbol %s returned empty frame.", symbol)
                    continue
                frame.index = pd.to_datetime(frame.index, utc=True, errors="coerce")
                payload[symbol] = frame
        else:
            frame = data.rename(columns=str.lower).dropna(how="all")
            if not frame.empty:
                frame.index = pd.to_datetime(frame.index, utc=True, errors="coerce")
                payload[symbols[0]] = frame
        return payload

    def _fetch_per_symbol(
        self,
        symbols: Sequence[str],
        interval: str,
        start: Optional[str],
        end: Optional[str],
        auto_adjust: bool,
    ) -> Dict[str, pd.DataFrame]:
        payload: Dict[str, pd.DataFrame] = {}
        for symbol in symbols:
            if self.rate_limiter:
                self.rate_limiter.acquire()
            try:
                # Modern yfinance manages its own curl_cffi session - don't pass custom session
                ticker = yf.Ticker(symbol)  # type: ignore[operator]
                # Add retry logic for 401/429 errors
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        frame = ticker.history(
                            interval=interval,
                            start=start,
                            end=end,
                            auto_adjust=auto_adjust,
                        )
                        break
                    except Exception as exc:
                        if attempt < max_retries - 1 and ("401" in str(exc) or "429" in str(exc) or "Unauthorized" in str(exc)):
                            wait_time = 2.0 * (2 ** attempt)
                            self.logger.warning(
                                "Yahoo Finance returned %s for %s (attempt %d/%d). Retrying after %.1fs...",
                                exc, symbol, attempt + 1, max_retries, wait_time
                            )
                            time.sleep(wait_time)
                            continue
                        raise
            except Exception as exc:  # pylint: disable=broad-except
                self.logger.warning("Failed to fetch %s individually: %s", symbol, exc)
                continue

            frame = frame.rename(columns=str.lower).dropna(how="all")
            if frame.empty:
                self.logger.warning("Symbol %s returned empty frame via individual fetch.", symbol)
                continue
            frame.index = pd.to_datetime(frame.index, utc=True, errors="coerce")
            payload[symbol] = frame
        return payload

    def _fetch_via_chart_api(
        self,
        symbols: Sequence[str],
        interval: str,
        start: Optional[str],
        end: Optional[str],
        auto_adjust: bool,
    ) -> Dict[str, pd.DataFrame]:
        # Deprecated: Direct chart API calls are no longer reliable with Yahoo's 2025 auth changes.
        # Modern yfinance handles authentication internally. This fallback is kept for compatibility
        # but may fail due to authentication requirements.
        self.logger.warning(
            "Using deprecated chart API fallback. This may fail due to Yahoo Finance authentication changes. "
            "Consider updating yfinance to >=0.2.58 with curl-cffi support."
        )
        payload: Dict[str, pd.DataFrame] = {}
        for symbol in symbols:
            if self.rate_limiter:
                self.rate_limiter.acquire()
            try:
                # Try to use yfinance Ticker as fallback instead of direct API
                ticker = yf.Ticker(symbol)  # type: ignore[operator]
                frame = ticker.history(interval=interval, start=start, end=end, auto_adjust=auto_adjust)
                frame = frame.rename(columns=str.lower).dropna(how="all")
                if frame.empty:
                    self.logger.warning("Chart API fallback returned empty frame for %s.", symbol)
                    continue
                frame.index = pd.to_datetime(frame.index, utc=True, errors="coerce")
                payload[symbol] = frame
            except Exception as exc:  # pylint: disable=broad-except
                self.logger.warning("Chart API fallback failed for %s: %s", symbol, exc)
                continue
        return payload

    def save_to_bronze(
        self,
        payload: Dict[str, pd.DataFrame],
        *,
        bronze_root: Path,
        asset_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        for symbol, frame in payload.items():
            _write_partitioned_frame(frame, bronze_root, asset_type, self.source_name, symbol, metadata)


class CCXTCollector(BaseCollector):
    """Collector for cryptocurrency exchanges via CCXT."""

    source_name = "ccxt"

    def __init__(
        self,
        rate_limiter: Optional[RateLimiter] = None,
        exchange_factory: Optional[Callable[[str], Any]] = None,
    ) -> None:
        super().__init__(rate_limiter=rate_limiter)
        self._exchange_factory = exchange_factory or self._default_exchange_factory

    @staticmethod
    def _default_exchange_factory(exchange_id: str) -> Any:
        if ccxt is None:  # pragma: no cover - dependency guard
            raise ImportError("ccxt is required for crypto collection. Install via `pip install ccxt`.")  # noqa: EM101
        exchange_class = getattr(ccxt, exchange_id)
        return exchange_class()

    def _fetch(
        self,
        exchange_id: str,
        symbol: str,
        timeframe: str = "1d",
        limit: int = 1000,
        since: Optional[int] = None,
    ) -> pd.DataFrame:
        self.handle_rate_limits()
        self.logger.info("Fetching %s %s from CCXT exchange %s", symbol, timeframe, exchange_id)
        exchange = self._exchange_factory(exchange_id)
        ohlcv = self.retry_with_backoff(exchange.fetch_ohlcv, symbol, timeframe=timeframe, limit=limit, since=since)
        columns = ["timestamp", "open", "high", "low", "close", "volume"]
        frame = pd.DataFrame(ohlcv, columns=columns)
        frame["timestamp"] = pd.to_datetime(frame["timestamp"], unit="ms", utc=True)
        frame.set_index("timestamp", inplace=True)
        return frame

    def save_to_bronze(
        self,
        payload: pd.DataFrame,
        *,
        bronze_root: Path,
        asset_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        symbol: str,
        exchange_id: str,
        **_: Any,
    ) -> None:
        meta = {"exchange_id": exchange_id}
        if metadata:
            meta.update(metadata)
        _write_partitioned_frame(payload, bronze_root, asset_type, self.source_name, symbol.replace("/", "-"), meta)


class AlphaVantageCollector(BaseCollector):
    """Collector for Alpha Vantage endpoints (intraday, daily, fundamentals)."""

    source_name = "alpha_vantage"

    def __init__(
        self,
        api_key: Optional[str] = None,
        rate_limiter: Optional[RateLimiter] = None,
        key_manager: Optional[ApiKeyManager] = None,
        quota_manager: Optional[DailyQuota] = None,
        daily_limit: Optional[int] = None,
    ) -> None:
        super().__init__(rate_limiter=rate_limiter)
        self._explicit_api_key = api_key
        self.key_manager = key_manager or ApiKeyManager(
            "alpha_vantage",
            env_candidates=[
                "ALPHA_VANTAGE_API_KEY_PRIMARY",
                "ALPHA_VANTAGE_API_KEY",
                "ALPHAVANTAGE_API_KEY",
                "ALPHA_VANTAGE_API_KEY_SECONDARY",
                "ALPHA_VANTAGE_API_KEY_BACKUP",
            ],
        )
        logs_dir = Path(os.getenv("AUTOMATION_LOGS_DIR", "automation/logs"))
        limit = daily_limit or int(os.getenv("ALPHA_VANTAGE_DAILY_LIMIT", "25"))
        self.quota_manager = quota_manager or DailyQuota(logs_dir / "alpha_vantage_usage.json", daily_limit=limit)

    def _fetch(
        self,
        function: str,
        symbol: Optional[str] = None,
        tickers: Optional[str] = None,
        interval: str = "1min",
        outputsize: str = "full",
        time_from: Optional[str] = None,
        time_to: Optional[str] = None,
        topics: Optional[str] = None,
    ) -> pd.DataFrame:
        import requests  # local import to avoid hard dependency during tests

        self.handle_rate_limits()
        if self.quota_manager:
            self.quota_manager.consume()

        api_key = self._explicit_api_key or self.key_manager.get_key()
        if not api_key:
            raise ValueError("Alpha Vantage API key is not configured.")

        # NEWS_SENTIMENT returns JSON, time series functions return CSV
        is_news_function = function.upper() == "NEWS_SENTIMENT"
        datatype = "json" if is_news_function else "csv"

        params = {
            "function": function,
            "apikey": api_key,
        }
        
        if is_news_function:
            # NEWS_SENTIMENT uses 'tickers' parameter, not 'symbol'
            if tickers:
                params["tickers"] = tickers
            elif symbol:
                # Fallback: use symbol as tickers for backward compatibility
                params["tickers"] = symbol
            else:
                raise ValueError("NEWS_SENTIMENT requires either 'tickers' or 'symbol' parameter.")
            # Optional parameters for NEWS_SENTIMENT
            if time_from:
                params["time_from"] = time_from
            if time_to:
                params["time_to"] = time_to
            if topics:
                params["topics"] = topics
        else:
            # Time series functions use 'symbol'
            if not symbol:
                raise ValueError(f"{function} requires 'symbol' parameter.")
            params["symbol"] = symbol
            params["interval"] = interval
            params["outputsize"] = outputsize
        
        params["datatype"] = datatype
        response = self.retry_with_backoff(requests.get, "https://www.alphavantage.co/query", params=params, timeout=30)
        response.raise_for_status()
        
        if is_news_function:
            # Parse JSON response for news data
            data = response.json()
            
            # Check for API errors in response
            if "Error Message" in data:
                error_msg = data["Error Message"]
                self.logger.error("Alpha Vantage API error: %s", error_msg)
                if "Invalid API key" in error_msg:
                    raise ValueError("Alpha Vantage API key is invalid. Please check your API key configuration.")
                elif "Thank you for using Alpha Vantage" in error_msg or "API call frequency" in error_msg:
                    raise RuntimeError(f"Alpha Vantage quota exceeded: {error_msg}")
                raise ValueError(f"Alpha Vantage API error: {error_msg}")
            
            if "Note" in data:
                self.logger.warning("Alpha Vantage API note: %s", data["Note"])
            
            # Extract feed array from response
            feed = data.get("feed", [])
            if not feed:
                ticker_str = tickers or symbol or "unknown"
                self.logger.warning("No news articles returned for %s", ticker_str)
                return pd.DataFrame()
            
            # Convert to DataFrame with expected columns
            articles = []
            ticker_str = tickers or symbol or "unknown"
            for item in feed:
                # Extract ticker from item if available, otherwise use provided ticker
                item_ticker = item.get("ticker", ticker_str)
                articles.append({
                    "timestamp": pd.to_datetime(item.get("time_published", ""), format="%Y%m%dT%H%M%S", errors="coerce"),
                    "ticker": item_ticker,
                    "headline": item.get("title", ""),
                    "summary": item.get("summary", ""),
                    "sentiment_score": float(item.get("overall_sentiment_score", 0.0)),
                    "sentiment_label": item.get("overall_sentiment_label", ""),
                    "source": item.get("source", ""),
                    "url": item.get("url", ""),
                })
            
            frame = pd.DataFrame(articles)
            if frame.empty:
                return frame
            
            # Set timestamp as index
            frame = frame.dropna(subset=["timestamp"])
            if frame.empty:
                return frame
            
            frame.set_index("timestamp", inplace=True)
            frame.sort_index(inplace=True)
            
            self.logger.info("Fetched %d news articles for %s", len(frame), ticker_str)
            return frame
        else:
            # Parse CSV response for time series data
            frame = pd.read_csv(io.StringIO(response.text))
            
            # Check for error messages in CSV (Alpha Vantage sometimes returns errors as CSV)
            if not frame.empty and len(frame.columns) == 1 and "Error Message" in frame.iloc[0, 0]:
                error_msg = frame.iloc[0, 0]
                self.logger.error("Alpha Vantage API error: %s", error_msg)
                if "Invalid API key" in error_msg:
                    raise ValueError("Alpha Vantage API key is invalid. Please check your API key configuration.")
                elif "Thank you for using Alpha Vantage" in error_msg or "API call frequency" in error_msg:
                    raise RuntimeError(f"Alpha Vantage quota exceeded: {error_msg}")
                raise ValueError(f"Alpha Vantage API error: {error_msg}")
            
            frame.rename(columns=str.lower, inplace=True)
            if "timestamp" in frame.columns:
                frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
                frame.set_index("timestamp", inplace=True)
            return frame

    def save_to_bronze(
        self,
        payload: pd.DataFrame,
        *,
        bronze_root: Path,
        asset_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        symbol: Optional[str] = None,
        tickers: Optional[str] = None,
        function: str,
        **_: Any,
    ) -> None:
        meta = {"function": function}
        if metadata:
            meta.update(metadata)
        
        # For news data, use ticker from payload or parameter
        if function.upper() == "NEWS_SENTIMENT":
            # News data may have different timestamp format - ensure it's timezone-aware
            if not payload.empty:
                if not isinstance(payload.index, pd.DatetimeIndex):
                    payload.index = pd.to_datetime(payload.index, utc=True, errors="coerce")
                # Remove rows with invalid timestamps
                payload = payload[~payload.index.isna()]
            
            # Determine identifier: use ticker from payload if available, otherwise use parameter
            identifier = tickers or symbol
            if identifier and not payload.empty and "ticker" in payload.columns:
                # Use the most common ticker from the payload
                identifier = payload["ticker"].mode()[0] if not payload["ticker"].mode().empty else identifier
            elif not identifier:
                identifier = "unknown"
        else:
            # For time series functions, use symbol
            identifier = symbol
            if not identifier:
                raise ValueError(f"{function} requires 'symbol' parameter for save_to_bronze.")
        
        _write_partitioned_frame(payload, bronze_root, asset_type, self.source_name, identifier, meta)


class FREDCollector(BaseCollector):
    """Collector for macroeconomic time series from FRED."""

    source_name = "fred"

    def __init__(
        self,
        api_key: Optional[str] = None,
        rate_limiter: Optional[RateLimiter] = None,
        key_manager: Optional[ApiKeyManager] = None,
    ) -> None:
        super().__init__(rate_limiter=rate_limiter)
        self._explicit_api_key = api_key
        self.key_manager = key_manager or ApiKeyManager(
            "fred",
            env_candidates=[
                "FRED_API_KEY_PRIMARY",
                "FRED_API_KEY",
                "FRED_API_KEY_SECONDARY",
                "FRED_API_KEY_BACKUP",
            ],
        )
        self._fred: Optional[Any] = None

    def _get_client(self) -> Any:
        if self._fred is None:
            if Fred is None:  # pragma: no cover
                raise ImportError("fredapi is required to collect macro series. Install via `pip install fredapi`.")  # noqa: EM101
            api_key = self._explicit_api_key or self.key_manager.get_key()
            self._fred = Fred(api_key=api_key)  # type: ignore[call-arg]
        return self._fred

    def _fetch(self, series_id: str, observation_start: Optional[str] = None) -> pd.Series:
        self.handle_rate_limits()
        self.logger.info("Fetching FRED series %s", series_id)
        client = self._get_client()
        series = self.retry_with_backoff(client.get_series, series_id, observation_start=observation_start)
        series.index = pd.to_datetime(series.index, utc=True)
        series.name = "value"
        return series

    def save_to_bronze(
        self,
        payload: pd.Series,
        *,
        bronze_root: Path,
        asset_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        series_id: str,
        **_: Any,
    ) -> None:
        frame = payload.to_frame()
        _write_partitioned_frame(frame, bronze_root, asset_type, self.source_name, series_id, metadata)


class SocialMediaCollector(BaseCollector):
    """Collector for Reddit and Twitter sentiment sources."""

    source_name = "social_media"

    def __init__(self, reddit_client: Optional[Any] = None, rate_limiter: Optional[RateLimiter] = None) -> None:
        super().__init__(rate_limiter=rate_limiter)
        self.reddit = reddit_client

    def _ensure_reddit(self) -> Any:
        if self.reddit is None:
            if praw is None:  # pragma: no cover
                raise ImportError("praw is required for Reddit collection. Install via `pip install praw`.")  # noqa: EM101
            
            # Support both PRAW_* and REDDIT_* env vars for backward compatibility
            client_id = os.getenv("PRAW_CLIENT_ID") or os.getenv("REDDIT_CLIENT_ID")
            client_secret = os.getenv("PRAW_CLIENT_SECRET") or os.getenv("REDDIT_CLIENT_SECRET")
            user_agent = os.getenv("PRAW_USER_AGENT") or os.getenv("REDDIT_USER_AGENT", "agentic-rl-collector")
            
            if not client_id or not client_secret:
                # Fallback mode: return None to indicate unauthenticated mode
                self.logger.warning(
                    "Reddit credentials (PRAW_CLIENT_ID/PRAW_CLIENT_SECRET or REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET) "
                    "not configured. Social media collection will be skipped."
                )
                return None
            
            self.reddit = praw.Reddit(  # type: ignore[call-arg]
                client_id=client_id,
                client_secret=client_secret,
                user_agent=user_agent,
            )
        return self.reddit

    def _fetch(
        self,
        platform: str,
        query: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        subreddit: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        self.handle_rate_limits()
        if platform.lower() != "reddit":
            raise NotImplementedError("Only Reddit is supported at this time.")

        reddit_client = self._ensure_reddit()
        if reddit_client is None:
            # Unauthenticated fallback mode: return empty list with warning
            self.logger.warning(
                "Reddit credentials not configured. Skipping social media collection for query '%s'. "
                "Configure PRAW_CLIENT_ID and PRAW_CLIENT_SECRET to enable Reddit data collection.",
                query
            )
            return []
        
        try:
            subreddit_obj = reddit_client.subreddit(subreddit or "all")
            search_kwargs = {"limit": limit, "sort": "new"}
            if start_time:
                search_kwargs["time_filter"] = "all"
            results = subreddit_obj.search(query, **search_kwargs)

            posts: List[Dict[str, Any]] = []
            for submission in results:
                created = datetime.fromtimestamp(
                    getattr(submission, "created_utc", time.time()),
                    tz=timezone.utc,
                )
                if start_time and created < start_time:
                    continue
                if end_time and created > end_time:
                    continue
                posts.append(
                    {
                        "id": submission.id,
                        "title": submission.title,
                        "text": submission.selftext,
                        "created_utc": created,
                        "score": submission.score,
                        "num_comments": submission.num_comments,
                        "url": submission.url,
                        "subreddit": submission.subreddit.display_name,
                    }
                )
            self.logger.info("Collected %d Reddit posts for query '%s'", len(posts), query)
            return posts
        except Exception as exc:
            self.logger.warning("Error collecting Reddit data for query '%s': %s. Returning empty result.", query, exc)
            return []

    def save_to_bronze(
        self,
        payload: Sequence[Dict[str, Any]],
        *,
        bronze_root: Path,
        asset_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        platform: str,
        query: str,
        **_: Any,
    ) -> None:
        if not payload:
            return
        frame = pd.DataFrame(payload)
        frame["created_utc"] = pd.to_datetime(frame["created_utc"], utc=True)
        frame.set_index("created_utc", inplace=True)
        meta = {"platform": platform, "query": query}
        if metadata:
            meta.update(metadata)
        identifier = query.replace(" ", "_")
        _write_partitioned_frame(frame, bronze_root, asset_type, self.source_name, identifier, meta)

    def filter_by_tickers(self, payload: Sequence[Dict[str, Any]], tickers: Iterable[str]) -> List[Dict[str, Any]]:
        """Filter posts referencing specific tickers."""
        ticker_set = {ticker.lower() for ticker in tickers}
        filtered = [
            post
            for post in payload
            if any(ticker in (post.get("text", "") or "").lower() or ticker in (post.get("title", "") or "").lower() for ticker in ticker_set)
        ]
        self.logger.debug("Filtered %d posts by ticker list", len(filtered))
        return filtered
