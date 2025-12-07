"""
Experiment tracking integrations (W&B, TensorBoard, LangSmith).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


logger = logging.getLogger(__name__)


@dataclass
class WandBLogger:
    """Wrapper for Weights & Biases logging."""

    project: str
    entity: Optional[str] = None
    run: Any = None

    def init(self, config: Dict[str, Any]) -> None:
        logger.info("Initializing W&B run for project %s", self.project)

    def log(self, data: Dict[str, Any]) -> None:
        logger.debug("Logging to W&B: %s", data)

    def log_table(self, name: str, data: Any) -> None:
        logger.debug("Logging table %s", name)

    def log_chart(self, name: str, figure: Any) -> None:
        logger.debug("Logging chart %s", name)

    def create_dashboard(self, name: str) -> None:
        logger.info("Creating W&B dashboard %s", name)

    def finish(self) -> None:
        logger.info("Finishing W&B run")


@dataclass
class TensorBoardLogger:
    """TensorBoard SummaryWriter wrapper."""

    log_dir: str
    writer: Any = None

    def init(self) -> None:
        logger.info("Initializing TensorBoard writer at %s", self.log_dir)

    def log_scalar(self, tag: str, value: float, step: int) -> None:
        logger.debug("Logging scalar %s=%f at step %d", tag, value, step)

    def log_histogram(self, tag: str, values: Any, step: int) -> None:
        logger.debug("Logging histogram %s at step %d", tag, step)

    def log_distribution(self, tag: str, values: Any, step: int) -> None:
        logger.debug("Logging distribution %s at step %d", tag, step)

    def close(self) -> None:
        logger.info("Closing TensorBoard writer")


@dataclass
class LangSmithTracer:
    """LangSmith tracing for LangGraph workflows."""

    api_key: Optional[str] = None
    tracing_enabled: bool = False

    def enable_tracing(self) -> None:
        logger.info("Enabling LangSmith tracing")
        self.tracing_enabled = True

    def log_trace(self, trace: Dict[str, Any]) -> None:
        if self.tracing_enabled:
            logger.debug("Logging LangSmith trace %s", trace)

    def create_trace_link(self, run_id: str) -> str:
        return f"https://smith.langchain.com/runs/{run_id}"


@dataclass
class ExperimentTracker:
    """Centralized interface combining W&B, TensorBoard, and LangSmith."""

    wandb_logger: WandBLogger
    tensorboard_logger: TensorBoardLogger
    langsmith_tracer: LangSmithTracer
    run_config: Dict[str, Any] = field(default_factory=dict)

    def start(self) -> None:
        logger.info("Starting experiment tracker session")
        self.wandb_logger.init(self.run_config)
        self.tensorboard_logger.init()
        if self.langsmith_tracer.api_key:
            self.langsmith_tracer.enable_tracing()

    def log_metrics(self, metrics: Dict[str, Any], step: int | None = None) -> None:
        logger.debug("Logging metrics %s", metrics)
        self.wandb_logger.log(metrics)
        if step is not None:
            for key, value in metrics.items():
                self.tensorboard_logger.log_scalar(key, value, step)

    def log_hyperparameters(self, params: Dict[str, Any]) -> None:
        logger.debug("Logging hyperparameters %s", params)
        self.wandb_logger.log({"hyperparameters": params})

    def log_artifact(self, path: str, name: str) -> None:
        logger.info("Logging artifact %s at %s", name, path)

    def log_figure(self, name: str, figure: Any) -> None:
        self.wandb_logger.log_chart(name, figure)

    def finish(self) -> None:
        self.wandb_logger.finish()
        self.tensorboard_logger.close()
