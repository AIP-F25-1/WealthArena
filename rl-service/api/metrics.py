"""
Prometheus Metrics Module for RL Service
Collects ML inference metrics for monitoring
"""

from prometheus_client import Counter, Histogram, Gauge, generate_latest, REGISTRY
import time
from typing import Optional

# Inference Metrics
inference_requests_total = Counter(
    'inference_requests_total',
    'Total number of inference requests',
    ['model', 'status']
)

inference_duration_seconds = Histogram(
    'inference_duration_seconds',
    'Duration of inference requests in seconds',
    ['model'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
)

inference_errors_total = Counter(
    'inference_errors_total',
    'Total number of inference errors',
    ['model', 'error_type']
)

model_loaded = Gauge(
    'model_loaded',
    'Whether model is loaded (1) or not (0)',
    ['model']
)

# Database Metrics
db_query_duration_seconds = Histogram(
    'db_query_duration_seconds',
    'Duration of database queries in seconds',
    ['query_type'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5]
)

db_query_errors_total = Counter(
    'db_query_errors_total',
    'Total number of database query errors',
    ['query_type']
)


def record_inference(duration: float, model_name: str = 'default', status: str = 'success'):
    """
    Record inference metrics
    
    Args:
        duration: Inference duration in seconds
        model_name: Name of the model used
        status: Status of the inference ('success' or 'error')
    """
    inference_requests_total.labels(model=model_name, status=status).inc()
    inference_duration_seconds.labels(model=model_name).observe(duration)


def record_error(model_name: str = 'default', error_type: str = 'unknown'):
    """
    Record inference error
    
    Args:
        model_name: Name of the model used
        error_type: Type of error that occurred
    """
    inference_errors_total.labels(model=model_name, error_type=error_type).inc()


def set_model_loaded(value: int, model_name: str = 'default'):
    """
    Set model loaded status
    
    Args:
        value: 1 if loaded, 0 if not
        model_name: Name of the model
    """
    model_loaded.labels(model=model_name).set(value)


def record_db_query(duration: float, query_type: str = 'select'):
    """
    Record database query metrics
    
    Args:
        duration: Query duration in seconds
        query_type: Type of query ('select', 'insert', 'update', 'delete')
    """
    db_query_duration_seconds.labels(query_type=query_type).observe(duration)


def record_db_error(query_type: str = 'select'):
    """
    Record database query error
    
    Args:
        query_type: Type of query that failed
    """
    db_query_errors_total.labels(query_type=query_type).inc()


def generate_metrics():
    """
    Generate Prometheus-formatted metrics
    
    Returns:
        bytes: Prometheus metrics in text format
    """
    return generate_latest(REGISTRY)

