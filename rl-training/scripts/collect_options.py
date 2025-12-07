"""
Collect equity options chains via Yahoo Finance and persist to the Bronze layer.
Uses yfinance's built-in options API (Ticker.options and Ticker.option_chain()) which
handles authentication internally via curl_cffi. This is more reliable than manual
HTTP requests with Yahoo's 2025 authentication requirements.
"""

from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple, Any

import pandas as pd
import yaml
import yfinance as yf

from src.data.collectors import RateLimiter, _write_partitioned_frame  # type: ignore
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)

DEFAULT_UNDERLYINGS = ["AAPL", "MSFT", "SPY", "QQQ", "TSLA", "NVDA", "AMD", "INTC", "AMZN", "GOOGL"]


def _fetch_options_expiries_via_yfinance(
    symbol: str,
    max_retries: int = 5,
    delay: float = 3.0,
    rate_limiter: Optional[RateLimiter] = None,
) -> Tuple[List[str], Dict[str, Any]]:
    """
    Fetch option expiry dates using yfinance's built-in options API.
    
    Returns:
        Tuple of (expiry_dates, status_info) where:
        - expiry_dates: List of expiry date strings (YYYY-MM-DD format), empty if failed
        - status_info: Dict with 'attempts_made', 'error_type', 'status_code' keys
    """
    attempts_made = 0
    last_error_type = None
    last_status_code = None
    
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                wait_time = delay * (2 ** (attempt - 1))
                logger.debug("Retrying expiry fetch for %s after %.1f seconds (attempt %d/%d)", 
                           symbol, wait_time, attempt + 1, max_retries)
                time.sleep(wait_time)
                if rate_limiter:
                    rate_limiter.acquire()
            elif rate_limiter:
                rate_limiter.acquire()
            
            logger.debug("Fetching option expiries for %s via yfinance (attempt %d/%d)", 
                        symbol, attempt + 1, max_retries)
            start_time = time.time()
            
            attempts_made += 1
            ticker = yf.Ticker(symbol)
            expiries = ticker.options  # Returns list of expiry date strings (YYYY-MM-DD)
            
            elapsed = time.time() - start_time
            logger.debug("Fetched expiries response in %.2f seconds", elapsed)
            
            if not expiries:
                logger.warning("No expiration dates found for %s", symbol)
                return [], {'attempts_made': attempts_made, 'error_type': 'other', 'status_code': None}
            
            logger.info("Successfully fetched %d expiries for %s in %.2f seconds", 
                       len(expiries), symbol, elapsed)
            return list(expiries), {'attempts_made': attempts_made, 'error_type': None, 'status_code': None}
            
        except Exception as exc:
            last_error_type = 'other'
            error_str = str(exc)
            
            # Check for specific error types
            if "401" in error_str or "Unauthorized" in error_str:
                last_error_type = 'unauthorized'
                last_status_code = 401
            elif "429" in error_str or "rate limit" in error_str.lower():
                last_error_type = 'rate_limited'
                last_status_code = 429
            elif "timeout" in error_str.lower():
                last_error_type = 'timeout'
            
            if attempt < max_retries - 1:
                wait_time = delay * (2 ** attempt)
                logger.warning(
                    "Error fetching expiries for %s (attempt %d/%d): %s. Retrying in %.1f seconds...",
                    symbol, attempt + 1, max_retries, exc, wait_time
                )
                time.sleep(wait_time)
                if rate_limiter:
                    rate_limiter.acquire()
                continue
            else:
                logger.error("Failed to fetch expiries for %s after %d attempts: %s", symbol, attempts_made, exc)
                return [], {'attempts_made': attempts_made, 'error_type': last_error_type, 'status_code': last_status_code}
    
    return [], {'attempts_made': attempts_made, 'error_type': last_error_type or 'other', 'status_code': last_status_code}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect options chain data from Yahoo Finance.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--lookahead-days", type=int, default=None, help="Override expiry lookahead window.")
    parser.add_argument("--max-expiries", type=int, default=None, help="Maximum number of expiries to collect per symbol.")
    parser.add_argument(
        "--max-contracts",
        type=int,
        default=None,
        help="Maximum number of strike rows to persist per option type (calls/puts).",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        default=False,
        help="Exit with error code 2 if no options data is collected. Default is lenient mode (exit code 0 with warnings).",
    )
    return parser.parse_args()


