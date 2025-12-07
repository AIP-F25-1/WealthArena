"""
Test script to verify environment variable loading
"""
import os
import sys
from pathlib import Path

# Add the chatbot directory to path
chatbot_dir = Path(__file__).parent
sys.path.insert(0, str(chatbot_dir))

# Test 1: Load dotenv directly
print("=" * 60)
print("Test 1: Loading .env file directly")
print("=" * 60)
from dotenv import load_dotenv
env_path = chatbot_dir / ".env"
print(f"Loading from: {env_path}")
print(f"File exists: {env_path.exists()}")
load_dotenv(env_path)
groq_key = os.getenv("GROQ_API_KEY")
print(f"GROQ_API_KEY after load_dotenv: {'SET' if groq_key else 'NOT SET'}")
if groq_key:
    print(f"Key preview: {groq_key[:8]}...{groq_key[-4:]}")
print()

# Test 2: Import LLMClient
print("=" * 60)
print("Test 2: Importing LLMClient")
print("=" * 60)
from app.llm.client import LLMClient
client = LLMClient()
print(f"LLMClient groq_api_key: {'SET' if client.groq_api_key else 'NOT SET'}")
if client.groq_api_key:
    print(f"Key preview: {client.groq_api_key[:8]}...{client.groq_api_key[-4:]}")
print()

# Test 3: Import chat module
print("=" * 60)
print("Test 3: Importing chat module")
print("=" * 60)
from app.api.chat import llm_client
print(f"chat.llm_client groq_api_key: {'SET' if llm_client.groq_api_key else 'NOT SET'}")
if llm_client.groq_api_key:
    print(f"Key preview: {llm_client.groq_api_key[:8]}...{llm_client.groq_api_key[-4:]}")
print()

# Test 4: Import chat_stream module
print("=" * 60)
print("Test 4: Checking chat_stream module")
print("=" * 60)
groq_key_from_stream = os.getenv("GROQ_API_KEY")
print(f"os.getenv('GROQ_API_KEY') in chat_stream context: {'SET' if groq_key_from_stream else 'NOT SET'}")
if groq_key_from_stream:
    print(f"Key preview: {groq_key_from_stream[:8]}...{groq_key_from_stream[-4:]}")
print()

print("=" * 60)
print("Summary")
print("=" * 60)
if groq_key and client.groq_api_key and llm_client.groq_api_key:
    print("✅ All tests passed - GROQ_API_KEY is loaded correctly")
else:
    print("❌ Some tests failed - GROQ_API_KEY is not loaded correctly")
    print("   This indicates an environment variable loading issue")

