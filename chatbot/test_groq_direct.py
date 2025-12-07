"""
Direct test of Groq API to diagnose the issue
"""
import asyncio
import os
from dotenv import load_dotenv
from app.llm.client import LLMClient

async def test_groq():
    load_dotenv()
    
    client = LLMClient()
    
    print("=== Groq API Configuration Test ===")
    print(f"Provider: {client.provider}")
    print(f"Groq API Key: {'SET' if client.groq_api_key else 'NOT SET'}")
    if client.groq_api_key:
        print(f"Groq API Key (first 8 chars): {client.groq_api_key[:8]}...")
    print(f"Groq Model: {client.groq_model}")
    
    if not client.groq_api_key:
        print("\n[ERROR] GROQ_API_KEY is not set in environment")
        print("Check chatbot/.env file")
        return
    
    print("\n=== Testing Groq API Call ===")
    messages = [
        {"role": "system", "content": "You are a helpful trading education assistant."},
        {"role": "user", "content": "Say 'Hello from Groq' if you are using Groq API"}
    ]
    
    try:
        print("Calling Groq API...")
        response = await client.chat(messages)
        print(f"\n[SUCCESS] Response received:")
        print(f"'{response}'")
        
        if "Groq" in response or "groq" in response.lower():
            print("\n[OK] Confirmed: Groq API is working!")
        else:
            print("\n[WARNING] Response doesn't mention Groq - may be using fallback")
            
    except Exception as e:
        print(f"\n[ERROR] Groq API call failed:")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_groq())

