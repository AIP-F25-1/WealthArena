"""
ETF Market Data Downloader
Simple wrapper script for etf_market_data_adls.py for consistency with other download scripts.
"""

import sys
import subprocess
from pathlib import Path

# Get the directory where this script is located
SCRIPT_DIR = Path(__file__).resolve().parent
ETF_SCRIPT = SCRIPT_DIR / "etf_market_data_adls.py"

if __name__ == "__main__":
    # Forward all command-line arguments to etf_market_data_adls.py
    cmd = [sys.executable, str(ETF_SCRIPT)] + sys.argv[1:]
    sys.exit(subprocess.call(cmd))

