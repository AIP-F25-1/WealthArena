"""
WealthArena Chat Streaming API
Streaming chat endpoints for mobile SDKs
"""

import os
import json
import logging
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from ..llm.client import LLMClient
from ..tools.retrieval import search_all_collections

router = APIRouter()

# Initialize LLM client
llm_client = LLMClient()

# Setup logging
logger = logging.getLogger(__name__)

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
            logger.warning(f"Could not load guard prompt from file: {e}. Using default.")
            _guard_prompt = "You are WealthArena Tutor. Be concise (2–3 sentences). Educational only; no financial advice."
    return _guard_prompt

class ChatStreamReq(BaseModel):
    message: str
    user_id: Optional[str] = None
    context: Optional[str] = None

async def _generate_stream_response(message: str, user_id: Optional[str] = None, context: Optional[str] = None):
    """Shared function to generate SSE stream response"""
    try:
        # Load guard prompt
        guard_prompt = _get_guard_prompt()
        
        # RAG: Search PDF documents collection for relevant context
        kb_context = ""
        try:
            kb_hits = await search_all_collections(message, k=5, collections=['pdf_documents'])
            if kb_hits:
                context_parts = []
                for hit in kb_hits:
                    meta = hit.get("meta", {})
                    filename = meta.get("filename", "PDF Document")
                    source_label = f"PDF: {filename}"
                    context_parts.append(f'[{source_label}]\n{hit["text"]}\n')
                kb_context = "\n\n".join(context_parts)
        except Exception as e:
            logger.warning(f"PDF document search failed: {e}. Continuing without context.")
        
        # Build messages list with system prompt and user content
        user_content = message
        if kb_context:
            user_content = f"QUESTION: {message}\n\nCONTEXT FROM KNOWLEDGE BASE:\n{kb_context}\n\nPlease answer the question using the context provided. If the context doesn't contain relevant information, say so."
        
        messages = [
            {"role": "system", "content": guard_prompt},
            {"role": "user", "content": user_content}
        ]
        
        # Add context if provided
        if context:
            messages.append({"role": "system", "content": f"Additional context: {context}"})
        
        # Stream response from LLM
        chunk_index = 0
        async for chunk in llm_client.chat_stream(messages):
            yield f"data: {json.dumps({'chunk': chunk, 'index': chunk_index})}\n\n"
            chunk_index += 1
        
        # Send final done event
        yield f"data: {json.dumps({'chunk': '', 'done': True})}\n\n"
        
    except Exception as e:
        error_message = str(e)
        if "GROQ_API_KEY" in error_message or "API key" in error_message.lower():
            error_response = "LLM service unavailable. Please check GROQ_API_KEY configuration in your .env file. Get your key from https://console.groq.com/"
        else:
            error_response = f"LLM service unavailable: {error_message}. Please check your configuration and try again."
        
        logger.error(f"Streaming error: {e}")
        yield f"data: {json.dumps({'error': error_response, 'done': True})}\n\n"

@router.post("/chat/stream")
async def chat_stream_post(request: ChatStreamReq):
    """Streaming chat endpoint using Server-Sent Events (SSE) - POST method"""
    return StreamingResponse(
        _generate_stream_response(request.message, request.user_id, request.context),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/chat/stream")
async def chat_stream_get(
    message: str = Query(..., description="Chat message"),
    user_id: Optional[str] = Query(None, description="User ID"),
    context: Optional[str] = Query(None, description="Additional context")
):
    """Streaming chat endpoint using Server-Sent Events (SSE) - GET method"""
    return StreamingResponse(
        _generate_stream_response(message, user_id, context),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

