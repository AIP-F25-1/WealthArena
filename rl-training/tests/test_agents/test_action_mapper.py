from __future__ import annotations

import numpy as np

from src.agents.sac_meta_controller import PortfolioActionMapper


def test_mapper_projects_to_simplex() -> None:
    mapper = PortfolioActionMapper(allow_short=False)
    weights = mapper.map_to_weights(np.array([2.0, 1.0, 0.5]))
    constrained = mapper.apply_constraints(weights)
    assert np.all(constrained >= 0.0)
    assert np.isclose(constrained.sum(), 1.0)


def test_mapper_respects_leverage_limit() -> None:
    mapper = PortfolioActionMapper(leverage_limit=1.0, allow_short=True)
    weights = mapper.map_to_weights(np.array([10.0, -10.0]))
    constrained = mapper.apply_constraints(weights)
    assert np.isclose(np.abs(constrained).sum(), 1.0)

