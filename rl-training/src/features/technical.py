"""
Technical indicator computation utilities.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

import pandas as pd


logger = logging.getLogger(__name__)


@dataclass
class TechnicalIndicators:
    """Vectorized technical indicator factory."""

    price_columns: Optional[List[str]] = None
    volume_column: str = "volume"

    def compute_all(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Compute every configured indicator and return augmented DataFrame."""
        logger.info("Computing complete technical indicator set")
        frame = frame.copy()
        frame = self.compute_price_indicators(frame)
        frame = self.compute_volume_indicators(frame)
        frame = self.compute_volatility_indicators(frame)
        frame = self.compute_asset_specific(frame)
        return frame

    def compute_sma(self, series: pd.Series, window: int) -> pd.Series:
        """Compute a simple moving average, matching TA-Lib semantics when available."""
        logger.debug("Computing SMA (window=%d)", window)
        series = series.astype(float)
        try:
            import talib  # type: ignore

            values = talib.SMA(series.values, timeperiod=window)
            return pd.Series(values, index=series.index, dtype=float)
        except ImportError:  # pragma: no cover - TA-Lib optional
            return series.rolling(window).mean()

    def compute_ema(self, series: pd.Series, window: int) -> pd.Series:
        """Compute an exponential moving average using TA-Lib when available."""
        logger.debug("Computing EMA (window=%d)", window)
        series = series.astype(float)
        try:
            import talib  # type: ignore

            values = talib.EMA(series.values, timeperiod=window)
            return pd.Series(values, index=series.index, dtype=float)
        except ImportError:  # pragma: no cover - TA-Lib optional
            return series.ewm(span=window, adjust=False).mean()

    def compute_macd(
        self,
        series: pd.Series,
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9,
    ) -> pd.DataFrame:
        """Compute Moving Average Convergence Divergence (MACD)."""
        logger.debug(
            "Computing MACD (fast=%d, slow=%d, signal=%d)", fast_period, slow_period, signal_period
        )
        series = series.astype(float)

        try:
            import talib  # type: ignore

            macd, signal, hist = talib.MACD(
                series.values,
                fastperiod=fast_period,
                slowperiod=slow_period,
                signalperiod=signal_period,
            )
            macd_series = pd.Series(macd, index=series.index, dtype=float)
            signal_series = pd.Series(signal, index=series.index, dtype=float)
            hist_series = pd.Series(hist, index=series.index, dtype=float)
        except ImportError:  # pragma: no cover - TA-Lib optional
            ema_fast = series.ewm(span=fast_period, adjust=False).mean()
            ema_slow = series.ewm(span=slow_period, adjust=False).mean()
            macd_series = ema_fast - ema_slow
            signal_series = macd_series.ewm(span=signal_period, adjust=False).mean()
            hist_series = macd_series - signal_series

        return pd.DataFrame(
            {
                "macd_line": macd_series,
                "macd_signal": signal_series,
                "macd_hist": hist_series,
            }
        )

    def compute_price_indicators(self, frame: pd.DataFrame) -> pd.DataFrame:
        logger.debug("Computing price-based indicators")
        for window in [5, 10, 20, 50, 200]:
            frame[f"sma_{window}"] = self.compute_sma(frame["close"], window)
            frame[f"ema_{window}"] = self.compute_ema(frame["close"], window)
        frame["momentum_10"] = frame["close"].diff(10)
        frame["roc_10"] = frame["close"].pct_change(10)
        macd = self.compute_macd(frame["close"])
        frame["macd_line"] = macd["macd_line"]
        frame["macd_signal"] = macd["macd_signal"]
        frame["macd_hist"] = macd["macd_hist"]
        return frame

    def compute_volume_indicators(self, frame: pd.DataFrame) -> pd.DataFrame:
        logger.debug("Computing volume-based indicators")
        if self.volume_column in frame:
            frame["obv"] = (frame[self.volume_column] * frame["close"].pct_change().sign()).fillna(0).cumsum()
            frame["volume_zscore_20"] = (frame[self.volume_column] - frame[self.volume_column].rolling(20).mean()) / (
                frame[self.volume_column].rolling(20).std() + 1e-9
            )
        return frame

    def compute_volatility_indicators(self, frame: pd.DataFrame) -> pd.DataFrame:
        logger.debug("Computing volatility indicators")
        frame["atr_14"] = self._average_true_range(frame, window=14)
        frame["hist_vol_21"] = frame["close"].pct_change().rolling(21).std() * (252 ** 0.5)
        frame["bollinger_mid"] = frame["close"].rolling(20).mean()
        frame["bollinger_std"] = frame["close"].rolling(20).std()
        frame["bollinger_upper"] = frame["bollinger_mid"] + 2 * frame["bollinger_std"]
        frame["bollinger_lower"] = frame["bollinger_mid"] - 2 * frame["bollinger_std"]
        return frame

    def compute_asset_specific(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Placeholder for asset-class-specific indicators."""
        logger.debug("Computing asset-class-specific indicators (placeholder)")
        return frame

    @staticmethod
    def _average_true_range(frame: pd.DataFrame, window: int) -> pd.Series:
        high_low = frame["high"] - frame["low"]
        high_close = (frame["high"] - frame["close"].shift()).abs()
        low_close = (frame["low"] - frame["close"].shift()).abs()
        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        return true_range.rolling(window).mean()