def _resolve_catalog_path(base: Path, reference: str) -> Path:
    reference_path = Path(reference)
    if reference_path.is_absolute():
        return reference_path.resolve()
    parts = list(reference_path.parts)
    if parts and parts[0].lower() == "catalog":
        reference_path = Path(*parts[1:]) if len(parts) > 1 else Path()
    return (base / reference_path).resolve()


def _extract_symbols_from_catalog(path: Path) -> List[str]:
    frame = pd.read_csv(path)
    column: Optional[str] = None
    for candidate in frame.columns:
        if candidate.lower() in {"symbol", "ticker"}:
            column = candidate
            break
    if column is None:
        column = frame.columns[0]
    symbols = frame[column].dropna().astype(str).str.strip()
    return sorted({symbol.upper() for symbol in symbols if symbol})


def _create_default_catalog(catalog_path: Path) -> None:
    """Create a default options underlyings catalog file if it doesn't exist."""
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame({"symbol": DEFAULT_UNDERLYINGS})
    frame.to_csv(catalog_path, index=False)
    logger.info("Created default options catalog at %s with %d symbols", catalog_path, len(DEFAULT_UNDERLYINGS))


def _resolve_underlyings(catalog_base: Path, reference: Optional[str]) -> List[str]:
    """Resolve option underlying symbols from catalog file.
    
    Uses the CSV catalog file if it exists. Only falls back to defaults if:
    - No reference is configured
    - Catalog file doesn't exist (creates default catalog first)
    - Catalog file is empty
    - Catalog file parsing fails
    """
    if not reference:
        logger.warning("Options configuration missing underlyings_reference; using default list.")
        return DEFAULT_UNDERLYINGS.copy()
    
    catalog_path = _resolve_catalog_path(catalog_base, reference)
    
    if not catalog_path.exists():
        logger.warning("Options underlying catalog not found at %s; creating default catalog.", catalog_path)
        _create_default_catalog(catalog_path)
        # After creating default, use it
        logger.info("Using newly created default catalog with %d symbols", len(DEFAULT_UNDERLYINGS))
        return DEFAULT_UNDERLYINGS.copy()
    
    try:
        symbols = _extract_symbols_from_catalog(catalog_path)
        if not symbols:
            logger.warning("Options catalog %s is empty; using defaults.", catalog_path)
            return DEFAULT_UNDERLYINGS.copy()
        logger.info("Loaded %d symbols from options catalog: %s", len(symbols), catalog_path)
        return symbols
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to parse options underlyings from %s. Using defaults.", catalog_path)
        return DEFAULT_UNDERLYINGS.copy()


def _filter_expiries(expiry_dates: List[str], lookahead_days: int, max_expiries: int) -> List[str]:
    """Filter expiry dates based on lookahead window and max count.
    
    Args:
        expiry_dates: List of expiry date strings in YYYY-MM-DD format
        lookahead_days: Maximum days ahead to include expiries
        max_expiries: Maximum number of expiries to return
    
    Returns:
        Filtered and sorted list of expiry date strings
    """
    if not expiry_dates:
        return []
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=max(1, lookahead_days))
    
    # Convert date strings to datetime and filter
    filtered = []
    for expiry_str in expiry_dates:
        try:
            expiry_dt = pd.to_datetime(expiry_str).tz_localize(timezone.utc) if pd.to_datetime(expiry_str).tz is None else pd.to_datetime(expiry_str)
            if expiry_dt >= now and expiry_dt <= cutoff:
                filtered.append(expiry_str)
        except Exception:
            logger.warning("Invalid expiry date format: %s", expiry_str)
            continue
    
    # Sort by date
    filtered.sort()
    
    if max_expiries > 0:
        filtered = filtered[:max_expiries]
    
    return filtered


def _limit_contracts(frame: pd.DataFrame, max_contracts: int) -> pd.DataFrame:
    if max_contracts <= 0 or frame.empty:
        return frame
    return frame.head(max_contracts)




