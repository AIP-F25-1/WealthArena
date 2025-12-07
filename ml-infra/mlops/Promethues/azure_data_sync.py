#!/usr/bin/env python3
"""
Azure Data Sync - WealthArena MLOps Platform
Syncs ASX news data from Azure Blob Storage to local storage
Tracks operations in MLflow and exposes Prometheus metrics
"""

import os
import time
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Azure SDK
from azure.storage.blob import BlobServiceClient, ContainerClient
from azure.core.exceptions import AzureError

# MLflow
import mlflow
from mlflow import log_param, log_metric, log_artifact

# Prometheus
from prometheus_client import Counter, Gauge, Histogram, start_http_server

# Environment variables
from dotenv import load_dotenv

# Load Azure credentials
load_dotenv('data/azureCred.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(message)s'
)

# ============================================================================
# PROMETHEUS METRICS
# ============================================================================
SYNC_RUNS = Counter('azure_sync_runs_total', 'Total Azure sync runs')
SYNC_ERRORS = Counter('azure_sync_errors_total', 'Total Azure sync errors')
SYNC_TIME = Histogram('azure_sync_duration_seconds', 'Azure sync duration')
FILES_DOWNLOADED = Counter('azure_files_downloaded_total', 'Total files downloaded from Azure')
BYTES_DOWNLOADED = Counter('azure_bytes_downloaded_total', 'Total bytes downloaded from Azure')
CURRENT_FILE_COUNT = Gauge('azure_current_file_count', 'Current number of files in Azure')
LAST_SYNC_TIME = Gauge('azure_last_sync_timestamp', 'Timestamp of last successful sync')

# ============================================================================
# AZURE CONFIGURATION
# ============================================================================
AZURE_CONNECTION_STRING = os.getenv('AZURE_CONNECTION_STRING', '')
AZURE_ACCOUNT = os.getenv('AZURE_STORAGE_ACCOUNT', 'aipwealtharena2025lake')
AZURE_KEY = os.getenv('AZURE_STORAGE_KEY', '')
AZURE_CONTAINER = os.getenv('AZURE_CONTAINER', '')  # Will auto-detect if empty
AZURE_BLOB_PATH = os.getenv('AZURE_BLOB_PATH', '')  # Optional prefix path

# Local storage path
LOCAL_DATA_PATH = Path('data/azure_sync')
LOCAL_DATA_PATH.mkdir(parents=True, exist_ok=True)

# ============================================================================
# AZURE BLOB CLIENT
# ============================================================================
def get_blob_service_client() -> Optional[BlobServiceClient]:
    """Create and return Azure Blob Service Client"""
    try:
        # Use connection string if available (preferred method)
        if AZURE_CONNECTION_STRING:
            client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
            logging.info(f"✅ Connected to Azure Storage via connection string")
        else:
            # Fallback to account name + key
            connection_string = f"DefaultEndpointsProtocol=https;AccountName={AZURE_ACCOUNT};AccountKey={AZURE_KEY};EndpointSuffix=core.windows.net"
            client = BlobServiceClient.from_connection_string(connection_string)
            logging.info(f"✅ Connected to Azure Storage: {AZURE_ACCOUNT}")
        
        # Test connection
        client.get_account_information()
        return client
    except Exception as e:
        logging.error(f"❌ Failed to connect to Azure: {e}")
        SYNC_ERRORS.inc()
        return None


def list_containers(blob_service_client: BlobServiceClient) -> List[str]:
    """List all containers in the storage account"""
    try:
        containers = blob_service_client.list_containers()
        container_names = [c.name for c in containers]
        logging.info(f"📦 Found {len(container_names)} containers: {container_names}")
        return container_names
    except Exception as e:
        logging.error(f"❌ Failed to list containers: {e}")
        return []


def list_blobs(container_client: ContainerClient, prefix: str = '') -> List[Dict]:
    """List all blobs in a container"""
    try:
        blobs = container_client.list_blobs(name_starts_with=prefix)
        blob_list = []
        for blob in blobs:
            blob_list.append({
                'name': blob.name,
                'size': blob.size,
                'last_modified': blob.last_modified,
                'content_type': blob.content_settings.content_type if blob.content_settings else 'unknown'
            })
        logging.info(f"📄 Found {len(blob_list)} blobs in container")
        return blob_list
    except Exception as e:
        logging.error(f"❌ Failed to list blobs: {e}")
        return []


