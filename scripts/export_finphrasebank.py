#!/usr/bin/env python3
"""
Export Financial PhraseBank dataset to CSV files for sentiment analysis training.

This script is Windows-robust with multiple fallback mechanisms:
1. Try to load via 🤗 datasets library with trust_remote_code=True
2. Fallback to huggingface_hub snapshot download if datasets fails
3. Fallback to synthetic demo data if snapshot fails
4. Always produces three CSV files with stratified splits
"""

import csv
import json
import os
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

# Windows-compatible output symbols
if sys.platform == "win32":
    # Use simple ASCII symbols for Windows compatibility
    SYMBOLS = {
        'rocket': '[START]',
        'gear': '[WORKING]',
        'chart': '[DATA]',
        'check': '[OK]',
        'cross': '[ERROR]',
        'folder': '[FOLDER]',
        'file': '[FILE]',
        'magnifying': '[SEARCH]',
        'floppy': '[SAVE]',
        'party': '[SUCCESS]',
        'lightbulb': '[TIP]',
        'bar_chart': '[STATS]',
        'arrows': '[SPLIT]',
        'download': '[DOWNLOAD]',
        'database': '[DATABASE]'
    }
else:
    # Use emojis for other platforms
    SYMBOLS = {
        'rocket': '🚀',
        'gear': '🔄',
        'chart': '📊',
        'check': '✅',
        'cross': '❌',
        'folder': '📁',
        'file': '📄',
        'magnifying': '🔍',
        'floppy': '💾',
        'party': '🎉',
        'lightbulb': '💡',
        'bar_chart': '📈',
        'arrows': '🔄',
        'download': '📥',
        'database': '📋'
    }


def load_via_datasets():
    """Try to load dataset via Hugging Face datasets library."""
    print(f"{SYMBOLS['gear']} Attempting to load via Hugging Face datasets library...")
    
    try:
        import datasets
        
        # Get auth token from environment
        auth_token = os.getenv("HF_API_TOKEN")
        
        print(f"{SYMBOLS['chart']} Loading Financial PhraseBank dataset with trust_remote_code=True...")
        dataset = datasets.load_dataset(
            "financial_phrasebank", 
            "sentences_allagree",
            trust_remote_code=True,
            use_auth_token=auth_token if auth_token else None
        )
        
        # Convert to list of dicts
        rows = []
        for item in dataset['train']:
            rows.append({
                'text': item['sentence'],
                'label': item['label']
            })
        
        print(f"{SYMBOLS['check']} Loaded {len(rows)} samples via datasets library")
        return rows
        
    except Exception as e:
        print(f"{SYMBOLS['cross']} Failed to load via datasets: {e}")
        return None


def load_via_snapshot():
    """Try to load dataset via huggingface_hub snapshot download."""
    print(f"{SYMBOLS['gear']} Attempting to load via snapshot download...")
    
    try:
        from huggingface_hub import snapshot_download
        
        print(f"{SYMBOLS['download']} Downloading dataset snapshot...")
        local_dir = snapshot_download(
            repo_id="financial_phrasebank",
            repo_type="dataset"
        )
        
        print(f"{SYMBOLS['folder']} Snapshot downloaded to: {local_dir}")
        
        # Search for data files
        data_files = []
        for root, dirs, files in os.walk(local_dir):
            # Prefer sentences_allagree folder if it exists
            if "sentences_allagree" in root:
                for file in files:
                    if file.endswith(('.csv', '.tsv', '.txt')):
                        data_files.insert(0, (root, file))  # Prioritize
            else:
                for file in files:
                    if file.endswith(('.csv', '.tsv', '.txt')):
                        data_files.append((root, file))
        
        if not data_files:
            print(f"{SYMBOLS['cross']} No data files found in snapshot")
            return None
        
        print(f"{SYMBOLS['database']} Found {len(data_files)} potential data files")
        
        # Try to parse files
        for root, filename in data_files:
            filepath = os.path.join(root, filename)
            print(f"{SYMBOLS['magnifying']} Trying to parse: {filepath}")
            
            rows = parse_data_file(filepath)
            if rows:
                print(f"{SYMBOLS['check']} Successfully parsed {len(rows)} samples from {filename}")
                return rows
        
        print(f"{SYMBOLS['cross']} No parsable data files found")
        return None
        
    except Exception as e:
        print(f"{SYMBOLS['cross']} Failed to load via snapshot: {e}")
        return None


