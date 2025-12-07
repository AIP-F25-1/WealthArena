"""Test portfolio optimizer placeholders."""

import numpy as np
import pandas as pd

from src.portfolio import PortfolioOptimizer


def test_optimize_sharpe_constraints():
    returns = pd.DataFrame(
        {
            "asset_a": [0.01, 0.015, 0.02, 0.018, 0.022],
            "asset_b": [0.008, 0.009, 0.011, 0.012, 0.013],
            "asset_c": [0.012, 0.017, 0.019, 0.021, 0.024],
        }
    )
    optimizer = PortfolioOptimizer(returns=returns)
    result = optimizer.optimize_sharpe()
    weights = result["weights"]
    assert np.isclose(weights.sum(), 1.0, atol=1e-6)
    assert np.all(weights >= 0.0)
