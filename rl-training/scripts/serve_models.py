"""Package and serve trained models using BentoML."""

from __future__ import annotations

import argparse
from pathlib import Path

from src.serving import InferenceOptimizer, ModelRegistry, ModelServer
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve trained PPO/SAC models.")
    parser.add_argument("--models-dir", type=Path, default=Path("./models"))
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--serve", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    registry = ModelRegistry(store_path=str(args.models_dir))
    optimizer = InferenceOptimizer(cache={})
    server = ModelServer(registry=registry, optimizer=optimizer)
    logger.info("Packaging models from %s", args.models_dir)
    server.build_bento()
    if args.serve:
        server.serve(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
