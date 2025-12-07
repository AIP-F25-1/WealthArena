#!/usr/bin/env python3
"""
WealthArena RL Inference Server
REST API for RL model inference to generate trading signals
Enhanced with RLModelService integration and database connectivity
"""

import os
import sys
import json
import logging
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

# Azure Blob Storage imports
try:
    from azure.storage.blob import BlobServiceClient
    AZURE_STORAGE_AVAILABLE = True
except ImportError:
    AZURE_STORAGE_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("azure-storage-blob not available. Model download from Blob Storage disabled.")

# GCS Model Loader imports
try:
    from api.gcs_model_loader import initialize_models_from_gcs
    GCS_MODEL_LOADER_AVAILABLE = True
except ImportError:
    GCS_MODEL_LOADER_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("gcs_model_loader not available. Model download from GCS disabled.")

# Flask imports
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Add wealtharena_rl to path for model_service import
wealtharena_rl_path = project_root / 'wealtharena_rl'
if wealtharena_rl_path.exists():
    sys.path.insert(0, str(wealtharena_rl_path))

# Import RLModelService
try:
    from backend.model_service import RLModelService, get_model_service
except ImportError:
    # Fallback if import fails
    logger = logging.getLogger(__name__)
    logger.error("Failed to import RLModelService. Please ensure wealtharena_rl/backend/model_service.py exists")
    RLModelService = None
    get_model_service = None

# Import database connector
try:
    from db_connector import get_market_data, get_symbols_by_asset_type
except ImportError:
    # Try alternative import path
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).parent))
        from db_connector import get_market_data, get_symbols_by_asset_type
    except ImportError:
        logger = logging.getLogger(__name__)
        logger.error("Failed to import db_connector")
        get_market_data = None
        get_symbols_by_asset_type = None

# Import metrics module
try:
    from api.metrics import (
        record_inference, record_error, set_model_loaded,
        record_db_query, record_db_error, generate_metrics
    )
    METRICS_AVAILABLE = True
except ImportError:
    try:
        from metrics import (
            record_inference, record_error, set_model_loaded,
            record_db_query, record_db_error, generate_metrics
        )
        METRICS_AVAILABLE = True
    except ImportError:
        logger.warning("Metrics module not available. Metrics collection disabled.")
        METRICS_AVAILABLE = False
        def record_inference(*args, **kwargs): pass
        def record_error(*args, **kwargs): pass
        def set_model_loaded(*args, **kwargs): pass
        def record_db_query(*args, **kwargs): pass
        def record_db_error(*args, **kwargs): pass
        def generate_metrics(): return b''

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Global model service
model_service = None
model_loaded = False

def infer_asset_type_from_symbol(symbol: str) -> str:
    """
    Infer asset type from symbol suffix patterns
    Uses the same logic as get_symbols_by_asset_type
    
    Args:
        symbol: Symbol string (e.g., "BHP.AX", "BTC-USD")
        
    Returns:
        str: Asset type ('stock', 'crypto', 'forex', 'commodity', 'etf')
    """
    symbol_upper = symbol.upper()
    
    # Check patterns in order of specificity
    if symbol_upper.endswith('.AX'):
        # Could be stock or ETF - default to stock
        return 'stock'
    elif '-USD' in symbol_upper or '-USDT' in symbol_upper:
        return 'crypto'
    elif '=X' in symbol_upper:
        return 'forex'
    elif '=F' in symbol_upper:
        return 'commodity'
    else:
        # Default to stock for unknown patterns
        return 'stock'

