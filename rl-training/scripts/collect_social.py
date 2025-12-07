"""Collect social media posts (Reddit/Twitter) for sentiment analysis."""

from __future__ import annotations

import argparse
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import os
import pandas as pd
import requests
import yaml

from src.data import SocialMediaCollector
from src.data.collectors import RateLimiter, _write_partitioned_frame  # type: ignore
from src.utils import get_logger, load_environment, resolve_env_placeholders


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect social media data.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--platform", choices=["reddit", "twitter"], default="reddit")
    parser.add_argument("--start-time", type=str, default=None)
    parser.add_argument("--end-time", type=str, default=None)
    parser.add_argument("--query", type=str, default=None)
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument(
        "--require-credentials",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Abort if required social platform credentials are missing.",
    )
    return parser.parse_args()


def _load_keywords_from_catalog(path: Path) -> List[str]:
    frame = pd.read_csv(path)
    column = None
    for candidate in frame.columns:
        if candidate.lower() in {"keyword", "keywords", "term"}:
            column = candidate
            break
    if column is None:
        column = frame.columns[0]
    keywords = frame[column].dropna().astype(str).str.strip().tolist()
    return sorted({keyword for keyword in keywords if keyword})


def _resolve_catalog_path(catalog_base: Path, reference: str) -> Path:
    reference_path = Path(reference)
    if reference_path.is_absolute():
        return reference_path.resolve()
    parts = list(reference_path.parts)
    if parts and parts[0].lower() == "catalog":
        reference_path = Path(*parts[1:]) if len(parts) > 1 else Path()
    return (catalog_base / reference_path).resolve()


def _parse_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    parsed = pd.to_datetime(value, utc=True, errors="coerce")
    if pd.isna(parsed):
        logger.warning("Unable to parse datetime value '%s'; ignoring.", value)
        return None
    return parsed.to_pydatetime()


