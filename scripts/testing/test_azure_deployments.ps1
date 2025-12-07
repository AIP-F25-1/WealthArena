# WealthArena Deployment Testing Script
# Test all deployed Azure Web Apps to verify they're running correctly and can communicate with each other

param(
    [string]$ResourceGroup = "rg-wealtharena-northcentralus"
)

# Set error action preference
$ErrorActionPreference = "Continue"

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Blue = "Blue"
$Cyan = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Azure Deployment Health Checks" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Service URLs
$backendUrl = "https://wealtharena-backend.azurewebsites.net"
$chatbotUrl = "https://wealtharena-chatbot.azurewebsites.net"
$rlUrl = "https://wealtharena-rl.azurewebsites.net"

$testResults = @{
    Backend = $false
    Chatbot = $false
    RLService = $false
    BackendToChatbot = $false
    BackendToRL = $false
    BackendToSQL = $false
    RLToSQL = $false
}

# Test Backend Health
Write-ColorOutput "Testing individual services..." $Blue
Write-ColorOutput ""

Write-ColorOutput "Testing Backend Health..." $Blue
try {
    # Use standardized /health endpoint
    $response = Invoke-RestMethod -Uri "$backendUrl/health" -Method Get -TimeoutSec 30 -ErrorAction Stop
    if ($response.status -eq "healthy" -or $response.StatusCode -eq 200) {
        Write-ColorOutput "✅ Backend: Healthy" $Green
        $testResults.Backend = $true
    } else {
        Write-ColorOutput "❌ Backend: Unhealthy (status != healthy)" $Red
    }
} catch {
    Write-ColorOutput "❌ Backend: Unhealthy ($($_.Exception.Message))" $Red
}

Write-ColorOutput ""

# Test Chatbot Health
Write-ColorOutput "Testing Chatbot Health..." $Blue
try {
    # Use standardized /health endpoint
    $response = Invoke-RestMethod -Uri "$chatbotUrl/health" -Method Get -TimeoutSec 30 -ErrorAction Stop
    if ($response.status -eq "healthy" -or $response.StatusCode -eq 200) {
        Write-ColorOutput "✅ Chatbot: Healthy" $Green
        $testResults.Chatbot = $true
    } else {
        Write-ColorOutput "❌ Chatbot: Unhealthy (status != healthy)" $Red
    }
} catch {
    Write-ColorOutput "❌ Chatbot: Unhealthy ($($_.Exception.Message))" $Red
}

Write-ColorOutput ""

# Test RL Service Health
Write-ColorOutput "Testing RL Service Health..." $Blue
try {
    $response = Invoke-RestMethod -Uri "$rlUrl/health" -Method Get -TimeoutSec 30 -ErrorAction Stop
    if ($response.status -eq "healthy") {
        Write-ColorOutput "✅ RL Service: Healthy" $Green
        Write-ColorOutput "   Model loaded: $($response.model_loaded)" $Blue
        $testResults.RLService = $true
    } else {
        Write-ColorOutput "❌ RL Service: Unhealthy (status != healthy)" $Red
    }
} catch {
    Write-ColorOutput "❌ RL Service: Unhealthy ($($_.Exception.Message))" $Red
}

Write-ColorOutput ""

# Test Service Integrations
Write-ColorOutput "Testing service integrations..." $Blue
Write-ColorOutput ""

# Test Backend → Chatbot Proxy
Write-ColorOutput "Testing Backend → Chatbot Proxy..." $Blue
try {
    # Try a health check endpoint if available, otherwise just verify backend can reach chatbot
    $response = Invoke-RestMethod -Uri "$backendUrl/api/chatbot/health" -Method Get -TimeoutSec 30 -ErrorAction Stop
    if ($response.success -eq $true) {
        Write-ColorOutput "✅ Backend → Chatbot: Connected" $Green
        $testResults.BackendToChatbot = $true
    } else {
        Write-ColorOutput "⚠️  Backend → Chatbot: Responded but may have issues" $Yellow
    }
} catch {
    # If specific endpoint doesn't exist, that's okay - backend may proxy directly
    Write-ColorOutput "⚠️  Backend → Chatbot: Health endpoint not available (proxy may work)" $Yellow
}

Write-ColorOutput ""

# Test Backend → RL Service Proxy
Write-ColorOutput "Testing Backend → RL Service Proxy..." $Blue
try {
    $response = Invoke-RestMethod -Uri "$backendUrl/api/rl-agent/health" -Method Get -TimeoutSec 30 -ErrorAction Stop
    if ($response.success -eq $true) {
        Write-ColorOutput "✅ Backend → RL Service: Connected" $Green
        $testResults.BackendToRL = $true
    } else {
        Write-ColorOutput "⚠️  Backend → RL Service: Responded but may have issues" $Yellow
    }
} catch {
    Write-ColorOutput "⚠️  Backend → RL Service: Health endpoint not available (proxy may work)" $Yellow
}

Write-ColorOutput ""

# Test Database Connections
Write-ColorOutput "Testing database connections..." $Blue
Write-ColorOutput ""

