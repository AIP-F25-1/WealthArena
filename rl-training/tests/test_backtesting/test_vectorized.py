from __future__ import annotations

import pandas as pd

from src.backtesting.transaction_costs import build_transaction_cost_model
from src.backtesting.vectorized_backtester import VectorizedBacktester


def test_vectorized_backtester_deducts_costs():
    dates = pd.date_range("2024-01-01", periods=5, freq="D")
    prices = pd.DataFrame({"A": [100, 101, 102, 103, 104]}, index=dates)
    signals = pd.DataFrame({"A": [0.0, 0.5, 0.5, 1.0, 0.2]}, index=dates)

    cost_model = build_transaction_cost_model(
        "stocks",
        {"stocks": {"commission_rate": 0.001, "spread_bps": 5, "slippage_rate": 0.0004}},
        {"square_root_coefficient": 0.1},
    )
    backtester = VectorizedBacktester(prices=prices, signals=signals, transaction_cost_model=cost_model)
    results = backtester.run()

    returns = results["returns"]
    costs = results["transaction_costs"]

    assert (costs >= 0).all()
    assert (returns <= prices.pct_change().fillna(0).sum(axis=1)).all()
    assert costs.sum() > 0
