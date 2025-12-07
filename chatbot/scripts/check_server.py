#!/usr/bin/env python3
"""Check if WealthArena server is running and prerequisites are met"""

import sys

# Fix Unicode/Emoji support (Python 3.7+)
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    # Python 3.6 or earlier - reconfigure() not available
    # Fall back to environment variable or accept default encoding
    pass

import json
import socket
from pathlib import Path
from typing import Optional
from urllib import request, error

def check_server(url="http://127.0.0.1:8000"):
    """Check if server is responding"""
    try:
        import socket
        socket.setdefaulttimeout(5)
        req = request.Request(f"{url}/healthz")
        with request.urlopen(req) as r:
            if r.getcode() == 200:
                body = r.read().decode("utf-8")
                try:
                    data = json.loads(body)
                    print(f"✅ Server is running at {url}")
                    print(f"   Response: {json.dumps(data, indent=2)}")
                    return True
                except:
                    print(f"✅ Server is running at {url}")
                    print(f"   Response: {body}")
                    return True
    except Exception as e:
        print(f"❌ Server is NOT running at {url}")
        print(f"   Error: {e}")
        return False

def check_venv():
    """Check if virtual environment exists"""
    venv_path = Path(".venv")
    if venv_path.exists():
        print("✅ Virtual environment (.venv) exists")
        return True
    else:
        print("❌ Virtual environment (.venv) not found")
        print("   The dev_up.ps1 script will create it.")
        return False

def check_vectorstore():
    """Check if vector database exists"""
    vectorstore_path = Path("data/vectorstore")
    if vectorstore_path.exists() and any(vectorstore_path.iterdir()):
        print("✅ Knowledge base (data/vectorstore) exists")
        return True
    else:
        print("❌ Knowledge base (data/vectorstore) not found or empty")
        print("   Run: python scripts/kb_ingest.py")
        return False

def check_packages():
    """Check if required packages are installed"""
    packages = ["fastapi", "chromadb", "uvicorn"]
    missing = []
    for pkg in packages:
        try:
            __import__(pkg)
            print(f"✅ Package '{pkg}' is installed")
        except ImportError:
            print(f"❌ Package '{pkg}' is NOT installed")
            missing.append(pkg)
    
    if missing:
        print(f"   Install with: pip install -r requirements.txt")
        return False
    return True

def check_env():
    """Check if .env file exists and has GROQ_API_KEY"""
    env_path = Path(".env")
    if not env_path.exists():
        print("❌ .env file not found")
        print("   Copy from .env.example and add your GROQ_API_KEY")
        return False
    
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            content = f.read()
            if "GROQ_API_KEY" in content:
                # Check if it's not empty
                for line in content.split("\n"):
                    if line.startswith("GROQ_API_KEY="):
                        value = line.split("=", 1)[1].strip()
                        if value and value != "":
                            print("✅ .env file exists and has GROQ_API_KEY set")
                            return True
                print("⚠️  .env file exists but GROQ_API_KEY is empty")
                print("   Add your GROQ_API_KEY to .env file")
                return False
            else:
                print("❌ .env file exists but GROQ_API_KEY is missing")
                print("   Add GROQ_API_KEY=your_key_here to .env file")
                return False
    except Exception as e:
        print(f"❌ Error reading .env file: {e}")
        return False

def get_venv_python() -> Optional[str]:
    """
    Get the path to the Python interpreter in the virtual environment.
    
    Returns:
        Path to venv Python interpreter if .venv exists, None otherwise.
    """
    venv_path = Path(".venv")
    if not venv_path.exists():
        return None
    
    if sys.platform == "win32":
        python_exe = venv_path / "Scripts" / "python.exe"
    else:
        python_exe = venv_path / "bin" / "python"
    
    if python_exe.exists():
        return str(python_exe.resolve())
    return None

def check_port_available(port: int, host: str = "127.0.0.1") -> bool:
    """
    Check if a port is available for binding.
    
    Args:
        port: Port number to check
        host: Host address (default: 127.0.0.1)
    
    Returns:
        True if port is available, False otherwise
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(1)
            result = sock.connect_ex((host, port))
            return result != 0  # Port is available if connection fails
    except Exception:
        return False

def check_metrics_file():
    """Check if metrics file exists and is valid (informational only)"""
    metrics_path = Path("metrics/runtime_http.json")
    if not metrics_path.exists():
        print("ℹ️  Metrics file not found (optional)")
        print("   Generate with: python scripts/print_metrics.py")
        return
    
    try:
        with open(metrics_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        overall = data.get("overall", {})
        success_rate = overall.get("success_rate_pct", 0.0)
        
        if success_rate == 0.0:
            print("⚠️  Metrics file shows 0% success rate")
            print("   This means metrics were collected when server was down")
            print("   Regenerate with: python scripts/print_metrics.py")
        else:
            print(f"✅ Metrics file is valid ({success_rate:.1f}% success rate)")
    except Exception as e:
        print(f"ℹ️  Could not read metrics file: {e}")

def main():
    """Main diagnostic function"""
    print("=" * 70)
    print("WealthArena Server Health Check")
    print("=" * 70)
    print()
    
    # Get URL from command line or use default
    url = "http://127.0.0.1:8000"
    if len(sys.argv) > 1:
        url = sys.argv[1]
    
    # Run checks
    server_ok = check_server(url)
    print()
    
    venv_ok = check_venv()
    print()
    
    # Check venv Python path (from bootstrap_checks)
    venv_python = get_venv_python()
    if venv_python:
        print(f"ℹ️  Virtual environment Python: {venv_python}")
    print()
    
    # Check port availability
    port_8000_available = check_port_available(8000)
    if port_8000_available:
        print("✅ Port 8000 is available")
    else:
        print("⚠️  Port 8000 appears to be in use (server may be running)")
    print()
    
    vectorstore_ok = check_vectorstore()
    print()
    
    packages_ok = check_packages()
    print()
    
    env_ok = check_env()
    print()
    
    # Check metrics file (informational, non-blocking)
    check_metrics_file()
    print()
    
    # Summary
    print("=" * 70)
    if server_ok and venv_ok and vectorstore_ok and packages_ok and env_ok:
        print("✅ All prerequisites met! Server is ready.")
        return 0
    elif not server_ok:
        print("❌ Server is not running")
        print("   Start server with: powershell -ExecutionPolicy Bypass -File scripts/dev_up.ps1")
        return 1
    else:
        print("⚠️  Some prerequisites are missing")
        print("   See messages above for details")
        return 2

if __name__ == "__main__":
    sys.exit(main())

