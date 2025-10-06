#!/usr/bin/env python3
"""
Test runner for WealthArena API tests
"""

import subprocess
import sys
from pathlib import Path


def run_tests():
    """Run all tests with pytest"""
    try:
        # Run tests with verbose output
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            "tests/", 
            "-v", 
            "--tb=short",
            "--asyncio-mode=auto"
        ], check=True)
        
        print("\n✅ All tests passed!")
        return result.returncode
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Tests failed with exit code {e.returncode}")
        return e.returncode
    except FileNotFoundError:
        print("❌ pytest not found. Please install with: pip install pytest pytest-asyncio")
        return 1


if __name__ == "__main__":
    exit_code = run_tests()
    sys.exit(exit_code)

