#!/usr/bin/env python3
"""
Data Validation Script

This script validates the exported CSV files and prints data statistics.
It ensures the data is properly formatted and ready for training.
"""

import csv
import random
import sys
from collections import Counter
from pathlib import Path


def print_header(title):
    """Print a formatted header."""
    print(f"\n{'='*50}")
    print(f"{title}")
    print(f"{'='*50}")


def print_success(message):
    """Print a success message."""
    print(f"[OK] {message}")


def print_error(message):
    """Print an error message."""
    print(f"[ERROR] {message}")


def print_info(message):
    """Print an info message."""
    print(f"[INFO] {message}")


def validate_csv_file(filepath):
    """Validate a CSV file and return data."""
    print_info(f"Validating: {filepath}")
    
    if not Path(filepath).exists():
        print_error(f"File not found: {filepath}")
        return None
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            
            # Check headers
            if headers != ['text', 'label']:
                print_error(f"Invalid headers in {filepath}: {headers}")
                return None
            
            # Read all rows
            rows = list(reader)
            
            if len(rows) == 0:
                print_error(f"Empty file: {filepath}")
                return None
            
            # Validate data
            valid_labels = {'positive', 'neutral', 'negative'}
            for i, row in enumerate(rows):
                if 'text' not in row or 'label' not in row:
                    print_error(f"Missing columns in row {i+1}")
                    return None
                
                if not row['text'].strip():
                    print_error(f"Empty text in row {i+1}")
                    return None
                
                if row['label'] not in valid_labels:
                    print_error(f"Invalid label '{row['label']}' in row {i+1}")
                    return None
            
            print_success(f"Validated {len(rows)} rows")
            return rows
            
    except Exception as e:
        print_error(f"Failed to read {filepath}: {e}")
        return None


def print_label_distribution(rows, split_name):
    """Print label distribution for a split."""
    if not rows:
        return
    
    counter = Counter(row['label'] for row in rows)
    total = len(rows)
    
    print(f"\n[STATS] {split_name} Distribution:")
    for label in sorted(counter.keys()):
        count = counter[label]
        percentage = (count / total) * 100
        print(f"   {label}: {count} ({percentage:.1f}%)")


def print_sample_examples(rows, split_name, num_examples=2):
    """Print sample examples from each label."""
    if not rows:
        return
    
    print(f"\n[INFO] {split_name} Sample Examples:")
    
    # Group by label
    by_label = {}
    for row in rows:
        label = row['label']
        if label not in by_label:
            by_label[label] = []
        by_label[label].append(row['text'])
    
    # Print examples for each label
    for label in sorted(by_label.keys()):
        examples = by_label[label]
        print(f"\n   {label.upper()} examples:")
        
        # Randomly sample examples
        sample_examples = random.sample(examples, min(num_examples, len(examples)))
        for i, example in enumerate(sample_examples, 1):
            print(f"     {i}. {example}")


def main():
    """Main validation function."""
    print("[SEARCH] DATA VALIDATION SCRIPT")
    print("Validating exported CSV files...")
    
    # Set random seed for reproducible examples
    random.seed(42)
    
    # Define CSV files
    csv_files = {
        "Training": "data/finance_sentiment_train.csv",
        "Validation": "data/finance_sentiment_val.csv", 
        "Test": "data/finance_sentiment_test.csv"
    }
    
    # Validate each file
    all_data = {}
    total_rows = 0
    
    for split_name, filepath in csv_files.items():
        print_header(f"Validating {split_name} Set")
        
        rows = validate_csv_file(filepath)
        if rows is None:
            print_error(f"Validation failed for {split_name} set")
            sys.exit(2)
        
        all_data[split_name] = rows
        total_rows += len(rows)
    
    # Print summary
    print_header("VALIDATION SUMMARY")
    
    print_success(f"All files validated successfully")
    print_info(f"Total rows across all splits: {total_rows}")
    
    for split_name, rows in all_data.items():
        print_label_distribution(rows, split_name)
    
    # Print sample examples from training set
    train_rows = all_data["Training"]
    print_sample_examples(train_rows, "Training", num_examples=2)
    
    # Final validation checks
    print_header("FINAL CHECKS")
    
    # Check all splits have data
    for split_name, rows in all_data.items():
        if len(rows) == 0:
            print_error(f"{split_name} split is empty")
            sys.exit(2)
    
    # Check all labels are valid
    all_labels = set()
    for rows in all_data.values():
        for row in rows:
            all_labels.add(row['label'])
    
    valid_labels = {'positive', 'neutral', 'negative'}
    invalid_labels = all_labels - valid_labels
    
    if invalid_labels:
        print_error(f"Invalid labels found: {invalid_labels}")
        sys.exit(2)
    
    print_success("All validation checks passed")
    print_success("Data is ready for training!")
    
    return 0


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n[WARNING] Validation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        sys.exit(1)
