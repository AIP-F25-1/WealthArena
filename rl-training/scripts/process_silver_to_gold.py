"""Run Silver → Gold feature engineering pipeline."""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import yaml

from src.data import SilverToGoldProcessor
from src.utils import get_logger


logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Process Silver data to Gold layer.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--assets", type=str, default="all")
    parser.add_argument("--stage", type=str, default="all", choices=["technical", "sentiment", "macro", "correlation", "all"])
    parser.add_argument("--validate", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = yaml.safe_load(args.config.read_text())
    processor = SilverToGoldProcessor(
        silver_path=config["storage"]["silver_path"],
        gold_path=config["storage"]["gold_path"],
        feature_config=config.get("feature_config", {}),
    )
    logger.info("Processing Silver→Gold stage=%s assets=%s", args.stage, args.assets)
    
    # Determine which asset classes to process
    silver_root = Path(config["storage"]["silver_path"])
    available_asset_classes = set()
    if silver_root.exists():
        for item in silver_root.iterdir():
            if item.is_dir() and list(item.glob("*.parquet")):
                available_asset_classes.add(item.name)
    
    if args.assets.lower() == "all":
        asset_classes = available_asset_classes
    else:
        asset_classes = {asset.strip() for asset in args.assets.split(",") if asset.strip()}
        asset_classes = asset_classes & available_asset_classes
    
    if not asset_classes:
        logger.warning("No asset classes available in Silver layer. Ensure Bronze→Silver processing has been completed.")
        return
    
    logger.info("Available asset classes in Silver: %s", sorted(available_asset_classes))
    logger.info("Processing asset classes: %s", sorted(asset_classes))
    
    # Track results
    stage_results = {}
    
    # Execute feature pipelines based on stage selection
    stages_to_run = []
    if args.stage == "all":
        stages_to_run = ["technical", "sentiment", "macro", "correlation"]
    else:
        stages_to_run = [args.stage]
    
    for stage in stages_to_run:
        logger.info("=" * 60)
        logger.info("Starting stage: %s", stage)
        logger.info("=" * 60)
        start_time = time.time()
        
        try:
            if stage == "technical":
                # Process technical features for each asset class
                for asset_class in sorted(asset_classes):
                    if asset_class in ("stocks", "forex", "crypto", "etfs", "commodities"):
                        try:
                            outputs = processor.compute_technical_features(asset_class)
                            logger.info("Computed technical features for %s: %d files", asset_class, len(outputs))
                            stage_results[f"{stage}_{asset_class}"] = "success"
                        except Exception as exc:
                            logger.exception("Error computing technical features for %s: %s", asset_class, exc)
                            # Don't fail entire stage - continue with other asset classes
                            stage_results[f"{stage}_{asset_class}"] = f"failed: {exc}"
                            logger.warning("Continuing with remaining asset classes despite error in %s", asset_class)
            
            elif stage == "sentiment":
                # Process sentiment features
                for asset_class in ["sentiment", "news", "social"]:
                    if asset_class in available_asset_classes:
                        try:
                            outputs = processor.compute_sentiment_features(asset_class)
                            logger.info("Computed sentiment features for %s: %d files", asset_class, len(outputs))
                            stage_results[f"{stage}_{asset_class}"] = "success"
                        except Exception as exc:
                            logger.exception("Error computing sentiment features for %s: %s", asset_class, exc)
                            stage_results[f"{stage}_{asset_class}"] = f"failed: {exc}"
            
            elif stage == "macro":
                # Process macro features
                if "macro" in available_asset_classes:
                    try:
                        output_path = processor.compute_macro_features()
                        logger.info("Computed macro features: %s", output_path)
                        stage_results[stage] = "success"
                    except FileNotFoundError:
                        logger.warning("Macro Silver data not found. Skipping macro features.")
                        stage_results[stage] = "skipped: no data"
                    except Exception as exc:
                        logger.exception("Error computing macro features: %s", exc)
                        stage_results[stage] = f"failed: {exc}"
                else:
                    logger.warning("Macro Silver data not available. Skipping macro features.")
                    stage_results[stage] = "skipped: no data"
            
            elif stage == "correlation":
                # Process correlation features
                if "stocks" in available_asset_classes:
                    try:
                        output_path = processor.compute_correlation_features()
                        logger.info("Computed correlation features: %s", output_path)
                        stage_results[stage] = "success"
                    except FileNotFoundError:
                        logger.warning("Stocks Silver data not found. Skipping correlation features.")
                        stage_results[stage] = "skipped: no data"
                    except Exception as exc:
                        logger.exception("Error computing correlation features: %s", exc)
                        stage_results[stage] = f"failed: {exc}"
                else:
                    logger.warning("Stocks Silver data not available. Skipping correlation features.")
                    stage_results[stage] = "skipped: no data"
            
            elapsed = time.time() - start_time
            logger.info("Completed stage '%s' in %.2f seconds", stage, elapsed)
            
        except Exception as exc:
            logger.exception("Fatal error in stage '%s': %s", stage, exc)
            stage_results[stage] = f"failed: {exc}"
    
    # Final summary
    logger.info("=" * 60)
    logger.info("Silver→Gold Processing Summary")
    logger.info("=" * 60)
    successful = sum(1 for status in stage_results.values() if status == "success")
    failed = sum(1 for status in stage_results.values() if "failed" in status)
    skipped = sum(1 for status in stage_results.values() if "skipped" in status)
    
    logger.info("Total stages/asset combinations: %d", len(stage_results))
    logger.info("Successful: %d", successful)
    logger.info("Failed: %d", failed)
    logger.info("Skipped: %d", skipped)
    
    if failed > 0:
        failed_items = [item for item, status in stage_results.items() if "failed" in status]
        logger.warning("Failed items: %s", failed_items)
    
    # Validate Gold outputs
    gold_root = Path(config["storage"]["gold_path"])
    if gold_root.exists():
        gold_files = list(gold_root.rglob("*.parquet"))
        logger.info("Total Gold files created: %d", len(gold_files))
    else:
        logger.warning("Gold directory was not created")


if __name__ == "__main__":
    main()
