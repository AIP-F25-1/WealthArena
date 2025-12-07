#!/usr/bin/env python3
"""
One-Button Pipeline: Data Export → Notebook Execution → Model Training → Validation

This script orchestrates the complete pipeline from data preparation to model training.
It ensures all steps complete successfully and validates the final artifacts.
"""

import csv
import json
import os
import subprocess
import sys
import time
from pathlib import Path


def print_step(step_name, description):
    """Print a formatted step header."""
    print(f"\n{'='*60}")
    print(f"STEP: {step_name}")
    print(f"DESC: {description}")
    print(f"{'='*60}")


def print_success(message):
    """Print a success message."""
    print(f"[OK] SUCCESS: {message}")


def print_error(message):
    """Print an error message."""
    print(f"[ERROR] ERROR: {message}")


def print_info(message):
    """Print an info message."""
    print(f"[INFO] INFO: {message}")


def ensure_directories():
    """Ensure required directories exist."""
    print_step("DIRECTORIES", "Ensuring required directories exist")
    
    directories = ["data", "models", "models/sentiment-finetuned"]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print_info(f"Directory ensured: {directory}")
    
    print_success("All directories created")


def run_data_export():
    """Step A: Run data export script."""
    print_step("DATA EXPORT", "Running Financial PhraseBank export script")
    
    try:
        print_info("Executing: python scripts/export_finphrasebank.py")
        result = subprocess.run([
            sys.executable, "scripts/export_finphrasebank.py"
        ], capture_output=True, text=True, timeout=300)
        
        print_info(f"Export script return code: {result.returncode}")
        if result.stdout:
            print_info("Export output:")
            print(result.stdout)
        if result.stderr:
            print_info("Export errors:")
            print(result.stderr)
            
    except subprocess.TimeoutExpired:
        print_error("Export script timed out after 5 minutes")
        return False
    except Exception as e:
        print_error(f"Failed to run export script: {e}")
        return False
    
    # Validate CSV files exist and have proper content
    csv_files = [
        "data/finance_sentiment_train.csv",
        "data/finance_sentiment_val.csv", 
        "data/finance_sentiment_test.csv"
    ]
    
    total_rows = 0
    for csv_file in csv_files:
        if not Path(csv_file).exists():
            print_error(f"Missing required file: {csv_file}")
            return False
        
        # Check file has proper header and content
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames
                
                if headers != ['text', 'label']:
                    print_error(f"Invalid headers in {csv_file}: {headers}")
                    return False
                
                rows = list(reader)
                total_rows += len(rows)
                
                if len(rows) == 0:
                    print_error(f"Empty file: {csv_file}")
                    return False
                
                print_info(f"{csv_file}: {len(rows)} rows")
                
        except Exception as e:
            print_error(f"Failed to read {csv_file}: {e}")
            return False
    
    if total_rows < 30:
        print_error(f"Insufficient data: only {total_rows} total rows (need ≥30)")
        return False
    
    print_success(f"Data export completed: {total_rows} total rows across 3 files")
    return True


