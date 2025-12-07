"""
WealthArena LLM Client
LLM client for chat functionality
Supports DeepSeek (via OpenRouter or direct), Groq as fallback
"""

import os
import asyncio
import time
import logging
import json
from typing import Dict, List, Optional
import httpx

class LLMClient:
    """LLM client for chat functionality"""
    
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "groq").lower()
        
        # DeepSeek configuration
        self.deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
        self.deepseek_model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
        
        # Groq configuration (fallback)
        self.groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.groq_model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
        
        self.sentiment_model_dir = os.getenv("SENTIMENT_MODEL_DIR", "models/sentiment-finetuned")
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
        
        # Determine if using OpenRouter (key starts with sk-or-) or direct DeepSeek API
        self.use_openrouter = False
        if self.deepseek_api_key:
            if self.deepseek_api_key.startswith('sk-or-'):
                self.use_openrouter = True
                self.logger.info("Detected OpenRouter API key for DeepSeek")
            elif self.deepseek_api_key.startswith('sk-'):
                self.use_openrouter = False
                self.logger.info("Detected direct DeepSeek API key")
            else:
                self.logger.warning(f"DeepSeek API key format may be invalid (expected 'sk-' or 'sk-or-' prefix)")
        
        # Validate Groq API key format
        if self.groq_api_key and not self.groq_api_key.startswith('gsk_'):
            self.logger.warning("Invalid GROQ_API_KEY format (expected 'gsk_' prefix). Treating as unset.")
            self.groq_api_key = ''  # Force fallback
        
        # Log configuration status
        if self.provider == "deepseek" and self.deepseek_api_key:
            api_type = "OpenRouter" if self.use_openrouter else "Direct DeepSeek"
            self.logger.info(f"LLM Client initialized with provider: {self.provider} ({api_type}), model: {self.deepseek_model}")
        elif self.provider == "groq" and self.groq_api_key and self.groq_api_key.startswith('gsk_'):
            self.logger.info(f"LLM Client initialized with provider: {self.provider}, model: {self.groq_model}")
        else:
            # Try to determine available provider
            if self.deepseek_api_key:
                self.logger.warning(f"Provider set to '{self.provider}' but DeepSeek key found. Consider setting LLM_PROVIDER=deepseek")
            if not self.groq_api_key or not self.groq_api_key.startswith('gsk_'):
                self.logger.error("No valid API keys found. LLM functionality will not be available.")
    
    async def chat(self, messages: List[Dict]) -> str:
        """New chat method that takes messages list and returns string"""
        start_time = time.time()
        
        # Try DeepSeek first if configured
        if self.provider == "deepseek" and self.deepseek_api_key:
            try:
                response = await self._call_deepseek(messages)
                latency = time.time() - start_time
                self.logger.info(f"DeepSeek API call completed in {latency:.2f}s")
                return response
            except Exception as e:
                latency = time.time() - start_time
                self.logger.warning(f"DeepSeek API call failed after {latency:.2f}s: {str(e)}")
                # Fallback to Groq if available
                if self.groq_api_key and self.groq_api_key.startswith('gsk_'):
                    self.logger.info("Falling back to Groq API")
                else:
                    raise
        
        # Use Groq as primary or fallback
        if not self.groq_api_key or not self.groq_api_key.startswith('gsk_'):
            raise ValueError("No valid API key found. Please set DEEPSEEK_API_KEY or GROQ_API_KEY in your .env file.")
        
        try:
            response = await self._call_groq(messages)
            latency = time.time() - start_time
            self.logger.info(f"Groq API call completed in {latency:.2f}s")
            return response
        except Exception as e:
            latency = time.time() - start_time
            self.logger.error(f"LLM API call failed after {latency:.2f}s: {str(e)}")
            raise
    
    async def _call_deepseek(self, messages: List[Dict]) -> str:
        """Call DeepSeek API (via OpenRouter or direct) using httpx with retry logic and exponential backoff"""
        if not self.deepseek_api_key:
            raise ValueError("Invalid or missing DEEPSEEK_API_KEY. Please check your .env file.")
        
        # Determine API endpoint based on key type
        if self.use_openrouter:
            # OpenRouter endpoint for DeepSeek
            url = "https://openrouter.ai/api/v1/chat/completions"
            # For OpenRouter, we need to specify the model in the format: deepseek/deepseek-chat
            model = f"deepseek/{self.deepseek_model}"
            headers = {
                "Authorization": f"Bearer {self.deepseek_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://wealtharena.com",  # Optional: for OpenRouter tracking
                "X-Title": "WealthArena Chatbot"  # Optional: for OpenRouter tracking
            }
        else:
            # Direct DeepSeek API endpoint
            url = "https://api.deepseek.com/v1/chat/completions"
            model = self.deepseek_model
            headers = {
                "Authorization": f"Bearer {self.deepseek_api_key}",
                "Content-Type": "application/json"
            }
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": 1000,
            "temperature": 0.7
        }
        
        max_attempts = 3
        last_exception = None
        
        for attempt in range(max_attempts):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                    
                    data = response.json()
                    if "choices" not in data or len(data["choices"]) == 0:
                        raise ValueError("Invalid response from DeepSeek API: no choices")
                    
                    return data["choices"][0]["message"]["content"]
            except httpx.TimeoutException as e:
                last_exception = e
                if attempt < max_attempts - 1:
                    backoff = 0.5 * (2 ** attempt)  # Exponential backoff: 0.5, 1.0 seconds
                    api_name = "OpenRouter" if self.use_openrouter else "DeepSeek"
                    self.logger.warning(f"{api_name} API request timed out (attempt {attempt + 1}/{max_attempts}), retrying in {backoff}s...")
                    await asyncio.sleep(backoff)
                else:
                    self.logger.error("DeepSeek API request timed out after all retries")
                    raise
            except httpx.HTTPStatusError as e:
                last_exception = e
                status_code = e.response.status_code
                api_name = "OpenRouter" if self.use_openrouter else "DeepSeek"
                
                # Handle 401 authentication errors specifically
                if status_code == 401:
                    self.logger.error(f"Authentication failed - verify DEEPSEEK_API_KEY in .env")
                    raise ValueError(f"Authentication failed - verify DEEPSEEK_API_KEY in .env")
                
                # Handle 400 Bad Request errors with detailed message
                if status_code == 400:
                    try:
                        error_data = e.response.json()
                        error_message = error_data.get("error", {}).get("message", "Invalid request")
                        error_type = error_data.get("error", {}).get("type", "invalid_request_error")
                        self.logger.error(f"{api_name} API Bad Request (400): {error_type} - {error_message}")
                        raise ValueError(f"Invalid request to {api_name} API: {error_message}. Check DEEPSEEK_MODEL setting (current: {self.deepseek_model})")
                    except (json.JSONDecodeError, KeyError):
                        # Fallback if response isn't JSON or doesn't have expected structure
                        self.logger.error(f"{api_name} API Bad Request (400): {e.response.text}")
                        raise ValueError(f"Invalid request to {api_name} API. Check DEEPSEEK_MODEL setting (current: {self.deepseek_model}) and request format.")
                
                # Retry on 429 (rate limit) or 5xx (server errors)
                should_retry = status_code == 429 or (500 <= status_code < 600)
                
                if should_retry and attempt < max_attempts - 1:
                    backoff = 0.5 * (2 ** attempt)  # Exponential backoff: 0.5, 1.0 seconds
                    self.logger.warning(f"{api_name} API HTTP error {status_code} (attempt {attempt + 1}/{max_attempts}), retrying in {backoff}s...")
                    await asyncio.sleep(backoff)
                else:
                    self.logger.error(f"{api_name} API HTTP error: {status_code} - {e.response.text}")
                    raise
            except Exception as e:
                last_exception = e
                # Don't retry on other exceptions (e.g., ValueError for invalid response)
                self.logger.error(f"DeepSeek API call failed: {e}")
                raise
        
        # This should never be reached, but just in case
        if last_exception:
            raise last_exception
    
    async def _call_groq(self, messages: List[Dict]) -> str:
        """Call Groq API using httpx with retry logic and exponential backoff"""
        if not self.groq_api_key or not self.groq_api_key.startswith('gsk_'):
            raise ValueError("Invalid or missing GROQ_API_KEY. Please check your .env file.")
        
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.groq_model,
            "messages": messages,
            "max_tokens": 1000,  # Increased for better responses
            "temperature": 0.7
        }
        
        max_attempts = 3
        last_exception = None
        
        for attempt in range(max_attempts):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                    
                    data = response.json()
                    if "choices" not in data or len(data["choices"]) == 0:
                        raise ValueError("Invalid response from Groq API: no choices")
                    
                    return data["choices"][0]["message"]["content"]
            except httpx.TimeoutException as e:
                last_exception = e
                if attempt < max_attempts - 1:
                    backoff = 0.5 * (2 ** attempt)  # Exponential backoff: 0.5, 1.0 seconds
                    self.logger.warning(f"Groq API request timed out (attempt {attempt + 1}/{max_attempts}), retrying in {backoff}s...")
                    await asyncio.sleep(backoff)
                else:
                    self.logger.error("Groq API request timed out after all retries")
                    raise
            except httpx.HTTPStatusError as e:
                last_exception = e
                status_code = e.response.status_code
                
                # Handle 401 authentication errors specifically
                if status_code == 401:
                    self.logger.error("Authentication failed - verify GROQ_API_KEY in .env")
                    raise ValueError("Authentication failed - verify GROQ_API_KEY in .env")
                
                # Handle 400 Bad Request errors with detailed message
                if status_code == 400:
                    try:
                        error_data = e.response.json()
                        error_message = error_data.get("error", {}).get("message", "Invalid request")
                        error_type = error_data.get("error", {}).get("type", "invalid_request_error")
                        self.logger.error(f"Groq API Bad Request (400): {error_type} - {error_message}")
                        raise ValueError(f"Invalid request to Groq API: {error_message}. Check GROQ_MODEL setting (current: {self.groq_model})")
                    except (json.JSONDecodeError, KeyError):
                        # Fallback if response isn't JSON or doesn't have expected structure
                        self.logger.error(f"Groq API Bad Request (400): {e.response.text}")
                        raise ValueError(f"Invalid request to Groq API. Check GROQ_MODEL setting (current: {self.groq_model}) and request format.")
                
                # Retry on 429 (rate limit) or 5xx (server errors)
                should_retry = status_code == 429 or (500 <= status_code < 600)
                
                if should_retry and attempt < max_attempts - 1:
                    backoff = 0.5 * (2 ** attempt)  # Exponential backoff: 0.5, 1.0 seconds
                    self.logger.warning(f"Groq API HTTP error {status_code} (attempt {attempt + 1}/{max_attempts}), retrying in {backoff}s...")
                    await asyncio.sleep(backoff)
                else:
                    self.logger.error(f"Groq API HTTP error: {status_code} - {e.response.text}")
                    raise
            except Exception as e:
                last_exception = e
                # Don't retry on other exceptions (e.g., ValueError for invalid response)
                self.logger.error(f"Groq API call failed: {e}")
                raise
        
        # This should never be reached, but just in case
        if last_exception:
            raise last_exception
    
    async def _call_deepseek_stream(self, messages: List[Dict]):
        """Stream chat responses from DeepSeek API (via OpenRouter or direct) using Server-Sent Events"""
        if not self.deepseek_api_key:
            raise ValueError("Invalid or missing DEEPSEEK_API_KEY. Please check your .env file.")
        
        # Determine API endpoint based on key type
        if self.use_openrouter:
            # OpenRouter endpoint for DeepSeek
            url = "https://openrouter.ai/api/v1/chat/completions"
            # For OpenRouter, we need to specify the model in the format: deepseek/deepseek-chat
            model = f"deepseek/{self.deepseek_model}"
            headers = {
                "Authorization": f"Bearer {self.deepseek_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://wealtharena.com",  # Optional: for OpenRouter tracking
                "X-Title": "WealthArena Chatbot"  # Optional: for OpenRouter tracking
            }
        else:
            # Direct DeepSeek API endpoint
            url = "https://api.deepseek.com/v1/chat/completions"
            model = self.deepseek_model
            headers = {
                "Authorization": f"Bearer {self.deepseek_api_key}",
                "Content-Type": "application/json"
            }
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": 1000,
            "temperature": 0.7,
            "stream": True
        }
        
        max_attempts = 3
        last_exception = None
        
        for attempt in range(max_attempts):
            try:
                # Use longer timeout for streaming - disable read timeout to allow long streams
                timeout = httpx.Timeout(connect=10.0, read=None, write=10.0, pool=10.0)
                async with httpx.AsyncClient(timeout=timeout) as client:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        response.raise_for_status()
                        
                        async for line in response.aiter_lines():
                            if not line.strip():
                                continue
                            
                            # SSE format: "data: {json}" or "data: [DONE]"
                            if line.startswith("data: "):
                                data_str = line[6:]  # Remove "data: " prefix
                                
                                if data_str.strip() == "[DONE]":
                                    break
                                
                                try:
                                    data = json.loads(data_str)
                                    
                                    # Extract delta content
                                    if "choices" in data and len(data["choices"]) > 0:
                                        delta = data["choices"][0].get("delta", {})
                                        content = delta.get("content", "")
                                        if content:
                                            yield content
                                except json.JSONDecodeError:
                                    # Skip invalid JSON lines
                                    continue
                        
                        # Stream completed successfully
                        return
                        
            except httpx.TimeoutException as e:
                last_exception = e
                if attempt < max_attempts - 1:
                    backoff = 0.5 * (2 ** attempt)
                    api_name = "OpenRouter" if self.use_openrouter else "DeepSeek"
                    self.logger.warning(f"{api_name} API streaming request timed out (attempt {attempt + 1}/{max_attempts}), retrying in {backoff}s...")
                    await asyncio.sleep(backoff)
                else:
                    self.logger.error("DeepSeek API streaming request timed out after all retries")
                    raise
            except httpx.HTTPStatusError as e:
                last_exception = e
                status_code = e.response.status_code
                api_name = "OpenRouter" if self.use_openrouter else "DeepSeek"
                
                # Handle 401 authentication errors specifically
                if status_code == 401:
                    self.logger.error(f"Authentication failed - verify DEEPSEEK_API_KEY in .env")
                    raise ValueError(f"Authentication failed - verify DEEPSEEK_API_KEY in .env")
                
                # Handle 400 Bad Request errors with detailed message
                if status_code == 400:
                    try:
                        error_data = e.response.json()
                        error_message = error_data.get("error", {}).get("message", "Invalid request")
                        error_type = error_data.get("error", {}).get("type", "invalid_request_error")
                        self.logger.error(f"{api_name} API Bad Request (400): {error_type} - {error_message}")
                        raise ValueError(f"Invalid request to {api_name} API: {error_message}. Check DEEPSEEK_MODEL setting (current: {self.deepseek_model})")
                    except (json.JSONDecodeError, KeyError):
                        # Fallback if response isn't JSON or doesn't have expected structure
                        self.logger.error(f"{api_name} API Bad Request (400): {e.response.text}")
                        raise ValueError(f"Invalid request to {api_name} API. Check DEEPSEEK_MODEL setting (current: {self.deepseek_model}) and request format.")
                
                # Retry on 429 (rate limit) or 5xx (server errors)
                should_retry = status_code == 429 or (500 <= status_code < 600)
                
                if should_retry and attempt < max_attempts - 1:
                    backoff = 0.5 * (2 ** attempt)
                    self.logger.warning(f"{api_name} API streaming HTTP error {status_code} (attempt {attempt + 1}/{max_attempts}), retrying in {backoff}s...")
                    await asyncio.sleep(backoff)
                else:
                    self.logger.error(f"{api_name} API streaming HTTP error: {status_code} - {e.response.text}")
                    raise
            except Exception as e:
                last_exception = e
                self.logger.error(f"DeepSeek API streaming call failed: {e}")
                raise
        
        # This should never be reached, but just in case
        if last_exception:
            raise last_exception
    
    async def chat_stream(self, messages: List[Dict]):
        """Stream chat responses from DeepSeek or Groq API using Server-Sent Events"""
        # Try DeepSeek first if configured
        if self.provider == "deepseek" and self.deepseek_api_key:
            try:
                async for content in self._call_deepseek_stream(messages):
                    yield content
                return
            except Exception as e:
                self.logger.warning(f"DeepSeek streaming failed: {str(e)}")
                # Fallback to Groq if available
                if self.groq_api_key and self.groq_api_key.startswith('gsk_'):
                    self.logger.info("Falling back to Groq API for streaming")
                else:
                    raise
        
        # Use Groq as primary or fallback
        if not self.groq_api_key or not self.groq_api_key.startswith('gsk_'):
            raise ValueError("No valid API key found. Please set DEEPSEEK_API_KEY or GROQ_API_KEY in your .env file.")
        
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.groq_model,
            "messages": messages,
            "max_tokens": 1000,
            "temperature": 0.7,
            "stream": True
        }
        
        max_attempts = 3
        last_exception = None
        
        for attempt in range(max_attempts):
            try:
                # Use longer timeout for streaming - disable read timeout to allow long streams
                timeout = httpx.Timeout(connect=10.0, read=None, write=10.0, pool=10.0)
                async with httpx.AsyncClient(timeout=timeout) as client:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        response.raise_for_status()
                        
                        async for line in response.aiter_lines():
                            if not line.strip():
                                continue
                            
                            # SSE format: "data: {json}" or "data: [DONE]"
                            if line.startswith("data: "):
                                data_str = line[6:]  # Remove "data: " prefix
                                
                                if data_str.strip() == "[DONE]":
                                    break
                                
                                try:
                                    data = json.loads(data_str)
                                    
                                    # Extract delta content
                                    if "choices" in data and len(data["choices"]) > 0:
                                        delta = data["choices"][0].get("delta", {})
                                        content = delta.get("content", "")
                                        if content:
                                            yield content
                                except json.JSONDecodeError:
                                    # Skip invalid JSON lines
                                    continue
                        
                        # Stream completed successfully
                        return
                        
            except httpx.TimeoutException as e:
                last_exception = e
                if attempt < max_attempts - 1:
                    backoff = 0.5 * (2 ** attempt)
                    self.logger.warning(f"Groq API streaming request timed out (attempt {attempt + 1}/{max_attempts}), retrying in {backoff}s...")
                    await asyncio.sleep(backoff)
                else:
                    self.logger.error("Groq API streaming request timed out after all retries")
                    raise
            except httpx.HTTPStatusError as e:
                last_exception = e
                status_code = e.response.status_code
                
                # Handle 401 authentication errors specifically
                if status_code == 401:
                    self.logger.error("Authentication failed - verify GROQ_API_KEY in .env")
                    raise ValueError("Authentication failed - verify GROQ_API_KEY in .env")
                
                # Handle 400 Bad Request errors with detailed message
                if status_code == 400:
                    try:
                        error_data = e.response.json()
                        error_message = error_data.get("error", {}).get("message", "Invalid request")
                        error_type = error_data.get("error", {}).get("type", "invalid_request_error")
                        self.logger.error(f"Groq API Bad Request (400): {error_type} - {error_message}")
                        raise ValueError(f"Invalid request to Groq API: {error_message}. Check GROQ_MODEL setting (current: {self.groq_model})")
                    except (json.JSONDecodeError, KeyError):
                        # Fallback if response isn't JSON or doesn't have expected structure
                        self.logger.error(f"Groq API Bad Request (400): {e.response.text}")
                        raise ValueError(f"Invalid request to Groq API. Check GROQ_MODEL setting (current: {self.groq_model}) and request format.")
                
                # Retry on 429 (rate limit) or 5xx (server errors)
                should_retry = status_code == 429 or (500 <= status_code < 600)
                
                if should_retry and attempt < max_attempts - 1:
                    backoff = 0.5 * (2 ** attempt)
                    self.logger.warning(f"Groq API streaming HTTP error {status_code} (attempt {attempt + 1}/{max_attempts}), retrying in {backoff}s...")
                    await asyncio.sleep(backoff)
                else:
                    self.logger.error(f"Groq API streaming HTTP error: {status_code} - {e.response.text}")
                    raise
            except Exception as e:
                last_exception = e
                self.logger.error(f"Groq API streaming call failed: {e}")
                raise
        
        # This should never be reached, but just in case
        if last_exception:
            raise last_exception

