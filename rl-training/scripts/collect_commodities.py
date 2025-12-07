"""
Collect commodity futures data via Yahoo Finance contracts defined in the configuration.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, List, Sequence

import yaml

from src.data import YahooFinanceCollector
from src.data.collectors import RateLimiter
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)

DEFAULT_COMMODITY_CONTRACTS = [
    "GC=F",  # Gold
    "SI=F",  # Silver
    "CL=F",  # Crude Oil
    "NG=F",  # Natural Gas
    "ZC=F",  # Corn
    "ZS=F",  # Soybeans
    "ZW=F",  # Wheat
    "HG=F",  # Copper
    "PL=F",  # Platinum
    "PA=F",  # Palladium
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect commodity futures data.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--start-date", type=str, default=None)
    parser.add_argument("--end-date", type=str, default=None)
    parser.add_argument("--interval", type=str, default="1d")
    return parser.parse_args()


def _chunked(values: Sequence[str], size: int) -> List[List[str]]:
    return [list(values[i : i + size]) for i in range(0, len(values), size)]


def _resolve_contracts(contracts_cfg: dict[str, Iterable[str]]) -> List[str]:
    resolved: List[str] = []
    for group_name, contracts in contracts_cfg.items():
        if not contracts:
            logger.warning("Commodity contract group %s is empty.", group_name)
            continue
        resolved.extend(str(contract).strip().upper() for contract in contracts)
    if not resolved:
        logger.warning("No commodity contracts defined; using default futures list.")
        resolved = DEFAULT_COMMODITY_CONTRACTS.copy()
    return sorted({contract for contract in resolved if contract})


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

        commodities_cfg = config.get("assets", {}).get("commodities", {})
        contracts_cfg = commodities_cfg.get("contracts", {})
        contracts = _resolve_contracts(contracts_cfg)
        if not contracts:
            logger.error("No commodity contracts resolved; aborting collection.")
            raise SystemExit(1)

        rate_limit_cfg = config.get("rate_limits", {}).get("yfinance", {})
        rate_limiter = None
        requests_per_second = rate_limit_cfg.get("requests_per_second")
        if requests_per_second:
            rate_limiter = RateLimiter(requests_per_interval=int(requests_per_second), interval_seconds=1.0)

        collector = YahooFinanceCollector(rate_limiter=rate_limiter)
        interval = commodities_cfg.get("interval", args.interval or "1d")
        batch_size_value = rate_limit_cfg.get("batch_size") or 25
        batch_size = max(1, int(batch_size_value))
        batches = _chunked(contracts, batch_size)

        logger.info(
            "Collecting %d commodity contracts from %s to %s using interval=%s",
            len(contracts),
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
                asset_type="commodities",
            )
            if not result:
                logger.warning("Batch returned no data for contracts %s", batch)
                continue
            collected += len(result)
            success_batches += 1

        if collected == 0:
            logger.error("No commodity contracts produced data. Verify Yahoo Finance symbols or connectivity.")
            raise SystemExit(2)

        logger.info(
            "Successfully collected %d commodity contracts across %d/%d batches.",
            collected,
            success_batches,
            len(batches),
        )
    except Exception:
        logger.exception("Failed to collect commodity data.")
        raise


if __name__ == "__main__":
    main()