def download_blob(container_client: ContainerClient, blob_name: str, blob_size: int, local_path: Path) -> bool:
    """Download a single blob from Azure"""
    try:
        # Skip directory markers (0 byte files)
        if blob_size == 0:
            logging.debug(f"⏭️  Skipping directory marker: {blob_name}")
            return False
        
        blob_client = container_client.get_blob_client(blob_name)
        
        # Create local directory structure
        local_file = local_path / blob_name
        local_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Download blob
        logging.info(f"⬇️  Downloading: {blob_name} ({blob_size / 1024:.2f} KB)")
        with open(local_file, 'wb') as f:
            download_stream = blob_client.download_blob()
            f.write(download_stream.readall())
        
        # Update metrics
        file_size = local_file.stat().st_size
        FILES_DOWNLOADED.inc()
        BYTES_DOWNLOADED.inc(file_size)
        
        logging.info(f"✅ Downloaded: {blob_name} ({file_size / 1024:.2f} KB)")
        return True
    except Exception as e:
        logging.error(f"❌ Failed to download {blob_name}: {e}")
        SYNC_ERRORS.inc()
        return False


# ============================================================================
# SYNC OPERATION
# ============================================================================
@SYNC_TIME.time()
def sync_azure_data(container_name: str = None, blob_prefix: str = '') -> Dict:
    """
    Sync data from Azure Blob Storage to local storage
    
    Args:
        container_name: Azure container name (uses AZURE_CONTAINER if None)
        blob_prefix: Optional prefix to filter blobs
    
    Returns:
        Dict with sync statistics
    """
    start_time = time.time()
    stats = {
        'files_downloaded': 0,
        'bytes_downloaded': 0,
        'files_failed': 0,
        'container': container_name or AZURE_CONTAINER,
        'prefix': blob_prefix or AZURE_BLOB_PATH
    }
    
    SYNC_RUNS.inc()
    
    # Get blob service client
    blob_service = get_blob_service_client()
    if not blob_service:
        return stats
    
    try:
        # Use specified container or default
        target_container = container_name or AZURE_CONTAINER
        
        # Get container client
        container_client = blob_service.get_container_client(target_container)
        
        # List all blobs
        blob_prefix = blob_prefix or AZURE_BLOB_PATH
        blobs = list_blobs(container_client, blob_prefix)
        CURRENT_FILE_COUNT.set(len(blobs))
        
        # Download each blob
        for blob_info in blobs:
            blob_name = blob_info['name']
            blob_size = blob_info['size']
            success = download_blob(container_client, blob_name, blob_size, LOCAL_DATA_PATH)
            
            if success:
                stats['files_downloaded'] += 1
                stats['bytes_downloaded'] += blob_info['size']
            else:
                if blob_size > 0:  # Only count as failed if it's an actual file
                    stats['files_failed'] += 1
        
        # Update last sync time
        LAST_SYNC_TIME.set(time.time())
        
    except AzureError as e:
        logging.error(f"❌ Azure sync error: {e}")
        SYNC_ERRORS.inc()
    
    stats['elapsed_seconds'] = time.time() - start_time
    
    logging.info(f"""
    ╔═══════════════════════════════════════╗
    ║     Azure Sync Complete               ║
    ╠═══════════════════════════════════════╣
    ║ Files Downloaded: {stats['files_downloaded']:18} ║
    ║ Bytes Downloaded: {stats['bytes_downloaded']:18} ║
    ║ Files Failed:     {stats['files_failed']:18} ║
    ║ Duration:         {stats['elapsed_seconds']:14.2f}s    ║
    ╚═══════════════════════════════════════╝
    """)
    
    return stats


# ============================================================================
# MLFLOW TRACKING
# ============================================================================
def track_sync_in_mlflow(stats: Dict):
    """Log sync operation to MLflow"""
    try:
        mlflow.set_experiment("azure_data_sync")
        
        with mlflow.start_run(run_name=f"sync_{datetime.now().strftime('%Y%m%d_%H%M%S')}"):
            # Log parameters
            log_param("container", stats['container'])
            log_param("prefix", stats['prefix'])
            log_param("storage_account", AZURE_ACCOUNT)
            
            # Log metrics
            log_metric("files_downloaded", stats['files_downloaded'])
            log_metric("bytes_downloaded", stats['bytes_downloaded'])
            log_metric("files_failed", stats['files_failed'])
            log_metric("elapsed_seconds", stats['elapsed_seconds'])
            log_metric("download_rate_mbps", 
                      (stats['bytes_downloaded'] / 1024 / 1024) / max(stats['elapsed_seconds'], 0.1))
            
            # Log artifact (sync summary)
            summary_file = LOCAL_DATA_PATH / 'sync_summary.txt'
            with open(summary_file, 'w') as f:
                f.write(f"Azure Data Sync Summary\n")
                f.write(f"{'='*50}\n")
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                f.write(f"Storage Account: {AZURE_ACCOUNT}\n")
                f.write(f"Container: {stats['container']}\n")
                f.write(f"Prefix: {stats['prefix']}\n")
                f.write(f"Files Downloaded: {stats['files_downloaded']}\n")
                f.write(f"Bytes Downloaded: {stats['bytes_downloaded']:,}\n")
                f.write(f"Files Failed: {stats['files_failed']}\n")
                f.write(f"Duration: {stats['elapsed_seconds']:.2f}s\n")
            
            log_artifact(str(summary_file))
            
        logging.info("✅ Logged sync to MLflow")
    except Exception as e:
        logging.error(f"❌ Failed to log to MLflow: {e}")


