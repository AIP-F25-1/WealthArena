"""
Data processing utilities for Bronze → Silver → Gold transformations.

Includes schema standardization, feature computation, data validation, and
quality reporting utilities.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _ensure_iterable(values: Iterable[str]) -> List[str]:
    items = list(values)
    if not items:
        raise ValueError("Expected at least one identifier.")
    return items


def _load_bronze_tables(bronze_root: Path, asset_type: str, identifier: str) -> List[pd.DataFrame]:
    frames: List[pd.DataFrame] = []
    asset_root = bronze_root / asset_type
    if not asset_root.exists():
        logger.warning("Bronze asset directory %s does not exist", asset_root)
        return frames
    for source_dir in asset_root.iterdir():
        if not source_dir.is_dir():
            continue
        # For options, identifier might be in the filename pattern (e.g., AAPL_2024-01-19_call)
        # For other assets, identifier is a subdirectory
        if asset_type == "options":
            # Options are stored as {underlying}_{expiry}_{option_type}, so we need to match by underlying
            # Look for files that start with the underlying identifier
            for parquet_file in sorted(source_dir.rglob("*.parquet")):
                # Check if the file path contains the underlying identifier
                if identifier.upper() in parquet_file.stem.upper():
                    try:
                        frame = pd.read_parquet(parquet_file)
                        if not isinstance(frame.index, pd.DatetimeIndex):
                            frame.index = pd.to_datetime(frame.index, utc=True, errors="coerce")
                        frame = frame.dropna(how="all")
                        frames.append(frame)
                    except Exception as exc:
                        logger.warning("Failed to load parquet file %s: %s", parquet_file, exc)
                        continue
        else:
            # For forex, try both with and without =X suffix
            possible_dirs = [source_dir / identifier]
            if asset_type == "forex":
                # Try with =X suffix if identifier doesn't have it
                if "=X" not in identifier.upper():
                    possible_dirs.append(source_dir / f"{identifier}=X")
                # Try without =X suffix if identifier has it
                elif identifier.upper().endswith("=X"):
                    possible_dirs.append(source_dir / identifier.replace("=X", "").replace("=x", ""))
            
            for target_dir in possible_dirs:
                if not target_dir.exists():
                    continue
                for parquet_file in sorted(target_dir.rglob("*.parquet")):
                    try:
                        frame = pd.read_parquet(parquet_file)
                        if not isinstance(frame.index, pd.DatetimeIndex):
                            frame.index = pd.to_datetime(frame.index, utc=True, errors="coerce")
                        frame = frame.dropna(how="all")
                        frames.append(frame)
                    except Exception as exc:
                        logger.warning("Failed to load parquet file %s: %s", parquet_file, exc)
                        continue
                # If we found data in this directory, don't try the other variant
                if frames:
                    break
    return frames


def _consolidate(frames: List[pd.DataFrame]) -> pd.DataFrame:
    if not frames:
        return pd.DataFrame()
    combined = pd.concat(frames).sort_index()
    combined = combined[~combined.index.duplicated(keep="last")]
    return combined


@dataclass
class BronzeToSilverProcessor:
    """Standardizes raw Bronze-layer data into clean Silver datasets."""

    bronze_path: str
    silver_path: str
    catalog_path: Optional[str] = None
    repartition: bool = True
    audit_log: Optional[str] = None

    def __post_init__(self) -> None:
        self.bronze_root = Path(self.bronze_path)
        self.silver_root = Path(self.silver_path)
        self.silver_root.mkdir(parents=True, exist_ok=True)

    def _process_time_series(
        self,
        asset_type: str,
        identifiers: Iterable[str],
        expected_columns: Optional[Sequence[str]] = None,
    ) -> Dict[str, Path]:
        outputs: Dict[str, Path] = {}
        for identifier in _ensure_iterable(identifiers):
            frames = _load_bronze_tables(self.bronze_root, asset_type, identifier)
            if not frames:
                logger.warning("No Bronze data found for %s/%s", asset_type, identifier)
                continue
            combined = _consolidate(frames)
            if expected_columns:
                for column in expected_columns:
                    if column not in combined.columns:
                        combined[column] = pd.NA
            combined = combined.sort_index()
            output_dir = self.silver_root / asset_type
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{identifier.replace('/', '-')}.parquet"
            combined.to_parquet(output_path)
            outputs[identifier] = output_path
            logger.debug("Wrote Silver dataset %s", output_path)
        return outputs

    def process_stocks(self, symbols: Iterable[str]) -> Dict[str, Path]:
        logger.info("Processing Bronze→Silver stocks")
        return self._process_time_series(
            asset_type="stocks",
            identifiers=symbols,
            expected_columns=["open", "high", "low", "close", "adj close", "volume"],
        )

    def process_forex(self, pairs: Iterable[str]) -> Dict[str, Path]:
        logger.info("Processing Bronze→Silver forex pairs")
        return self._process_time_series(
            asset_type="forex",
            identifiers=pairs,
            expected_columns=["open", "high", "low", "close", "volume"],
        )

    def process_crypto(self, symbols: Iterable[str]) -> Dict[str, Path]:
        logger.info("Processing Bronze→Silver crypto symbols")
        return self._process_time_series(
            asset_type="crypto",
            identifiers=symbols,
            expected_columns=["open", "high", "low", "close", "volume"],
        )

    def process_etfs(self, symbols: Iterable[str]) -> Dict[str, Path]:
        logger.info("Processing Bronze→Silver ETFs")
        return self._process_time_series(
            asset_type="etfs",
            identifiers=symbols,
            expected_columns=["open", "high", "low", "close", "adj close", "volume"],
        )

    def process_commodities(self, symbols: Iterable[str]) -> Dict[str, Path]:
        logger.info("Processing Bronze→Silver commodities")
        return self._process_time_series(
            asset_type="commodities",
            identifiers=symbols,
            expected_columns=["open", "high", "low", "close", "volume"],
        )

    def process_options(self, underlyings: Iterable[str]) -> Dict[str, Path]:
        logger.info("Processing Bronze→Silver options")
        outputs: Dict[str, Path] = {}
        for underlying in _ensure_iterable(underlyings):
            frames = _load_bronze_tables(self.bronze_root, "options", underlying)
            if not frames:
                logger.warning("No options data found for underlying %s", underlying)
                continue
            
            # Consolidate all option chains (calls and puts across all expiries)
            combined = _consolidate(frames)
            if combined.empty:
                logger.warning("Consolidated options data is empty for %s", underlying)
                continue
            
            # Preserve option-specific columns
            expected_columns = ["strike", "expiry", "expiry_date", "expiry_timestamp", "option_type", 
                              "underlying", "underlying_price", "impliedVolatility", "volume", "openInterest"]
            for column in expected_columns:
                if column not in combined.columns:
                    combined[column] = pd.NA
            
            combined = combined.sort_index()
            output_dir = self.silver_root / "options"
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{underlying}_options.parquet"
            combined.to_parquet(output_path)
            outputs[underlying] = output_path
            logger.debug("Wrote Silver options dataset %s", output_path)
        return outputs

    def process_news(self, tickers: Iterable[str]) -> Dict[str, Path]:
        logger.info("Processing Bronze→Silver news")
        outputs: Dict[str, Path] = {}
        for ticker in _ensure_iterable(tickers):
            frames = _load_bronze_tables(self.bronze_root, "news", ticker)
            if not frames:
                logger.warning("No news data found for %s", ticker)
                continue
            
            combined = _consolidate(frames)
            if combined.empty:
                logger.warning("Consolidated news data is empty for %s", ticker)
                continue
            
            # Ensure required columns exist (don't add artificial timestamp column - use index)
            # The timestamp is already in the index from collectors
            expected_columns = ["ticker", "headline", "summary", "sentiment_score", "sentiment_label", "source", "url"]
            for column in expected_columns:
                if column not in combined.columns:
                    combined[column] = pd.NA
            
            combined = combined.sort_index()
            output_dir = self.silver_root / "news"
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{ticker}.parquet"
            combined.to_parquet(output_path)
            outputs[ticker] = output_path
            logger.debug("Wrote Silver news dataset %s", output_path)
        return outputs

    def process_social(self, queries: Iterable[str]) -> Dict[str, Path]:
        logger.info("Processing Bronze→Silver social media")
        outputs: Dict[str, Path] = {}
        for query in _ensure_iterable(queries):
            identifier = query.replace(" ", "_")
            frames = _load_bronze_tables(self.bronze_root, "social", identifier)
            if not frames:
                logger.warning("No social data found for query %s", query)
                continue
            
            combined = _consolidate(frames)
            if combined.empty:
                logger.warning("Consolidated social data is empty for %s", query)
                continue
            
            # Ensure required columns exist (don't add artificial timestamp column - use index)
            # The timestamp is in the index as 'created_utc' from collectors
            # If index is named 'created_utc', keep it; otherwise ensure we have the right columns
            expected_columns = ["text", "score", "platform", "id", "title", "url"]
            # Check if we have created_utc column (from collectors) or if it's in the index
            if "created_utc" in combined.columns:
                # Keep created_utc column as is
                pass
            elif combined.index.name == "created_utc" or (isinstance(combined.index, pd.DatetimeIndex) and combined.index.name is None):
                # Index is the timestamp, no need for separate column
                pass
            
            for column in expected_columns:
                if column not in combined.columns:
                    combined[column] = pd.NA
            
            combined = combined.sort_index()
            output_dir = self.silver_root / "social"
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{identifier}.parquet"
            combined.to_parquet(output_path)
            outputs[query] = output_path
            logger.debug("Wrote Silver social dataset %s", output_path)
        return outputs

    def process_sentiment(self, assets: Iterable[str]) -> Dict[str, Path]:
        logger.info("Processing Bronze→Silver sentiment assets")
        outputs: Dict[str, Path] = {}
        for asset in _ensure_iterable(assets):
            frames = _load_bronze_tables(self.bronze_root, "sentiment", asset)
            if not frames:
                logger.warning("No sentiment data found for %s", asset)
                continue
            combined = _consolidate(frames)
            if "text" in combined.columns:
                combined["text"] = combined["text"].fillna("")
            output_dir = self.silver_root / "sentiment"
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{asset}.parquet"
            combined.to_parquet(output_path)
            outputs[asset] = output_path
        return outputs

    def process_macro(self, series_ids: Iterable[str]) -> Dict[str, Path]:
        logger.info("Processing Bronze→Silver macro series")
        outputs: Dict[str, Path] = {}
        for series_id in _ensure_iterable(series_ids):
            frames = _load_bronze_tables(self.bronze_root, "macro", series_id)
            if not frames:
                logger.warning("No macro data found for %s", series_id)
                continue
            combined = _consolidate(frames).rename(columns={"value": series_id})
            output_dir = self.silver_root / "macro"
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{series_id}.parquet"
            combined.to_parquet(output_path)
            outputs[series_id] = output_path
        return outputs

    def validate_schema(self, dataset: pd.DataFrame, expected_schema: Dict[str, Any]) -> bool:
        """Validate schema of the cleaned dataset."""
        missing = [column for column in expected_schema if column not in dataset.columns]
        if missing:
            logger.error("Schema validation failed. Missing columns: %s", missing)
            return False
        return True


@dataclass
class SilverToGoldProcessor:
    """Computes features and aggregates Silver datasets into Gold artifacts."""

    silver_path: str
    gold_path: str
    feature_config: Dict[str, Any]
    cache_path: Optional[str] = None
    normalize: bool = True

    def __post_init__(self) -> None:
        self.silver_root = Path(self.silver_path)
        self.gold_root = Path(self.gold_path)
        self.gold_root.mkdir(parents=True, exist_ok=True)

    def _load_silver_files(self, asset_class: str) -> List[Path]:
        asset_dir = self.silver_root / asset_class
        if not asset_dir.exists():
            logger.warning("Silver asset directory %s missing", asset_dir)
            return []
        files = sorted(asset_dir.glob("*.parquet"))
        if not files:
            logger.warning("No Silver files found in %s", asset_dir)
        return files

    def compute_technical_features(self, asset_class: str) -> Dict[str, Path]:
        logger.info("Computing technical features for %s", asset_class)
        outputs: Dict[str, Path] = {}
        price_config = self.feature_config.get("technical_indicators", {}).get("price", {})
        vol_config = self.feature_config.get("technical_indicators", {}).get("volatility", {})
        band_config = self.feature_config.get("technical_indicators", {}).get("bands", {})

        files = self._load_silver_files(asset_class)
        if not files:
            logger.warning("No Silver files found for %s. Skipping technical features.", asset_class)
            return outputs

        # Check which files already exist in Gold layer
        gold_asset_dir = self.gold_root / asset_class
        existing_gold_files = set()
        if gold_asset_dir.exists():
            existing_gold_files = {f.stem for f in gold_asset_dir.glob("*.parquet")}
            if existing_gold_files:
                logger.info("Found %d existing Gold files for %s. Will skip these and process remaining files.", 
                           len(existing_gold_files), asset_class)

        processed_count = 0
        skipped_count = 0
        error_count = 0

        for file_path in files:
            # Skip if already processed (check both with and without =X for forex)
            file_stem = file_path.stem
            if file_stem in existing_gold_files:
                logger.debug("Skipping %s (already exists in Gold)", file_stem)
                skipped_count += 1
                continue
            
            # For forex, also check without =X suffix
            if asset_class == "forex" and "=X" in file_stem:
                file_stem_no_suffix = file_stem.replace("=X", "")
                if file_stem_no_suffix in existing_gold_files:
                    logger.debug("Skipping %s (already exists in Gold as %s)", file_stem, file_stem_no_suffix)
                    skipped_count += 1
                    continue

            try:
                df = pd.read_parquet(file_path)
                if df.empty:
                    logger.warning("Dataset %s is empty; skipping.", file_path)
                    error_count += 1
                    continue
                if "close" not in df.columns:
                    logger.warning("Dataset %s lacks close column; skipping technical features.", file_path)
                    error_count += 1
                    continue
                
                features = pd.DataFrame(index=df.index)
                close = df["close"].astype(float)
                high = df.get("high", close)
                low = df.get("low", close)
                volume = df.get("volume", pd.Series(0, index=df.index))

                for window in price_config.get("sma_windows", []):
                    features[f"sma_{window}"] = close.rolling(window).mean()
                for window in price_config.get("ema_windows", []):
                    features[f"ema_{window}"] = close.ewm(span=window, adjust=False).mean()
                for window in price_config.get("momentum_windows", []):
                    features[f"momentum_{window}"] = close.diff(window)
                for window in price_config.get("rate_of_change_windows", []):
                    features[f"roc_{window}"] = close.pct_change(window)

                macd_cfg = price_config.get("macd", {})
                fast = macd_cfg.get("fast", 12)
                slow = macd_cfg.get("slow", 26)
                signal = macd_cfg.get("signal", 9)
                fast_ema = close.ewm(span=fast, adjust=False).mean()
                slow_ema = close.ewm(span=slow, adjust=False).mean()
                macd_line = fast_ema - slow_ema
                signal_line = macd_line.ewm(span=signal, adjust=False).mean()
                features["macd"] = macd_line
                features["macd_signal"] = signal_line
                features["macd_hist"] = macd_line - signal_line

                for window in vol_config.get("atr_windows", []):
                    tr = pd.concat([(high - low), (high - close.shift()), (close.shift() - low)], axis=1).abs().max(axis=1)
                    features[f"atr_{window}"] = tr.rolling(window).mean()
                for window in vol_config.get("rolling_std_windows", []):
                    features[f"rolling_std_{window}"] = close.rolling(window).std()

                boll_cfg = band_config.get("bollinger", {})
                b_window = boll_cfg.get("window", 20)
                b_std = boll_cfg.get("std_dev", 2)
                rolling_mean = close.rolling(b_window).mean()
                rolling_std = close.rolling(b_window).std()
                features["bollinger_mid"] = rolling_mean
                features["bollinger_upper"] = rolling_mean + b_std * rolling_std
                features["bollinger_lower"] = rolling_mean - b_std * rolling_std

                feature_frame = df.join(features)
                out_dir = self.gold_root / asset_class
                out_dir.mkdir(parents=True, exist_ok=True)
                # Preserve original filename (including =X suffix for forex) in Gold layer
                output_path = out_dir / file_path.name
                feature_frame.to_parquet(output_path)
                outputs[file_path.stem] = output_path
                processed_count += 1
                logger.debug("Wrote Gold technical dataset %s", output_path)
            except Exception as exc:
                logger.exception("Error processing file %s: %s", file_path, exc)
                error_count += 1
                # Continue processing remaining files instead of stopping
                continue
        
        logger.info("Completed technical features for %s: %d processed, %d skipped, %d errors", 
                   asset_class, processed_count, skipped_count, error_count)
        return outputs

    def compute_sentiment_features(self, asset_class: str) -> Dict[str, Path]:
        logger.info("Computing sentiment features for %s", asset_class)
        outputs: Dict[str, Path] = {}
        files = self._load_silver_files(asset_class)
        if not files:
            logger.warning("No Silver files found for %s. Skipping sentiment features.", asset_class)
            return outputs
        
        for file_path in files:
            try:
                df = pd.read_parquet(file_path)
                if df.empty:
                    logger.warning("Dataset %s is empty; skipping.", file_path)
                    continue
                df.sort_index(inplace=True)
                
                # Build aggregations based on available columns
                aggregations = {}
                if "sentiment_score" in df.columns:
                    aggregations["sentiment_score"] = ["mean", "sum"]
                elif "sentiment" in df.columns:
                    aggregations["sentiment"] = ["mean", "sum"]
                if "score" in df.columns:
                    aggregations["score"] = ["mean", "sum"]
                if "id" in df.columns:
                    aggregations["id"] = "count"
                elif "message_count" in df.columns:
                    aggregations["message_count"] = "sum"
                
                if not aggregations:
                    logger.warning("Dataset %s lacks required columns for sentiment aggregation; skipping.", file_path)
                    continue
                
                agg = df.resample("1D").agg(aggregations)
                agg.columns = ["_".join(filter(None, col)).rstrip("_") for col in agg.columns]
                if "id_count" in agg.columns:
                    agg.rename(columns={"id_count": "message_count"}, inplace=True)
                
                out_dir = self.gold_root / asset_class
                out_dir.mkdir(parents=True, exist_ok=True)
                output_path = out_dir / file_path.name
                agg.to_parquet(output_path)
                outputs[file_path.stem] = output_path
                logger.debug("Stored sentiment aggregates %s", output_path)
            except Exception as exc:
                logger.exception("Error processing file %s: %s", file_path, exc)
                continue
        return outputs

    def compute_macro_features(self) -> Path:
        logger.info("Computing macroeconomic features")
        macro_dir = self.silver_root / "macro"
        if not macro_dir.exists():
            logger.warning("Silver macro directory missing: %s", macro_dir)
            raise FileNotFoundError("Silver macro directory missing.")

        frames = []
        for macro_file in sorted(macro_dir.glob("*.parquet")):
            series = pd.read_parquet(macro_file).rename(columns={"value": macro_file.stem})
            frames.append(series)
        macro_df = pd.concat(frames, axis=1).sort_index()

        aliases = self.feature_config.get("macro_features", {}).get("aliases", {})
        if aliases:
            macro_df = macro_df.rename(columns=aliases)

        base_cols = list(macro_df.columns)

        transformations = self.feature_config.get("macro_features", {}).get("transformations", {})
        if transformations.get("yoy_change"):
            yoy = macro_df[base_cols].pct_change(periods=12)
            yoy.columns = [f"{col}_yoy" for col in base_cols]
            macro_df = macro_df.join(yoy)
        if transformations.get("mom_change"):
            mom = macro_df[base_cols].pct_change(periods=1)
            mom.columns = [f"{col}_mom" for col in base_cols]
            macro_df = macro_df.join(mom)
        if transformations.get("wow_change"):
            wow = macro_df[base_cols].pct_change(periods=4)
            wow.columns = [f"{col}_wow" for col in base_cols]
            macro_df = macro_df.join(wow)

        zscore_windows = transformations.get("zscore_windows", [])
        for window in zscore_windows:
            rolling_mean = macro_df[base_cols].rolling(window).mean()
            rolling_std = macro_df[base_cols].rolling(window).std()
            zscore = (macro_df[base_cols] - rolling_mean) / rolling_std
            zscore.columns = [f"{col}_z{window}" for col in base_cols]
            macro_df = macro_df.join(zscore)

        out_path = self.gold_root / "macro_features.parquet"
        macro_df.to_parquet(out_path)
        logger.debug("Wrote macro features to %s", out_path)
        return out_path

    def compute_correlation_features(self) -> Path:
        logger.info("Computing correlation features from Silver datasets")
        price_dir = self.silver_root / "stocks"
        if not price_dir.exists():
            logger.warning("Silver stocks directory missing: %s", price_dir)
            raise FileNotFoundError("Silver stocks directory missing.")

        prices = []
        symbols = []
        for file_path in price_dir.glob("*.parquet"):
            try:
                df = pd.read_parquet(file_path)
                if df.empty:
                    continue
                if "close" not in df.columns:
                    logger.warning("Dataset %s lacks close column; skipping.", file_path)
                    continue
                prices.append(df["close"].rename(file_path.stem))
                symbols.append(file_path.stem)
            except Exception as exc:
                logger.warning("Error loading %s: %s", file_path, exc)
                continue
        
        if len(prices) < 2:
            logger.warning("Need at least 2 stock symbols for correlation. Found %d. Skipping.", len(prices))
            raise ValueError("Insufficient data for correlation computation.")
        
        price_df = pd.concat(prices, axis=1).sort_index()
        returns = price_df.pct_change().dropna()
        
        if len(returns) < 30:  # Minimum data points for meaningful correlation
            logger.warning("Insufficient data points (%d) for correlation. Need at least 30. Skipping.", len(returns))
            raise ValueError("Insufficient data points for correlation computation.")
        
        corr = returns.corr()

        out_path = self.gold_root / "correlations.parquet"
        corr.to_parquet(out_path)
        logger.debug("Stored correlation matrix at %s", out_path)
        return out_path

    def create_training_dataset(self, name: str, assets: Iterable[str]) -> Path:
        logger.info("Creating training dataset %s", name)
        assets = _ensure_iterable(assets)
        feature_frames = []
        for asset in assets:
            path = self.gold_root / "stocks" / f"{asset}.parquet"
            if path.exists():
                feature_frames.append(pd.read_parquet(path).add_prefix(f"{asset}_"))
        if not feature_frames:
            raise ValueError("No feature frames available for the requested assets.")
        dataset = pd.concat(feature_frames, axis=1).dropna()
        out_path = self.gold_root / f"{name}.parquet"
        dataset.to_parquet(out_path)
        logger.debug("Training dataset written to %s", out_path)
        return out_path


@dataclass
class DataValidator:
    """Validates data quality across the medallion layers."""

    rules: Dict[str, Any] = field(default_factory=dict)

    def validate_schema(self, dataset: pd.DataFrame, schema: Dict[str, Any]) -> bool:
        missing = [column for column in schema if column not in dataset.columns]
        return not missing

    def check_completeness(self, dataset: pd.DataFrame) -> Dict[str, Any]:
        missing_ratio = dataset.isna().mean().to_dict()
        return {"missing_ratio": missing_ratio}

    def detect_outliers(self, dataset: pd.DataFrame) -> Dict[str, Any]:
        zscore = np.abs((dataset - dataset.mean()) / dataset.std(ddof=0))
        outlier_count = int((zscore > 3).sum().sum())
        return {"outlier_count": outlier_count}

    def generate_report(self, dataset_name: str, metrics: Dict[str, Any]) -> None:
        logger.info("Data quality report for %s: %s", dataset_name, metrics)
