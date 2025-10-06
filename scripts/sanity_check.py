#!/usr/bin/env python3
"""
WealthArena API Sanity Check
Tests key API endpoints to ensure the system is working correctly
"""

import asyncio
import json
import sys
import time
from typing import Dict, Any, Optional
import httpx
from pathlib import Path

# Add the parent directory to the path so we can import from app
sys.path.append(str(Path(__file__).parent.parent))

class SanityChecker:
    """Sanity checker for WealthArena API endpoints"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        self.game_id = None
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log_result(self, test_name: str, success: bool, message: str = ""):
        """Log test result"""
        status = "PASS" if success else "FAIL"
        print(f"{status}: {test_name} - {message}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message
        })
    
    async def test_health_check(self) -> bool:
        """Test health check endpoint"""
        try:
            response = await self.client.get(f"{self.base_url}/healthz")
            if response.status_code == 200:
                data = response.json()
                self.log_result("Health Check", True, f"Status: {data.get('status', 'unknown')}")
                return True
            else:
                self.log_result("Health Check", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Health Check", False, f"Error: {str(e)}")
            return False
    
    async def test_game_episodes(self) -> bool:
        """Test game episodes endpoint"""
        try:
            response = await self.client.get(f"{self.base_url}/v1/game/episodes")
            if response.status_code == 200:
                data = response.json()
                episodes = data.get("episodes", [])
                self.log_result("Game Episodes", True, f"Found {len(episodes)} episodes")
                return len(episodes) > 0
            else:
                self.log_result("Game Episodes", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Game Episodes", False, f"Error: {str(e)}")
            return False
    
    async def test_start_game(self) -> bool:
        """Test starting a new game"""
        try:
            payload = {
                "user_id": "sanity_test_user",
                "episode_id": "covid_crash_2020",
                "difficulty": "medium"
            }
            response = await self.client.post(f"{self.base_url}/v1/game/start", json=payload)
            if response.status_code == 200:
                data = response.json()
                self.game_id = data.get("game_id")
                self.log_result("Start Game", True, f"Game ID: {self.game_id}")
                return True
            else:
                self.log_result("Start Game", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Start Game", False, f"Error: {str(e)}")
            return False
    
    async def test_game_tick(self) -> bool:
        """Test game tick (advance 1 day)"""
        if not self.game_id:
            self.log_result("Game Tick", False, "No game ID available")
            return False
            
        try:
            payload = {
                "game_id": self.game_id,
                "speed": 1
            }
            response = await self.client.post(f"{self.base_url}/v1/game/tick", json=payload)
            if response.status_code == 200:
                data = response.json()
                current_date = data.get("current_date", "unknown")
                self.log_result("Game Tick", True, f"Advanced to: {current_date}")
                return True
            else:
                self.log_result("Game Tick", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Game Tick", False, f"Error: {str(e)}")
            return False
    
    async def test_game_trade(self) -> bool:
        """Test buying AAPL stock"""
        if not self.game_id:
            self.log_result("Game Trade", False, "No game ID available")
            return False
            
        try:
            payload = {
                "game_id": self.game_id,
                "symbol": "AAPL",
                "side": "buy",
                "qty": 1,
                "type": "market"
            }
            response = await self.client.post(f"{self.base_url}/v1/game/trade", json=payload)
            if response.status_code == 200:
                data = response.json()
                trade_id = data.get("trade_id", "unknown")
                self.log_result("Game Trade", True, f"Trade ID: {trade_id}")
                return True
            else:
                self.log_result("Game Trade", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Game Trade", False, f"Error: {str(e)}")
            return False
    
    async def test_game_portfolio(self) -> bool:
        """Test getting portfolio"""
        if not self.game_id:
            self.log_result("Game Portfolio", False, "No game ID available")
            return False
            
        try:
            response = await self.client.get(f"{self.base_url}/v1/game/portfolio?game_id={self.game_id}")
            if response.status_code == 200:
                data = response.json()
                cash = data.get("cash", 0)
                holdings = data.get("holdings", [])
                self.log_result("Game Portfolio", True, f"Cash: ${cash:,.2f}, Holdings: {len(holdings)}")
                return True
            else:
                self.log_result("Game Portfolio", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Game Portfolio", False, f"Error: {str(e)}")
            return False
    
    async def test_game_summary(self) -> bool:
        """Test getting game summary"""
        if not self.game_id:
            self.log_result("Game Summary", False, "No game ID available")
            return False
            
        try:
            response = await self.client.get(f"{self.base_url}/v1/game/summary?game_id={self.game_id}")
            if response.status_code == 200:
                data = response.json()
                total_value = data.get("total_value", 0)
                pnl = data.get("pnl", 0)
                self.log_result("Game Summary", True, f"Total Value: ${total_value:,.2f}, P&L: ${pnl:,.2f}")
                return True
            else:
                self.log_result("Game Summary", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Game Summary", False, f"Error: {str(e)}")
            return False
    
    async def test_search(self) -> bool:
        """Test search endpoint"""
        try:
            response = await self.client.get(f"{self.base_url}/v1/search?q=earnings&k=5")
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])
                self.log_result("Search", True, f"Found {len(results)} results")
                return True
            else:
                self.log_result("Search", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Search", False, f"Error: {str(e)}")
            return False
    
    async def test_explain(self) -> bool:
        """Test explain endpoint"""
        try:
            payload = {
                "question": "What is a P/E ratio and why is it important for stock valuation?",
                "k": 3
            }
            response = await self.client.post(f"{self.base_url}/v1/explain", json=payload)
            if response.status_code == 200:
                data = response.json()
                answer_length = len(data.get("answer", ""))
                sources = data.get("sources", [])
                self.log_result("Explain", True, f"Answer length: {answer_length} chars, Sources: {len(sources)}")
                return True
            else:
                self.log_result("Explain", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Explain", False, f"Error: {str(e)}")
            return False
    
    async def test_metrics(self) -> bool:
        """Test metrics endpoints"""
        try:
            # Test basic metrics
            response = await self.client.get(f"{self.base_url}/metrics/basic")
            if response.status_code == 200:
                data = response.json()
                self.log_result("Metrics Basic", True, f"Metrics available: {len(data)} keys")
                return True
            else:
                self.log_result("Metrics Basic", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Metrics Basic", False, f"Error: {str(e)}")
            return False
    
    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all sanity tests"""
        print("🧪 WealthArena API Sanity Check")
        print("=" * 50)
        
        # Test basic connectivity
        await self.test_health_check()
        
        # Test game functionality
        await self.test_game_episodes()
        await self.test_start_game()
        await self.test_game_tick()
        await self.test_game_trade()
        await self.test_game_portfolio()
        await self.test_game_summary()
        
        # Test search and explain
        await self.test_search()
        await self.test_explain()
        
        # Test metrics
        await self.test_metrics()
        
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {passed_tests}/{total_tests} tests passed")
        
        if failed_tests > 0:
            print(f"❌ {failed_tests} tests failed")
            return {"success": False, "passed": passed_tests, "total": total_tests}
        else:
            print("✅ All tests passed!")
            return {"success": True, "passed": passed_tests, "total": total_tests}

async def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="WealthArena API Sanity Check")
    parser.add_argument("--url", default="http://localhost:8000", help="API base URL")
    args = parser.parse_args()
    
    async with SanityChecker(args.url) as checker:
        result = await checker.run_all_tests()
        
        # Exit with appropriate code
        sys.exit(0 if result["success"] else 1)

if __name__ == "__main__":
    asyncio.run(main())