def _fetch_option_chain_via_yfinance(
    symbol: str,
    expiry_date: str,
    max_retries: int = 5,
    delay: float = 3.0,
    rate_limiter: Optional[RateLimiter] = None,
) -> Tuple[Optional[Dict], Dict[str, Any]]:
    """
    Fetch option chain for a specific expiry using yfinance's built-in API.
    
    Returns:
        Tuple of (chain_data, status_info) where:
        - chain_data: Dictionary with 'calls' and 'puts' DataFrames, or None if failed
        - status_info: Dict with 'attempts_made', 'error_type', 'status_code' keys
    """
    attempts_made = 0
    last_error_type = None
    last_status_code = None
    
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                wait_time = delay * (2 ** (attempt - 1))
                logger.debug("Retrying option chain fetch for %s %s after %.1f seconds (attempt %d/%d)",
                           symbol, expiry_date, wait_time, attempt + 1, max_retries)
                time.sleep(wait_time)
                if rate_limiter:
                    rate_limiter.acquire()
            elif rate_limiter:
                rate_limiter.acquire()
            
            logger.debug("Fetching option chain for %s expiry %s via yfinance (attempt %d/%d)",
                        symbol, expiry_date, attempt + 1, max_retries)
            start_time = time.time()
            
            attempts_made += 1
            ticker = yf.Ticker(symbol)
            chain = ticker.option_chain(expiry_date)
            
            calls_df = chain.calls
            puts_df = chain.puts
            
            # Get underlying price and quote time from ticker fast_info (faster, less error-prone)
            # Fallback to info if fast_info is not available
            try:
                fast_info = ticker.fast_info
                underlying_price = (
                    fast_info.get("lastPrice") or 
                    fast_info.get("regularMarketPrice") or 
                    fast_info.get("preMarketPrice") or 
                    fast_info.get("postMarketPrice")
                )
                quote_timestamp = (
                    fast_info.get("lastPriceTime") or
                    fast_info.get("regularMarketTime") or 
                    fast_info.get("preMarketTime") or 
                    fast_info.get("postMarketTime")
                )
            except (AttributeError, KeyError):
                # Fallback to info if fast_info is not available
                info = ticker.info
                underlying_price = info.get("regularMarketPrice") or info.get("preMarketPrice") or info.get("postMarketPrice")
                quote_timestamp = (
                    info.get("regularMarketTime") or 
                    info.get("preMarketTime") or 
                    info.get("postMarketTime")
                )
            
            # Ensure we have a timestamp (use current time as final fallback)
            if not quote_timestamp:
                quote_timestamp = int(datetime.now(timezone.utc).timestamp())
            
            # Convert timestamp to int if it's a datetime or Timestamp
            if isinstance(quote_timestamp, pd.Timestamp):
                quote_timestamp = int(quote_timestamp.timestamp())
            elif isinstance(quote_timestamp, datetime):
                quote_timestamp = int(quote_timestamp.timestamp())
            elif isinstance(quote_timestamp, (int, float)):
                quote_timestamp = int(quote_timestamp)
            else:
                # Final fallback
                quote_timestamp = int(datetime.now(timezone.utc).timestamp())
            
            # Convert expiry_date to timestamp for consistency
            expiry_dt = pd.to_datetime(expiry_date)
            expiry_timestamp = int(expiry_dt.timestamp())
            
            # Add metadata fields
            if not calls_df.empty:
                calls_df["underlying"] = symbol
                calls_df["underlying_price"] = underlying_price
                calls_df["expiry_timestamp"] = expiry_timestamp
                calls_df["expiry_date"] = expiry_date
                calls_df["option_type"] = "call"
            if not puts_df.empty:
                puts_df["underlying"] = symbol
                puts_df["underlying_price"] = underlying_price
                puts_df["expiry_timestamp"] = expiry_timestamp
                puts_df["expiry_date"] = expiry_date
                puts_df["option_type"] = "put"
            
            elapsed = time.time() - start_time
            logger.info("Successfully fetched option chain for %s %s: %d calls, %d puts in %.2f seconds",
                       symbol, expiry_date, len(calls_df), len(puts_df), elapsed)
            
            return {
                "calls": calls_df, 
                "puts": puts_df, 
                "underlying_price": underlying_price,
                "quote_timestamp": quote_timestamp
            }, {'attempts_made': attempts_made, 'error_type': None, 'status_code': None}
            
        except Exception as exc:
            last_error_type = 'other'
            error_str = str(exc)
            
            # Check for specific error types
            if "401" in error_str or "Unauthorized" in error_str:
                last_error_type = 'unauthorized'
                last_status_code = 401
            elif "429" in error_str or "rate limit" in error_str.lower():
                last_error_type = 'rate_limited'
                last_status_code = 429
            elif "timeout" in error_str.lower():
                last_error_type = 'timeout'
            elif "No options data" in error_str or "expiration date" in error_str.lower():
                last_error_type = 'not_found'
                last_status_code = 404
            
            if attempt < max_retries - 1:
                wait_time = delay * (2 ** attempt)
                logger.warning(
                    "Error fetching option chain for %s %s (attempt %d/%d): %s. Retrying in %.1f seconds...",
                    symbol, expiry_date, attempt + 1, max_retries, exc, wait_time
                )
                time.sleep(wait_time)
                if rate_limiter:
                    rate_limiter.acquire()
                continue
            else:
                logger.error("Failed to fetch option chain for %s %s after %d attempts: %s",
                           symbol, expiry_date, attempts_made, exc)
                return None, {'attempts_made': attempts_made, 'error_type': last_error_type, 'status_code': last_status_code}
    
    return None, {'attempts_made': attempts_made, 'error_type': last_error_type or 'other', 'status_code': last_status_code}


