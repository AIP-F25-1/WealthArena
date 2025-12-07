# Why Azure Isn't Working When Docker Works Fine

## The Core Issue

**Docker works because:** Docker automatically reads your local `.env` file and loads environment variables from it.

**Azure doesn't work because:** Azure App Service **does NOT** read your local `.env` file. Environment variables must be set separately in Azure App Settings.

## Quick Diagnosis

Run this to check if `GROQ_API_KEY` is set in Azure:

```powershell
# Replace with your actual app name and resource group
$AppName = "your-app-name"
$ResourceGroup = "your-resource-group"

# Check if GROQ_API_KEY is set
az webapp config appsettings list --name $AppName --resource-group $ResourceGroup --query "[?name=='GROQ_API_KEY']"
```

If it returns `[]` or nothing, **that's your problem** - the API key isn't set in Azure.

## The Solution

### Option 1: Use the Fix Script (Recommended)

The `azure_fix_deployment.ps1` script reads your `.env` file and sets the key in Azure:

```powershell
.\scripts\azure_fix_deployment.ps1 -AppName "your-app-name" -ResourceGroup "your-resource-group"
```

This script will:
1. Read `GROQ_API_KEY` from your local `.env` file
2. Set it in Azure App Settings
3. Fix other common configuration issues
4. Restart your app

### Option 2: Set It Manually

If you know your API key, set it directly:

```powershell
az webapp config appsettings set `
  --name "your-app-name" `
  --resource-group "your-resource-group" `
  --settings GROQ_API_KEY="your_actual_key_here"
```

Then restart the app:

```powershell
az webapp restart --name "your-app-name" --resource-group "your-resource-group"
```

### Option 3: Use the Diagnostic Script

Run the diagnostic tool to see what's wrong:

```powershell
.\scripts\diagnose_azure.ps1 -AppName "your-app-name" -ResourceGroup "your-resource-group"
```

## Why This Happens

### Docker Environment
```
Local .env file → Docker reads it → Environment variables loaded → App works ✅
```

### Azure Environment
```
Local .env file → NOT automatically read ❌
Azure App Settings → Must be set separately → App works ✅
```

## Common Mistakes

1. **Assuming `.env` works in Azure** - It doesn't! Azure needs App Settings.
2. **Setting placeholder in Azure** - Make sure you set the REAL key, not `gsk_your_actual_key_here`
3. **Not restarting after setting** - Changes require a restart to take effect

## Verification Steps

1. **Check Azure App Settings:**
   ```powershell
   az webapp config appsettings list --name "your-app-name" --resource-group "your-resource-group"
   ```

2. **Test Health Endpoint:**
   ```powershell
   curl https://your-app-name.azurewebsites.net/healthz
   ```
   Should return: `{"status":"ok"}`

3. **Check Logs:**
   ```powershell
   az webapp log tail --name "your-app-name" --resource-group "your-resource-group"
   ```
   Look for errors about missing `GROQ_API_KEY`

## For UI Integration

**Yes, you need Azure for UI integration** because:
- Your UI (React/React Native) needs to call the API from a public URL
- Docker runs locally (localhost) - not accessible from other devices/networks
- Azure provides a public HTTPS URL that your UI can call

## Next Steps

1. **Set GROQ_API_KEY in Azure** (use one of the options above)
2. **Restart the app**
3. **Test the health endpoint**
4. **Update your UI to use the Azure URL** instead of localhost

## Still Not Working?

Run the comprehensive verification:

```powershell
.\scripts\azure_verify_config.ps1 -AppName "your-app-name" -ResourceGroup "your-resource-group"
```

This will check:
- ✅ Azure CLI login
- ✅ App state
- ✅ All critical settings (SCM_DO_BUILD_DURING_DEPLOYMENT, PYTHONPATH, GROQ_API_KEY)
- ✅ Startup command
- ✅ Health endpoint
- ✅ Recent logs