def download_models_from_blob(model_path: Path, storage_conn_string: str, container_name: str = "rl-models", prefix: str = "latest/"):
    """Download model files from Azure Blob Storage to local path"""
    try:
        if not AZURE_STORAGE_AVAILABLE:
            logger.warning("Azure Blob Storage library not available. Skipping model download.")
            return False
        
        # Create model directory if it doesn't exist
        model_path.mkdir(parents=True, exist_ok=True)
        
        # Initialize BlobServiceClient
        blob_service_client = BlobServiceClient.from_connection_string(storage_conn_string)
        container_client = blob_service_client.get_container_client(container_name)
        
        # Check if container exists
        if not container_client.exists():
            logger.warning(f"Container {container_name} does not exist. Skipping model download.")
            return False
        
        # List all blobs with prefix
        blobs = container_client.list_blobs(name_starts_with=prefix)
        blob_list = list(blobs)
        
        if not blob_list:
            logger.warning(f"No blobs found in container {container_name} with prefix {prefix}")
            return False
        
        logger.info(f"Found {len(blob_list)} model files to download")
        
        # Download each blob
        downloaded_count = 0
        for blob in blob_list:
            # Get relative path from prefix
            blob_name = blob.name
            relative_path = blob_name[len(prefix):] if blob_name.startswith(prefix) else blob_name
            
            # Create local file path
            local_file_path = model_path / relative_path
            local_file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Download blob
            blob_client = container_client.get_blob_client(blob_name)
            with open(local_file_path, "wb") as download_file:
                download_file.write(blob_client.download_blob().readall())
            
            downloaded_count += 1
            logger.info(f"Downloaded: {blob_name} -> {local_file_path}")
        
        logger.info(f"✅ Successfully downloaded {downloaded_count} model files")
        return True
        
    except Exception as e:
        logger.error(f"Failed to download models from Blob Storage: {e}", exc_info=True)
        return False

