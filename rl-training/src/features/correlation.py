"""
Cross-asset correlation and covariance utilities.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, Iterable, Optional

import numpy as np
import pandas as pd
from sklearn.covariance import LedoitWolf, OAS


logger = logging.getLogger(__name__)


@dataclass
class CorrelationEstimator:
    """Estimate rolling correlations and covariance matrices."""

    window: int = 126
    shrinkage: str = "ledoit_wolf"

    def compute_rolling_correlation(self, frame: pd.DataFrame) -> Dict[pd.Timestamp, pd.DataFrame]:
        logger.debug("Computing rolling correlation (window=%d)", self.window)
        correlations = {}
        for end_idx in range(self.window, len(frame)):
            sub = frame.iloc[end_idx - self.window : end_idx]
            correlations[sub.index[-1]] = sub.corr()
        return correlations

    def compute_rolling_covariance(self, frame: pd.DataFrame) -> Dict[pd.Timestamp, np.ndarray]:
        logger.debug("Computing rolling covariance (window=%d)", self.window)
        covariances = {}
        for end_idx in range(self.window, len(frame)):
            sub = frame.iloc[end_idx - self.window : end_idx]
            covariances[sub.index[-1]] = self._shrink_covariance(sub.values)
        return covariances

    def _shrink_covariance(self, data: np.ndarray) -> np.ndarray:
        if self.shrinkage == "ledoit_wolf":
            estimator = LedoitWolf().fit(data)
        elif self.shrinkage == "oas":
            estimator = OAS().fit(data)
        else:
            estimator = LedoitWolf().fit(data)
        return estimator.covariance_

    def compute_pca(self, cov_matrix: np.ndarray, retain_variance: float = 0.9) -> Dict[str, np.ndarray]:
        eigvals, eigvecs = np.linalg.eigh(cov_matrix)
        sorted_idx = np.argsort(eigvals)[::-1]
        eigvals = eigvals[sorted_idx]
        eigvecs = eigvecs[:, sorted_idx]
        cumulative = np.cumsum(eigvals) / np.sum(eigvals)
        k = np.searchsorted(cumulative, retain_variance) + 1
        return {"eigvals": eigvals[:k], "eigvecs": eigvecs[:, :k]}


@dataclass
class CrossAssetFeatures:
    """Extract features from correlation/covariance matrices."""

    def extract_correlation_features(self, corr_matrix: pd.DataFrame) -> Dict[str, float]:
        logger.debug("Extracting correlation features")
        abs_corr = corr_matrix.abs()
        return {
            "corr_max": abs_corr.values[np.triu_indices(len(abs_corr), k=1)].max(initial=0.0),
            "corr_min": abs_corr.values[np.triu_indices(len(abs_corr), k=1)].min(initial=0.0),
            "corr_mean": abs_corr.values[np.triu_indices(len(abs_corr), k=1)].mean(),
        }

    def compute_interdependencies(self, corr_matrix: pd.DataFrame) -> Dict[str, float]:
        sector_mean = corr_matrix.groupby(level=0, axis=0).mean().mean().mean()
        return {"sector_interdependence": float(sector_mean)}

    def analyze_etf_holdings(self, holdings_frame: pd.DataFrame) -> Dict[str, float]:
        logger.debug("Analyzing ETF holdings overlap")
        overlap = holdings_frame.T.corr().mean().mean()
        return {"etf_holdings_overlap": float(overlap)}


@dataclass
class CovarianceValidator:
    """Validate covariance matrices for positive semi-definiteness."""

    tolerance: float = 1e-6

    def validate_psd(self, cov_matrix: np.ndarray) -> bool:
        eigenvalues = np.linalg.eigvalsh(cov_matrix)
        is_psd = np.all(eigenvalues >= -self.tolerance)
        logger.debug("Covariance PSD check: %s", is_psd)
        return bool(is_psd)

    def fix_nonpositive_semidefinite(self, cov_matrix: np.ndarray) -> np.ndarray:
        eigvals, eigvecs = np.linalg.eigh(cov_matrix)
        eigvals[eigvals < self.tolerance] = self.tolerance
        return eigvecs @ np.diag(eigvals) @ eigvecs.T
