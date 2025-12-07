# Chatbot Troubleshooting Guide

## Current Issues Identified

### 1. API Endpoint Mismatch ✅ FIXED
- **Problem**: Frontend was calling `/chat` but backend expects `/v1/chat`
- **Solution**: Updated `chatbotService.ts` to use correct endpoints

### 2. Azure Deployment Issues
- **Problem**: The chatbot service at `https://wealtharena-chatbot-5224.azurewebsites.net` is not responding
- **Status**: 404 errors on all endpoints
- **Solution**: Need to redeploy or fix the Azure deployment

### 3. Missing Environment Configuration
- **Problem**: No GROQ API key configured for LLM responses
- **Solution**: Set up environment variables

## Quick Fixes Applied

1. ✅ Updated API endpoints to use `/v1/` prefix
2. ✅ Added better error handling with fallback responses
3. ✅ Added local development fallback (localhost:8000)
4. ✅ Improved error messages for debugging

## Next Steps to Fix Completely

### Option 1: Fix Azure Deployment
1. Check Azure deployment logs
2. Ensure environment variables are set in Azure
3. Redeploy the chatbot service

### Option 2: Run Locally (Recommended for Development)
1. Start the chatbot service locally:
   ```bash
   cd wealtharena_chatbot
   pip install -r requirements.txt
   python -m app.main
   ```

2. Set environment variable in your app:
   ```bash
   export EXPO_PUBLIC_CHATBOT_API_URL=http://localhost:8000
   ```

3. Get a free GROQ API key:
   - Go to https://console.groq.com/
   - Sign up for free
   - Create an API key
   - Set it in your environment: `export GROQ_API_KEY=your_key_here`

### Option 3: Use Mock Responses (Temporary)
The app now has fallback responses when the chatbot is unavailable, so it will still work but with limited functionality.

## Testing the Fix

1. Try sending a message in the AI chat
2. Check the console for error messages
3. The app should now show a proper error message instead of crashing

## Environment Variables Needed

Create a `.env` file in the `wealtharena_chatbot` directory:
```
GROQ_API_KEY=your_groq_api_key_here
LLM_PROVIDER=groq
GROQ_MODEL=llama3-8b-8192
DEBUG=true
```

## Verification

To test if the chatbot is working:
1. Check if the service responds: `curl http://localhost:8000/v1/healthz`
2. Test a chat message: `curl -X POST http://localhost:8000/v1/chat -H "Content-Type: application/json" -d '{"message": "Hello"}'`