def _fetch_reddit_via_json(
    subreddit: str,
    keyword: str,
    *,
    limit: int,
    bronze_root: Path,
    rate_limiter: Optional[RateLimiter] = None,
) -> int:
    # Apply rate limiting if provided
    if rate_limiter:
        rate_limiter.acquire()
    
    url = f"https://www.reddit.com/r/{subreddit}/search.json"
    params = {
        "q": keyword,
        "restrict_sr": "1",
        "sort": "new",
        "limit": str(max(1, min(limit, 100))),
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    try:
        response = requests.get(url, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        payload = response.json()
    except requests.exceptions.HTTPError as exc:
        if exc.response and exc.response.status_code == 429:
            logger.warning(
                "Reddit JSON fallback rate limited (429) for %s/%s. "
                "Rate limiting is active. Continuing with next request.",
                subreddit,
                keyword,
            )
            # Add a small delay when rate limited
            time.sleep(0.5)
        else:
            logger.warning("Reddit JSON fallback failed for %s/%s: %s", subreddit, keyword, exc)
        return 0
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Reddit JSON fallback failed for %s/%s: %s", subreddit, keyword, exc)
        return 0

    children = payload.get("data", {}).get("children", [])
    if not children:
        return 0

    records = []
    for child in children:
        data = child.get("data", {})
        created = data.get("created_utc")
        created_ts = pd.to_datetime(created, unit="s", utc=True, errors="coerce") if created is not None else None
        if pd.isna(created_ts):
            continue
        records.append(
            {
                "id": data.get("id"),
                "title": data.get("title"),
                "text": data.get("selftext", ""),
                "created_utc": created_ts,
                "score": data.get("score"),
                "num_comments": data.get("num_comments"),
                "url": data.get("url"),
                "subreddit": data.get("subreddit"),
                "author": data.get("author"),
            }
        )

    if not records:
        return 0

    frame = pd.DataFrame(records)
    frame = frame.set_index("created_utc").sort_index()
    identifier = f"{subreddit}_{keyword}".replace(" ", "_")
    metadata = {"platform": "reddit", "query": keyword, "subreddit": subreddit, "fallback": "reddit_json"}
    _write_partitioned_frame(frame, bronze_root, "social", "reddit_fallback", identifier, metadata)
    return frame.shape[0]


def main() -> None:
    args = parse_args()
    try:
        load_environment()
        raw_config = yaml.safe_load(args.config.read_text())
        config = resolve_env_placeholders(raw_config)

        storage_cfg = config.get("storage", {})
        bronze_root = Path(storage_cfg.get("bronze_path", "./data/bronze"))
        catalog_base = Path(storage_cfg.get("catalog_path", "./data/catalog"))

        social_cfg = config.get("assets", {}).get("social", {})
        platform = args.platform.lower()

        if platform == "reddit":
            reddit_cfg = social_cfg.get("reddit", {})
            subreddits = reddit_cfg.get("subreddits", [])
            if not subreddits:
                logger.error("No subreddits configured for Reddit collection; aborting.")
                raise SystemExit(1)

            keywords: List[str]
            if args.query:
                keywords = [args.query.strip()]
            else:
                reference = reddit_cfg.get("keywords_reference")
                if reference:
                    catalog_path = _resolve_catalog_path(catalog_base, reference)
                    if catalog_path.exists():
                        try:
                            keywords = _load_keywords_from_catalog(catalog_path)
                        except Exception:  # pylint: disable=broad-except
                            logger.exception("Failed to load Reddit keywords from %s", catalog_path)
                            keywords = ["stocks", "trading", "market", "earnings"]
                    else:
                        logger.warning("Reddit keywords catalog missing at %s; using defaults.", catalog_path)
                        keywords = ["stocks", "trading", "market", "earnings"]
                else:
                    keywords = ["stocks", "trading", "market", "earnings"]

            if not keywords:
                logger.error("No Reddit keywords resolved; aborting collection.")
                raise SystemExit(1)

            # Check for Reddit credentials and log status
            client_id = os.getenv("PRAW_CLIENT_ID") or os.getenv("REDDIT_CLIENT_ID")
            client_secret = os.getenv("PRAW_CLIENT_SECRET") or os.getenv("REDDIT_CLIENT_SECRET")
            user_agent = os.getenv("PRAW_USER_AGENT") or os.getenv("REDDIT_USER_AGENT")
            
            if not client_id or not client_secret:
                logger.info("Reddit credentials not configured, using unauthenticated JSON fallback API (limited data available)")
                if args.require_credentials:
                    logger.error(
                        "Reddit credentials required but not configured (missing PRAW_CLIENT_ID or PRAW_CLIENT_SECRET). "
                        "Aborting collection."
                    )
                    raise SystemExit(1)
                # Create a rate limiter for fallback JSON API (30-60 requests/minute)
                fallback_rate_limiter = RateLimiter(requests_per_interval=1, interval_seconds=2.0)  # ~30 requests/minute
                
                total_posts = 0
                for subreddit in subreddits:
                    for keyword in keywords:
                        total_posts += _fetch_reddit_via_json(
                            subreddit=subreddit,
                            keyword=keyword,
                            limit=args.limit,
                            bronze_root=bronze_root,
                            rate_limiter=fallback_rate_limiter,
                        )
                if total_posts:
                    logger.info(
                        "Collected %d Reddit posts using fallback JSON API across %d subreddits.",
                        total_posts,
                        len(subreddits),
                    )
                else:
                    logger.warning(
                        "No Reddit posts collected via fallback JSON API. "
                        "This is expected when Reddit rate limits unauthenticated requests. "
                        "The pipeline will continue without social media data."
                    )
                return
            elif not user_agent:
                # Client ID and secret are present, but user agent is missing
                logger.warning(
                    "Reddit credentials detected but REDDIT_USER_AGENT (or PRAW_USER_AGENT) is missing. "
                    "PRAW requires a user agent string. Falling back to JSON API."
                )
                if args.require_credentials:
                    logger.error(
                        "Reddit credentials required but REDDIT_USER_AGENT is missing. "
                        "Set REDDIT_USER_AGENT to a string like 'agentic-rl-trader/0.1 by <username>'. "
                        "Aborting collection."
                    )
                    raise SystemExit(1)
                # Fall back to JSON method
                client_id = None
                client_secret = None
                # Create a rate limiter for fallback JSON API (30-60 requests/minute)
                fallback_rate_limiter = RateLimiter(requests_per_interval=1, interval_seconds=2.0)  # ~30 requests/minute
                
                total_posts = 0
                for subreddit in subreddits:
                    for keyword in keywords:
                        total_posts += _fetch_reddit_via_json(
                            subreddit=subreddit,
                            keyword=keyword,
                            limit=args.limit,
                            bronze_root=bronze_root,
                            rate_limiter=fallback_rate_limiter,
                        )
                if total_posts:
                    logger.info(
                        "Collected %d Reddit posts using fallback JSON API across %d subreddits.",
                        total_posts,
                        len(subreddits),
                    )
                else:
                    logger.warning(
                        "No Reddit posts collected via fallback JSON API. "
                        "This is expected when Reddit rate limits unauthenticated requests. "
                        "The pipeline will continue without social media data."
                    )
                return

            # Credentials and user agent are available, use authenticated PRAW API
            logger.info("Reddit credentials and user agent detected, using authenticated PRAW API")
            rate_cfg = config.get("rate_limits", {}).get("reddit", {})
            rate_limiter = None
            requests_per_minute = rate_cfg.get("requests_per_minute")
            if requests_per_minute:
                per_second = max(1, int(requests_per_minute / 60))
                rate_limiter = RateLimiter(requests_per_interval=per_second, interval_seconds=1.0)

            collector = SocialMediaCollector(rate_limiter=rate_limiter)
            start_time = _parse_time(args.start_time) or _parse_time(reddit_cfg.get("start_date"))
            end_time = _parse_time(args.end_time)

            total_posts = 0
            for subreddit in subreddits:
                for keyword in keywords:
                    try:
                        payload = collector.collect(
                            platform="reddit",
                            query=keyword,
                            subreddit=subreddit,
                            start_time=start_time,
                            end_time=end_time,
                            limit=args.limit,
                            bronze_root=bronze_root,
                            asset_type="social",
                            metadata={"subreddit": subreddit},
                        )
                        total_posts += len(payload or [])
                    except Exception:  # pylint: disable=broad-except
                        logger.exception("Failed to collect Reddit posts for %s in %s", keyword, subreddit)
            if total_posts:
                logger.info("Collected %d Reddit posts across %d subreddits.", total_posts, len(subreddits))
            else:
                logger.warning(
                    "No Reddit posts collected. This may be due to rate limiting or no matching posts. "
                    "The pipeline will continue without social media data."
                )

        else:
            logger.warning(
                "Twitter collection is not implemented. Configure Twitter API v2 integration before enabling."
            )
    except Exception:
        logger.exception("Failed to collect social data.")
        raise


if __name__ == "__main__":
    main()
