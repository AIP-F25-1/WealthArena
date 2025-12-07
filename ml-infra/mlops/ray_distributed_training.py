"""
Ray Distributed Training for WealthArena
=========================================

Implements distributed model training using Ray:
- Parallel hyperparameter search
- Distributed data processing
- Multi-worker training
- Resource management

Week 2 Task: Set up distributed training with Ray
"""

import ray
import time
import random
import numpy as np
import pandas as pd
from datetime import datetime
import mlflow
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus Metrics
RAY_TASKS_TOTAL = Counter('wealtharena_ray_tasks_total', 'Total Ray tasks', ['status'])
RAY_TRAINING_DURATION = Histogram('wealtharena_ray_training_duration_seconds', 'Training duration')
RAY_ACTIVE_WORKERS = Gauge('wealtharena_ray_active_workers', 'Active Ray workers')
RAY_BEST_ACCURACY = Gauge('wealtharena_ray_best_accuracy', 'Best model accuracy from distributed training')

# MLflow setup
mlflow.set_experiment("ray_distributed_training")


@ray.remote
def train_model_worker(trial_id, params, data_size=1000):
    """
    Ray remote worker for model training
    """
    logger.info(f"Worker {trial_id}: Training with params {params}")
    
    # Simulate data loading
    X = np.random.randn(data_size, 10)
    y = np.random.randint(0, 2, data_size)
    
    # Simulate training
    epochs = params.get('epochs', 10)
    lr = params.get('lr', 0.01)
    
    best_accuracy = 0
    for epoch in range(epochs):
        # Simulate training progress
        accuracy = 0.5 + (epoch / epochs) * 0.4 + random.uniform(-0.05, 0.05)
        accuracy += lr * 0.1  # Learning rate affects accuracy
        accuracy = min(accuracy, 0.99)
        best_accuracy = max(best_accuracy, accuracy)
        
        time.sleep(0.1)  # Simulate computation
    
    result = {
        'trial_id': trial_id,
        'accuracy': best_accuracy,
        'params': params,
        'training_time': epochs * 0.1,
    }
    
    logger.info(f"Worker {trial_id}: Completed with accuracy {best_accuracy:.4f}")
    return result


@ray.remote
def process_data_chunk(chunk_id, data_size=1000):
    """
    Ray remote worker for data processing
    """
    logger.info(f"Processing data chunk {chunk_id}")
    
    # Simulate data processing
    data = pd.DataFrame({
        'price': np.random.uniform(100, 200, data_size),
        'volume': np.random.randint(1000, 10000, data_size),
        'returns': np.random.randn(data_size) * 0.02,
    })
    
    # Feature engineering
    data['ma_7'] = data['price'].rolling(7, min_periods=1).mean()
    data['volatility'] = data['returns'].rolling(7, min_periods=1).std()
    
    time.sleep(0.5)  # Simulate processing time
    
    logger.info(f"Chunk {chunk_id}: Processed {len(data)} rows")
    return {
        'chunk_id': chunk_id,
        'rows': len(data),
        'features': data.shape[1],
        'data': data,
    }


def distributed_hyperparameter_search(n_trials=10, n_workers=4):
    """
    Distributed hyperparameter search using Ray
    """
    logger.info(f"\nStarting distributed HPO with {n_trials} trials across {n_workers} workers")
    
    with mlflow.start_run(run_name=f"ray_hpo_{datetime.now().strftime('%Y%m%d_%H%M%S')}"):
        mlflow.log_param("n_trials", n_trials)
        mlflow.log_param("n_workers", n_workers)
        
        RAY_ACTIVE_WORKERS.set(n_workers)
        
        # Generate hyperparameter combinations
        trials = []
        for i in range(n_trials):
            params = {
                'lr': random.uniform(0.001, 0.1),
                'epochs': random.randint(5, 20),
                'batch_size': random.choice([16, 32, 64, 128]),
            }
            trials.append((i, params))
        
        # Distribute training across Ray workers
        start_time = time.time()
        
        logger.info("Submitting tasks to Ray cluster...")
        futures = [train_model_worker.remote(trial_id, params) for trial_id, params in trials]
        
        # Collect results
        logger.info("Waiting for workers to complete...")
        results = ray.get(futures)
        
        training_duration = time.time() - start_time
        RAY_TRAINING_DURATION.observe(training_duration)
        
        # Find best result
        best_result = max(results, key=lambda x: x['accuracy'])
        
        RAY_BEST_ACCURACY.set(best_result['accuracy'])
        RAY_TASKS_TOTAL.labels(status="success").inc(n_trials)
        
        # Log to MLflow
        mlflow.log_metric("best_accuracy", best_result['accuracy'])
        mlflow.log_metric("total_training_time", training_duration)
        mlflow.log_metric("avg_time_per_trial", training_duration / n_trials)
        mlflow.log_params(best_result['params'])
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Distributed HPO Results:")
        logger.info(f"  Trials completed: {n_trials}")
        logger.info(f"  Total time: {training_duration:.2f}s")
        logger.info(f"  Avg time per trial: {training_duration/n_trials:.2f}s")
        logger.info(f"  Best accuracy: {best_result['accuracy']:.4f}")
        logger.info(f"  Best params: {best_result['params']}")
        logger.info(f"{'='*60}\n")
        
        return best_result


