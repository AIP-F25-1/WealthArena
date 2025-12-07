#!/usr/bin/env python3
"""
Lightweight bootstrap checks for CI/CD workflows.
Provides utility functions for checking virtual environment and port availability.
"""

import socket
import sys
from pathlib import Path
from typing import Optional


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


if __name__ == "__main__":
    # Simple test when run directly
    venv_python = get_venv_python()
    if venv_python:
        print(f"✅ Virtual environment Python: {venv_python}")
    else:
        print("ℹ️  No virtual environment found")
    
    port_8000_available = check_port_available(8000)
    if port_8000_available:
        print("✅ Port 8000 is available")
    else:
        print("⚠️  Port 8000 appears to be in use")

