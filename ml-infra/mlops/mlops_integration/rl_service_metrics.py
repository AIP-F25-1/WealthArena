"""
Prometheus Metrics Integration for RL Service
This file should be integrated into WealthArena_Production/rl-service/api/inference_server.py
"""

from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from flask import Response
import time

# ============================================================================
# PROMETHEUS METRICS DEFINITIONS
# ============================================================================

# Request metrics
RL_REQUESTS_TOTAL = Counter(
    'rl_requests_total',
    'Total number of RL inference requests',
    ['endpoint', 'status']  # endpoint: /predict, /api/predictions, etc. | status: success, error
)

RL_REQUEST_LATENCY = Histogram(
    'rl_request_latency_seconds',
    'RL inference request latency in seconds',
    ['endpoint'],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0]
)

# Model inference metrics
RL_INFERENCE_TIME = Histogram(
    'rl_inference_time_seconds',
    'Time taken for model inference in seconds',
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

RL_PREDICTIONS_TOTAL = Counter(
    'rl_predictions_total',
    'Total number of predictions generated',
    ['signal']  # signal: BUY, SELL, HOLD
)

RL_PREDICTION_CONFIDENCE = Histogram(
    'rl_prediction_confidence',
    'Confidence score of predictions',
    buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

# Model service metrics
RL_MODEL_LOADED = Gauge(
    'rl_model_loaded',
    'Whether the RL model is loaded (1) or not (0)'
)

RL_MODEL_LOAD_TIME = Histogram(
    'rl_model_load_time_seconds',
    'Time taken to load the RL model',
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0]
)

# Database metrics
RL_DB_QUERY_TIME = Histogram(
    'rl_db_query_time_seconds',
    'Time taken for database queries',
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

RL_DB_QUERIES_TOTAL = Counter(
    'rl_db_queries_total',
    'Total number of database queries',
    ['status']  # status: success, error
)

# Error metrics
RL_ERRORS_TOTAL = Counter(
    'rl_errors_total',
    'Total number of errors',
    ['error_type']  # error_type: model_error, db_error, validation_error, etc.
)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def record_request(endpoint: str, status: str, latency: float):
    """
    Record a request metric
    
    Args:
        endpoint: API endpoint (e.g., '/predict', '/api/predictions')
        status: Request status ('success' or 'error')
        latency: Request latency in seconds
    """
    RL_REQUESTS_TOTAL.labels(endpoint=endpoint, status=status).inc()
    RL_REQUEST_LATENCY.labels(endpoint=endpoint).observe(latency)

def record_inference_time(duration: float):
    """
    Record model inference time
    
    Args:
        duration: Inference time in seconds
    """
    RL_INFERENCE_TIME.observe(duration)

def record_prediction(signal: str, confidence: float):
    """
    Record a prediction
    
    Args:
        signal: Trading signal ('BUY', 'SELL', 'HOLD')
        confidence: Confidence score (0.0 to 1.0)
    """
    RL_PREDICTIONS_TOTAL.labels(signal=signal).inc()
    RL_PREDICTION_CONFIDENCE.observe(confidence)

def set_model_loaded(loaded: bool):
    """
    Set model loaded status
    
    Args:
        loaded: Whether model is loaded
    """
    RL_MODEL_LOADED.set(1 if loaded else 0)

def record_model_load_time(duration: float):
    """
    Record model load time
    
    Args:
        duration: Load time in seconds
    """
    RL_MODEL_LOAD_TIME.observe(duration)

def record_db_query(status: str, duration: float):
    """
    Record database query
    
    Args:
        status: Query status ('success' or 'error')
        duration: Query duration in seconds
    """
    RL_DB_QUERIES_TOTAL.labels(status=status).inc()
    RL_DB_QUERY_TIME.observe(duration)

def record_error(error_type: str):
    """
    Record an error
    
    Args:
        error_type: Type of error ('model_error', 'db_error', 'validation_error', etc.)
    """
    RL_ERRORS_TOTAL.labels(error_type=error_type).inc()

def get_metrics_response() -> Response:
    """
    Generate Prometheus metrics response
    
    Returns:
        Flask Response with metrics data
    """
    return Response(
        generate_latest(),
        mimetype=CONTENT_TYPE_LATEST
    )

# ============================================================================
# DECORATOR FOR AUTOMATIC METRICS RECORDING
# ============================================================================

def track_request(endpoint: str):
    """
    Decorator to automatically track request metrics
    
    Usage:
        @app.route('/predict', methods=['POST'])
        @track_request('/predict')
        def predict():
            ...
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            start_time = time.time()
            status = 'success'
            try:
                result = func(*args, **kwargs)
                # Check if result is a Flask response with error status
                if hasattr(result, 'status_code') and result.status_code >= 400:
                    status = 'error'
                return result
            except Exception as e:
                status = 'error'
                record_error('request_error')
                raise
            finally:
                latency = time.time() - start_time
                record_request(endpoint, status, latency)
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator

