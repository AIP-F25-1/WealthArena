"""
Test configuration and fixtures for WealthArena API tests
"""

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient

# Mock yfinance if not available
try:
    import yfinance as yf
except ImportError:
    # Create a mock yfinance module for testing
    import sys
    from unittest.mock import MagicMock
    
    mock_yf = MagicMock()
    mock_ticker = MagicMock()
    mock_ticker.history.return_value = MagicMock()
    mock_ticker.info = {"currency": "USD"}
    mock_yf.Ticker.return_value = mock_ticker
    
    sys.modules['yfinance'] = mock_yf

from app.main import app


@pytest.fixture
def client():
    """Create a FastAPI test client"""
    return TestClient(app)


@pytest_asyncio.fixture
async def async_client():
    """Create an async HTTP client for testing"""
    from httpx import ASGITransport
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
