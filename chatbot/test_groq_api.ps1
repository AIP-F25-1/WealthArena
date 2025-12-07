# Direct GROQ API Test Script
# Tests the GROQ API key directly without guardrails or application code

Write-Host "=== GROQ API Direct Test ===" -ForegroundColor Cyan
Write-Host ""

# Read the .env file to get the API key
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] .env file not found at: $envFile" -ForegroundColor Red
    exit 1
}

Write-Host "Reading .env file..." -ForegroundColor Yellow
$envContent = Get-Content $envFile
$groqApiKey = $null

foreach ($line in $envContent) {
    if ($line -match "^GROQ_API_KEY=(.+)$") {
        $groqApiKey = $matches[1].Trim()
        break
    }
}

if (-not $groqApiKey) {
    Write-Host "[ERROR] GROQ_API_KEY not found in .env file" -ForegroundColor Red
    exit 1
}

# Show first 8 and last 4 characters for verification
$keyPreview = $groqApiKey.Substring(0, [Math]::Min(8, $groqApiKey.Length)) + "..." + $groqApiKey.Substring([Math]::Max(0, $groqApiKey.Length - 4))
Write-Host "API Key found: $keyPreview" -ForegroundColor Green
Write-Host ""

# Test prompt
$testPrompt = "Say 'Hello from Groq API' if you can read this message."

Write-Host "Testing GROQ API with prompt: '$testPrompt'" -ForegroundColor Yellow
Write-Host ""

# Prepare the request
$url = "https://api.groq.com/openai/v1/chat/completions"
$headers = @{
    "Authorization" = "Bearer $groqApiKey"
    "Content-Type" = "application/json"
}

$body = @{
    model = "llama-3.1-8b-instant"
    messages = @(
        @{
            role = "system"
            content = "You are a helpful assistant."
        },
        @{
            role = "user"
            content = $testPrompt
        }
    )
    max_tokens = 200
    temperature = 0.7
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Sending request to GROQ API..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host ""
    Write-Host "[SUCCESS] GROQ API is working!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host $response.choices[0].message.content -ForegroundColor White
    Write-Host ""
    Write-Host "Model used: $($response.model)" -ForegroundColor Gray
    Write-Host "Tokens used: $($response.usage.total_tokens)" -ForegroundColor Gray
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] GROQ API call failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error Details:" -ForegroundColor Yellow
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    } else {
        Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "1. Invalid API key - check if key is correct at https://console.groq.com/keys" -ForegroundColor Yellow
    Write-Host "2. API key expired or revoked" -ForegroundColor Yellow
    Write-Host "3. Network connectivity issue" -ForegroundColor Yellow
    Write-Host "4. API rate limit exceeded" -ForegroundColor Yellow
    
    exit 1
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan

