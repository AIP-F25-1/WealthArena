"""
Log all downloaded Azure data to MLflow
Shows data ingestion metrics without needing model code
"""
import mlflow
import pandas as pd
import json
from pathlib import Path
from datetime import datetime

DATA_DIR = Path("data/azure_sync")

print("\n" + "="*70)
print("Logging All Data to MLflow")
print("="*70 + "\n")

mlflow.set_experiment("wealtharena_data_analysis")

with mlflow.start_run(run_name=f"data_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}"):
    
    # Log run info
    mlflow.log_param("data_source", "azure_blob_storage")
    mlflow.log_param("sync_date", datetime.now().isoformat())
    mlflow.log_param("data_location", str(DATA_DIR.absolute()))
    
    stats = {}
    
    # 1. Analyze Commodities
    print("Analyzing Commodities...")
    commodity_files = list((DATA_DIR / "asxCommodities").glob("*.csv"))
    total_commodity_rows = 0
    for csv_file in commodity_files:
        df = pd.read_csv(csv_file)
        rows = len(df)
        total_commodity_rows += rows
        mlflow.log_metric(f"commodities_{csv_file.stem}_rows", rows)
        print(f"  {csv_file.name}: {rows:,} rows")
    
    mlflow.log_metric("total_commodity_rows", total_commodity_rows)
    mlflow.log_param("commodity_files_count", len(commodity_files))
    stats['commodities'] = {'files': len(commodity_files), 'rows': total_commodity_rows}
    
    # 2. Analyze Crypto
    print("\nAnalyzing Cryptocurrencies...")
    crypto_files = list((DATA_DIR / "asxCrypto").glob("*.csv"))
    total_crypto_rows = 0
    for csv_file in crypto_files:
        df = pd.read_csv(csv_file)
        rows = len(df)
        total_crypto_rows += rows
        mlflow.log_metric(f"crypto_{csv_file.stem}_rows", rows)
        print(f"  {csv_file.name}: {rows:,} rows")
    
    mlflow.log_metric("total_crypto_rows", total_crypto_rows)
    mlflow.log_param("crypto_files_count", len(crypto_files))
    stats['crypto'] = {'files': len(crypto_files), 'rows': total_crypto_rows}
    
    # 3. Analyze Forex
    print("\nAnalyzing Forex...")
    forex_files = list((DATA_DIR / "asxForex").glob("*.csv"))
    total_forex_rows = 0
    for csv_file in forex_files:
        df = pd.read_csv(csv_file)
        rows = len(df)
        total_forex_rows += rows
        mlflow.log_metric(f"forex_{csv_file.stem}_rows", rows)
        print(f"  {csv_file.name}: {rows:,} rows")
    
    mlflow.log_metric("total_forex_rows", total_forex_rows)
    mlflow.log_param("forex_files_count", len(forex_files))
    stats['forex'] = {'files': len(forex_files), 'rows': total_forex_rows}
    
    # 4. Analyze News
    print("\nAnalyzing News...")
    news_files = list((DATA_DIR / "alpha_vantage_asx").rglob("*.jsonl"))
    total_news_articles = 0
    for jsonl_file in news_files:
        with open(jsonl_file, encoding='utf-8') as f:
            articles = len(f.readlines())
            total_news_articles += articles
            mlflow.log_metric(f"news_{jsonl_file.stem}_articles", articles)
            print(f"  {jsonl_file.name}: {articles} articles")
    
    mlflow.log_metric("total_news_articles", total_news_articles)
    mlflow.log_param("news_files_count", len(news_files))
    stats['news'] = {'files': len(news_files), 'articles': total_news_articles}
    
    # 5. Analyze Reddit
    print("\nAnalyzing Reddit...")
    reddit_files = list((DATA_DIR / "reddit").rglob("*.csv"))
    total_reddit_posts = 0
    for csv_file in reddit_files:
        df = pd.read_csv(csv_file)
        posts = len(df)
        total_reddit_posts += posts
        mlflow.log_metric(f"reddit_{csv_file.stem}_posts", posts)
        print(f"  {csv_file.name}: {posts:,} posts")
    
    mlflow.log_metric("total_reddit_posts", total_reddit_posts)
    mlflow.log_param("reddit_files_count", len(reddit_files))
    stats['reddit'] = {'files': len(reddit_files), 'posts': total_reddit_posts}
    
    # Overall stats
    total_files = sum(s['files'] for s in stats.values())
    mlflow.log_metric("total_data_files", total_files)
    
    total_data_points = (
        total_commodity_rows + 
        total_crypto_rows + 
        total_forex_rows + 
        total_news_articles + 
        total_reddit_posts
    )
    mlflow.log_metric("total_data_points", total_data_points)
    
    # Log summary as artifact
    summary_text = f"""WealthArena Data Summary
========================
Generated: {datetime.now().isoformat()}

Data Sources:
- Commodities: {stats['commodities']['files']} files, {stats['commodities']['rows']:,} rows
- Cryptocurrencies: {stats['crypto']['files']} files, {stats['crypto']['rows']:,} rows
- Forex: {stats['forex']['files']} files, {stats['forex']['rows']:,} rows
- News: {stats['news']['files']} files, {stats['news']['articles']:,} articles
- Reddit: {stats['reddit']['files']} files, {stats['reddit']['posts']:,} posts

TOTAL: {total_files} files, {total_data_points:,} data points
"""
    
    with open("data_summary.txt", "w") as f:
        f.write(summary_text)
    mlflow.log_artifact("data_summary.txt")
    
    print("\n" + "="*70)
    print("MLflow Logging Complete!")
    print("="*70)
    print(summary_text)
    print("\nView in MLflow: http://localhost:5000")
    print("Experiment: wealtharena_data_analysis")
    print("="*70 + "\n")