def distributed_data_processing(n_chunks=8):
    """
    Distributed data processing using Ray
    """
    logger.info(f"\nStarting distributed data processing with {n_chunks} chunks")
    
    with mlflow.start_run(run_name=f"ray_data_proc_{datetime.now().strftime('%Y%m%d_%H%M%S')}"):
        mlflow.log_param("n_chunks", n_chunks)
        
        start_time = time.time()
        
        # Distribute data processing
        logger.info("Submitting data processing tasks...")
        futures = [process_data_chunk.remote(i) for i in range(n_chunks)]
        
        # Collect results
        logger.info("Waiting for processing to complete...")
        results = ray.get(futures)
        
        processing_duration = time.time() - start_time
        
        total_rows = sum(r['rows'] for r in results)
        
        # Log to MLflow
        mlflow.log_metric("total_rows", total_rows)
        mlflow.log_metric("processing_time", processing_duration)
        mlflow.log_metric("rows_per_second", total_rows / processing_duration)
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Distributed Data Processing Results:")
        logger.info(f"  Chunks processed: {n_chunks}")
        logger.info(f"  Total rows: {total_rows}")
        logger.info(f"  Processing time: {processing_duration:.2f}s")
        logger.info(f"  Throughput: {total_rows/processing_duration:.0f} rows/sec")
        logger.info(f"{'='*60}\n")
        
        RAY_TASKS_TOTAL.labels(status="success").inc(n_chunks)
        
        return results


def main():
    """
    Main entry point for Ray distributed training
    """
    import argparse
    
    parser = argparse.ArgumentParser(description='WealthArena Ray Distributed Training')
    parser.add_argument('--port', type=int, default=8011, help='Prometheus metrics port')
    parser.add_argument('--trials', type=int, default=12, help='Number of HPO trials')
    parser.add_argument('--workers', type=int, default=4, help='Number of Ray workers')
    parser.add_argument('--data-chunks', type=int, default=8, help='Number of data chunks to process')
    args = parser.parse_args()
    
    # Start Prometheus metrics server
    start_http_server(args.port)
    logger.info(f"[Ray] Metrics server started on port {args.port}")
    logger.info(f"[Ray] Access metrics at http://localhost:{args.port}/metrics\n")
    
    # Initialize Ray
    try:
        logger.info("Initializing Ray cluster...")
        ray.init(num_cpus=args.workers, ignore_reinit_error=True)
        logger.info(f"✅ Ray initialized with {args.workers} CPUs")
        
        # Run distributed hyperparameter search
        logger.info("\n" + "="*60)
        logger.info("Task 1: Distributed Hyperparameter Search")
        logger.info("="*60)
        best_model = distributed_hyperparameter_search(
            n_trials=args.trials,
            n_workers=args.workers
        )
        
        # Run distributed data processing
        logger.info("\n" + "="*60)
        logger.info("Task 2: Distributed Data Processing")
        logger.info("="*60)
        processed_data = distributed_data_processing(n_chunks=args.data_chunks)
        
        logger.info("\n" + "="*60)
        logger.info("Ray distributed training completed successfully!")
        logger.info(f"Metrics available at http://localhost:{args.port}/metrics")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"❌ Ray training failed: {e}")
        RAY_TASKS_TOTAL.labels(status="error").inc()
    
    finally:
        # Shutdown Ray
        RAY_ACTIVE_WORKERS.set(0)
        logger.info("\nShutting down Ray cluster...")
        ray.shutdown()
        logger.info("✅ Ray shutdown complete")


if __name__ == "__main__":
    main()

