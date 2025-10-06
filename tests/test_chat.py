"""
Test cases for WealthArena Chat API
"""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient


class TestChatAPI:
    """Test cases for chat API endpoints"""

    @pytest.mark.asyncio
    async def test_health_returns_ok(self, async_client: AsyncClient):
        """Test that health endpoint returns OK status"""
        response = await async_client.get("/healthz")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "wealtharena-mobile-api"
        assert data["version"] == "1.0.0"

    @pytest.mark.asyncio
    async def test_chat_echo_reply(self, async_client: AsyncClient):
        """Test chat endpoint with mocked LLM returning 'hi'"""
        # Mock the LLM client to return a simple response
        with patch('app.api.chat.llm_client') as mock_llm:
            mock_llm.chat = AsyncMock(return_value="hi")
            
            response = await async_client.post(
                "/v1/chat",
                json={
                    "message": "hello",
                    "user_id": "test_user"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["reply"] == "hi"
            assert "llm_client" in data["tools_used"]
            assert data["trace_id"].startswith("run-")
            assert len(data["trace_id"]) > 5

    @pytest.mark.asyncio
    async def test_price_tool_path(self, async_client: AsyncClient):
        """Test price tool functionality with 'price AAPL'"""
        # Mock the price tool to return a realistic response
        with patch('app.api.chat.price_tool') as mock_price_tool:
            mock_price_tool.get_price.return_value = {
                "ticker": "AAPL",
                "price": 150.25,
                "currency": "USD"
            }
            
            response = await async_client.post(
                "/v1/chat",
                json={
                    "message": "price AAPL"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify response structure
            assert "reply" in data
            assert "tools_used" in data
            assert "trace_id" in data
            
            # Verify tools_used contains get_price
            assert "get_price" in data["tools_used"]
            assert len(data["tools_used"]) == 1
            
            # Verify reply contains price information
            assert "AAPL" in data["reply"]
            assert "150.25" in data["reply"]
            assert "$" in data["reply"]
            
            # Verify trace_id format
            assert data["trace_id"].startswith("run-")
            assert len(data["trace_id"]) > 5

    @pytest.mark.asyncio
    async def test_price_tool_invalid_ticker(self, async_client: AsyncClient):
        """Test price tool with invalid ticker"""
        # Mock the price tool to return None price for invalid ticker
        with patch('app.api.chat.price_tool') as mock_price_tool:
            mock_price_tool.get_price.return_value = {
                "ticker": "INVALID",
                "price": None,
                "currency": "USD"
            }
            
            response = await async_client.post(
                "/v1/chat",
                json={
                    "message": "price INVALID"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify error response
            assert "couldn't get the price" in data["reply"]
            assert "INVALID" in data["reply"]
            assert "get_price" in data["tools_used"]

    @pytest.mark.asyncio
    async def test_chat_with_trading_keywords(self, async_client: AsyncClient):
        """Test chat with buy/sell keywords triggers disclaimer"""
        with patch('app.api.chat.llm_client') as mock_llm:
            mock_llm.chat = AsyncMock(return_value="This is educational content only. Please consult a financial advisor.")
            
            response = await async_client.post(
                "/v1/chat",
                json={
                    "message": "Should I buy Tesla stock?",
                    "user_id": "test_user"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert "llm_client" in data["tools_used"]
            assert data["trace_id"].startswith("run-")

    @pytest.mark.asyncio
    async def test_chat_with_context(self, async_client: AsyncClient):
        """Test chat with additional context"""
        with patch('app.api.chat.llm_client') as mock_llm:
            mock_llm.chat = AsyncMock(return_value="Context-aware response")
            
            response = await async_client.post(
                "/v1/chat",
                json={
                    "message": "Explain RSI",
                    "user_id": "test_user",
                    "context": "Beginner trader"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["reply"] == "Context-aware response"
            assert "llm_client" in data["tools_used"]
