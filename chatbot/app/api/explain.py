"""
Explain API endpoint
Provides explanation functionality using search and Groq LLM
"""

import os
import time
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..llm.client import LLMClient
from ..metrics.prom import record_explain_request
from ..tools.retrieval import search_kb, search_all_collections

# Lazy load guard prompt
_guard_prompt = None

def _get_guard_prompt() -> str:
    """Lazy load guard prompt with graceful fallback"""
    global _guard_prompt
    if _guard_prompt is None:
        try:
            guard_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "llm", "guard_prompt.txt")
            with open(guard_path, "r", encoding="utf-8") as f:
                _guard_prompt = f.read()
        except Exception as e:
            # Fallback to default guard prompt if file not found
            logging.warning(f"Could not load guard prompt from file: {e}. Using default.")
            _guard_prompt = "You are WealthArena Tutor. Be concise (2–3 sentences). Educational only; no financial advice."
    return _guard_prompt

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
    
    async def explain(self, question: str, k: int = 3) -> ExplainResponse:
        """
        Explain a question using KB search and LLM
        
        Args:
            question: Question to explain
            k: Number of search results to use for context
            
        Returns:
            ExplainResponse with answer and sources
        """
        start_time = time.time()
        try:
            # Search PDF documents collection for relevant documents
            kb_hits = await search_all_collections(question, k=k, collections=['pdf_documents'])
            
            # Format context with source attribution
            context_parts = []
            for hit in kb_hits:
                meta = hit.get("meta", {})
                filename = meta.get("filename", "PDF Document")
                source_label = f"PDF: {filename}"
                context_parts.append(f'[{source_label}]\n{hit["text"]}\n')
            context = "\n\n".join(context_parts) or "No context."
            
            # Build sources from hits with collection type
            sources = []
            for hit in kb_hits:
                meta = hit.get("meta", {})
                collection_type = meta.get("collection_type", "unknown")
                title = meta.get("title") or meta.get("path") or f"{collection_type} Document"
                sources.append(SourceInfo(
                    title=title,
                    url=meta.get("url", ""),
                    score=hit.get("score", 0)
                ))
            
            # Prepare messages for LLM with guard prompt
            guard_prompt = _get_guard_prompt()
            messages = [
                {
                    "role": "system",
                    "content": guard_prompt
                },
                {
                    "role": "user", 
                    "content": f"QUESTION: {question}\n\nCONTEXT:\n{context}"
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
            
            logging.error(f"Explain service error: {e}")
            error_message = str(e)
            if "GROQ_API_KEY" in error_message or "API key" in error_message.lower():
                answer = "Unable to generate explanation. Please ensure GROQ_API_KEY is configured correctly in your .env file. Get your key from https://console.groq.com/"
            else:
                answer = f"Unable to generate explanation. LLM service unavailable: {error_message}. Please check your configuration and try again."
            
            return ExplainResponse(
                answer=answer,
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
