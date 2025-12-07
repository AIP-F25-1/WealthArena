"""
Test cases for RAG Service
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.rag_service import RAGService


class TestRAGService:
    """Test cases for RAG service"""
    
    @pytest.fixture
    def mock_chroma_available(self):
        """Mock Chroma as available"""
        with patch('app.services.rag_service.CHROMA_AVAILABLE', True):
            with patch('app.services.rag_service.SENTENCE_TRANSFORMERS_AVAILABLE', True):
                yield
    
    @pytest.fixture
    def mock_chroma_unavailable(self):
        """Mock Chroma as unavailable"""
        with patch('app.services.rag_service.CHROMA_AVAILABLE', False):
            yield
    
    @pytest.fixture
    def sample_chunks(self):
        """Sample chunks for testing"""
        return [
            {
                'text': 'This is a sample financial education text about trading.',
                'metadata': {
                    'source_file': 'test.pdf',
                    'chunk_index': 0,
                    'total_chunks': 2
                },
                'score': 0.85
            },
            {
                'text': 'Another chunk about risk management and position sizing.',
                'metadata': {
                    'source_file': 'test.pdf',
                    'chunk_index': 1,
                    'total_chunks': 2
                },
                'score': 0.78
            }
        ]
    
    def test_rag_service_initialization(self, mock_chroma_available):
        """Test that RAGService can be instantiated"""
        with patch('app.services.rag_service.chromadb.Client') as mock_client_class:
            with patch('app.services.rag_service.SentenceTransformer') as mock_model_class:
                mock_client = Mock()
                mock_client.get_collection = Mock(side_effect=Exception("Collection not found"))
                mock_client_class.return_value = mock_client
                
                service = RAGService()
                
                assert service is not None
                assert service.chroma_client is not None
    
    def test_retrieve_context_returns_results(self, mock_chroma_available, sample_chunks):
        """Test that retrieve_context returns expected format"""
        with patch('app.services.rag_service.chromadb.Client') as mock_client_class:
            with patch('app.services.rag_service.SentenceTransformer') as mock_model_class:
                # Setup mocks
                mock_collection = Mock()
                mock_collection.query.return_value = {
                    'documents': [[chunk['text'] for chunk in sample_chunks]],
                    'metadatas': [[chunk['metadata'] for chunk in sample_chunks]],
                    'distances': [[0.15, 0.22]]  # Low distances = high similarity
                }
                
                mock_client = Mock()
                mock_client.get_collection = Mock(side_effect=Exception("Collection not found"))
                mock_client_class.return_value = mock_client
                
                mock_model = Mock()
                mock_model.encode.return_value = [[0.1, 0.2, 0.3]]  # Mock embedding
                mock_model_class.return_value = mock_model
                
                service = RAGService()
                service.chroma_collection = mock_collection
                service.embedding_model = mock_model
                
                # Test retrieval
                results = service.retrieve_context("test query", top_k=2)
                
                assert len(results) == 2
                assert 'text' in results[0]
                assert 'metadata' in results[0]
                assert 'score' in results[0]
                # Score can be None if distances not available, or > 0 if available
                assert results[0]['score'] is None or results[0]['score'] > 0
    
    def test_retrieve_context_handles_empty_collection(self, mock_chroma_available):
        """Test that retrieve_context handles empty collection gracefully"""
        with patch('app.services.rag_service.chromadb.Client') as mock_client_class:
            with patch('app.services.rag_service.SentenceTransformer') as mock_model_class:
                mock_collection = Mock()
                mock_collection.query.return_value = {
                    'documents': [[]],
                    'metadatas': [[]],
                    'distances': [[]]
                }
                
                mock_client = Mock()
                mock_client.get_collection = Mock(side_effect=Exception("Collection not found"))
                mock_client_class.return_value = mock_client
                
                mock_model = Mock()
                mock_model.encode.return_value = [[0.1, 0.2, 0.3]]
                mock_model_class.return_value = mock_model
                
                service = RAGService()
                service.chroma_collection = mock_collection
                service.embedding_model = mock_model
                
                results = service.retrieve_context("test query")
                
                assert results == []
    
    def test_format_context_for_prompt(self, sample_chunks):
        """Test that format_context_for_prompt produces readable text"""
        service = RAGService()
        
        formatted = service.format_context_for_prompt(sample_chunks)
        
        assert isinstance(formatted, str)
        assert len(formatted) > 0
        assert "test.pdf" in formatted
        assert sample_chunks[0]['text'] in formatted
        assert "[1]" in formatted  # Should have numbered references
        assert "[2]" in formatted
    
    def test_format_context_for_prompt_empty(self):
        """Test format_context_for_prompt with empty chunks"""
        service = RAGService()
        
        formatted = service.format_context_for_prompt([])
        
        assert formatted == ""
    
    def test_rag_service_handles_missing_chroma(self, mock_chroma_unavailable):
        """Test that RAG service handles missing Chroma gracefully"""
        service = RAGService()
        
        assert service.chroma_client is None
        assert service.chroma_collection is None
        
        # Should return empty list when Chroma is unavailable
        results = service.retrieve_context("test query")
        assert results == []
    
    def test_rag_service_handles_missing_embedding_model(self, mock_chroma_available):
        """Test that RAG service handles missing embedding model gracefully"""
        with patch('app.services.rag_service.chromadb.Client') as mock_client_class:
            mock_client = Mock()
            mock_client.get_collection = Mock(side_effect=Exception("Collection not found"))
            mock_client_class.return_value = mock_client
            
            service = RAGService()
            service.embedding_model = None
            
            # Should return empty list when embedding model is unavailable
            results = service.retrieve_context("test query")
            assert results == []