def parse_data_file(filepath):
    """Parse various data file formats."""
    try:
        rows = []
        
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            # Try CSV format first
            if filepath.endswith('.csv'):
                reader = csv.DictReader(f)
                for row in reader:
                    if 'text' in row and 'label' in row:
                        rows.append({'text': row['text'], 'label': row['label']})
                    elif len(row) >= 2:
                        # Assume first two columns are text, label
                        cols = list(row.values())
                        rows.append({'text': cols[0], 'label': cols[1]})
            
            # Try TSV format
            elif filepath.endswith('.tsv'):
                reader = csv.DictReader(f, delimiter='\t')
                for row in reader:
                    if 'text' in row and 'label' in row:
                        rows.append({'text': row['text'], 'label': row['label']})
                    elif len(row) >= 2:
                        cols = list(row.values())
                        rows.append({'text': cols[0], 'label': cols[1]})
            
            # Try TXT format with various patterns
            elif filepath.endswith('.txt'):
                f.seek(0)  # Reset file pointer
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Pattern: __label__<label>\t<text>
                    if line.startswith('__label__'):
                        parts = line.split('\t', 1)
                        if len(parts) == 2:
                            label = parts[0].replace('__label__', '')
                            text = parts[1]
                            rows.append({'text': text, 'label': label})
                    
                    # Pattern: <text>\t<label>
                    elif '\t' in line:
                        parts = line.split('\t', 1)
                        if len(parts) == 2:
                            text, label = parts
                            rows.append({'text': text, 'label': label})
        
        return rows if rows else None
        
    except Exception as e:
        print(f"{SYMBOLS['cross']} Failed to parse {filepath}: {e}")
        return None


def generate_demo_data(n=300):
    """Generate synthetic demo dataset with finance sentences."""
    print(f"{SYMBOLS['gear']} Generating {n} synthetic finance sentences...")
    
    # Finance sentence templates by sentiment
    templates = {
        'positive': [
            "The company reported strong quarterly earnings that beat analyst expectations.",
            "Revenue growth accelerated to 15% year-over-year, exceeding guidance.",
            "The stock surged 8% after the positive earnings announcement.",
            "Management raised full-year guidance due to robust demand.",
            "The dividend was increased by 12% reflecting strong cash flow.",
            "New product launch exceeded sales targets by 25%.",
            "The merger created significant synergies and cost savings.",
            "Customer acquisition costs decreased while retention improved.",
            "The company secured a major contract worth $50M annually.",
            "Operating margins expanded to 18% from 15% last quarter.",
            "The IPO was oversubscribed by 3x indicating strong investor demand.",
            "The CEO's strategic vision is driving impressive growth.",
            "The company's ESG initiatives are gaining investor recognition.",
            "International expansion is showing promising early results.",
            "The balance sheet remains strong with low debt levels."
        ],
        'neutral': [
            "The company maintained its quarterly dividend at $0.25 per share.",
            "Revenue was flat compared to the previous quarter.",
            "The stock price remained relatively stable throughout the day.",
            "Management provided updated guidance for the next quarter.",
            "The board of directors held its regular monthly meeting.",
            "The company announced a stock split effective next month.",
            "Trading volume was average for the sector.",
            "The earnings call is scheduled for next Tuesday.",
            "The company filed its quarterly 10-Q report with the SEC.",
            "Analyst coverage was unchanged with 5 buy, 3 hold ratings.",
            "The company's market cap is approximately $2.5 billion.",
            "The annual shareholder meeting will be held in May.",
            "The company maintains its investment grade credit rating.",
            "The quarterly results were in line with expectations.",
            "The company continues to focus on operational efficiency."
        ],
        'negative': [
            "The company missed quarterly earnings expectations by 8%.",
            "Revenue declined 5% year-over-year due to market headwinds.",
            "The stock dropped 12% after the disappointing guidance.",
            "Management lowered full-year outlook citing economic uncertainty.",
            "The dividend was cut by 20% to preserve cash.",
            "The product recall will impact Q4 results significantly.",
            "The merger fell through due to regulatory concerns.",
            "Customer churn increased to 15% from 8% last quarter.",
            "The company lost a major contract worth $30M annually.",
            "Operating margins compressed to 8% from 12% last year.",
            "The IPO was undersubscribed indicating weak investor demand.",
            "The CEO resigned amid accounting irregularities.",
            "The company faces potential regulatory fines.",
            "International operations are underperforming expectations.",
            "The balance sheet shows concerning debt levels."
        ]
    }
    
    # Additional finance topics for variety
    topics = [
        "earnings", "guidance", "revenue", "profit", "loss", "dividend", 
        "stock", "market", "trading", "investment", "analyst", "upgrade", 
        "downgrade", "IPO", "merger", "acquisition", "layoffs", "hiring",
        "CPI", "inflation", "interest rates", "Fed", "JOLTS", "unemployment",
        "GDP", "recession", "recovery", "stimulus", "bailout", "regulation"
    ]
    
    rows = []
    random.seed(42)  # For reproducibility
    
    for i in range(n):
        sentiment = random.choice(['positive', 'neutral', 'negative'])
        template = random.choice(templates[sentiment])
        
        # Sometimes add topic variety
        if random.random() < 0.3:  # 30% chance to modify
            topic = random.choice(topics)
            template = template.replace("company", f"{topic} company")
        
        rows.append({
            'text': template,
            'label': sentiment
        })
    
    print(f"{SYMBOLS['check']} Generated {len(rows)} synthetic samples")
    return rows


