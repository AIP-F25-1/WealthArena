"""
Environment Variable Validation Script
Validates that all required environment variables are set for the chatbot service

Usage:
    python scripts/validate_env.py

This script checks for:
- Required API keys (GROQ_API_KEY)
- RAG configuration variables
- Optional but recommended variables
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    # Try .env.local
    env_local_path = Path(__file__).parent.parent / ".env.local"
    if env_local_path.exists():
        load_dotenv(env_local_path)

def validate_env():
    """Validate environment variables"""
    errors = []
    warnings = []
    
    print("=" * 60)
    print("WealthArena Chatbot - Environment Variable Validation")
    print("=" * 60)
    print()
    
    # Required variables
    print("Checking required variables...")
    required_vars = {
        "GROQ_API_KEY": "Groq API key for LLM integration"
    }
    
    for var, description in required_vars.items():
        value = os.getenv(var)
        if not value or value in ["your_groq_api_key_here", "your-groq-api-key-here"]:
            errors.append(f"  ❌ {var}: {description} (not set or placeholder)")
        else:
            print(f"  ✅ {var}: Set")
    
    print()
    
    # RAG configuration variables
    print("Checking RAG configuration variables...")
    rag_vars = {
        "EMBEDDING_MODEL": os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
        "RAG_COLLECTION_NAME": os.getenv("RAG_COLLECTION_NAME", "financial_knowledge"),
        "RAG_CHUNK_SIZE": os.getenv("RAG_CHUNK_SIZE", "1000"),
        "RAG_CHUNK_OVERLAP": os.getenv("RAG_CHUNK_OVERLAP", "200"),
        "RAG_TOP_K": os.getenv("RAG_TOP_K", "3"),
        "CHROMA_PERSIST_DIR": os.getenv("CHROMA_PERSIST_DIR", "data/vectorstore")
    }
    
    for var, default_value in rag_vars.items():
        value = os.getenv(var, default_value)
        if value == default_value:
            print(f"  ⚠️  {var}: Using default ({default_value})")
            warnings.append(f"{var} using default value")
        else:
            print(f"  ✅ {var}: {value}")
    
    print()
    
    # Optional variables
    print("Checking optional variables...")
    optional_vars = {
        "GROQ_MODEL": os.getenv("GROQ_MODEL", "llama3-8b-8192"),
        "LLM_PROVIDER": os.getenv("LLM_PROVIDER", "groq"),
        "APP_PORT": os.getenv("APP_PORT", "8000")
    }
    
    for var, default_value in optional_vars.items():
        value = os.getenv(var, default_value)
        print(f"  ℹ️  {var}: {value}")
    
    print()
    print("=" * 60)
    
    # Summary
    if errors:
        print("❌ VALIDATION FAILED")
        print()
        print("Errors found:")
        for error in errors:
            print(error)
        print()
        print("Please update your .env or .env.local file with the required values.")
        return False
    elif warnings:
        print("⚠️  VALIDATION PASSED WITH WARNINGS")
        print()
        print("Some variables are using default values. This is acceptable but you may want to customize them.")
        return True
    else:
        print("✅ VALIDATION PASSED")
        print()
        print("All required variables are set and RAG configuration is present.")
        return True

if __name__ == "__main__":
    success = validate_env()
    sys.exit(0 if success else 1)

