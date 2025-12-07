"""Test Monte Carlo simulator basic behavior."""

import numpy as np
import pandas as pd

from src.backtesting import MonteCarloSimulator


def test_parametric_simulation_shape():
    returns = pd.Series(np.random.normal(0, 0.01, size=100))
    simulator = MonteCarloSimulator(returns=returns, num_simulations=100)
    sims = simulator.parametric_simulation()
    assert sims.shape == (100, 100)
