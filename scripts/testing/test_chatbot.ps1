# Consolidated Chatbot Test Script
# Merged from test_chatbot.ps1 and test_chatbot_simple.ps1
# Usage: 
#   .\scripts\testing\test_chatbot.ps1 -Mode Full
#   .\scripts\testing\test_chatbot.ps1 -Mode Simple
#   .\scripts\testing\test_chatbot.ps1 -Mode Quick -Message "Your message here"

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("Full", "Simple", "Quick")]
    [string]$Mode = "Full",
    
    [Parameter(Mandatory=$false)]
    [string]$Message = "What is the best forex strategy on the market?"
)

Write-Host "Testing Chatbot Service..." -ForegroundColor Cyan
Write-Host "Mode: $Mode" -ForegroundColor Yellow
Write-Host "Message: $Message" -ForegroundColor Yellow
Write-Host ""

# Test 1: Health check (Full and Simple modes only)
if ($Mode -eq "Full" -or $Mode -eq "Simple") {
    Write-Host "1. Testing health endpoint..." -ForegroundColor Yellow
    try {
        $healthResponse = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
        Write-Host "[OK] Health check passed" -ForegroundColor Green
        Write-Host "Response: $($healthResponse | ConvertTo-Json)" -ForegroundColor Gray
    } catch {
        Write-Host "[ERROR] Health check failed: $_" -ForegroundColor Red
        Write-Host "`nTip: Make sure the chatbot service is running:" -ForegroundColor Yellow
        Write-Host "   cd chatbot" -ForegroundColor White
        Write-Host "   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000" -ForegroundColor White
        exit 1
    }
    Write-Host ""
}

# Test 2: Chat endpoint
$testNumber = if ($Mode -eq "Full" -or $Mode -eq "Simple") { "2" } else { "1" }
Write-Host "$testNumber. Testing chat endpoint..." -ForegroundColor Yellow
$chatBody = @{
    message = $Message
} | ConvertTo-Json

try {
    $chatResponse = Invoke-RestMethod -Uri "http://localhost:8000/v1/chat" -Method Post -Body $chatBody -ContentType "application/json"
    Write-Host "[OK] Chat request successful" -ForegroundColor Green
    Write-Host "`nResponse:" -ForegroundColor Cyan
    Write-Host "Reply: $($chatResponse.reply)" -ForegroundColor White
    Write-Host "Tools Used: $($chatResponse.tools_used -join ', ')" -ForegroundColor Gray
    Write-Host "Trace ID: $($chatResponse.trace_id)" -ForegroundColor Gray
    
    # Check if Groq is being used (Full mode only)
    if ($Mode -eq "Full") {
        if ($chatResponse.reply -match "Groq|groq|I'm using Groq") {
            Write-Host "`n[OK] Groq API is working!" -ForegroundColor Green
        } else {
            Write-Host "`n[WARNING] Response received but may not be from Groq API" -ForegroundColor Yellow
            Write-Host "   Check chatbot/.env file for GROQ_API_KEY" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "[ERROR] Chat request failed: $_" -ForegroundColor Red
    Write-Host "`nError Details:" -ForegroundColor Yellow
    Write-Host "$_" -ForegroundColor White
    
    if ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "`nTip: Check chatbot/.env file has GROQ_API_KEY set" -ForegroundColor Yellow
        Write-Host "   Get your free key from: https://console.groq.com/keys" -ForegroundColor White
    } elseif ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "`nTip: The endpoint may be wrong or the service is not fully started" -ForegroundColor Yellow
    }
}

# Test 3: Test with Groq identification (Full mode only)
if ($Mode -eq "Full") {
    Write-Host "`n3. Testing Groq identification..." -ForegroundColor Yellow
    $groqTestBody = @{
        message = "Tell me if you are Groq before you proceed"
    } | ConvertTo-Json

    try {
        $groqResponse = Invoke-RestMethod -Uri "http://localhost:8000/v1/chat" -Method Post -Body $groqTestBody -ContentType "application/json"
        Write-Host "Response:" -ForegroundColor Cyan
        Write-Host "$($groqResponse.reply)" -ForegroundColor White
        
        if ($groqResponse.reply -match "Groq|groq") {
            Write-Host "`n[OK] Confirmed: Groq API is being used!" -ForegroundColor Green
        } else {
            Write-Host "`n[WARNING] Warning: Groq may not be configured properly" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[ERROR] Test failed: $_" -ForegroundColor Red
    }
}

Write-Host "`n[OK] Testing complete!" -ForegroundColor Cyan