def run_notebook(nb_path: str, out_name: str, timeout_s: int = 600) -> int:
    """Execute a Jupyter notebook using the current Python interpreter."""
    nb = Path(nb_path).resolve()
    out = Path(nb.parent, out_name).resolve()
    
    print_info(f"Executing notebook: {nb}")
    print_info(f"Notebook exists: {nb.exists()}")
    print_info(f"Output will be saved to: {out}")
    
    if not nb.exists():
        print_error(f"Notebook not found: {nb}")
        return 1
    
    # Check if jupyter is available
    try:
        result = subprocess.run([
            sys.executable, "-c", "import jupyter"
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print_error("Jupyter not found. Please run: pip install jupyter")
            return 1
    except Exception as e:
        print_error(f"Failed to check Jupyter availability: {e}")
        return 1
    
    # Check and install tf-keras for Transformers compatibility
    try:
        result = subprocess.run([
            sys.executable, "-c", "import tf_keras"
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print_info("tf-keras not found, installing for Transformers compatibility...")
            install_result = subprocess.run([
                sys.executable, "-m", "pip", "install", "tf-keras"
            ], capture_output=True, text=True)
            
            if install_result.returncode != 0:
                print_error("Failed to install tf-keras. This may cause issues with Transformers.")
                print_error(f"Error: {install_result.stderr}")
            else:
                print_success("tf-keras installed successfully")
    except Exception as e:
        print_error(f"Failed to check tf-keras availability: {e}")
    
    # Build command using current Python interpreter
    cmd = [
        sys.executable, "-m", "jupyter", "nbconvert",
        "--to", "notebook",
        "--execute",
        f"--ExecutePreprocessor.timeout={timeout_s}",
        "--output", str(out),
        str(nb),
    ]
    
    print_info(f"Running: {' '.join(cmd)}")
    
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s + 300)
        
        if proc.returncode != 0:
            print_error("nbconvert failed")
            if proc.stdout:
                print_error("STDOUT:")
                print(proc.stdout)
            if proc.stderr:
                print_error("STDERR:")
                print(proc.stderr)
        else:
            print_success(f"Notebook executed successfully: {out}")
            
        return proc.returncode
        
    except subprocess.TimeoutExpired:
        print_error(f"Notebook execution timed out after {timeout_s + 300} seconds")
        return 1
    except Exception as e:
        print_error(f"Failed to execute notebook: {e}")
        return 1


def run_notebook_01():
    """Step B: Execute notebook 01 (data preparation)."""
    print_step("NOTEBOOK 01", "Executing data preparation notebook")
    
    notebook_path = "notebooks/01_prepare_data.ipynb"
    abs_notebook_path = Path(notebook_path).resolve()
    
    print_info(f"Looking for notebook at: {abs_notebook_path}")
    print_info(f"Current working directory: {Path.cwd()}")
    
    rc = run_notebook(notebook_path, "01_prepare_data.out.ipynb")
    if rc != 0:
        print_error("Pipeline failed at notebook 01 execution")
        sys.exit(3)
    
    return True


def run_notebook_02():
    """Step C: Execute notebook 02 (model training)."""
    print_step("NOTEBOOK 02", "Executing sentiment analysis training notebook")
    
    notebook_path = "notebooks/02_finetune_sentiment.ipynb"
    abs_notebook_path = Path(notebook_path).resolve()
    
    print_info(f"Looking for notebook at: {abs_notebook_path}")
    print_info(f"Current working directory: {Path.cwd()}")
    
    rc = run_notebook(notebook_path, "02_finetune_sentiment.out.ipynb")
    if rc != 0:
        print_error("Pipeline failed at notebook 02 execution")
        sys.exit(3)
    
    return True


def validate_training_artifacts():
    """Step D: Validate training artifacts and metrics."""
    print_step("VALIDATION", "Validating training artifacts and metrics")
    
    model_dir = Path("models/sentiment-finetuned")
    metrics_file = model_dir / "metrics.json"
    
    # Check model directory exists
    if not model_dir.exists():
        print_error(f"Model directory not found: {model_dir}")
        return False
    
    # Check for required model files
    required_files = ["config.json"]
    optional_files = ["tokenizer.json", "vocab.txt", "merges.txt"]
    
    found_required = []
    for file in required_files:
        if (model_dir / file).exists():
            found_required.append(file)
    
    if not found_required:
        print_error(f"No required model files found in {model_dir}")
        return False
    
    # Check for at least one tokenizer file
    found_tokenizer = any((model_dir / file).exists() for file in optional_files)
    if not found_tokenizer:
        print_error(f"No tokenizer files found in {model_dir}")
        return False
    
    print_info(f"Model files found: {found_required}")
    print_info(f"Tokenizer files found: {[f for f in optional_files if (model_dir / f).exists()]}")
    
    # Check metrics file
    if not metrics_file.exists():
        print_error(f"Metrics file not found: {metrics_file}")
        return False
    
    try:
        with open(metrics_file, 'r') as f:
            metrics = json.load(f)
        
        # Validate metrics structure
        required_keys = ["accuracy", "f1_macro", "inference_ms"]
        missing_keys = [key for key in required_keys if key not in metrics]
        
        if missing_keys:
            print_error(f"Missing metrics keys: {missing_keys}")
            return False
        
        # Validate metric types and values
        for key in required_keys:
            value = metrics[key]
            if not isinstance(value, (int, float)):
                print_error(f"Invalid metric type for {key}: {type(value)}")
                return False
            
            if key == "inference_ms" and value <= 0:
                print_error(f"Invalid inference time: {value}ms")
                return False
        
        # Print final results
        print_success("Training artifacts validated successfully")
        print(f"\n🎯 FINAL RESULTS:")
        print(f"   Accuracy: {metrics['accuracy']:.4f} ({metrics['accuracy']*100:.2f}%)")
        print(f"   F1-Macro: {metrics['f1_macro']:.4f}")
        print(f"   Inference: {metrics['inference_ms']:.2f}ms")
        
        print(f"\n📋 RESULT: accuracy={metrics['accuracy']:.4f}, f1_macro={metrics['f1_macro']:.4f}, inference_ms={metrics['inference_ms']:.2f}")
        
        return True
        
    except json.JSONDecodeError as e:
        print_error(f"Invalid JSON in metrics file: {e}")
        return False
    except Exception as e:
        print_error(f"Failed to read metrics file: {e}")
        return False


def main():
    """Main pipeline execution."""
    print("[START] ONE-BUTTON PIPELINE: Data Export -> Training -> Validation")
    print("=" * 70)
    print(f"Started at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check working directory and key files
    current_dir = Path.cwd()
    print_info(f"Current working directory: {current_dir}")
    
    # Check for key project files to ensure we're in the right directory
    key_files = [
        "scripts/export_finphrasebank.py",
        "notebooks/01_prepare_data.ipynb", 
        "notebooks/02_finetune_sentiment.ipynb"
    ]
    
    missing_files = []
    for file_path in key_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print_error("Missing required files:")
        for file_path in missing_files:
            print_error(f"  - {file_path}")
        print_error("Please ensure you're running from the WealthArena project root directory")
        return 1
    
    print_info("All required files found, proceeding with pipeline...")
    
    # Step 1: Ensure directories
    ensure_directories()
    
    # Step 2: Data export
    if not run_data_export():
        print_error("Pipeline failed at data export step")
        sys.exit(2)
    
    # Step 3: Execute notebook 01
    run_notebook_01()
    
    # Step 4: Execute notebook 02
    run_notebook_02()
    
    # Step 5: Validate artifacts
    if not validate_training_artifacts():
        print_error("Pipeline failed at validation step")
        sys.exit(4)
    
    # Success!
    print(f"\n[SUCCESS] PIPELINE COMPLETED SUCCESSFULLY!")
    print(f"   Data prepared [OK]")
    print(f"   Model trained [OK]") 
    print(f"   Metrics loaded [OK]")
    print(f"   Completed at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    return 0


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n[WARNING] Pipeline interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        sys.exit(1)
