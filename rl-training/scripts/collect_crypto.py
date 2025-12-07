"""Collect cryptocurrency data via CCXT and Yahoo Finance."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Set

import pandas as pd
import yaml

from src.data import CCXTCollector, YahooFinanceCollector
from src.data.collectors import RateLimiter
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect cryptocurrency data.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--exchange", type=str, default=None)
    parser.add_argument("--timeframe", type=str, default="1d")
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--start-date", type=str, default=None)
    parser.add_argument("--end-date", type=str, default=None)
    return parser.parse_args()


def _extract_symbols_from_catalog(path: Path) -> List[str]:
    frame = pd.read_csv(path)
    symbol_column: Optional[str] = None
    for column in frame.columns:
        if column.lower() in {"symbol", "ticker"}:
            symbol_column = column
            break
    if symbol_column is None:
        symbol_column = frame.columns[0]
    symbols: Iterable[str] = frame[symbol_column].dropna().astype(str).str.strip()
    return sorted({symbol for symbol in symbols if symbol})


def _chunked(values: Sequence[str], size: int) -> List[List[str]]:
    return [list(values[i : i + size]) for i in range(0, len(values), size)]


def main() -> None:
    args = parse_args()
    try:
        load_environment()
        raw_config = yaml.safe_load(args.config.read_text())
        config = resolve_env_placeholders(raw_config)

        storage_cfg = config.get("storage", {})
        bronze_root = Path(storage_cfg.get("bronze_path", "./data/bronze"))

        date_cfg = config.get("date_ranges", {}).get("default", {})
        start_date = args.start_date or date_cfg.get("start")
        end_date = args.end_date or date_cfg.get("end")

        crypto_cfg = config.get("assets", {}).get("crypto", {})
        symbols_cfg = crypto_cfg.get("symbols", {})
        majors: List[str] = list(symbols_cfg.get("majors", []))

        symbols: Set[str] = set(majors)
        emerging_reference = symbols_cfg.get("emerging_top100_reference")
        if emerging_reference:
            catalog_path = (args.config.parent / emerging_reference).resolve()
            if catalog_path.exists():
                try:
                    symbols.update(_extract_symbols_from_catalog(catalog_path))
                except Exception:  # pylint: disable=broad-except
                    logger.exception("Failed to load emerging symbols from %s", catalog_path)
            else:
                logger.warning("Emerging crypto catalog missing at %s; using majors only.", catalog_path)

        if not symbols:
            logger.error("No cryptocurrency symbols resolved from configuration; aborting.")
            raise SystemExit(1)

        # Yahoo Finance collection for USD pairs
        usd_pairs = sorted({symbol for symbol in symbols if symbol.upper().endswith("-USD")})
        yfinance_rate_cfg = config.get("rate_limits", {}).get("yfinance", {})
        yfinance_rate_limiter = None
        yfinance_rps = yfinance_rate_cfg.get("requests_per_second")
        if yfinance_rps:
            yfinance_rate_limiter = RateLimiter(requests_per_interval=int(yfinance_rps), interval_seconds=1.0)

        if usd_pairs:
            yahoo_collector = YahooFinanceCollector(rate_limiter=yfinance_rate_limiter)
            interval = crypto_cfg.get("interval", args.timeframe or "1d")
            batch_size_value = yfinance_rate_cfg.get("batch_size") or 50
            batch_size = max(1, int(batch_size_value))
            batches = _chunked(usd_pairs, batch_size)
            logger.info(
                "Collecting %d crypto USD pairs via Yahoo Finance from %s to %s interval=%s",
                len(usd_pairs),
                start_date,
                end_date,
                interval,
            )
            collected_pairs = 0
            success_batches = 0
            for batch in batches:
                result = yahoo_collector.collect(
                    symbols=batch,
                    interval=interval,
                    start=start_date,
                    end=end_date,
                    auto_adjust=False,
                    bronze_root=bronze_root,
                    asset_type="crypto",
                )
                if not result:
                    logger.warning("Batch returned no data for crypto symbols %s", batch)
                    continue
                collected_pairs += len(result)
                success_batches += 1
            if collected_pairs == 0:
                logger.error("No crypto USD pairs produced data via Yahoo Finance.")
            else:
                logger.info(
                    "Successfully collected %d crypto USD pairs via Yahoo Finance across %d/%d batches.",
                    collected_pairs,
                    success_batches,
                    len(batches),
                )
        else:
            logger.warning("No USD-denominated crypto pairs available for Yahoo Finance collection.")

        # CCXT collection for configured exchanges
        ccxt_cfg = crypto_cfg.get("ccxt", {})
        config_exchanges = [exchange.lower() for exchange in crypto_cfg.get("exchanges", [])]
        if args.exchange:
            exchanges = [args.exchange.lower()]
        else:
            exchanges = config_exchanges

        # Check if CCXT API keys are available (optional - CCXT can work without keys for public data)
        import os
        ccxt_key_available = bool(os.getenv("CCXT_EXCHANGE_API_KEY") or os.getenv("CCXT_API_KEY"))
        if not exchanges:
            logger.info("No CCXT exchanges configured; skipping CCXT collection. Using Yahoo Finance only.")
        elif not ccxt_key_available:
            logger.warning(
                "CCXT API keys not configured (CCXT_EXCHANGE_API_KEY or CCXT_API_KEY). "
                "Skipping CCXT collection. Crypto data will be collected via Yahoo Finance only. "
                "To use CCXT exchanges, configure API keys in .env file."
            )
        else:
            ccxt_rate_cfg = config.get("rate_limits", {}).get("ccxt", {})
            ccxt_rate_limiter = None
            throttle_ms = ccxt_rate_cfg.get("throttle_ms")
            if throttle_ms:
                requests_per_second = max(1, int(1000 / int(throttle_ms)))
                ccxt_rate_limiter = RateLimiter(requests_per_interval=requests_per_second, interval_seconds=1.0)

            ccxt_collector = CCXTCollector(rate_limiter=ccxt_rate_limiter)
            timeframe = args.timeframe or ccxt_cfg.get("timeframe", "1d")
            limit = args.limit
            since_ms = None
            if start_date:
                start_ts = pd.to_datetime(start_date, utc=True, errors="coerce")
                if pd.isna(start_ts):
                    logger.warning("Unable to parse start date %s for CCXT since parameter.", start_date)
                else:
                    since_ms = int(start_ts.value // 1_000_000)
            total_success = 0
            for exchange in exchanges:
                if exchange not in config_exchanges:
                    logger.warning("Exchange %s not listed in configuration; skipping.", exchange)
                    continue
                for symbol in majors:
                    ccxt_symbol = symbol.replace("-", "/")
                    try:
                        ccxt_collector.collect(
                            exchange_id=exchange,
                            symbol=ccxt_symbol,
                            timeframe=timeframe,
                            limit=limit,
                            since=since_ms,
                            bronze_root=bronze_root,
                            asset_type="crypto",
                        )
                        total_success += 1
                    except Exception:  # pylint: disable=broad-except
                        logger.exception("Failed to collect %s from exchange %s via CCXT", ccxt_symbol, exchange)
            if total_success:
                logger.info("Successfully collected %d CCXT crypto datasets.", total_success)
            else:
                logger.warning("No CCXT crypto datasets collected.")
    except Exception:
        logger.exception("Failed to collect cryptocurrency data.")
        raise


if __name__ == "__main__":
    main()
