"""Collect forex pairs via Yahoo Finance."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import List, Sequence

import yaml

from src.data import YahooFinanceCollector
from src.data.collectors import RateLimiter
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect forex data.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--start-date", type=str, default=None)
    parser.add_argument("--end-date", type=str, default=None)
    parser.add_argument("--interval", type=str, default="1d")
    return parser.parse_args()


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

        forex_cfg = config.get("assets", {}).get("forex", {})
        pairs_cfg = forex_cfg.get("pairs", {})
        majors: List[str] = pairs_cfg.get("majors", []) or []
        crosses: List[str] = pairs_cfg.get("crosses", []) or []

        forex_pairs = majors + crosses
        if not forex_pairs:
            logger.error("No forex pairs defined in configuration; aborting.")
            raise SystemExit(1)

        forex_symbols = sorted({f"{pair}=X" if not pair.endswith("=X") else pair for pair in forex_pairs})

        rate_limit_cfg = config.get("rate_limits", {}).get("yfinance", {})
        rate_limiter = None
        requests_per_second = rate_limit_cfg.get("requests_per_second")
        if requests_per_second:
            rate_limiter = RateLimiter(requests_per_interval=int(requests_per_second), interval_seconds=1.0)

        collector = YahooFinanceCollector(rate_limiter=rate_limiter)
        interval = forex_cfg.get("interval", args.interval or "1d")
        batch_size_value = rate_limit_cfg.get("batch_size") or 50
        batch_size = max(1, int(batch_size_value))
        batches = _chunked(forex_symbols, batch_size)

        logger.info(
            "Collecting %d forex pairs from %s to %s using interval=%s",
            len(forex_symbols),
            start_date,
            end_date,
            interval,
        )
        collected = 0
        success_batches = 0
        for batch in batches:
            result = collector.collect(
                symbols=batch,
                interval=interval,
                start=start_date,
                end=end_date,
                auto_adjust=False,
                bronze_root=bronze_root,
                asset_type="forex",
            )
            if not result:
                logger.warning("Batch returned no data for pairs %s", batch)
                continue
            collected += len(result)
            success_batches += 1
        if collected == 0:
            logger.error("No forex pairs produced data. Check Yahoo Finance availability.")
            raise SystemExit(2)
        logger.info(
            "Successfully collected %d forex symbols across %d/%d batches.",
            collected,
            success_batches,
            len(batches),
        )
    except Exception:
        logger.exception("Failed to collect forex data.")
        raise


if __name__ == "__main__":
    main()
