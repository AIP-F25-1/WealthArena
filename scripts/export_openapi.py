"""
Export OpenAPI specification from running WealthArena server
Fetches the OpenAPI JSON from the running server and saves it to docs/openapi.json
"""

import requests
import json
import os
from pathlib import Path
from typing import Optional

def export_openapi_spec(
    server_url: str = "http://127.0.0.1:8000",
    output_file: str = "docs/openapi.json"
) -> bool:
    """
    Export OpenAPI specification from running server
    
    Args:
        server_url: URL of the running server
        output_file: Path to save the OpenAPI JSON file
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Check if server is running
        print(f"Checking if server is running at {server_url}...")
        health_response = requests.get(f"{server_url}/healthz", timeout=5)
        
        if health_response.status_code != 200:
            print(f"❌ Server health check failed: {health_response.status_code}")
            return False
            
        print("✅ Server is running and healthy")
        
        # Fetch OpenAPI specification
        print(f"Fetching OpenAPI specification from {server_url}/openapi.json...")
        openapi_response = requests.get(f"{server_url}/openapi.json", timeout=10)
        
        if openapi_response.status_code != 200:
            print(f"❌ Failed to fetch OpenAPI spec: {openapi_response.status_code}")
            print(f"Response: {openapi_response.text}")
            return False
            
        # Parse JSON to validate
        try:
            openapi_data = openapi_response.json()
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON response: {e}")
            return False
            
        # Create output directory if it doesn't exist
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write OpenAPI specification to file
        print(f"Writing OpenAPI specification to {output_file}...")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(openapi_data, f, indent=2, ensure_ascii=False)
            
        print(f"✅ OpenAPI specification exported successfully to {output_file}")
        
        # Print summary
        info = openapi_data.get('info', {})
        print(f"\n📋 OpenAPI Summary:")
        print(f"  Title: {info.get('title', 'N/A')}")
        print(f"  Version: {info.get('version', 'N/A')}")
        print(f"  Description: {info.get('description', 'N/A')[:100]}...")
        
        paths = openapi_data.get('paths', {})
        print(f"  Endpoints: {len(paths)}")
        
        # List some key endpoints
        key_endpoints = [
            '/healthz', '/metrics', '/v1/chat', '/v1/search', 
            '/v1/explain', '/v1/game/episodes', '/v1/game/create'
        ]
        
        print(f"\n🔗 Key Endpoints:")
        for endpoint in key_endpoints:
            if endpoint in paths:
                methods = list(paths[endpoint].keys())
                print(f"  {endpoint}: {', '.join(methods).upper()}")
            else:
                print(f"  {endpoint}: Not found")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Could not connect to server at {server_url}")
        print("Make sure the server is running with: uvicorn app.main:app --reload")
        return False
        
    except requests.exceptions.Timeout:
        print(f"❌ Request timed out. Server might be slow or unresponsive.")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    """Main function to export OpenAPI specification"""
    print("🚀 WealthArena OpenAPI Export Tool")
    print("=" * 50)
    
    # Default configuration
    server_url = "http://127.0.0.1:8000"
    output_file = "docs/openapi.json"
    
    # Check if custom server URL is provided via environment variable
    custom_server = os.getenv("WEALTHARENA_SERVER_URL")
    if custom_server:
        server_url = custom_server
        print(f"Using custom server URL: {server_url}")
    
    # Check if custom output file is provided via environment variable
    custom_output = os.getenv("WEALTHARENA_OPENAPI_OUTPUT")
    if custom_output:
        output_file = custom_output
        print(f"Using custom output file: {output_file}")
    
    # Export OpenAPI specification
    success = export_openapi_spec(server_url, output_file)
    
    if success:
        print("\n🎉 OpenAPI export completed successfully!")
        print(f"📄 Documentation saved to: {output_file}")
        print("\n💡 Next steps:")
        print("  - Use the OpenAPI file with tools like Swagger UI")
        print("  - Generate client SDKs from the specification")
        print("  - Share API documentation with your team")
    else:
        print("\n❌ OpenAPI export failed!")
        print("\n🔧 Troubleshooting:")
        print("  1. Make sure the server is running: uvicorn app.main:app --reload")
        print("  2. Check that the server is accessible at http://127.0.0.1:8000")
        print("  3. Verify the server is healthy: curl http://127.0.0.1:8000/healthz")
        exit(1)

if __name__ == "__main__":
    main()
