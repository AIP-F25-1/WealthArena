#!/usr/bin/env python3
"""
WealthArena Local Smoke Test
Tests the API endpoints to ensure the system is working correctly.
"""

import time
import sys
import json
from typing import Dict, Any
import httpx


def wait_for_server(url: str, timeout: int = 60) -> bool:
    """Wait for the server to be ready."""
    print(f"Waiting for server at {url} (timeout: {timeout}s)...")
    
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = httpx.get(f"{url}/healthz", timeout=5)
            if response.status_code == 200:
                print("Server is ready!")
                return True
        except (httpx.ConnectError, httpx.TimeoutException):
            pass
        
        time.sleep(1)
    
    print(f"Server not ready after {timeout}s")
    return False


def test_endpoint(client: httpx.Client, method: str, url: str, 
                 data: Dict[str, Any] = None, expected_status: int = 200) -> bool:
    """Test a single endpoint."""
    try:
        if method.upper() == "GET":
            response = client.get(url)
        elif method.upper() == "POST":
            response = client.post(url, json=data)
        else:
            print(f"Unsupported method: {method}")
            return False
        
        if response.status_code == expected_status:
            print(f"{method} {url} - Status: {response.status_code}")
            return True
        else:
            print(f"{method} {url} - Expected: {expected_status}, Got: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"{method} {url} - Error: {e}")
        return False


def run_smoke_tests(base_url: str) -> bool:
    """Run all smoke tests."""
    print("WealthArena Local Smoke Test")
    print("=" * 50)
    
    tests_passed = 0
    total_tests = 0
    
    with httpx.Client(base_url=base_url, timeout=30) as client:
        # Test 1: Health Check
        total_tests += 1
        if test_endpoint(client, "GET", "/healthz"):
            tests_passed += 1
        
        # Test 2: Game Episodes
        total_tests += 1
        if test_endpoint(client, "GET", "/v1/game/episodes"):
            tests_passed += 1
        
        # Test 3: Search
        total_tests += 1
        if test_endpoint(client, "GET", "/v1/search?q=RSI"):
            tests_passed += 1
        
        # Test 4: Explain
        total_tests += 1
        explain_data = {
            "question": "What is RSI?",
            "k": 3
        }
        try:
            response = client.post("/v1/explain", json=explain_data)
            if response.status_code == 200:
                data = response.json()
                # Verify response has answer/text field
                if "answer" in data or "text" in data:
                    print(f"POST /v1/explain - Status: {response.status_code}, has answer/text field")
                    tests_passed += 1
                else:
                    print(f"POST /v1/explain - Missing answer/text field in response")
            else:
                print(f"POST /v1/explain - Expected: 200, Got: {response.status_code}")
        except Exception as e:
            print(f"POST /v1/explain - Error: {e}")
        
        # Test 5: Root endpoint
        total_tests += 1
        if test_endpoint(client, "GET", "/"):
            tests_passed += 1
        
        # Test 6: Metrics endpoint
        total_tests += 1
        if test_endpoint(client, "GET", "/metrics"):
            tests_passed += 1
        
        # Test 7: API Documentation
        total_tests += 1
        if test_endpoint(client, "GET", "/docs"):
            tests_passed += 1
    
    # Print results
    print("\n" + "=" * 50)
    print(f"Test Summary: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        print("All tests passed!")
        return True
    else:
        print("Some tests failed!")
        return False


def main():
    """Main smoke test function."""
    base_url = "http://127.0.0.1:8000"
    
    # Wait for server to be ready
    if not wait_for_server(base_url):
        print("Server is not running or not ready")
        print("Start the server with: powershell -ExecutionPolicy Bypass -File scripts/dev_up.ps1")
        sys.exit(1)
    
    # Run smoke tests
    success = run_smoke_tests(base_url)
    
    if success:
        print("\nAll smoke tests passed! The API is working correctly.")
        sys.exit(0)
    else:
        print("\nSome smoke tests failed. Check the server logs.")
        sys.exit(1)


if __name__ == "__main__":
    main()
