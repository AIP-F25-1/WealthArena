"""
Macroeconomic feature engineering utilities.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, Iterable, Optional

import pandas as pd


logger = logging.getLogger(__name__)


@dataclass
class MacroFeatures:
    """Produce macroeconomic features from FRED and related sources."""

    resample_frequency: str = "1d"

    def load_fred_data(self, series: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        logger.info("Loading %d FRED series", len(series))
        merged = pd.concat(series.values(), axis=1)
        merged.columns = series.keys()
        return merged

    def compute_changes(self, frame: pd.DataFrame) -> pd.DataFrame:
        logger.debug("Computing macro changes (MoM, YoY, WoW)")
        result = frame.copy()
        result = result.resample(self.resample_frequency).ffill()
        result = result.assign(
            **{f"{col}_mom": result[col].pct_change(30) for col in result.columns},
            **{f"{col}_yoy": result[col].pct_change(252) for col in result.columns},
        )
        return result

    def create_regime_features(self, frame: pd.DataFrame) -> pd.DataFrame:
        logger.debug("Creating macro regime indicators")
        result = frame.copy()
        result["yield_curve_slope"] = frame["DGS10"] - frame["DGS2"]
        result["inflation_pressure"] = frame["CPIAUCSL"].pct_change(12)
        return result

    def resample_to_daily(self, frame: pd.DataFrame) -> pd.DataFrame:
        return frame.resample("1d").ffill()


@dataclass
class VIXProcessor:
    """Derive implied volatility features from VIX series."""

    term_structure_columns: Optional[Iterable[str]] = None

    def compute_vix_features(self, frame: pd.DataFrame) -> pd.DataFrame:
        logger.debug("Computing VIX features")
        frame = frame.copy()
        frame["vix_change_5"] = frame["VIXCLS"].pct_change(5)
        frame["vix_momentum_10"] = frame["VIXCLS"].diff(10)
        return frame

    def compute_term_structure(self, frame: pd.DataFrame) -> pd.DataFrame:
        if not self.term_structure_columns:
            return frame
        logger.debug("Computing VIX term structure")
        frame = frame.copy()
        cols = list(self.term_structure_columns)
        for i in range(len(cols) - 1):
            near = cols[i]
            far = cols[i + 1]
            frame[f"term_structure_{near}_{far}"] = frame[far] - frame[near]
        return frame
