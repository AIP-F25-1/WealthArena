from __future__ import annotations

from dataclasses import dataclass

from src.backtesting.backtest_engine import BacktestEngine


@dataclass
class _StubBroker:
    initial_value: float = 100_000.0
    cash: float = 100_000.0
    commission: float = 0.0
    slippage_perc: float = 0.0

    def __post_init__(self) -> None:
        self.value = self.initial_value

    def setcommission(self, commission: float) -> None:
        self.commission = commission

    def set_slippage_perc(self, slippage: float) -> None:
        self.slippage_perc = slippage

    def getvalue(self) -> float:
        return self.value

    def getcash(self) -> float:
        return self.cash


class _StubCerebro:
    def __init__(self) -> None:
        self._broker = _StubBroker()
        self._result = ["OK"]

    def adddata(self, data) -> None:  # pragma: no cover - compatibility no-op
        _ = data

    def addstrategy(self, strategy, **kwargs) -> None:  # pragma: no cover - compatibility no-op
        _ = (strategy, kwargs)

    def getbroker(self) -> _StubBroker:
        return self._broker

    def run(self):
        self._broker.value += 5_000.0
        return self._result


def test_backtest_engine_run_produces_positive_pnl():
    cerebro = _StubCerebro()
    engine = BacktestEngine(cerebro=cerebro)

    results = engine.run()
    assert results == ["OK"]

    summary = engine.get_results()
    assert summary["final_value"] > cerebro.getbroker().initial_value