def initialize_service():
    """Initialize RL model service and database connection"""
    global model_service, model_loaded
    
    try:
        # Check MODEL_MODE environment variable
        model_mode = os.getenv('MODEL_MODE', 'production').lower()
        
        # Get model path
        model_path = Path(os.getenv('MODEL_PATH', '/app/models/latest'))
        model_path = Path(model_path)  # Ensure it's a Path object
        
        # If in mock mode, skip model download
        if model_mode == 'mock':
            logger.info("MODEL_MODE=mock: Operating in mock mode, skipping model download")
            if get_model_service:
                model_service = RLModelService(model_dir=model_path)
                model_loaded = True
            else:
                logger.error("Failed to initialize model service")
                model_loaded = False
            return
        
        # For production mode, we need actual model files
        # Priority: GCS > Azure Blob Storage
        model_download_success = False
        
        # Try GCS first (primary source for GCP deployments)
        if GCS_MODEL_LOADER_AVAILABLE:
            gcs_bucket = os.getenv('GCS_BUCKET', 'wealtharena-models')
            gcs_prefix = os.getenv('GCS_MODEL_PREFIX', 'latest/')
            local_dir = str(model_path)
            
            logger.info(f"Attempting to download models from GCS bucket: {gcs_bucket}, prefix: {gcs_prefix}")
            model_download_success = initialize_models_from_gcs(
                bucket_name=gcs_bucket,
                prefix=gcs_prefix,
                local_dir=local_dir
            )
            
            if model_download_success:
                logger.info("✅ Models initialized successfully from GCS")
                model_loaded = True
            else:
                logger.warning("GCS model download failed. Will try Azure Blob Storage as fallback.")
        
        # Fallback to Azure Blob Storage if GCS download failed
        if not model_download_success:
            storage_conn_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
            if storage_conn_string and AZURE_STORAGE_AVAILABLE:
                logger.info("AZURE_STORAGE_CONNECTION_STRING found. Attempting to download models from Blob Storage...")
                model_download_success = download_models_from_blob(model_path, storage_conn_string)
                
                if model_download_success:
                    logger.info("✅ Models initialized successfully from Azure Blob Storage")
                    model_loaded = True
                else:
                    logger.warning("Azure Blob Storage download failed. Checking if models already exist locally...")
            else:
                if not storage_conn_string:
                    logger.warning("AZURE_STORAGE_CONNECTION_STRING not found. Skipping Azure Blob Storage download.")
                if not model_download_success:
                    logger.warning("Checking if models already exist locally...")
        
        # Initialize model service with correct path from the outset
        if get_model_service:
            # Initialize model service with path directly
            model_service = RLModelService(model_dir=model_path)
            
            # Verify model directory and check for model files
            # Need at least one .pt file and matching metadata
            if model_path.exists():
                # Check if directory has model files (*.pt, *.pkl, *.json)
                pt_files = list(model_path.glob("*.pt"))
                pkl_files = list(model_path.glob("*.pkl"))
                json_files = list(model_path.glob("*.json"))
                
                # Check for actual model files in subdirectories (asx_stocks, etc.)
                has_subdir_models = False
                for subdir in model_path.iterdir():
                    if subdir.is_dir():
                        subdir_pt = list(subdir.glob("*.pt"))
                        subdir_pkl = list(subdir.glob("*.pkl"))
                        subdir_json = list(subdir.glob("*.json"))
                        if subdir_pt or subdir_pkl or subdir_json:
                            has_subdir_models = True
                            break
                
                # Set model_loaded based on actual files found
                if pt_files or pkl_files or has_subdir_models:
                    logger.info(f"✅ Model directory found with model files: {model_path}")
                    logger.info(f"   PT files: {len(pt_files)}, PKL files: {len(pkl_files)}, JSON files: {len(json_files)}, Subdirs: {has_subdir_models}")
                    model_loaded = True
                    if METRICS_AVAILABLE:
                        set_model_loaded(1, 'default')
                else:
                    logger.warning(f"⚠️ Model directory exists but contains no model files: {model_path}")
                    logger.warning("MODEL_MODE=production but no models available. Service will operate with model_loaded=false")
                    model_loaded = False
                    if METRICS_AVAILABLE:
                        set_model_loaded(0, 'default')
            else:
                logger.warning(f"⚠️ Model directory not found: {model_path}")
                logger.warning("MODEL_MODE=production but no model directory. Service will operate with model_loaded=false")
                model_loaded = False
        else:
            logger.error("Failed to initialize model service")
            model_loaded = False
            
        # Test database connection
        try:
            if get_market_data:
                # Test connection by trying a simple query
                try:
                    test_data = get_market_data("AAPL", days=1)
                    if not test_data.empty:
                        logger.info("✅ Database connection established")
                    else:
                        logger.warning("⚠️ Database connection test returned empty result")
                except RuntimeError as e:
                    logger.warning(f"⚠️ Database connection test failed: {e}")
                    logger.info("Service will continue but may have limited functionality")
            else:
                logger.warning("⚠️ Database connector not available")
        except Exception as e:
            logger.warning(f"⚠️ Database connection test failed: {e}")
            logger.info("Service will continue but may have limited functionality")
            
    except Exception as e:
        logger.error(f"Failed to initialize service: {e}")
        model_loaded = False

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        return jsonify({
            'status': 'healthy' if model_loaded else 'model_not_loaded',
            'model_loaded': model_loaded,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/model/info', methods=['GET'])
def model_info():
    """Get model information"""
    try:
        model_path = os.getenv('MODEL_PATH', '../../wealtharena_rl/checkpoints/latest')
        return jsonify({
            'model_path': model_path,
            'model_loaded': model_loaded,
            'model_type': 'PPO',
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        return jsonify({
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/predict', methods=['POST'])
def predict():
    """
    Generate trading signals from market state
    
    Request body:
    {
        "market_state": [[feature1, feature2, ...], ...],  # Optional, can be derived from DB
        "symbol": "BHP.AX",
        "asset_type": "stock"
    }
    
    Response:
    {
        "symbol": "BHP.AX",
        "signal": "BUY|SELL|HOLD",
        "confidence": 0.85,
        "entry": {...},
        "take_profit": [...],
        "stop_loss": {...},
        "risk_metrics": {...},
        "position_sizing": {...},
        "indicators": {...},
        "chart_data": [...]
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        symbol = data.get('symbol')
        asset_type = data.get('asset_type', 'stock')
        market_state = data.get('market_state')  # Optional, fallback if DB unavailable
        
        if not symbol:
            return jsonify({'error': 'symbol is required'}), 400
        
        market_data_df = pd.DataFrame()
        db_error = False
        
        # Try to query market data from Azure SQL
        if get_market_data:
            try:
                market_data_df = get_market_data(symbol, days=60)
            except RuntimeError as e:
                # Database error - distinguish from no data
                logger.error(f"Database error querying data for {symbol}: {e}")
                db_error = True
            except Exception as e:
                logger.warning(f"Database query failed for {symbol}: {e}")
                db_error = True
        
        # If DB is unavailable or returns empty, try to use provided market_state
        if db_error or (market_data_df.empty and market_state is not None):
            if market_state is not None:
                logger.info(f"Using provided market_state for {symbol} (DB unavailable or empty)")
                try:
                    # Construct minimal DataFrame from market_state
                    # market_state should be a list of lists/arrays with features
                    # We'll create a DataFrame with the last row as the latest state
                    if isinstance(market_state, list) and len(market_state) > 0:
                        # Assume market_state is a list of feature vectors
                        # Create a DataFrame with expected columns
                        df_data = market_state[-1] if len(market_state) == 1 else market_state[-1]
                        # Expected columns: Date, Open, High, Low, Close, Volume, SMA_20, SMA_50, RSI, MACD, Volume_Ratio, Volatility_20
                        # Try to map provided features to these columns
                        if isinstance(df_data, (list, np.ndarray)) and len(df_data) >= 6:
                            # Create minimal DataFrame with last row
                            market_data_df = pd.DataFrame([{
                                'Date': datetime.now(),
                                'Open': float(df_data[0]) if len(df_data) > 0 else 0,
                                'High': float(df_data[1]) if len(df_data) > 1 else float(df_data[0]) if len(df_data) > 0 else 0,
                                'Low': float(df_data[2]) if len(df_data) > 2 else float(df_data[0]) if len(df_data) > 0 else 0,
                                'Close': float(df_data[3]) if len(df_data) > 3 else float(df_data[0]) if len(df_data) > 0 else 0,
                                'Volume': float(df_data[4]) if len(df_data) > 4 else 0,
                                'SMA_20': float(df_data[5]) if len(df_data) > 5 else float(df_data[0]) if len(df_data) > 0 else 0,
                                'SMA_50': float(df_data[6]) if len(df_data) > 6 else float(df_data[0]) if len(df_data) > 0 else 0,
                                'RSI': float(df_data[7]) if len(df_data) > 7 else 50.0,
                                'MACD': float(df_data[8]) if len(df_data) > 8 else 0.0,
                                'Volume_Ratio': float(df_data[9]) if len(df_data) > 9 else 1.0,
                                'Volatility_20': float(df_data[10]) if len(df_data) > 10 else 0.02
                            }])
                        else:
                            # Fallback: create a minimal DataFrame with defaults
                            market_data_df = pd.DataFrame([{
                                'Date': datetime.now(),
                                'Open': 0, 'High': 0, 'Low': 0, 'Close': 0,
                                'Volume': 0, 'SMA_20': 0, 'SMA_50': 0,
                                'RSI': 50.0, 'MACD': 0.0, 'Volume_Ratio': 1.0,
                                'Volatility_20': 0.02
                            }])
                    else:
                        market_data_df = pd.DataFrame()
                except Exception as e:
                    logger.error(f"Failed to construct DataFrame from market_state: {e}")
                    market_data_df = pd.DataFrame()
        
        # If still no data and no market_state, return appropriate error
        if market_data_df.empty:
            if db_error and market_state is None:
                return jsonify({
                    'error': 'Database unavailable and no market_state provided',
                    'timestamp': datetime.now().isoformat()
                }), 503
            else:
                logger.warning(f"No market data found for {symbol}")
                return jsonify({
                    'symbol': symbol,
                    'signal': 'HOLD',
                    'confidence': 0.5,
                    'error': 'No market data available',
                    'timestamp': datetime.now().isoformat()
                }), 404
        
        # Generate prediction using RLModelService
        if not model_service:
            return jsonify({
                'error': 'Model service not initialized',
                'timestamp': datetime.now().isoformat()
            }), 503
        
        # Record inference start time
        inference_start_time = time.time()
        try:
            prediction = model_service.generate_prediction(symbol, market_data_df, asset_type)
            inference_duration = time.time() - inference_start_time
            
            # Record successful inference
            if METRICS_AVAILABLE:
                record_inference(inference_duration, 'default', 'success')
            
            return jsonify(prediction), 200
        except Exception as e:
            inference_duration = time.time() - inference_start_time
            error_type = type(e).__name__
            
            # Record inference error
            if METRICS_AVAILABLE:
                record_inference(inference_duration, 'default', 'error')
                record_error('default', error_type)
            
            logger.error(f"Prediction error: {e}", exc_info=True)
            return jsonify({
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500
        
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        if METRICS_AVAILABLE:
            record_error('default', type(e).__name__)
        return jsonify({
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/predictions', methods=['POST'])
def predictions():
    """
    Generate trading signals from market state (backend proxy compatible endpoint)
    
    Request body:
    {
        "symbol": "BHP.AX",
        "horizon": 1  # Optional, for compatibility
    }
    
    Response:
    Same as /predict endpoint
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        symbol = data.get('symbol')
        asset_type = data.get('asset_type', 'stock')
        horizon = data.get('horizon', 1)  # For compatibility with backend proxy
        market_state = data.get('market_state')  # Optional, fallback if DB unavailable
        
        if not symbol:
            return jsonify({'error': 'symbol is required'}), 400
        
        market_data_df = pd.DataFrame()
        db_error = False
        
        # Try to query market data from Azure SQL
        if get_market_data:
            db_start_time = time.time()
            try:
                market_data_df = get_market_data(symbol, days=60)
                db_duration = time.time() - db_start_time
                if METRICS_AVAILABLE:
                    record_db_query(db_duration, 'select')
            except RuntimeError as e:
                # Database error - distinguish from no data
                db_duration = time.time() - db_start_time
                if METRICS_AVAILABLE:
                    record_db_query(db_duration, 'select')
                    record_db_error('select')
                logger.error(f"Database error querying data for {symbol}: {e}")
                db_error = True
            except Exception as e:
                db_duration = time.time() - db_start_time
                if METRICS_AVAILABLE:
                    record_db_query(db_duration, 'select')
                    record_db_error('select')
                logger.warning(f"Database query failed for {symbol}: {e}")
                db_error = True
        
        # If DB is unavailable or returns empty, try to use provided market_state
        if db_error or (market_data_df.empty and market_state is not None):
            if market_state is not None:
                logger.info(f"Using provided market_state for {symbol} (DB unavailable or empty)")
                try:
                    # Construct minimal DataFrame from market_state
                    # market_state should be a list of lists/arrays with features
                    # We'll create a DataFrame with the last row as the latest state
                    if isinstance(market_state, list) and len(market_state) > 0:
                        # Assume market_state is a list of feature vectors
                        # Create a DataFrame with expected columns
                        df_data = market_state[-1] if len(market_state) == 1 else market_state[-1]
                        # Expected columns: Date, Open, High, Low, Close, Volume, SMA_20, SMA_50, RSI, MACD, Volume_Ratio, Volatility_20
                        # Try to map provided features to these columns
                        if isinstance(df_data, (list, np.ndarray)) and len(df_data) >= 6:
                            # Create minimal DataFrame with last row
                            market_data_df = pd.DataFrame([{
                                'Date': datetime.now(),
                                'Open': float(df_data[0]) if len(df_data) > 0 else 0,
                                'High': float(df_data[1]) if len(df_data) > 1 else float(df_data[0]) if len(df_data) > 0 else 0,
                                'Low': float(df_data[2]) if len(df_data) > 2 else float(df_data[0]) if len(df_data) > 0 else 0,
                                'Close': float(df_data[3]) if len(df_data) > 3 else float(df_data[0]) if len(df_data) > 0 else 0,
                                'Volume': float(df_data[4]) if len(df_data) > 4 else 0,
                                'SMA_20': float(df_data[5]) if len(df_data) > 5 else float(df_data[0]) if len(df_data) > 0 else 0,
                                'SMA_50': float(df_data[6]) if len(df_data) > 6 else float(df_data[0]) if len(df_data) > 0 else 0,
                                'RSI': float(df_data[7]) if len(df_data) > 7 else 50.0,
                                'MACD': float(df_data[8]) if len(df_data) > 8 else 0.0,
                                'Volume_Ratio': float(df_data[9]) if len(df_data) > 9 else 1.0,
                                'Volatility_20': float(df_data[10]) if len(df_data) > 10 else 0.02
                            }])
                        else:
                            # Fallback: create a minimal DataFrame with defaults
                            market_data_df = pd.DataFrame([{
                                'Date': datetime.now(),
                                'Open': 0, 'High': 0, 'Low': 0, 'Close': 0,
                                'Volume': 0, 'SMA_20': 0, 'SMA_50': 0,
                                'RSI': 50.0, 'MACD': 0.0, 'Volume_Ratio': 1.0,
                                'Volatility_20': 0.02
                            }])
                    else:
                        market_data_df = pd.DataFrame()
                except Exception as e:
                    logger.error(f"Failed to construct DataFrame from market_state: {e}")
                    market_data_df = pd.DataFrame()
        
        # If still no data and no market_state, return appropriate error
        if market_data_df.empty:
            if db_error and market_state is None:
                return jsonify({
                    'error': 'Database unavailable and no market_state provided',
                    'timestamp': datetime.now().isoformat()
                }), 503
            else:
                logger.warning(f"No market data found for {symbol}")
                return jsonify({
                    'symbol': symbol,
                    'signal': 'HOLD',
                    'confidence': 0.5,
                    'error': 'No market data available',
                    'timestamp': datetime.now().isoformat()
                }), 404
        
        # Generate prediction using RLModelService
        if not model_service:
            return jsonify({
                'error': 'Model service not initialized',
                'timestamp': datetime.now().isoformat()
            }), 503
        
        # Record inference start time
        inference_start_time = time.time()
        try:
            prediction = model_service.generate_prediction(symbol, market_data_df, asset_type)
            inference_duration = time.time() - inference_start_time
            
            # Record successful inference
            if METRICS_AVAILABLE:
                record_inference(inference_duration, 'default', 'success')
            
            return jsonify(prediction), 200
        except Exception as e:
            inference_duration = time.time() - inference_start_time
            error_type = type(e).__name__
            
            # Record inference error
            if METRICS_AVAILABLE:
                record_inference(inference_duration, 'default', 'error')
                record_error('default', error_type)
            
            logger.error(f"Prediction error: {e}", exc_info=True)
            return jsonify({
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }), 500
        
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        if METRICS_AVAILABLE:
            record_error('default', type(e).__name__)
        return jsonify({
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/top-setups', methods=['POST'])
def top_setups():
    """
    Get top N trading setups for an asset type
    
    Request body:
    {
        "asset_type": "stocks",
        "count": 3,
        "risk_tolerance": "medium"  # Optional
    }
    
    Response:
    {
        "setups": [
            {
                "rank": 1,
                "symbol": "BHP.AX",
                "signal": "BUY",
                "confidence": 0.85,
                "ranking_score": 0.7823,
                ...
            },
            ...
        ],
        "count": 3,
        "asset_type": "stocks"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        asset_type = data.get('asset_type')
        count = data.get('count', 3)
        risk_tolerance = data.get('risk_tolerance', 'medium')
        
        if not asset_type:
            return jsonify({'error': 'asset_type is required'}), 400
        
        # Get symbols for asset type
        if not get_symbols_by_asset_type:
            return jsonify({
                'error': 'Database connector not available',
                'timestamp': datetime.now().isoformat()
            }), 503
        
        symbols = get_symbols_by_asset_type(asset_type, limit=100)
        
        if not symbols:
            return jsonify({
                'error': f'No symbols found for asset_type: {asset_type}',
                'timestamp': datetime.now().isoformat()
            }), 404
        
        # Fetch market data for each symbol
        if not get_market_data or not model_service:
            return jsonify({
                'error': 'Service not fully initialized',
                'timestamp': datetime.now().isoformat()
            }), 503
        
        data_dict = {}
        for symbol in symbols:
            try:
                market_data = get_market_data(symbol, days=60)
                if not market_data.empty:
                    data_dict[symbol] = market_data
            except Exception as e:
                logger.warning(f"Failed to fetch data for {symbol}: {e}")
                continue
        
        if not data_dict:
            return jsonify({
                'error': 'No market data available for symbols',
                'timestamp': datetime.now().isoformat()
            }), 404
        
        # Generate top setups using RLModelService
        top_setups_list = model_service.generate_top_setups(asset_type, data_dict, count)
        
        return jsonify({
            'setups': top_setups_list,
            'count': len(top_setups_list),
            'asset_type': asset_type,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Top setups error: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/portfolio', methods=['POST'])
def portfolio():
    """
    Analyze portfolio of symbols
    
    Request body:
    {
        "symbols": ["BHP.AX", "CBA.AX", "RIO.AX"],
        "weights": [0.4, 0.35, 0.25]
    }
    
    Response:
    {
        "portfolio_analysis": {
            "weighted_confidence": 0.81,
            "portfolio_signal": "BUY",
            "combined_risk_reward": 2.45,
            ...
        },
        "individual_signals": [...],
        "recommendations": [...]
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        symbols = data.get('symbols')
        weights = data.get('weights')
        
        if not symbols or not weights:
            return jsonify({
                'error': 'symbols and weights arrays are required'
            }), 400
        
        if len(symbols) != len(weights):
            return jsonify({
                'error': 'symbols and weights arrays must have equal length'
            }), 400
        
        if abs(sum(weights) - 1.0) > 0.01:
            return jsonify({
                'error': 'weights must sum to approximately 1.0'
            }), 400
        
        # Fetch market data and generate predictions for each symbol
        if not get_market_data or not model_service:
            return jsonify({
                'error': 'Service not fully initialized',
                'timestamp': datetime.now().isoformat()
            }), 503
        
        individual_signals = []
        for symbol, weight in zip(symbols, weights):
            try:
                # Infer asset_type from symbol suffix patterns (same logic as get_symbols_by_asset_type)
                asset_type = infer_asset_type_from_symbol(symbol)
                
                market_data = get_market_data(symbol, days=60)
                if market_data.empty:
                    continue
                
                prediction = model_service.generate_prediction(symbol, market_data, asset_type)
                prediction['weight'] = weight
                individual_signals.append(prediction)
            except Exception as e:
                logger.warning(f"Failed to generate prediction for {symbol}: {e}")
                continue
        
        if not individual_signals:
            return jsonify({
                'error': 'No predictions generated for portfolio symbols',
                'timestamp': datetime.now().isoformat()
            }), 404
        
        # Calculate portfolio-level metrics
        weighted_confidence = sum(s['confidence'] * s['weight'] for s in individual_signals)
        combined_risk_reward = sum(
            s.get('risk_metrics', {}).get('risk_reward_ratio', 0) * s['weight']
            for s in individual_signals
        )
        
        # Determine portfolio signal
        buy_count = sum(1 for s in individual_signals if s['signal'] == 'BUY')
        sell_count = sum(1 for s in individual_signals if s['signal'] == 'SELL')
        
        if buy_count > sell_count:
            portfolio_signal = 'BUY'
        elif sell_count > buy_count:
            portfolio_signal = 'SELL'
        else:
            portfolio_signal = 'HOLD'
        
        # Calculate diversification score (simplified)
        diversification_score = min(1.0, 1.0 / (len(individual_signals) * 0.2))
        
        # Generate recommendations
        recommendations = []
        if buy_count > sell_count:
            recommendations.append(f"Portfolio shows strong bullish bias ({buy_count} BUY, {sell_count} SELL)")
        elif sell_count > buy_count:
            recommendations.append(f"Portfolio shows bearish bias ({sell_count} SELL, {buy_count} BUY)")
        else:
            recommendations.append("Portfolio shows mixed signals")
        
        if diversification_score < 0.5:
            recommendations.append("Consider rebalancing to reduce concentration risk")
        
        recommendations.append(f"Overall risk/reward ratio: {combined_risk_reward:.2f}:1")
        
        portfolio_analysis = {
            'weighted_confidence': round(weighted_confidence, 2),
            'portfolio_signal': portfolio_signal,
            'combined_risk_reward': round(combined_risk_reward, 2),
            'total_expected_value': sum(
                s.get('risk_metrics', {}).get('expected_value', 0) * s['weight']
                for s in individual_signals
            ),
            'diversification_score': round(diversification_score, 2)
        }
        
        return jsonify({
            'portfolio_analysis': portfolio_analysis,
            'individual_signals': individual_signals,
            'recommendations': recommendations,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Portfolio analysis error: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/market-data', methods=['POST'])
def market_data():
    """
    Get market data for symbols
    
    Request body:
    {
        "symbols": ["BHP.AX", "CBA.AX"],
        "days": 30
    }
    
    Response:
    {
        "data": {
            "BHP.AX": [...],
            "CBA.AX": [...]
        },
        "symbols": [...],
        "days": 30
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        symbols = data.get('symbols')
        days = data.get('days', 30)
        
        if not symbols or not isinstance(symbols, list):
            return jsonify({'error': 'symbols array is required'}), 400
        
        if not get_market_data:
            return jsonify({
                'error': 'Database connector not available',
                'timestamp': datetime.now().isoformat()
            }), 503
        
        market_data_dict = {}
        for symbol in symbols:
            try:
                df = get_market_data(symbol, days=days)
                if not df.empty:
                    # Convert DataFrame to list of dicts
                    market_data_dict[symbol] = df.to_dict('records')
                else:
                    market_data_dict[symbol] = []
            except Exception as e:
                logger.warning(f"Failed to fetch data for {symbol}: {e}")
                market_data_dict[symbol] = []
        
        return jsonify({
            'data': market_data_dict,
            'symbols': symbols,
            'days': days,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Market data error: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Chat with RL chatbot (stub endpoint)
    
    Request body:
    {
        "message": "What's the best stock to buy?",
        "context": {...}
    }
    
    Response:
    {
        "status": "not_implemented",
        "message": "Chat feature is not yet available"
    }
    """
    return jsonify({
        'status': 'not_implemented',
        'message': 'Chat feature is not yet available',
        'timestamp': datetime.now().isoformat()
    }), 501

@app.route('/api/game/leaderboard', methods=['GET'])
def game_leaderboard():
    """
    Get game leaderboard (stub endpoint)
    
    Response:
    {
        "status": "not_implemented",
        "message": "Game leaderboard feature is not yet available"
    }
    """
    return jsonify({
        'status': 'not_implemented',
        'message': 'Game leaderboard feature is not yet available',
        'timestamp': datetime.now().isoformat()
    }), 501

@app.route('/api/metrics/summary', methods=['GET'])
def metrics_summary():
    """
    Get system metrics summary (Prometheus format)
    
    Response:
    Prometheus-formatted metrics text
    """
    try:
        if METRICS_AVAILABLE:
            from flask import Response
            metrics_output = generate_metrics()
            return Response(
                metrics_output,
                mimetype='text/plain; version=0.0.4; charset=utf-8'
            ), 200
        else:
            return jsonify({
                'status': 'not_available',
                'message': 'Metrics module not available',
                'timestamp': datetime.now().isoformat()
            }), 503
    except Exception as e:
        logger.error(f"Error generating metrics: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5002))
    host = os.getenv('HOST', '0.0.0.0')
    
    # Initialize service before starting server
    logger.info("Initializing RL inference server...")
    initialize_service()
    logger.info("RL inference server initialized")
    
    logger.info(f"Starting RL inference server on {host}:{port}")
    app.run(host=host, port=port, debug=False)
