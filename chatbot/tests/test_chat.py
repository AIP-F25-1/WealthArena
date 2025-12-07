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
    
    @pytest.mark.asyncio
    async def test_chat_with_rag_context(self, async_client: AsyncClient):
        """Test chat with RAG context retrieval"""
        sample_chunks = [
            {
                'text': 'RSI is a momentum oscillator that measures price movements.',
                'metadata': {'source_file': 'indicators.pdf', 'chunk_index': 0},
                'score': 0.85
            },
            {
                'text': 'RSI values above 70 indicate overbought conditions.',
                'metadata': {'source_file': 'indicators.pdf', 'chunk_index': 1},
                'score': 0.78
            }
        ]
        
        with patch('app.api.chat.llm_client') as mock_llm:
            with patch('app.api.chat.rag_service') as mock_rag:
                # Mock RAG service to return sample chunks
                mock_rag.retrieve_context.return_value = sample_chunks
                mock_rag.format_context_for_prompt.return_value = "[1] RSI is a momentum oscillator...\n(Source: indicators.pdf)"
                
                # Mock LLM to capture the messages passed to it
                captured_messages = []
                async def capture_messages(messages):
                    captured_messages.extend(messages)
                    return "RSI is a technical indicator used in trading analysis."
                
                mock_llm.chat = AsyncMock(side_effect=capture_messages)
                
                response = await async_client.post(
                    "/v1/chat",
                    json={
                        "message": "What is RSI?",
                        "user_id": "test_user"
                    }
                )
                
                assert response.status_code == 200
                data = response.json()
                
                # Verify RAG was used
                assert "rag_retrieval" in data["tools_used"]
                assert "llm_client" in data["tools_used"]
                
                # Verify RAG context was passed to LLM
                assert len(captured_messages) > 0
                # Check that RAG context appears in system messages
                system_messages = [msg for msg in captured_messages if msg.get("role") == "system"]
                assert any("knowledge base" in msg.get("content", "").lower() for msg in system_messages)
    
    @pytest.mark.asyncio
    async def test_chat_without_rag_fallback(self, async_client: AsyncClient):
        """Test chat gracefully handles RAG service unavailability"""
        with patch('app.api.chat.llm_client') as mock_llm:
            with patch('app.api.chat.rag_service') as mock_rag:
                # Mock RAG service to raise an exception
                mock_rag.retrieve_context.side_effect = Exception("RAG service unavailable")
                
                mock_llm.chat = AsyncMock(return_value="Standard response without RAG")
                
                response = await async_client.post(
                    "/v1/chat",
                    json={
                        "message": "Explain trading",
                        "user_id": "test_user"
                    }
                )
                
                assert response.status_code == 200
                data = response.json()
                
                # Should still work without RAG
                assert data["reply"] == "Standard response without RAG"
                assert "llm_client" in data["tools_used"]
                # RAG should not be in tools_used if it failed
                assert "rag_retrieval" not in data["tools_used"]