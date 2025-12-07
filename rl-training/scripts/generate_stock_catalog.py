"""
Generate sector-based stock catalogs using Yahoo Finance's Screener API.
"""

from __future__ import annotations

import argparse
import random
import time
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

import pandas as pd
import requests
import yaml

from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)

YAHOO_SCREENER_URL = "https://query2.finance.yahoo.com/v1/finance/screener"

# Mapping between internal sectors and Yahoo Finance sector/industry labels.
SECTOR_MAPPING: Dict[str, Dict[str, Sequence[str]]] = {
    "technology_services": {
        "sectors": ["Technology"],
        "industries": ["Information Technology Services", "Software - Infrastructure", "Software - Application"],
    },
    "electronic_technology": {
        "sectors": ["Technology"],
        "industries": ["Semiconductors", "Computer Hardware", "Communication Equipment"],
    },
    "finance": {"sectors": ["Financial Services"], "industries": ["Banks - Diversified", "Capital Markets"]},
    "health_technology": {"sectors": ["Healthcare"], "industries": ["Healthcare Plans", "Biotechnology", "Medical Devices"]},
    "energy_minerals": {"sectors": ["Energy"], "industries": ["Oil & Gas E&P", "Oil & Gas Integrated", "Coal"]},
    "consumer": {"sectors": ["Consumer Cyclical", "Consumer Defensive"], "industries": ["Specialty Retail", "Consumer Electronics", "Beverages - Non-Alcoholic"]},
    "industrial": {"sectors": ["Industrials"], "industries": ["Aerospace & Defense", "Specialty Industrial Machinery", "Conglomerates"]},
}

SECTOR_FALLBACK_SYMBOLS: Dict[str, Sequence[str]] = {
    "technology_services": [
        "AAPL", "MSFT", "GOOGL", "AMZN", "META", "CRM", "ADBE", "ORCL", "INTU", "NOW",
        "SNOW", "TEAM", "UBER", "SQ", "SHOP", "PANW", "FTNT", "CRWD", "ZS", "DDOG",
        "MDB", "OKTA", "NET", "DOCU", "TWLO", "WDAY", "BILL", "RNG", "HUBS", "SAP",
        "VMW", "IBM", "TXN", "AVGO", "QCOM", "AMD", "NVDA", "NFLX", "ASML", "INTC",
        "MU", "ADI", "NXPI", "MRVL", "LRCX", "KLAC", "AMAT", "SNPS", "CDNS", "APH",
    ],
    "electronic_technology": [
        "NVDA", "AMD", "AVGO", "TXN", "QCOM", "INTC", "MU", "ASML", "LRCX", "KLAC",
        "AMAT", "NXPI", "MRVL", "ADI", "ON", "TSM", "STM", "MCHP", "WDC", "STX",
        "APH", "TEL", "GLW", "LOGI", "HPQ", "DELL", "CSCO", "ANET", "FFIV", "JNPR",
        "KEYS", "TTMI", "JBL", "FLEX", "SANM", "SMTC", "QRVO", "SWKS", "SYNA", "OLED",
        "SLAB", "LSCC", "MPWR", "TER", "COHR", "AEHR", "PLAB", "AMKR", "SGH", "VIAV",
    ],
    "finance": [
        "JPM", "BAC", "C", "WFC", "GS", "MS", "USB", "PNC", "TD", "BK",
        "SCHW", "CB", "AXP", "COF", "DFS", "BLK", "TROW", "BEN", "SPGI", "MCO",
        "ICE", "CME", "NDAQ", "MMC", "AIG", "MET", "PRU", "LNC", "ALL", "PGR",
        "TRV", "CINF", "HIG", "L", "MTB", "FITB", "KEY", "RF", "CFG", "HBAN",
        "ALLY", "CIB", "BMO", "BNS", "RY", "ING", "UBS", "HSBC", "TDOC", "KBWB",
    ],
    "health_technology": [
        "UNH", "JNJ", "PFE", "MRK", "ABBV", "LLY", "TMO", "DHR", "ABT", "BMY",
        "AMGN", "GILD", "CVS", "CI", "HUM", "ISRG", "SYK", "BSX", "BDX", "ZBH",
        "ALGN", "EW", "IDXX", "ILMN", "REGN", "VRTX", "BIIB", "MRNA", "PODD", "DXCM",
        "RMD", "SGEN", "ABC", "MCK", "CAH", "HCA", "UHS", "DGX", "LH", "HOLX",
        "TFX", "STE", "MTD", "WST", "OGN", "BAX", "PKI", "NVCR", "BGNE", "EXAS",
    ],
    "energy_minerals": [
        "XOM", "CVX", "COP", "EOG", "PXD", "SLB", "HAL", "BKR", "OXY", "DVN",
        "MPC", "PSX", "VLO", "HES", "FANG", "APA", "MRO", "CVE", "SU", "CNQ",
        "ENB", "TRP", "KMI", "WMB", "OKE", "LNG", "AR", "EQNR", "BP", "SHEL",
        "TOT", "EC", "YPF", "CRC", "SM", "MTDR", "MGY", "RRC", "SWN", "CHK",
        "CLR", "DK", "CVI", "PBF", "SUN", "TALO", "OAS", "NOG", "PR", "VTLE",
    ],
    "consumer": [
        "WMT", "TGT", "COST", "HD", "LOW", "SBUX", "MCD", "YUM", "CMG", "DRI",
        "DPZ", "KO", "PEP", "PG", "CL", "KMB", "MNST", "KDP", "MDLZ", "GIS",
        "K", "HSY", "TSLA", "F", "GM", "TM", "HMC", "NKE", "LULU", "ROST",
        "TJX", "BBY", "DG", "DLTR", "EBAY", "BKNG", "EXPE", "MAR", "HLT", "CCL",
        "NCLH", "RCL", "LEN", "PHM", "DHI", "NVR", "WHR", "MAT", "HAS", "ETSY",
    ],
    "industrial": [
        "BA", "CAT", "DE", "LMT", "NOC", "RTX", "GD", "HON", "MMM", "GE",
        "ETN", "EMR", "DOV", "ROP", "ROK", "ITW", "CMI", "PH", "PCAR", "UAL",
        "DAL", "LUV", "UNP", "NSC", "CSX", "ODFL", "JBHT", "CHRW", "UPS", "FDX",
        "RSG", "WM", "TXT", "FAST", "GWW", "ALLE", "IR", "TT", "OTIS", "CARR",
        "JCI", "AME", "LHX", "TDG", "HEI", "SWK", "MAS", "LENNAR", "BALL", "WAB",
    ],
}

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
}


