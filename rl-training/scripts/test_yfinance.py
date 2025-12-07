"""
Test script to verify yfinance installation and test Yahoo Finance access.

This script helps diagnose Yahoo Finance API issues by:
1. Checking yfinance version
2. Verifying curl_cffi is installed
3. Testing basic Yahoo Finance API access
4. Testing options data access

Run this before attempting full options collection to verify your setup.
"""

from __future__ import annotations

import sys
import time
from typing import Optional

try:
    import yfinance as yf
except ImportError as e:
    print(f"✗ ERROR: yfinance is not installed: {e}")
    print("Install with: pip install --upgrade yfinance>=0.2.58")
    sys.exit(1)

try:
    import curl_cffi
    curl_cffi_available = True
except ImportError:
    curl_cffi_available = False
    print("⚠ WARNING: curl_cffi is not installed. yfinance may not work properly with Yahoo Finance 2025 requirements.")
    print("Install with: pip install --upgrade curl-cffi>=0.6.0")


def test_yfinance_version() -> bool:
    """Check yfinance version."""
    try:
        version = yf.__version__
        print(f"✓ yfinance version: {version}")
        
        # Check if version is >= 0.2.58
        version_parts = version.split('.')
        major = int(version_parts[0])
        minor = int(version_parts[1])
        patch = int(version_parts[2]) if len(version_parts) > 2 else 0
        
        if major > 0 or (major == 0 and minor > 2) or (major == 0 and minor == 2 and patch >= 58):
            print("✓ yfinance version is >= 0.2.58 (recommended)")
            return True
        else:
            print(f"⚠ WARNING: yfinance version {version} is < 0.2.58. Recommended: >= 0.2.58")
            print("Upgrade with: pip install --upgrade yfinance>=0.2.58")
            return False
    except Exception as e:
        print(f"✗ ERROR: Could not determine yfinance version: {e}")
        return False


def test_curl_cffi() -> bool:
    """Check if curl_cffi is available."""
    if curl_cffi_available:
        try:
            version = curl_cffi.__version__
            print(f"✓ curl_cffi version: {version}")
            return True
        except Exception:
            print("✓ curl_cffi is installed (version unknown)")
            return True
    else:
        print("✗ ERROR: curl_cffi is not installed")
        print("Install with: pip install --upgrade curl-cffi>=0.6.0")
        return False


def test_basic_info(symbol: str = "AAPL") -> tuple[bool, Optional[str]]:
    """Test fetching basic ticker info."""
    try:
        print(f"\nTesting basic info fetch for {symbol}...")
        ticker = yf.Ticker(symbol)
        info = ticker.info
        
        if not info:
            return False, "Empty info response"
        
        symbol_name = info.get('symbol', 'N/A')
        print(f"✓ Basic info works: {symbol_name}")
        return True, None
    except Exception as e:
        error_str = str(e)
        error_type = type(e).__name__
        print(f"✗ Error fetching basic info: {error_type}: {error_str}")
        return False, error_str


def test_options_expiries(symbol: str = "AAPL") -> tuple[bool, Optional[str]]:
    """Test fetching options expiries."""
    try:
        print(f"\nTesting options expiries fetch for {symbol}...")
        time.sleep(2)  # Add delay before options request
        
        ticker = yf.Ticker(symbol)
        expiries = ticker.options
        
        if not expiries:
            return False, "No expiries returned (empty list)"
        
        print(f"✓ Options expiries: {len(expiries)} found")
        if len(expiries) > 0:
            print(f"  First expiry: {expiries[0]}")
            if len(expiries) > 1:
                print(f"  Last expiry: {expiries[-1]}")
        return True, None
    except Exception as e:
        error_str = str(e)
        error_type = type(e).__name__
        print(f"✗ Error fetching options expiries: {error_type}: {error_str}")
        
        # Check for specific error patterns
        if "Expecting value: line 1 column 1 (char 0)" in error_str:
            return False, "JSON parsing error - Yahoo Finance may be blocking requests"
        elif "401" in error_str or "Unauthorized" in error_str:
            return False, "Unauthorized (401) - Authentication issue"
        elif "429" in error_str or "rate limit" in error_str.lower():
            return False, "Rate limited (429) - Too many requests"
        elif "timeout" in error_str.lower():
            return False, "Timeout - Network issue"
        else:
            return False, error_str


def main() -> None:
    """Run all tests."""
    print("=" * 60)
    print("Yahoo Finance API Test Script")
    print("=" * 60)
    
    all_passed = True
    
    # Test 1: yfinance version
    print("\n[Test 1] Checking yfinance version...")
    if not test_yfinance_version():
        all_passed = False
    
    # Test 2: curl_cffi
    print("\n[Test 2] Checking curl_cffi installation...")
    if not test_curl_cffi():
        all_passed = False
    
    # Test 3: Basic info
    print("\n[Test 3] Testing basic ticker info...")
    basic_ok, basic_error = test_basic_info("AAPL")
    if not basic_ok:
        all_passed = False
        print(f"  Basic info test failed: {basic_error}")
    
    # Test 4: Options expiries (this is the critical test)
    print("\n[Test 4] Testing options expiries (critical test)...")
    options_ok, options_error = test_options_expiries("AAPL")
    if not options_ok:
        all_passed = False
        print(f"  Options expiries test failed: {options_error}")
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    if all_passed:
        print("✓ All tests passed! Yahoo Finance API is working correctly.")
        print("\nYou can proceed with options collection:")
        print("  python scripts/collect_options.py --config config/data_config.yaml")
        sys.exit(0)
    else:
        print("✗ Some tests failed. Review the errors above.")
        print("\nTroubleshooting steps:")
        print("1. Verify installation:")
        print("   pip install --upgrade yfinance>=0.2.58 curl-cffi>=0.6.0")
        print("\n2. If options test failed with JSON parsing error:")
        print("   - Yahoo Finance may be blocking your IP")
        print("   - Wait 24-48 hours before retrying")
        print("   - Try from a different network (VPN, mobile hotspot)")
        print("   - Check for corporate proxy/firewall blocking")
        print("\n3. If rate limited (429):")
        print("   - Wait longer between requests")
        print("   - Use a different IP address")
        print("\n4. Options are optional - you can continue without them:")
        print("   - The pipeline will continue with other asset types")
        print("   - Options-based features will be unavailable")
        sys.exit(1)


if __name__ == "__main__":
    main()

