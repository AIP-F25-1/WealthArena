"""
Utility helpers for logging, configuration, and shared functionality.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Optional

from dotenv import load_dotenv

from .api_keys import ApiKeyManager, DailyQuota  # noqa: F401


_PLACEHOLDER_PATTERN = re.compile(r"\$\{([^:}]+)(?::-(.*?))?\}")


def _resolve_level(level_name: Optional[str]) -> int:
    if not level_name:
        return logging.INFO
    level_name = level_name.upper()
    if level_name.isdigit():
        return int(level_name)
    return getattr(logging, level_name, logging.INFO)


def _replace_placeholder(match: re.Match[str]) -> str:
    variable = match.group(1)
    default = match.group(2)
    return os.getenv(variable, default if default is not None else "")


def load_environment(dotenv_path: Optional[str] = None) -> None:
    """Load environment variables from a .env file if present."""
    load_dotenv(dotenv_path, override=False)


def resolve_env_placeholders(value: Any) -> Any:
    """Recursively resolve ${VAR:-default} placeholders using environment variables."""
    if isinstance(value, dict):
        return {key: resolve_env_placeholders(val) for key, val in value.items()}
    if isinstance(value, list):
        return [resolve_env_placeholders(item) for item in value]
    if isinstance(value, str):
        return _PLACEHOLDER_PATTERN.sub(_replace_placeholder, value)
    return value


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger that respects environment-level settings."""
    logger = logging.getLogger(name)

    log_format = os.getenv("LOG_FORMAT", "[%(asctime)s] %(levelname)s %(name)s: %(message)s")
    date_format = os.getenv("LOG_DATEFMT", "%Y-%m-%d %H:%M:%S")
    level = _resolve_level(os.getenv("LOG_LEVEL"))

    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(fmt=log_format, datefmt=date_format))
        logger.addHandler(handler)

    logger.setLevel(level)
    logger.propagate = False
    return logger