class ScreenerError(RuntimeError):
    """Raised when the Yahoo Finance screener request fails."""


def _build_filter_operands(
    sectors: Sequence[str], industries: Optional[Sequence[str]], region: str
) -> List[Dict[str, object]]:
    operands: List[Dict[str, object]] = []
    if sectors:
        sector_operands = [
            {"operator": "and", "operands": [{"field": "sector", "operator": "eq", "value": sector}]}
            for sector in sectors
        ]
        operands.append({"operator": "or", "operands": sector_operands})
    if industries:
        industry_operands = [
            {"operator": "and", "operands": [{"field": "industry", "operator": "eq", "value": industry}]}
            for industry in industries
        ]
        operands.append({"operator": "or", "operands": industry_operands})
    operands.append(
        {
            "operator": "or",
            "operands": [
                {"operator": "and", "operands": [{"field": "region", "operator": "eq", "value": region.lower()}]}
            ],
        }
    )
    return operands


def _fetch_crumb(session: requests.Session) -> str:
    session.get(
        "https://finance.yahoo.com",
        headers=DEFAULT_HEADERS,
        timeout=30,
    )
    response = session.get(
        "https://query1.finance.yahoo.com/v1/test/getcrumb",
        headers=DEFAULT_HEADERS,
        timeout=30,
    )
    response.raise_for_status()
    crumb = response.text.strip()
    if not crumb:
        raise RuntimeError("Yahoo Finance crumb endpoint returned empty response.")
    return crumb


