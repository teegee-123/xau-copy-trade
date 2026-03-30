"""Test script to verify the XAU Copy Trade application is working."""

import urllib.request
import json
import sys

BASE_URL = "http://localhost:8001"

def test_endpoint(endpoint: str, expected_status: int = 200) -> bool:
    """Test an endpoint and return True if successful."""
    url = f"{BASE_URL}{endpoint}"
    try:
        response = urllib.request.urlopen(url, timeout=5)
        status = response.status
        data = response.read().decode()
        
        if status == expected_status:
            print(f"✓ {endpoint} - Status: {status}")
            return True
        else:
            print(f"✗ {endpoint} - Expected {expected_status}, got {status}")
            return False
    except Exception as e:
        print(f"✗ {endpoint} - Error: {e}")
        return False

def test_json_endpoint(endpoint: str, expected_keys: list) -> bool:
    """Test a JSON endpoint and verify it contains expected keys."""
    url = f"{BASE_URL}{endpoint}"
    try:
        response = urllib.request.urlopen(url, timeout=5)
        data = json.loads(response.read().decode())
        
        missing_keys = [key for key in expected_keys if key not in str(data)]
        if not missing_keys:
            print(f"✓ {endpoint} - Contains expected keys")
            return True
        else:
            print(f"✗ {endpoint} - Missing keys: {missing_keys}")
            return False
    except Exception as e:
        print(f"✗ {endpoint} - Error: {e}")
        return False

def main():
    print("=" * 60)
    print("XAU Copy Trade - Application Health Check")
    print("=" * 60)
    print()
    
    tests = [
        # API endpoints
        ("Test 1: Health endpoint", lambda: test_json_endpoint("/api/health", ["status", "version", "services"])),
        ("Test 2: Active trades", lambda: test_json_endpoint("/api/trades/active", ["success", "data"])),
        ("Test 3: Pending trades", lambda: test_json_endpoint("/api/trades/pending", ["success", "data"])),
        ("Test 4: Trade history", lambda: test_json_endpoint("/api/trades/history", ["success", "data"])),
        ("Test 5: Summary", lambda: test_json_endpoint("/api/summary", ["success", "data"])),
        ("Test 6: Bot status", lambda: test_json_endpoint("/api/status", ["success", "data"])),
        
        # Frontend
        ("Test 7: Frontend index.html", lambda: test_endpoint("/", 200)),
        ("Test 8: Frontend CSS", lambda: test_endpoint("/assets/index-BAOuQFRw.css", 200)),
        ("Test 9: Frontend JS", lambda: test_endpoint("/assets/index-DpoQvjCJ.js", 200)),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"Running: {test_name}")
        if test_func():
            passed += 1
        else:
            failed += 1
        print()
    
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed > 0:
        sys.exit(1)
    else:
        print("\n✓ All tests passed! The application is running correctly.")
        print("\nAccess the dashboard at: http://localhost:8001")
        sys.exit(0)

if __name__ == "__main__":
    main()