def _persist_option_frame(
    frame: pd.DataFrame,
    *,
    bronze_root: Path,
    underlying: str,
    expiry_date: str,
    option_type: str,
    quote_timestamp: Optional[int] = None,
) -> int:
    """Persist option chain DataFrame to Bronze layer.
    
    Option chains are snapshot data - all contracts share the same quote time.
    We use the quote timestamp as the index for proper partitioning by date.
    This matches the pattern used by other collectors (stocks, forex, etc.)
    where data is partitioned by acquisition date.
    """
    if frame.empty:
        return 0
    
    working = frame.copy()
    
    # Option chains are snapshot data - all contracts share the same quote time
    # Use quote_timestamp if provided (from the quote object)
    if quote_timestamp:
        # Use the shared quote timestamp for all contracts in this chain
        quote_dt = pd.to_datetime(quote_timestamp, unit="s", utc=True)
        working.index = pd.DatetimeIndex([quote_dt] * len(working))
    else:
        # Fallback: use current timestamp (should not happen if API response is correct)
        logger.warning("No quote_timestamp provided for %s %s %s; using current time", underlying, expiry_date, option_type)
        quote_dt = datetime.now(timezone.utc)
        working.index = pd.DatetimeIndex([quote_dt] * len(working))
    
    # Ensure index is timezone-aware DatetimeIndex (required by _write_partitioned_frame)
    if not isinstance(working.index, pd.DatetimeIndex):
        working.index = pd.to_datetime(working.index, utc=True, errors="coerce")
    
    # Remove any duplicate index entries and sort
    working = working[~working.index.duplicated(keep="first")]
    working = working.sort_index()
    
    # Prepare metadata - matches pattern used by other collectors
    # Extract expiry_timestamp from frame if available, otherwise compute from expiry_date
    expiry_timestamp = None
    if "expiry_timestamp" in working.columns and not working.empty:
        expiry_timestamp = int(working["expiry_timestamp"].iloc[0])
    else:
        expiry_dt = pd.to_datetime(expiry_date)
        expiry_timestamp = int(expiry_dt.timestamp())
    
    metadata = {
        "underlying": underlying,
        "expiry": expiry_date,
        "expiry_timestamp": expiry_timestamp,
        "option_type": option_type,
        "quote_timestamp": int(working.index[0].timestamp()) if len(working) > 0 else None,
    }
    
    # Identifier follows pattern: {underlying}_{expiry_date}_{option_type}
    identifier = f"{underlying}_{expiry_date}_{option_type}".replace(":", "_").replace("-", "_")
    
    # Use standard _write_partitioned_frame to match other collectors
    # This ensures consistent partitioning by date: bronze/options/yfinance/{identifier}/{YYYY}/{MM}/{DD}.parquet
    _write_partitioned_frame(
        working,
        bronze_root=bronze_root,
        asset_type="options",
        source_name="yfinance",
        identifier=identifier,
        metadata=metadata,
    )
    return working.shape[0]