def stratified_split(rows, y_key="label", seed=42, train=0.7, val=0.15):
    """Perform stratified split using only standard library."""
    print(f"{SYMBOLS['arrows']} Performing stratified split (train={train:.0%}, val={val:.0%}, test={1-train-val:.0%})...")
    
    # Set random seed
    random.seed(seed)
    
    # Group by label for stratification
    label_groups = defaultdict(list)
    for row in rows:
        label_groups[row[y_key]].append(row)
    
    train_rows = []
    val_rows = []
    test_rows = []
    
    # Split each label group proportionally
    for label, group in label_groups.items():
        random.shuffle(group)
        n = len(group)
        n_train = int(n * train)
        n_val = int(n * val)
        
        train_rows.extend(group[:n_train])
        val_rows.extend(group[n_train:n_train + n_val])
        test_rows.extend(group[n_train + n_val:])
    
    # Shuffle final splits
    random.shuffle(train_rows)
    random.shuffle(val_rows)
    random.shuffle(test_rows)
    
    print(f"{SYMBOLS['check']} Split completed:")
    print(f"  {SYMBOLS['chart']} Train: {len(train_rows)} samples")
    print(f"  {SYMBOLS['chart']} Validation: {len(val_rows)} samples")
    print(f"  {SYMBOLS['chart']} Test: {len(test_rows)} samples")
    
    return train_rows, val_rows, test_rows


def write_csv(filepath, rows):
    """Write rows to CSV file using standard library."""
    try:
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            if not rows:
                return False
            
            writer = csv.DictWriter(f, fieldnames=['text', 'label'])
            writer.writeheader()
            writer.writerows(rows)
        
        return True
    except Exception as e:
        print(f"{SYMBOLS['cross']} Failed to write {filepath}: {e}")
        return False


def print_label_distributions(train_rows, val_rows, test_rows):
    """Print label distribution for each split."""
    print(f"\n{SYMBOLS['bar_chart']} Label Distribution by Split:")
    
    for name, rows in [("Train", train_rows), ("Validation", val_rows), ("Test", test_rows)]:
        if not rows:
            continue
            
        print(f"\n{name}:")
        counter = Counter(row['label'] for row in rows)
        total = len(rows)
        
        for label in sorted(counter.keys()):
            count = counter[label]
            percentage = (count / total) * 100
            print(f"  {label}: {count} ({percentage:.1f}%)")


def main():
    """Main execution function with fallback mechanisms."""
    print(f"{SYMBOLS['rocket']} Financial PhraseBank Dataset Export (Windows-Robust)")
    print("=" * 60)
    
    rows = None
    source = None
    
    # Try Method 1: 🤗 datasets library
    rows = load_via_datasets()
    if rows:
        source = "datasets library"
    
    # Try Method 2: snapshot download
    if not rows:
        rows = load_via_snapshot()
        if rows:
            source = "snapshot download"
    
    # Try Method 3: synthetic demo data
    if not rows:
        rows = generate_demo_data(300)
        source = "synthetic demo data"
    
    if not rows:
        print(f"{SYMBOLS['cross']} All data loading methods failed")
        return 1
    
    print(f"\n{SYMBOLS['check']} Data loaded successfully via: {source}")
    print(f"{SYMBOLS['chart']} Total samples: {len(rows)}")
    
    # Perform stratified split
    train_rows, val_rows, test_rows = stratified_split(rows)
    
    # Print label distributions
    print_label_distributions(train_rows, val_rows, test_rows)
    
    # Create output directory
    output_dir = Path("data")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Write CSV files
    print(f"\n{SYMBOLS['floppy']} Writing CSV files to {output_dir}/...")
    
    train_path = output_dir / "finance_sentiment_train.csv"
    val_path = output_dir / "finance_sentiment_val.csv"
    test_path = output_dir / "finance_sentiment_test.csv"
    
    success = True
    success &= write_csv(train_path, train_rows)
    success &= write_csv(val_path, val_rows)
    success &= write_csv(test_path, test_rows)
    
    if not success:
        print(f"{SYMBOLS['cross']} Failed to write CSV files")
        return 1
    
    print(f"{SYMBOLS['check']} All CSV files written successfully!")
    print(f"{SYMBOLS['folder']} Files created:")
    print(f"  - {train_path}")
    print(f"  - {val_path}")
    print(f"  - {test_path}")
    
    print(f"\n{SYMBOLS['party']} Export completed successfully using: {source}")
    print(f"{SYMBOLS['lightbulb']} You can now use these CSV files for sentiment analysis training!")
    
    return 0


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
