#!/usr/bin/env python3
"""
Start Multi-Agent and Specialized Agents Metrics Servers

This script starts both metrics servers for:
1. Multi-Agent System (Port 8012)
2. Specialized Trading Agents (Port 8013)
"""

import sys
import time
import threading
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from multi_agent_prometheus_metrics import start_multi_agent_metrics_server
from specialized_agents_prometheus_metrics import start_specialized_agents_metrics_server

def start_all_servers():
    """Start both metrics servers in separate threads"""
    
    print("=" * 60)
    print("Starting Multi-Agent & Specialized Agents Metrics Servers")
    print("=" * 60)
    print()
    
    # Start multi-agent metrics server in a thread
    def start_multi_agent():
        try:
            start_multi_agent_metrics_server(port=8012)
        except Exception as e:
            print(f"Error starting multi-agent metrics server: {e}")
    
    # Start specialized agents metrics server in a thread
    def start_specialized():
        try:
            start_specialized_agents_metrics_server(port=8013)
        except Exception as e:
            print(f"Error starting specialized agents metrics server: {e}")
    
    # Start servers in separate threads
    multi_agent_thread = threading.Thread(target=start_multi_agent, daemon=True)
    specialized_thread = threading.Thread(target=start_specialized, daemon=True)
    
    multi_agent_thread.start()
    specialized_thread.start()
    
    # Wait a moment for servers to start
    time.sleep(2)
    
    print()
    print("=" * 60)
    print("✅ Both Metrics Servers Started!")
    print("=" * 60)
    print()
    print("Multi-Agent Metrics: http://localhost:8012/metrics")
    print("Specialized Agents Metrics: http://localhost:8013/metrics")
    print()
    print("⚠️  Keep this script running to maintain metrics servers")
    print("   Press Ctrl+C to stop")
    print()
    
    # Keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\nStopping metrics servers...")
        print("Servers stopped.")

if __name__ == "__main__":
    start_all_servers()

