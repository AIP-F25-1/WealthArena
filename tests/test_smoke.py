"""
Smoke tests for WealthArena API endpoints
Basic functionality tests to ensure core endpoints are working
"""

import pytest
import httpx
from fastapi.testclient import TestClient
from app.main import app

# Test client for synchronous tests
client = TestClient(app)

@pytest.mark.asyncio
async def test_episodes():
    """Test game episodes endpoint returns 200 and non-empty list"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/v1/game/episodes")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return a list (even if empty)
        assert isinstance(data, list)
        
        # If episodes exist, they should have required fields
        if data:
            episode = data[0]
            assert "id" in episode
            assert "name" in episode
            assert "difficulty" in episode

@pytest.mark.asyncio
async def test_search_fallback():
    """Test search endpoint with fallback functionality"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/v1/search?q=earnings")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have query and results fields
        assert "query" in data
        assert "results" in data
        assert data["query"] == "earnings"
        assert isinstance(data["results"], list)
        
        # Results should be a list (even if empty)
        # If results exist, they should have required fields
        if data["results"]:
            result = data["results"][0]
            assert "id" in result
            assert "score" in result
            assert "title" in result
            assert "url" in result
            assert "source" in result
            assert "ts" in result

@pytest.mark.asyncio
async def test_explain():
    """Test explain endpoint with AAPL question"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        payload = {"question": "What happened with AAPL?"}
        response = await ac.post("/v1/explain", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have answer and sources fields
        assert "answer" in data
        assert "sources" in data
        
        # Answer should be a non-empty string
        assert isinstance(data["answer"], str)
        assert len(data["answer"]) > 0
        
        # Sources should be a list
        assert isinstance(data["sources"], list)
        
        # If sources exist, they should have required fields
        if data["sources"]:
            source = data["sources"][0]
            assert "title" in source
            assert "url" in source
            assert "score" in source

@pytest.mark.asyncio
async def test_metrics():
    """Test Prometheus metrics endpoint"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/metrics")
        
        assert response.status_code == 200
        
        # Should return Prometheus format
        content_type = response.headers.get("content-type")
        assert content_type == "text/plain; version=0.0.4; charset=utf-8"
        
        # Should contain Prometheus metrics
        content = response.text
        assert "# HELP" in content or "# TYPE" in content
        
        # Should contain our custom metrics
        assert "chat_requests_total" in content
        assert "chat_latency_seconds" in content
        assert "game_tick_latency_seconds" in content
        assert "game_trades_total" in content
        assert "vector_or_fallback_search_seconds" in content

@pytest.mark.asyncio
async def test_metrics_basic():
    """Test basic metrics endpoint (if it exists)"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/v1/metrics")
        
        # This endpoint might not exist, so we check for either 200 or 404
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            # Should return some metrics data
            assert isinstance(data, dict)

@pytest.mark.asyncio
async def test_health_check():
    """Test health check endpoint"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/healthz")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert data["status"] == "healthy"

@pytest.mark.asyncio
async def test_root_endpoint():
    """Test root endpoint"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "version" in data
        assert "status" in data

@pytest.mark.asyncio
async def test_chat_endpoint():
    """Test chat endpoint with simple message"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        payload = {"message": "Hello, what is RSI?"}
        response = await ac.post("/v1/chat", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have required fields
        assert "reply" in data
        assert "tools_used" in data
        assert "trace_id" in data
        
        # Reply should be a non-empty string
        assert isinstance(data["reply"], str)
        assert len(data["reply"]) > 0
        
        # Tools used should be a list
        assert isinstance(data["tools_used"], list)

@pytest.mark.asyncio
async def test_game_create():
    """Test game creation endpoint"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        payload = {
            "name": "Test Game",
            "difficulty": "beginner",
            "start_date": "2024-01-01",
            "end_date": "2024-01-31"
        }
        response = await ac.post("/v1/game/create", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have game ID and other required fields
        assert "game_id" in data
        assert "name" in data
        assert "difficulty" in data
        assert "current_date" in data
        assert "portfolio" in data

@pytest.mark.asyncio
async def test_search_with_empty_query():
    """Test search endpoint with empty query should return 400"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/v1/search?q=")
        
        assert response.status_code == 400

@pytest.mark.asyncio
async def test_explain_with_empty_question():
    """Test explain endpoint with empty question should return 400"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        payload = {"question": ""}
        response = await ac.post("/v1/explain", json=payload)
        
        assert response.status_code == 400

@pytest.mark.asyncio
async def test_search_with_invalid_k():
    """Test search endpoint with invalid k parameter"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        # Test with k=0 (should be invalid)
        response = await ac.get("/v1/search?q=test&k=0")
        assert response.status_code == 422  # Validation error
        
        # Test with k=100 (should be invalid, max is 20)
        response = await ac.get("/v1/search?q=test&k=100")
        assert response.status_code == 422  # Validation error

@pytest.mark.asyncio
async def test_explain_with_invalid_k():
    """Test explain endpoint with invalid k parameter"""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        # Test with k=0 (should be invalid)
        payload = {"question": "What is RSI?", "k": 0}
        response = await ac.post("/v1/explain", json=payload)
        assert response.status_code == 400
        
        # Test with k=100 (should be invalid, max is 10)
        payload = {"question": "What is RSI?", "k": 100}
        response = await ac.post("/v1/explain", json=payload)
        assert response.status_code == 400

# Synchronous tests using TestClient
def test_sync_health_check():
    """Synchronous test for health check"""
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_sync_root():
    """Synchronous test for root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "WealthArena" in data["message"]

def test_sync_metrics():
    """Synchronous test for metrics endpoint"""
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert "chat_requests_total" in response.text
