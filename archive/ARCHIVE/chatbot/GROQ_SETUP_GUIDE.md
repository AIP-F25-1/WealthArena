# Groq API Setup and Verification Guide

This guide helps you set up and verify the Groq API integration for the WealthArena chatbot.

## Your Groq API Key

**API Key:** `YOUR_GROQ_API_KEY`  
**Model:** `llama3-8b-8192`  
**Provider:** `groq`

## Step 1: Set Up .env File

1. **Copy the example environment file:**
   ```bash
   cd wealtharena_chatbot
   copy env.example .env
   ```

2. **Edit `.env` and set your Groq API key:**
   ```
   GROQ_API_KEY=YOUR_GROQ_API_KEY
   ```

3. **Verify your `.env` file has the following configuration:**
   ```bash
   LLM_PROVIDER=groq
   GROQ_API_KEY=YOUR_GROQ_API_KEY
   GROQ_MODEL=llama3-8b-8192
   PORT=5001
   BASE_URL=http://127.0.0.1:5001
   ```

## Step 2: Verify Configuration

### Method 1: Quick Test Script

Run the test script:
```bash
cd wealtharena_chatbot
python test_groq_integration.py
```

This will:
- ✅ Check that GROQ_API_KEY is set in your environment
- ✅ Verify the API key format
- ✅ Make a test API call to Groq
- ✅ Display the response to confirm it's working

### Method 2: Manual Verification

1. **Check environment variables are loaded:**
   ```python
   from dotenv import load_dotenv
   import os
   
   load_dotenv()
   print(f"LLM Provider: {os.getenv('LLM_PROVIDER')}")
   print(f"Groq Model: {os.getenv('GROQ_MODEL')}")
   print(f"API Key: {os.getenv('GROQ_API_KEY')[:8]}...{os.getenv('GROQ_API_KEY')[-4:]}")
   ```

2. **Test the LLM client:**
   ```python
   from app.llm.client import LLMClient
   import asyncio
   
   async def test():
       client = LLMClient()
       messages = [
           {"role": "user", "content": "What is RSI in trading? Keep it brief."}
       ]
       response = await client.chat(messages)
       print(response)
   
   asyncio.run(test())
   ```

## Step 3: Start the Chatbot Service

1. **Start the service:**
   ```bash
   python main.py
   # OR
   uvicorn app.main:app --host 0.0.0.0 --port 5001
   ```

2. **Test the chat endpoint:**
   ```bash
   curl -X POST http://localhost:5001/v1/chat \
     -H "Content-Type: application/json" \
     -d '{
       "message": "What is RSI?",
       "user_id": "test_user"
     }'
   ```

   **Expected Response:**
   ```json
   {
     "reply": "RSI (Relative Strength Index) is a momentum oscillator...",
     "tools_used": ["llm_client"],
     "trace_id": "run-12345",
     "card": null
   }
   ```

## Configuration Verification Checklist

- [ ] `.env` file exists in `wealtharena_chatbot/` directory
- [ ] `GROQ_API_KEY` is set in `.env` with your key
- [ ] `LLM_PROVIDER=groq` is set in `.env`
- [ ] `GROQ_MODEL=llama3-8b-8192` is set in `.env`
- [ ] API key starts with `gsk_` (format validation)
- [ ] Test script runs successfully
- [ ] Chatbot service starts without errors
- [ ] Chat endpoint returns Groq responses (not fallback)

## How Groq Integration Works

### Architecture

```
User Request → /v1/chat endpoint
    ↓
Chat API Handler (app/api/chat.py)
    ↓
LLM Client (app/llm/client.py)
    ↓
Groq API (https://api.groq.com/openai/v1/chat/completions)
    ↓
Response returned to user
```

### Key Components

1. **LLM Client** (`app/llm/client.py`):
   - Reads `GROQ_API_KEY` from environment
   - Configures Groq API endpoint
   - Makes async HTTP requests to Groq
   - Returns generated responses

2. **Chat Endpoint** (`app/api/chat.py`):
   - Receives user messages
   - Prepares messages for LLM
   - Calls LLM client
   - Formats and returns responses

3. **Configuration**:
   - Environment variables loaded via `python-dotenv`
   - Default provider: `groq`
   - Default model: `llama3-8b-8192`
   - API endpoint: `https://api.groq.com/openai/v1/chat/completions`

### Fallback Behavior

If Groq API is not available:
- Service continues running
- Falls back to educational hardcoded responses
- No service interruption
- Logs errors for debugging

## Troubleshooting

### Issue: "GROQ_API_KEY not found"
**Solution:** 
- Check `.env` file exists in `wealtharena_chatbot/` directory
- Verify `GROQ_API_KEY` line is present and not commented out
- Ensure no spaces around `=` sign: `GROQ_API_KEY=your_key_here`
- Restart the service after editing `.env`

### Issue: "Invalid API key"
**Solution:**
- Verify your API key is correct (starts with `gsk_`)
- Check for any extra spaces or characters
- Ensure the key hasn't expired
- Test the key directly with Groq API

### Issue: "Network error" or "Connection timeout"
**Solution:**
- Check your internet connection
- Verify Groq API is accessible: `https://api.groq.com`
- Check firewall settings
- Try again after a few seconds (rate limiting)

### Issue: Service falls back to hardcoded responses
**Symptoms:** Chat responses don't use Groq AI, uses static educational content instead

**Solution:**
1. Check logs for error messages
2. Verify `GROQ_API_KEY` is set correctly
3. Test with `test_groq_integration.py`
4. Check that `LLM_PROVIDER=groq` in `.env`

## Testing Different Models

You can test different Groq models by changing `GROQ_MODEL` in `.env`:

- `llama3-8b-8192` (default, fastest)
- `llama3-70b-8192` (higher quality, slower)
- `mixtral-8x7b-32768` (alternative option)

## Next Steps

Once Groq is verified and working:

1. ✅ Test various chat scenarios
2. ✅ Test trade setup generation (`/setup for SYMBOL`)
3. ✅ Test sentiment analysis (`analyze: text`)
4. ✅ Integrate with frontend
5. ✅ Monitor API usage and rate limits

## Success Indicators

✅ **Groq integration is working when:**
- Test script passes all checks
- Chat endpoint returns AI-generated responses (not static fallbacks)
- Response latency is reasonable (< 2 seconds typically)
- Responses are contextually relevant to user questions
- No error messages in service logs related to Groq API

---

**Your Groq configuration is ready!** 🚀

If you encounter any issues, refer to the troubleshooting section above or check the service logs.