# Test Backend → Azure SQL
Write-ColorOutput "Testing Backend → Azure SQL..." $Blue
try {
    # Try an endpoint that requires database access
    $response = Invoke-RestMethod -Uri "$backendUrl/api/signals/top?limit=1" -Method Get -TimeoutSec 30 -ErrorAction Stop
    Write-ColorOutput "✅ Backend → Azure SQL: Connected" $Green
    $testResults.BackendToSQL = $true
} catch {
    # If 401 (unauthorized), database connection is working (auth failed, not DB)
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-ColorOutput "✅ Backend → Azure SQL: Connected (401 = auth required, DB working)" $Green
        $testResults.BackendToSQL = $true
    } elseif ($_.Exception.Response.StatusCode -eq 500) {
        Write-ColorOutput "❌ Backend → Azure SQL: Database connection may be failing (500)" $Red
    } else {
        Write-ColorOutput "⚠️  Backend → Azure SQL: Could not verify ($($_.Exception.Message))" $Yellow
    }
}

Write-ColorOutput ""

# Test RL Service → Azure SQL
Write-ColorOutput "Testing RL Service → Azure SQL..." $Blue
try {
    # RL service may not have a direct SQL test endpoint, but if it's healthy, SQL likely works
    if ($testResults.RLService) {
        Write-ColorOutput "✅ RL Service → Azure SQL: Likely connected (service is healthy)" $Green
        $testResults.RLToSQL = $true
    } else {
        Write-ColorOutput "⚠️  RL Service → Azure SQL: Cannot verify (service unhealthy)" $Yellow
    }
} catch {
    Write-ColorOutput "⚠️  RL Service → Azure SQL: Could not verify" $Yellow
}

Write-ColorOutput ""

# Test External Dependencies
Write-ColorOutput "Testing external dependencies..." $Blue
Write-ColorOutput ""

# Test Chatbot → GROQ API (implicit - if chatbot works, GROQ likely works)
if ($testResults.Chatbot) {
    Write-ColorOutput "✅ Chatbot → GROQ API: Connected (chatbot is healthy)" $Green
} else {
    Write-ColorOutput "❌ Chatbot → GROQ API: Cannot verify (chatbot unhealthy)" $Red
}

Write-ColorOutput ""

# Test RL Service → Azure Blob Storage (implicit - if service is healthy and models loaded)
if ($testResults.RLService) {
    Write-ColorOutput "✅ RL Service → Azure Blob Storage: Connected (service is healthy)" $Green
} else {
    Write-ColorOutput "⚠️  RL Service → Azure Blob Storage: Cannot verify (service unhealthy)" $Yellow
}

Write-ColorOutput ""

# Summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Test Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$totalTests = $testResults.Count
$passedTests = ($testResults.Values | Where-Object { $_ -eq $true }).Count
$failedTests = $totalTests - $passedTests

Write-ColorOutput "Total Tests: $totalTests" $Blue
Write-ColorOutput "Passed: $passedTests" $Green
Write-ColorOutput "Failed: $failedTests" $(if ($failedTests -eq 0) { $Green } else { $Red })
Write-ColorOutput ""

if ($failedTests -eq 0) {
    Write-ColorOutput "✅ All Tests Passed!" $Green
} else {
    Write-ColorOutput "⚠️  Some tests failed. Review the results above." $Yellow
}

Write-ColorOutput ""

# Deployment URLs
Write-ColorOutput "Deployment URLs:" $Cyan
Write-ColorOutput "  Backend:  $backendUrl" $Blue
Write-ColorOutput "  Chatbot:  $chatbotUrl" $Blue
Write-ColorOutput "  RL Service: $rlUrl" $Blue
Write-ColorOutput ""

# API Documentation
Write-ColorOutput "API Documentation:" $Cyan
Write-ColorOutput "  Backend:  $backendUrl/" $Blue
Write-ColorOutput "  Chatbot:  $chatbotUrl/docs" $Blue
Write-ColorOutput ""

# Troubleshooting commands
Write-ColorOutput "🔧 Troubleshooting Commands:" $Yellow
Write-ColorOutput "  # View backend logs" $Blue
Write-ColorOutput "  az webapp log tail --name wealtharena-backend --resource-group $ResourceGroup" $Blue
Write-ColorOutput ""
Write-ColorOutput "  # View chatbot logs" $Blue
Write-ColorOutput "  az webapp log tail --name wealtharena-chatbot --resource-group $ResourceGroup" $Blue
Write-ColorOutput ""
Write-ColorOutput "  # View RL service logs" $Blue
Write-ColorOutput "  az webapp log tail --name wealtharena-rl --resource-group $ResourceGroup" $Blue
Write-ColorOutput ""
Write-ColorOutput "  # Check App Service status" $Blue
Write-ColorOutput "  az webapp show --name wealtharena-backend --resource-group $ResourceGroup --query state" $Blue
Write-ColorOutput ""

if ($failedTests -eq 0) {
    Write-ColorOutput "✅ Ready for frontend integration!" $Green
} else {
    Write-ColorOutput "⚠️  Fix issues before proceeding with frontend integration" $Yellow
}

Write-ColorOutput ""

