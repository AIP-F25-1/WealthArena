# Environment Configuration Setup

This guide explains how to set up your `.env` file for deployment scripts.

## Quick Setup

1. **Copy the template file:**
   ```powershell
   cd infrastructure/azure_infrastructure
   copy env.template .env
   ```

2. **Edit `.env` and add your Groq API key:**
   ```
   GROQ_API_KEY=your_actual_groq_api_key_here
   ```

3. **Run your deployment scripts** - they will automatically load values from `.env`

## Required Variables

### GROQ_API_KEY (Required)
- **Purpose:** API key for Groq LLM service used by the chatbot
- **Where to get it:** https://console.groq.com/keys
- **Format:** Starts with `gsk_`
- **Example:** `GROQ_API_KEY=gsk_your_actual_api_key_here`

## Optional Variables

### AZURE_SQL_PASSWORD
- **Purpose:** Custom password for Azure SQL Database
- **Default:** Scripts will use a default password if not set
- **Example:** `AZURE_SQL_PASSWORD=YourSecurePassword123!`

### AZURE_COSMOS_KEY
- **Purpose:** Connection key for Azure Cosmos DB (for chatbot knowledge base)
- **Example:** `AZURE_COSMOS_KEY=your_cosmos_key_here`

### AZURE_STORAGE_CONNECTION_STRING
- **Purpose:** Connection string for Azure Storage Account
- **Example:** `AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...`

## How Scripts Load Environment Variables

The deployment scripts will load variables in this order (first found wins):

1. **Environment Variables** - System/user environment variables take precedence
2. **`.env` file** - Located in `infrastructure/azure_infrastructure/.env`
3. **Default/Placeholder** - Scripts will warn if required values are missing

## Setting Environment Variables (Alternative to .env file)

You can also set environment variables directly in PowerShell:

```powershell
# Set for current session
$env:GROQ_API_KEY = "your_groq_api_key_here"

# Set permanently for user
[Environment]::SetEnvironmentVariable("GROQ_API_KEY", "your_groq_api_key_here", "User")
```

## Security Notes

⚠️ **Important:**
- Never commit `.env` files to version control
- `.env` is already in `.gitignore`
- Keep your API keys secure and rotate them if exposed
- Use Azure Key Vault for production deployments

## Troubleshooting

### Script says "GROQ_API_KEY not found"
1. Check that `.env` file exists in `infrastructure/azure_infrastructure/`
2. Verify the file contains `GROQ_API_KEY=your_key` (no spaces around `=`)
3. Check that the key doesn't have quotes around it
4. Try setting it as an environment variable instead

### Script still uses placeholder values
- Make sure `.env` file is in the same directory as the script
- Check for typos in variable names (case-sensitive)
- Restart PowerShell session if you just created the `.env` file

## Example .env File

```env
# Required
GROQ_API_KEY=gsk_your_actual_key_here

# Optional
AZURE_SQL_PASSWORD=YourSecurePassword123!
AZURE_COSMOS_KEY=your_cosmos_key_here
```

