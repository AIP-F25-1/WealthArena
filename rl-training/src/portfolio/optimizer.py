"""
Portfolio optimization utilities leveraging classical and modern methods.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


logger = logging.getLogger(__name__)


def _ensure_covariance(returns: pd.DataFrame, cov_matrix: Optional[pd.DataFrame]) -> pd.DataFrame:
    if cov_matrix is not None:
        return cov_matrix
    logger.debug("Covariance matrix not provided; computing sample covariance.")
    return returns.cov()


def _normalize_weights(raw: np.ndarray) -> np.ndarray:
    total = raw.sum()
    if total == 0 or not np.isfinite(total):
        logger.warning("Weights sum to zero or are non-finite; defaulting to equal weights.")
        return np.full(raw.shape, 1.0 / len(raw))
    return raw / total


@dataclass
class PortfolioOptimizer:
    """Mean-variance style optimizations via closed-form solutions."""

    returns: pd.DataFrame
    cov_matrix: Optional[pd.DataFrame] = None
    regularization: float = 1e-6

    def _prepare_inputs(self) -> Tuple[np.ndarray, np.ndarray]:
        if self.returns.empty:
            raise ValueError("Returns DataFrame is empty; cannot perform optimization.")
        cov = _ensure_covariance(self.returns, self.cov_matrix).copy()
        cov.values.flat[:: cov.shape[0] + 1] += self.regularization
        mu = self.returns.mean().values
        return mu, cov.values

    def optimize_sharpe(self, risk_free_rate: float = 0.0) -> Dict[str, np.ndarray]:
        logger.info("Optimizing portfolio for maximal Sharpe ratio.")
        mu, cov = self._prepare_inputs()
        excess = mu - risk_free_rate
        try:
            raw_weights = np.linalg.solve(cov, excess)
        except np.linalg.LinAlgError:
            logger.exception("Covariance matrix is singular; falling back to pseudo-inverse.")
            raw_weights = np.linalg.pinv(cov) @ excess
        weights = _normalize_weights(raw_weights.clip(min=0))
        return {"weights": weights, "risk_free_rate": risk_free_rate}

    def optimize_min_volatility(self) -> Dict[str, np.ndarray]:
        logger.info("Optimizing portfolio for minimum volatility.")
        _, cov = self._prepare_inputs()
        ones = np.ones(cov.shape[0])
        try:
            raw_weights = np.linalg.solve(cov, ones)
        except np.linalg.LinAlgError:
            logger.exception("Covariance matrix is singular; falling back to pseudo-inverse.")
            raw_weights = np.linalg.pinv(cov) @ ones
        weights = _normalize_weights(raw_weights.clip(min=0))
        return {"weights": weights}

    def optimize_target_return(self, target_return: float) -> Dict[str, np.ndarray]:
        logger.info("Optimizing portfolio for target return %.4f.", target_return)
        mu, cov = self._prepare_inputs()
        ones = np.ones_like(mu)
        try:
            inv_cov = np.linalg.inv(cov)
        except np.linalg.LinAlgError:
            logger.exception("Covariance matrix is singular; falling back to pseudo-inverse.")
            inv_cov = np.linalg.pinv(cov)

        a = ones @ inv_cov @ ones
        b = ones @ inv_cov @ mu
        c = mu @ inv_cov @ mu
        det = a * c - b**2

        if np.isclose(det, 0):
            logger.warning("Target return system ill-conditioned; falling back to min-volatility weights.")
            return self.optimize_min_volatility()

        lambda_ = (c - b * target_return) / det
        gamma = (a * target_return - b) / det
        weights = inv_cov @ (lambda_ * ones + gamma * mu)
        weights = _normalize_weights(weights.clip(min=0))
        return {"weights": weights, "target_return": target_return}

    def optimize_risk_parity(self, tolerance: float = 1e-6, max_iter: int = 500) -> Dict[str, np.ndarray]:
        logger.info("Optimizing portfolio for equal risk contribution.")
        _, cov = self._prepare_inputs()
        n_assets = cov.shape[0]
        weights = np.full(n_assets, 1.0 / n_assets)

        for _ in range(max_iter):
            marginal = cov @ weights
            portfolio_var = weights @ marginal
            risk_contrib = weights * marginal
            target = portfolio_var / n_assets

            gradient = risk_contrib - target
            if np.linalg.norm(gradient, ord=1) < tolerance:
                break

            weights -= 0.01 * gradient
            weights = np.clip(weights, 0, None)
            weights = _normalize_weights(weights)

        return {"weights": weights, "tolerance": tolerance, "max_iter": max_iter}


@dataclass
class BlackLittermanOptimizer:
    """Black-Litterman model for blending market equilibrium with investor views."""

    market_weights: pd.Series
    cov_matrix: pd.DataFrame
    risk_aversion: float = 2.5
    tau: float = 0.025
    _views: List[Tuple[pd.Series, float]] = field(default_factory=list)

    def compute_equilibrium_returns(self) -> pd.Series:
        logger.debug("Computing implied equilibrium returns.")
        return self.risk_aversion * self.cov_matrix @ self.market_weights

    def add_view(self, view_vector: pd.Series, confidence: float) -> None:
        if not 0 < confidence <= 1:
            raise ValueError("Confidence must lie in the interval (0, 1].")
        aligned_view = view_vector.reindex(self.market_weights.index).fillna(0.0)
        self._views.append((aligned_view, confidence))
        logger.debug("Added view with confidence %.2f.", confidence)

    def compute_posterior(self) -> pd.Series:
        logger.info("Computing Black-Litterman posterior returns.")
        pi = self.compute_equilibrium_returns()
        if not self._views:
            return pi

        cov = self.cov_matrix
        tau_cov = self.tau * cov

        p_matrix = np.vstack([view.values for view, _ in self._views])
        q_vector = np.array([view.values @ self.market_weights.values for view, _ in self._views])
        omega = np.diag([1.0 / confidence for _, confidence in self._views])

        inv_term = np.linalg.inv(p_matrix @ tau_cov.values @ p_matrix.T + omega)
        adjustment = tau_cov.values @ p_matrix.T @ inv_term @ (q_vector - p_matrix @ pi.values)
        posterior = pi.values + adjustment
        return pd.Series(posterior, index=self.market_weights.index)

    def optimize(self) -> Dict[str, np.ndarray]:
        logger.info("Optimizing Black-Litterman portfolio.")
        posterior_returns = self.compute_posterior()
        optimizer = PortfolioOptimizer(
            returns=pd.DataFrame([posterior_returns.values], columns=posterior_returns.index)
        )
        result = optimizer.optimize_sharpe()
        return {"weights": result["weights"], "posterior_returns": posterior_returns.values}


@dataclass
class RiskParityOptimizer:
    """Equal risk contribution portfolio via convex-optimization heuristic."""

    cov_matrix: pd.DataFrame

    def optimize_erc(self, tolerance: float = 1e-6, max_iter: int = 500) -> Dict[str, np.ndarray]:
        if self.cov_matrix.empty:
            raise ValueError("Covariance matrix is empty; cannot compute ERC weights.")

        cov = self.cov_matrix.values.copy()
        cov.flat[:: cov.shape[0] + 1] += 1e-6

        n_assets = cov.shape[0]
        weights = np.full(n_assets, 1.0 / n_assets)
        risk_contrib = weights * (cov @ weights)

        for _ in range(max_iter):
            marginal = cov @ weights
            risk_contrib = weights * marginal
            total_risk = risk_contrib.sum()
            target = total_risk / n_assets

            gradient = risk_contrib - target
            if np.linalg.norm(gradient, ord=1) < tolerance:
                break

            weights -= 0.01 * gradient
            weights = np.clip(weights, 0, None)
            weights = _normalize_weights(weights)

        return {
            "weights": weights,
            "risk_contributions": risk_contrib,
            "tolerance": tolerance,
            "max_iter": max_iter,
        }

    def compute_risk_contributions(self, weights: np.ndarray) -> np.ndarray:
        if weights.ndim != 1:
            raise ValueError("Weights vector must be one-dimensional.")
        if len(weights) != self.cov_matrix.shape[0]:
            raise ValueError("Weights dimension does not match covariance matrix.")
        cov = self.cov_matrix.values.copy()
        cov.flat[:: cov.shape[0] + 1] += 1e-6
        marginal = cov @ weights
        return weights * marginal
