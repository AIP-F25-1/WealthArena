#!/usr/bin/env python3
"""
Google Cloud Storage Model Loader for WealthArena RL Service
Downloads RL model checkpoints from GCS bucket on App Engine startup
"""

import os
import logging
from pathlib import Path
from typing import Optional
from google.cloud import storage

logger = logging.getLogger(__name__)

def download_models_from_gcs(
    bucket_name: str = None,
    prefix: str = 'latest/',
    local_dir: str = '/app/models/latest'
) -> bool:
    """
    Download model checkpoints from GCS to local directory
    
    Args:
        bucket_name: Cloud Storage bucket name (defaults to GCS_BUCKET env var)
        prefix: Prefix for model files in bucket (default: 'latest/')
        local_dir: Local directory to save models (default: '/app/models/latest')
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        bucket_name = bucket_name or os.getenv('GCS_BUCKET', 'wealtharena-models')
        
        # Initialize storage client
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        
        # Create local directory
        local_path = Path(local_dir)
        local_path.mkdir(parents=True, exist_ok=True)
        
        # List and download blobs
        blobs = bucket.list_blobs(prefix=prefix)
        downloaded_count = 0
        
        for blob in blobs:
            # Skip directories
            if blob.name.endswith('/'):
                continue
            
            # Create local path (preserve directory structure)
            relative_path = blob.name.replace(prefix, '').lstrip('/')
            file_local_path = local_path / relative_path
            file_local_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Download blob
            blob.download_to_filename(str(file_local_path))
            logger.info(f"Downloaded: {blob.name} -> {file_local_path}")
            downloaded_count += 1
        
        logger.info(f"Downloaded {downloaded_count} model files from GCS bucket: {bucket_name}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to download models from GCS: {e}")
        return False

def check_models_exist(
    local_dir: str = '/app/models/latest',
    expected_files: int = 25
) -> bool:
    """
    Check if models already downloaded to local directory
    
    Args:
        local_dir: Local directory to check
        expected_files: Expected number of model files (default: 25, 5 asset classes × 5 files)
        
    Returns:
        bool: True if all expected files exist, False otherwise
    """
    try:
        local_path = Path(local_dir)
        
        if not local_path.exists():
            return False
        
        # Count model files (exclude directories and non-model files)
        model_files = list(local_path.rglob('*.pt'))  # PyTorch model files
        
        if len(model_files) >= expected_files:
            logger.info(f"Found {len(model_files)} model files in {local_dir}")
            return True
        
        logger.info(f"Only found {len(model_files)} model files, expected {expected_files}")
        return False
        
    except Exception as e:
        logger.error(f"Error checking models: {e}")
        return False

def get_model_path(
    asset_class: str,
    local_dir: str = '/app/models/latest'
) -> Optional[str]:
    """
    Get local path to specific model file
    
    Args:
        asset_class: Asset class name (e.g., 'asx_stocks', 'crypto')
        local_dir: Local directory containing models
        
    Returns:
        Optional[str]: Path to model file, or None if not found
    """
    try:
        local_path = Path(local_dir)
        
        # Search for model file matching asset class
        model_pattern = f"{asset_class}_*_model.pt"
        model_files = list(local_path.rglob(model_pattern))
        
        if model_files:
            return str(model_files[0])
        
        # Try alternative pattern
        model_pattern = f"*{asset_class}*model.pt"
        model_files = list(local_path.rglob(model_pattern))
        
        if model_files:
            return str(model_files[0])
        
        logger.warning(f"Model not found for asset class: {asset_class}")
        return None
        
    except Exception as e:
        logger.error(f"Error getting model path: {e}")
        return None

def initialize_models_from_gcs(
    bucket_name: str = None,
    prefix: str = 'latest/',
    local_dir: str = '/app/models/latest',
    force_download: bool = False
) -> bool:
    """
    Initialize models from GCS on startup
    
    Args:
        bucket_name: Cloud Storage bucket name
        prefix: Prefix for model files
        local_dir: Local directory to save models
        force_download: Force download even if models exist locally
        
    Returns:
        bool: True if models are ready, False otherwise
    """
    try:
        # Check if models already exist
        if not force_download and check_models_exist(local_dir):
            logger.info("Models already exist locally, skipping download")
            return True
        
        # Download from GCS
        logger.info(f"Downloading models from GCS bucket: {bucket_name or os.getenv('GCS_BUCKET', 'wealtharena-models')}")
        success = download_models_from_gcs(bucket_name, prefix, local_dir)
        
        if success:
            logger.info("✅ Models initialized successfully from GCS")
            return True
        else:
            logger.warning("⚠️ Failed to download models from GCS, will use mock mode")
            return False
            
    except Exception as e:
        logger.error(f"Error initializing models from GCS: {e}")
        return False