# ============================================================================
# MAIN EXECUTION
# ============================================================================
def main():
    """Main execution function"""
    logging.info("╔═══════════════════════════════════════════════════════╗")
    logging.info("║   Azure Data Sync - WealthArena MLOps Platform       ║")
    logging.info("╚═══════════════════════════════════════════════════════╝")
    
    # Start Prometheus metrics server
    prometheus_port = 8101
    try:
        start_http_server(prometheus_port)
        logging.info(f"📊 Prometheus metrics: http://localhost:{prometheus_port}/metrics")
    except OSError:
        logging.warning(f"⚠️  Port {prometheus_port} already in use, skipping Prometheus server")
    
    # Check credentials
    if not AZURE_CONNECTION_STRING and not AZURE_KEY:
        logging.error("❌ Azure credentials not found in data/azureCred.env")
        logging.info("Please set AZURE_CONNECTION_STRING in data/azureCred.env")
        return
    
    # Get blob service to explore storage
    blob_service = get_blob_service_client()
    if not blob_service:
        logging.error("❌ Could not connect to Azure. Check your credentials.")
        return
    
    # List available containers
    containers = list_containers(blob_service)
    
    if not containers:
        logging.error("❌ No containers found in the storage account.")
        return
    
    logging.info("\n" + "="*70)
    logging.info("📦 CONTAINERS FOUND IN AZURE STORAGE:")
    logging.info("="*70)
    
    # Explore each container
    for idx, container_name in enumerate(containers, 1):
        logging.info(f"\n[{idx}] Container: '{container_name}'")
        logging.info("-" * 70)
        
        try:
            container_client = blob_service.get_container_client(container_name)
            blobs = list_blobs(container_client, '')
            
            if not blobs:
                logging.info("   └─ (Empty container)")
            else:
                # Show first 5 files as preview
                preview_count = min(5, len(blobs))
                total_size = sum(b['size'] for b in blobs)
                
                logging.info(f"   📄 Total files: {len(blobs)}")
                logging.info(f"   💾 Total size: {total_size / 1024 / 1024:.2f} MB")
                logging.info(f"   📋 Preview (first {preview_count} files):")
                
                for blob in blobs[:preview_count]:
                    size_kb = blob['size'] / 1024
                    logging.info(f"      • {blob['name']} ({size_kb:.2f} KB)")
                
                if len(blobs) > preview_count:
                    logging.info(f"      ... and {len(blobs) - preview_count} more files")
        
        except Exception as e:
            logging.warning(f"   ⚠️  Could not access container: {e}")
    
    logging.info("\n" + "="*70)
    logging.info("🎯 SUMMARY:")
    logging.info("="*70)
    logging.info(f"Total containers found: {len(containers)}")
    logging.info(f"Container names: {', '.join(containers)}")
    logging.info("="*70)
    
    # If container is specified, sync it
    if AZURE_CONTAINER:
        logging.info(f"\n🔄 Starting sync for container: {AZURE_CONTAINER}")
        stats = sync_azure_data()
        track_sync_in_mlflow(stats)
        logging.info(f"\n✅ Sync complete! Data saved to: {LOCAL_DATA_PATH}")
    else:
        logging.info("\n💡 TIP: To download data from a specific container, update data/azureCred.env:")
        logging.info("   AZURE_CONTAINER=container-name-here")
        logging.info("\nThen run this script again to sync the data!")
    
    logging.info(f"\n📊 Prometheus metrics: http://localhost:{prometheus_port}/metrics")
    logging.info("Press Ctrl+C to stop...")
    
    # Keep running to serve Prometheus metrics
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        logging.info("\n👋 Shutting down Azure sync service...")


if __name__ == '__main__':
    main()