def fetch_sector_symbols(
    sector_key: str,
    *,
    region: str = "us",
    page_size: int = 250,
    max_pages: int = 40,
    request_delay: Tuple[float, float] = (0.3, 0.5),
    session: Optional[requests.Session] = None,
) -> List[str]:
    """
    Fetch symbols for the configured sector using Yahoo's Screener API.

    Parameters
    ----------
    sector_key:
        Sector identifier as defined in SECTOR_MAPPING.
    region:
        Two-letter country/region code (default: "us").
    page_size:
        Number of entries to request per page (default: 250).
    max_pages:
        Maximum number of pages to fetch to avoid infinite loops.
    request_delay:
        Tuple controlling min/max sleep between requests for rate limiting.
    session:
        Optional requests.Session for connection pooling in tests.
    """

    if sector_key not in SECTOR_MAPPING:
        raise ValueError(f"Sector '{sector_key}' not defined in Yahoo sector mapping.")

    mapping = SECTOR_MAPPING[sector_key]
    sectors = mapping.get("sectors", [])
    industries = mapping.get("industries", [])

    operands = _build_filter_operands(sectors, industries, region)
    collected: List[str] = []
    offset = 0
    delay_min, delay_max = request_delay
    delay_min = max(0.0, delay_min)
    delay_max = max(delay_min, delay_max)

    session_obj = session or requests.Session()
    crumb = getattr(session_obj, "_yahoo_crumb", None)
    if not crumb:
        crumb = _fetch_crumb(session_obj)
        setattr(session_obj, "_yahoo_crumb", crumb)

    for page in range(max_pages):
        payload = {
            "offset": offset,
            "size": page_size,
            "sortField": "marketCap",
            "sortType": "DESC",
            "quoteType": "EQUITY",
            "query": {"operator": "and", "operands": operands},
        }

        response = session_obj.post(
            YAHOO_SCREENER_URL,
            params={"crumb": crumb},
            json=payload,
            headers=DEFAULT_HEADERS,
            timeout=30,
        )

        if response.status_code == 401 and "Invalid Crumb" in response.text:
            crumb = _fetch_crumb(session_obj)
            setattr(session_obj, "_yahoo_crumb", crumb)
            response = session_obj.post(
                YAHOO_SCREENER_URL,
                params={"crumb": crumb},
                json=payload,
                headers=DEFAULT_HEADERS,
                timeout=30,
            )

        if response.status_code == 429:
            logger.warning("Yahoo Finance Screener rate limit encountered for sector %s; backing off.", sector_key)
            time.sleep(delay_max * 2)
            continue

        if response.status_code >= 500:
            logger.error(
                "Yahoo Finance Screener server error (%s) for sector %s: %s",
                response.status_code,
                sector_key,
                response.text[:200],
            )
            time.sleep(delay_max)
            continue

        if response.status_code != 200:
            raise ScreenerError(
                f"Screener request failed for sector {sector_key} ({response.status_code}): {response.text[:200]}"
            )

        payload_json = response.json()
        results = payload_json.get("finance", {}).get("result", [])
        if not results:
            break

        quotes = results[0].get("quotes", [])
        if not quotes:
            break

        for quote in quotes:
            symbol = quote.get("symbol")
            if symbol:
                collected.append(symbol.strip().upper())

        if len(quotes) < page_size:
            break

        offset += page_size
        sleep_time = random.uniform(delay_min, delay_max)
        time.sleep(sleep_time)

    return sorted(set(collected))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate sector-based stock catalogs.")
    parser.add_argument("--config", type=Path, required=True, help="Path to data_config.yaml.")
    parser.add_argument(
        "--target-count",
        type=int,
        default=50,
        help="Default number of stocks to sample per sector when not specified in config.",
    )
    parser.add_argument("--region", type=str, default="us", help="Yahoo Finance region code (default: us).")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducible sampling.")
    return parser.parse_args()


def _resolve_catalog_directory(catalog_path: Path) -> Path:
    stocks_dir = catalog_path / "stocks"
    stocks_dir.mkdir(parents=True, exist_ok=True)
    return stocks_dir


def _resolve_reference_path(base: Path, reference: str) -> Path:
    reference_path = Path(reference)
    if reference_path.is_absolute():
        return reference_path
    parts = list(reference_path.parts)
    if parts and parts[0].lower() == "catalog":
        reference_path = Path(*parts[1:]) if len(parts) > 1 else Path()
    return (base / reference_path).resolve()


