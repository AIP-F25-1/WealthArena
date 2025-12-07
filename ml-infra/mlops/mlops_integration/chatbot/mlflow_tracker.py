"""
MLflow Integration for Chatbot Service
Logs chatbot interactions, sentiment analysis, and performance metrics to MLflow
"""

import os
from typing import Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Try to import MLflow (optional)
try:
    import mlflow
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False
    mlflow = None
    logger.warning("MLflow not installed, MLflow logging will be disabled")

# MLflow configuration
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000")
MLFLOW_EXPERIMENT_NAME = os.getenv("MLFLOW_EXPERIMENT_NAME", "chatbot_service")

# Initialize MLflow if available
if MLFLOW_AVAILABLE and mlflow:
    try:
        mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
        mlflow.set_experiment(MLFLOW_EXPERIMENT_NAME)
        logger.info(f"MLflow initialized: {MLFLOW_TRACKING_URI}, experiment: {MLFLOW_EXPERIMENT_NAME}")
    except Exception as e:
        MLFLOW_AVAILABLE = False
        logger.warning(f"MLflow not available: {e}")

def log_chat_interaction(
    message: str,
    response: str,
    latency: float,
    status: str = "success",
    tools_used: Optional[list] = None,
    sentiment: Optional[Dict[str, Any]] = None,
    trace_id: Optional[str] = None
):
    """
    Log a chat interaction to MLflow
    
    Args:
        message: User message
        response: Bot response
        latency: Request latency in seconds
        status: Request status (success, error)
        tools_used: List of tools used
        sentiment: Sentiment analysis result (if available)
        trace_id: Trace ID for the interaction
    """
    if not MLFLOW_AVAILABLE or not mlflow:
        return
    
    try:
        with mlflow.start_run(run_name=f"chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}", nested=True):
            # Log parameters
            mlflow.log_param("message_length", len(message))
            mlflow.log_param("response_length", len(response))
            mlflow.log_param("status", status)
            mlflow.log_param("trace_id", trace_id or "unknown")
            
            if tools_used:
                mlflow.log_param("tools_used", ",".join(tools_used))
            
            # Log metrics
            mlflow.log_metric("latency_seconds", latency)
            mlflow.log_metric("request_status", 1 if status == "success" else 0)
            
            # Log sentiment if available
            if sentiment:
                mlflow.log_metric("sentiment_confidence", sentiment.get("confidence", 0.0))
                mlflow.log_param("sentiment_label", sentiment.get("label", "unknown"))
            
            # Log artifacts (sample message/response)
            if len(message) < 500 and len(response) < 500:
                interaction_data = {
                    "message": message[:200],
                    "response": response[:200],
                    "timestamp": datetime.now().isoformat(),
                    "latency": latency,
                    "status": status
                }
                import tempfile
                import json
                with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                    json.dump(interaction_data, f, indent=2)
                    mlflow.log_artifact(f.name, "interactions")
    except Exception as e:
        logger.warning(f"Failed to log to MLflow: {e}")

def log_sentiment_analysis(
    text: str,
    sentiment_result: Dict[str, Any],
    model_version: str = "1.0.0"
):
    """
    Log sentiment analysis result to MLflow
    
    Args:
        text: Analyzed text
        sentiment_result: Sentiment analysis result
        model_version: Model version used
    """
    if not MLFLOW_AVAILABLE or not mlflow:
        return
    
    try:
        with mlflow.start_run(run_name=f"sentiment_{datetime.now().strftime('%Y%m%d_%H%M%S')}", nested=True):
            mlflow.log_param("model_version", model_version)
            mlflow.log_param("text_length", len(text))
            mlflow.log_param("sentiment_label", sentiment_result.get("label", "unknown"))
            
            probs = sentiment_result.get("probs", [])
            if len(probs) >= 3:
                mlflow.log_metric("sentiment_negative_prob", probs[0])
                mlflow.log_metric("sentiment_neutral_prob", probs[1])
                mlflow.log_metric("sentiment_positive_prob", probs[2])
                mlflow.log_metric("sentiment_confidence", max(probs))
    except Exception as e:
        logger.warning(f"Failed to log sentiment to MLflow: {e}")

def log_chatbot_metrics_summary(
    total_requests: int,
    success_count: int,
    error_count: int,
    avg_latency: float,
    p95_latency: float
):
    """
    Log chatbot metrics summary to MLflow
    
    Args:
        total_requests: Total number of requests
        success_count: Number of successful requests
        error_count: Number of failed requests
        avg_latency: Average latency in seconds
        p95_latency: 95th percentile latency
    """
    if not MLFLOW_AVAILABLE or not mlflow:
        return
    
    try:
        with mlflow.start_run(run_name=f"metrics_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}"):
            mlflow.log_metric("total_requests", total_requests)
            mlflow.log_metric("success_count", success_count)
            mlflow.log_metric("error_count", error_count)
            mlflow.log_metric("success_rate", success_count / total_requests if total_requests > 0 else 0)
            mlflow.log_metric("avg_latency_seconds", avg_latency)
            mlflow.log_metric("p95_latency_seconds", p95_latency)
    except Exception as e:
        logger.warning(f"Failed to log metrics summary to MLflow: {e}")

