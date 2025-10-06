"""
Explain API endpoint
Provides explanation functionality using search and Groq LLM
"""

import time
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..api.search import get_search_service
from ..llm.client import LLMClient
from ..metrics.prom import record_explain_request

router = APIRouter()

class ExplainRequest(BaseModel):
    """Explain request model"""
    question: str
    k: int = 3

class SourceInfo(BaseModel):
    """Source information model"""
    title: str
    url: str
    score: float

class ExplainResponse(BaseModel):
    """Explain response model"""
    answer: str
    sources: List[SourceInfo]

class ExplainService:
    """Explain service using search and LLM"""
    
    def __init__(self):
        self.llm_client = LLMClient()
        self.search_service = get_search_service()
    
    async def explain(self, question: str, k: int = 3) -> ExplainResponse:
        """
        Explain a question using search results and LLM
        
        Args:
            question: Question to explain
            k: Number of search results to use for context
            
        Returns:
            ExplainResponse with answer and sources
        """
        start_time = time.time()
        try:
            # Search for relevant documents
            search_response = await self.search_service.search(question, k)
            
            if not search_response.results:
                return ExplainResponse(
                    answer="I couldn't find relevant information to answer your question. Please try rephrasing your question or ask about a different topic.",
                    sources=[]
                )
            
            # Build context from search results
            context_parts = []
            sources = []
            
            for result in search_response.results:
                context_parts.append(f"Title: {result.title}")
                context_parts.append(f"Summary: {result.summary if hasattr(result, 'summary') else 'No summary available'}")
                context_parts.append(f"URL: {result.url}")
                context_parts.append("---")
                
                sources.append(SourceInfo(
                    title=result.title,
                    url=result.url,
                    score=result.score
                ))
            
            context = "\n".join(context_parts)
            
            # Create system prompt
            system_prompt = """You are a financial education assistant. Answer the user's question using ONLY the provided context from financial news articles. 

Rules:
1. Answer only using the provided context
2. If the context is insufficient to answer the question, say what information is missing
3. Keep your answer to 2-3 sentences maximum
4. Focus on educational content about trading and finance
5. Always remind users that this is educational content and they should practice with paper trading first
6. Never provide specific investment advice

Context:
{context}"""
            
            # Prepare messages for LLM
            messages = [
                {
                    "role": "system",
                    "content": system_prompt.format(context=context)
                },
                {
                    "role": "user", 
                    "content": question
                }
            ]
            
            # Get answer from LLM
            answer = await self.llm_client.chat(messages)
            
            # Record successful explain request
            latency = time.time() - start_time
            record_explain_request("success", latency)
            
            return ExplainResponse(
                answer=answer,
                sources=sources
            )
            
        except Exception as e:
            # Record failed explain request
            latency = time.time() - start_time
            record_explain_request("error", latency)
            
            print(f"Explain service error: {e}")
            return ExplainResponse(
                answer="I'm having trouble processing your question right now. Please try again later.",
                sources=[]
            )

# Global explain service instance
_explain_service = None

def get_explain_service() -> ExplainService:
    """Get or create the global explain service instance"""
    global _explain_service
    if _explain_service is None:
        _explain_service = ExplainService()
    return _explain_service

@router.post("/explain", response_model=ExplainResponse)
async def explain_question(request: ExplainRequest):
    """
    Explain a financial question using search and LLM
    
    Args:
        request: ExplainRequest with question and optional k parameter
        
    Returns:
        ExplainResponse with answer and sources
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    if request.k < 1 or request.k > 10:
        raise HTTPException(status_code=400, detail="k must be between 1 and 10")
    
    explain_service = get_explain_service()
    return await explain_service.explain(request.question, request.k)