def generate_catalogs(args: argparse.Namespace) -> None:
    if args.seed is not None:
        random.seed(args.seed)

    load_environment()

    raw_config = yaml.safe_load(args.config.read_text())
    config = resolve_env_placeholders(raw_config)

    storage_cfg = config.get("storage", {})
    catalog_base = Path(storage_cfg.get("catalog_path", "./data/catalog")).resolve()
    stocks_dir = _resolve_catalog_directory(catalog_base)

    assets_cfg = config.get("assets", {}).get("stocks", {})
    sectors_cfg = assets_cfg.get("sectors", {})

    if not sectors_cfg:
        logger.error("No sectors configuration found under assets.stocks.sectors.")
        raise SystemExit(1)

    created_files: List[Path] = []
    total_symbols = 0
    missing_mappings: Set[str] = set()

    for sector_key, sector_cfg in sectors_cfg.items():
        target_count = int(sector_cfg.get("target_count") or args.target_count)
        reference = sector_cfg.get("universe_reference")
        if not reference:
            logger.warning("Sector %s missing universe_reference; skipping.", sector_key)
            continue

        if sector_key not in SECTOR_MAPPING:
            logger.error(
                "Sector %s not present in Yahoo sector mapping. Add it to SECTOR_MAPPING before rerunning.", sector_key
            )
            missing_mappings.add(sector_key)
            continue

        try:
            available_symbols = fetch_sector_symbols(sector_key, region=args.region)
        except Exception as exc:  # pylint: disable=broad-except
            logger.exception("Failed to fetch symbols for sector %s: %s", sector_key, exc)
            fallback = SECTOR_FALLBACK_SYMBOLS.get(sector_key, [])
            if fallback:
                logger.warning(
                    "Using fallback ticker list for sector %s (%d symbols) due to API failure.",
                    sector_key,
                    len(fallback),
                )
                available_symbols = list(fallback)
            else:
                continue

        unique_symbols = sorted(set(available_symbols))
        total_available = len(unique_symbols)
        if total_available == 0:
            fallback = SECTOR_FALLBACK_SYMBOLS.get(sector_key, [])
            if fallback:
                logger.warning(
                    "No symbols returned for sector %s from API; using fallback list (%d symbols).",
                    sector_key,
                    len(fallback),
                )
                unique_symbols = sorted(set(fallback))
                total_available = len(unique_symbols)
            else:
                logger.warning("No symbols returned for sector %s; skipping.", sector_key)
                continue

        if total_available < target_count:
            logger.warning(
                "Only %d symbols available for sector %s (target %d). Using all available symbols.",
                total_available,
                sector_key,
                target_count,
            )
            sampled_symbols = unique_symbols
        else:
            sampled_symbols = random.sample(unique_symbols, target_count)

        reference_path = _resolve_reference_path(catalog_base, reference)
        reference_path.parent.mkdir(parents=True, exist_ok=True)

        frame = pd.DataFrame({"symbol": sorted(sampled_symbols)})
        frame.to_csv(reference_path, index=False)

        created_files.append(reference_path)
        total_symbols += len(sampled_symbols)
        logger.info(
            "Generated catalog for sector %s at %s with %d symbols (available=%d).",
            sector_key,
            reference_path,
            len(sampled_symbols),
            total_available,
        )

    if missing_mappings:
        logger.error("Missing Yahoo Screener mappings for sectors: %s", ", ".join(sorted(missing_mappings)))
        raise SystemExit(2)

    if not created_files:
        logger.error(
            "No sector catalogs were generated. Verify network connectivity and sector mappings, then rerun the generator."
        )
        raise SystemExit(3)

    logger.info(
        "Catalog generation complete: %d sector files created, %d symbols total.",
        len(created_files),
        total_symbols,
    )
    for path in created_files:
        logger.info("  - %s", path)


def main() -> None:
    args = parse_args()
    try:
        generate_catalogs(args)
    except SystemExit:
        raise
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to generate stock catalogs.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()