def main() -> None:
    args = parse_args()
    try:
        load_environment()
        raw_config = yaml.safe_load(args.config.read_text())
        config = resolve_env_placeholders(raw_config)

        storage_cfg = config.get("storage", {})
        bronze_root = Path(storage_cfg.get("bronze_path", "./data/bronze"))
        catalog_base = Path(storage_cfg.get("catalog_path", "./data/catalog"))

        options_cfg = config.get("assets", {}).get("options", {})
        underlyings = _resolve_underlyings(catalog_base, options_cfg.get("underlyings_reference"))
        if not underlyings:
            logger.error("No option underlyings resolved; aborting.")
            raise SystemExit(1)

        expiry_cfg = options_cfg.get("expiries", {})
        lookahead_days = args.lookahead_days or int(expiry_cfg.get("lookahead_days", 60))
        max_strikes = args.max_contracts or int(expiry_cfg.get("max_strikes", 20))
        max_expiries = args.max_expiries or int(expiry_cfg.get("max_expiries", 3))

        rate_limit_cfg = config.get("rate_limits", {}).get("yfinance", {})
        retry_attempts = rate_limit_cfg.get("retry_attempts", 5)
        backoff_seconds = rate_limit_cfg.get("backoff_seconds", 3.0)
        requests_per_second = rate_limit_cfg.get("requests_per_second", 2)
        min_delay_seconds = rate_limit_cfg.get("min_delay_seconds", 0.5)
        request_delay = max(min_delay_seconds, 1.0 / max(requests_per_second, 1))
        
        # Use RateLimiter for proper rate limit management
        rate_limiter = RateLimiter(requests_per_interval=int(requests_per_second), interval_seconds=1.0)
        
        logger.info(
            "Rate limiting: %d requests/second, delay: %.2fs, retries: %d, backoff: %.1fs",
            requests_per_second,
            request_delay,
            retry_attempts,
            backoff_seconds,
        )

        total_underlyings = 0
        total_contracts = 0
        failed_symbols = []
        total_attempts = 0
        failure_types = {
            'rate_limited': 0,
            'not_found': 0,
            'timeout': 0,
            'parse_error': 0,
            'other': 0
        }
        
        logger.info("Processing %d option underlyings with lookahead=%d days, max_expiries=%d", 
                   len(underlyings), lookahead_days, max_expiries)
        
        # Add initial delay to avoid hitting Yahoo Finance immediately after startup
        initial_delay = max(2.0, request_delay * 2)
        logger.info("Applying initial delay of %.2f seconds before starting options collection", initial_delay)
        time.sleep(initial_delay)
        
        for symbol_idx, symbol in enumerate(underlyings, 1):
            logger.info("Processing symbol %d/%d: %s", symbol_idx, len(underlyings), symbol)
            
            # Fetch expiries using yfinance - returns (expiry_dates, status_info)
            expiries, expiry_status = _fetch_options_expiries_via_yfinance(
                symbol, 
                max_retries=retry_attempts, 
                delay=backoff_seconds, 
                rate_limiter=rate_limiter
            )
            
            # Track actual attempts made
            total_attempts += expiry_status.get('attempts_made', 0)
            
            # Track failure type if there was an error
            if expiry_status.get('error_type'):
                error_type = expiry_status['error_type']
                if error_type in failure_types:
                    failure_types[error_type] += 1
                else:
                    failure_types['other'] += 1
            
            if not expiries:
                logger.warning("No option expiries available for %s (may be rate limited or symbol has no options)", symbol)
                failed_symbols.append(symbol)
                continue

            filtered_expiries = _filter_expiries(expiries, lookahead_days, max_expiries)
            if not filtered_expiries:
                logger.warning("No option expiries within %d days for %s (found %d total expiries)", 
                             lookahead_days, symbol, len(expiries))
                continue

            logger.info("Collecting %d expiries for %s (from %d available)", 
                       len(filtered_expiries), symbol, len(expiries))
            
            symbol_contracts = 0
            for expiry_idx, expiry_date in enumerate(filtered_expiries, 1):
                logger.debug("Fetching option chain for %s expiry %s (%d/%d)", 
                           symbol, expiry_date, expiry_idx, len(filtered_expiries))
                
                # Fetch option chain using yfinance - returns (chain_data, status_info)
                chain_data, chain_status = _fetch_option_chain_via_yfinance(
                    symbol,
                    expiry_date,
                    max_retries=retry_attempts,
                    delay=backoff_seconds,
                    rate_limiter=rate_limiter,
                )
                
                # Track actual attempts made
                total_attempts += chain_status.get('attempts_made', 0)
                
                # Track failure type if there was an error
                if chain_status.get('error_type'):
                    error_type = chain_status['error_type']
                    if error_type in failure_types:
                        failure_types[error_type] += 1
                    else:
                        failure_types['other'] += 1
                
                if not chain_data:
                    logger.warning("Failed to fetch option chain for %s %s", symbol, expiry_date)
                    continue

                # Persist calls and puts
                quote_timestamp = chain_data.get("quote_timestamp")
                for option_type, frame in (("calls", chain_data["calls"]), ("puts", chain_data["puts"])):
                    if frame.empty:
                        continue
                    limited = _limit_contracts(frame, max_strikes)
                    persisted = _persist_option_frame(
                        limited,
                        bronze_root=bronze_root,
                        underlying=symbol,
                        expiry_date=expiry_date,
                        option_type=option_type,
                        quote_timestamp=quote_timestamp,
                    )
                    symbol_contracts += persisted
                    total_contracts += persisted
            
            if symbol_contracts > 0:
                total_underlyings += 1
                logger.info("Collected %d option contracts for %s", symbol_contracts, symbol)
            else:
                failed_symbols.append(symbol)

        if total_contracts == 0:
            failed_symbols_str = failed_symbols[:10] if len(failed_symbols) > 10 else failed_symbols
            if len(failed_symbols) > 10:
                failed_symbols_str = f"{failed_symbols_str} ... (and {len(failed_symbols) - 10} more)"
            
            # Build failure summary
            failure_summary_parts = []
            if failure_types['rate_limited'] > 0:
                failure_summary_parts.append(f"rate limiting: {failure_types['rate_limited']}")
            if failure_types['not_found'] > 0:
                failure_summary_parts.append(f"not found (404): {failure_types['not_found']}")
            if failure_types['timeout'] > 0:
                failure_summary_parts.append(f"timeout: {failure_types['timeout']}")
            if failure_types['parse_error'] > 0:
                failure_summary_parts.append(f"parse errors: {failure_types['parse_error']}")
            if failure_types['other'] > 0:
                failure_summary_parts.append(f"other: {failure_types['other']}")
            
            failure_summary = ", ".join(failure_summary_parts) if failure_summary_parts else "unknown reasons"
            
            base_message = (
                f"Options data collection failed after {total_attempts} attempts across {len(underlyings)} symbols. "
                f"{len(failed_symbols)} symbols failed. "
                f"Most common failure reasons: {failure_summary}. "
                f"Failed symbols (first 10): {failed_symbols_str}"
            )
            continuation_message = (
                "This is often due to Yahoo Finance rate limiting or API changes. "
                "The pipeline will continue, but options-based features and the options agent will be unavailable. "
                "You can retry options collection later by running: python scripts/collect_options.py --config config/data_config.yaml"
            )
            
            if args.strict:
                logger.error(base_message)
                logger.error(continuation_message)
                logger.error("Exiting with error code 2 (strict mode: no data collected)")
                raise SystemExit(2)
            else:
                logger.warning(base_message)
                logger.warning(continuation_message)
                logger.warning("Exiting with error code 1 - no data collected (automation will not mark as completed)")
                # Exit with error code even in lenient mode to prevent false positive checkpoints
                # The automation script should handle this gracefully and continue with other steps
                raise SystemExit(1)

        logger.info(
            "Successfully persisted %d option contracts across %d underlyings. "
            "%d symbols had no data available.",
            total_contracts,
            total_underlyings,
            len(failed_symbols),
        )
        if failed_symbols:
            logger.warning("Symbols with no options data: %s", failed_symbols[:20])
    except Exception:
        logger.exception("Failed to collect options data.")
        raise


if __name__ == "__main__":
    main()

