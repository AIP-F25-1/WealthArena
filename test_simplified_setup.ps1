#Requires -Version 5.1

<#
.SYNOPSIS
    Automated test script for simplified WealthArena setup
    
.DESCRIPTION
    Tests the simplified setup without user interaction:
    - Service health checks
    - Backend API tests
    - Chatbot API tests
    - Integration tests
    
.EXAMPLE
    .\test_simplified_setup.ps1
#>

param()

$ErrorActionPreference = "Stop"

# Colors
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Cyan = "Cyan"
$White = "White"

$script:TestResults = @{
    Passed = 0
    Failed = 0
    Tests = @()
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = ""
    )
    
    if ($Passed) {
        Write-ColorOutput "  ✓ $TestName" $Green
        $script:TestResults.Passed++
    }
    else {
        Write-ColorOutput "  ✗ $TestName" $Red
        if ($Message) {
            Write-ColorOutput "    $Message" $Red
        }
        $script:TestResults.Failed++
    }
    
    $script:TestResults.Tests += @{
        Name = $TestName
        Passed = $Passed
        Message = $Message
    }
}

function Test-ServiceHealth {
    param(
        [string]$Url,
        [string]$ServiceName
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-TestResult "$ServiceName health check" $true
            return $true
        }
        else {
            Write-TestResult "$ServiceName health check" $false "Status code: $($response.StatusCode)"
            return $false
        }
    }
    catch {
        Write-TestResult "$ServiceName health check" $false $_.Exception.Message
        return $false
    }
}

function Test-BackendAPI {
    Write-ColorOutput "`nBackend API Tests:" $Cyan
    
    # Test signup
    try {
        $signupBody = @{
            email = "test@example.com"
            password = "Test123!@#"
            username = "testuser"
        } | ConvertTo-Json
        
        $signupResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/signup" `
            -Method POST `
            -Body $signupBody `
            -ContentType "application/json" `
            -UseBasicParsing `
            -ErrorAction Stop
        
        if ($signupResponse.StatusCode -eq 201) {
            $signupData = $signupResponse.Content | ConvertFrom-Json
            if ($signupData.data.token) {
                Write-TestResult "Backend signup" $true
                $script:AuthToken = $signupData.data.token
                return $true
            }
            else {
                Write-TestResult "Backend signup" $false "No token in response"
                return $false
            }
        }
        else {
            Write-TestResult "Backend signup" $false "Status code: $($signupResponse.StatusCode)"
            return $false
        }
    }
    catch {
        Write-TestResult "Backend signup" $false $_.Exception.Message
        return $false
    }
}

function Test-ChatbotAPI {
    Write-ColorOutput "`nChatbot API Tests:" $Cyan
    
    # Test financial question
    try {
        $chatBody = @{
            message = "What is RSI?"
        } | ConvertTo-Json
        
        $chatResponse = Invoke-WebRequest -Uri "http://localhost:8000/v1/chat" `
            -Method POST `
            -Body $chatBody `
            -ContentType "application/json" `
            -UseBasicParsing `
            -ErrorAction Stop
        
        if ($chatResponse.StatusCode -eq 200) {
            $chatData = $chatResponse.Content | ConvertFrom-Json
            if ($chatData.reply -and $chatData.reply.Length -gt 0) {
                Write-TestResult "Chatbot financial question" $true
            }
            else {
                Write-TestResult "Chatbot financial question" $false "Empty response"
            }
        }
        else {
            Write-TestResult "Chatbot financial question" $false "Status code: $($chatResponse.StatusCode)"
        }
    }
    catch {
        Write-TestResult "Chatbot financial question" $false $_.Exception.Message
    }
    
    # Test off-topic question (should be rejected)
    try {
        $offTopicBody = @{
            message = "What's the weather today?"
        } | ConvertTo-Json
        
        $offTopicResponse = Invoke-WebRequest -Uri "http://localhost:8000/v1/chat" `
            -Method POST `
            -Body $offTopicBody `
            -ContentType "application/json" `
            -UseBasicParsing `
            -ErrorAction Stop
        
        if ($offTopicResponse.StatusCode -eq 200) {
            $offTopicData = $offTopicResponse.Content | ConvertFrom-Json
            # Check if response contains rejection message
            if ($offTopicData.reply -and ($offTopicData.reply -like "*financial*" -or $offTopicData.reply -like "*WealthArena*")) {
                Write-TestResult "Chatbot guardrails (off-topic rejection)" $true
            }
            else {
                Write-TestResult "Chatbot guardrails (off-topic rejection)" $false "Guardrails not working"
            }
        }
        else {
            Write-TestResult "Chatbot guardrails (off-topic rejection)" $false "Status code: $($offTopicResponse.StatusCode)"
        }
    }
    catch {
        Write-TestResult "Chatbot guardrails (off-topic rejection)" $false $_.Exception.Message
    }
    
    # Test trade setup card
    try {
        $setupBody = @{
            message = "setup for AAPL"
        } | ConvertTo-Json
        
        $setupResponse = Invoke-WebRequest -Uri "http://localhost:8000/v1/chat" `
            -Method POST `
            -Body $setupBody `
            -ContentType "application/json" `
            -UseBasicParsing `
            -ErrorAction Stop
        
        if ($setupResponse.StatusCode -eq 200) {
            $setupData = $setupResponse.Content | ConvertFrom-Json
            if ($setupData.card -and $setupData.card.symbol -and $setupData.card.signal -and $setupData.card.entry -and $setupData.card.tp -and $setupData.card.sl) {
                Write-TestResult "Chatbot trade setup card" $true
            }
            else {
                Write-TestResult "Chatbot trade setup card" $false "Card missing required properties"
            }
        }
        else {
            Write-TestResult "Chatbot trade setup card" $false "Status code: $($setupResponse.StatusCode)"
        }
    }
    catch {
        Write-TestResult "Chatbot trade setup card" $false $_.Exception.Message
    }
}

function Test-ChatbotStreaming {
    Write-ColorOutput "`nChatbot Streaming API Tests:" $Cyan
    
    try {
        $streamBody = @{
            message = "What is RSI?"
        } | ConvertTo-Json
        
        # Create HTTP request for streaming
        $request = [System.Net.HttpWebRequest]::Create("http://localhost:8000/v1/chat/stream")
        $request.Method = "POST"
        $request.ContentType = "application/json"
        $request.Timeout = 30000
        
        # Write request body
        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($streamBody)
        $request.ContentLength = $bodyBytes.Length
        $requestStream = $request.GetRequestStream()
        $requestStream.Write($bodyBytes, 0, $bodyBytes.Length)
        $requestStream.Close()
        
        # Get response stream
        $response = $request.GetResponse()
        $responseStream = $response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($responseStream)
        
        $chunksReceived = 0
        $hasContent = $false
        $hasDone = $false
        $timeout = (Get-Date).AddSeconds(30)
        
        # Read SSE lines
        while ((Get-Date) -lt $timeout) {
            $line = $reader.ReadLine()
            if ($null -eq $line) {
                Start-Sleep -Milliseconds 100
                continue
            }
            
            if ($line.StartsWith("data: ")) {
                $dataStr = $line.Substring(6)
                if ($dataStr.Trim() -eq "[DONE]") {
                    $hasDone = $true
                    break
                }
                
                try {
                    $data = $dataStr | ConvertFrom-Json
                    if ($data.chunk -and $data.chunk.Length -gt 0) {
                        $hasContent = $true
                        $chunksReceived++
                    }
                    if ($data.done -eq $true) {
                        $hasDone = $true
                        break
                    }
                }
                catch {
                    # Skip invalid JSON lines
                }
            }
            
            # Stop after receiving a few chunks and done signal
            if ($chunksReceived -ge 3 -and $hasDone) {
                break
            }
        }
        
        $reader.Close()
        $response.Close()
        
        if ($hasContent -and $hasDone) {
            Write-TestResult "Chatbot streaming endpoint" $true
        }
        else {
            Write-TestResult "Chatbot streaming endpoint" $false "Missing content chunks or done signal"
        }
    }
    catch {
        Write-TestResult "Chatbot streaming endpoint" $false $_.Exception.Message
    }
}

# Main execution
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Simplified Setup Tests" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-Host ""

# Phase 1: Service Health Checks
Write-ColorOutput "Phase 1: Service Health Checks" $Cyan
Test-ServiceHealth "http://localhost:3000/health" "Backend"
Test-ServiceHealth "http://localhost:8000/health" "Chatbot"
Test-ServiceHealth "http://localhost:8081" "Frontend"

# Phase 2: Backend API Tests
Write-ColorOutput "`nPhase 2: Backend API Tests" $Cyan
Test-BackendAPI

# Phase 3: Chatbot API Tests
Write-ColorOutput "`nPhase 3: Chatbot API Tests" $Cyan
Test-ChatbotAPI

# Phase 4: Chatbot Streaming Tests
Write-ColorOutput "`nPhase 4: Chatbot Streaming Tests" $Cyan
Test-ChatbotStreaming

# Summary
Write-Host ""
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Test Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Passed: $($script:TestResults.Passed)" $Green
Write-ColorOutput "Failed: $($script:TestResults.Failed)" $Red
Write-ColorOutput "Total:  $($script:TestResults.Tests.Count)" $White
Write-Host ""

if ($script:TestResults.Failed -eq 0) {
    Write-ColorOutput "All tests passed! ✓" $Green
    exit 0
}
else {
    Write-ColorOutput "Some tests failed. Please check the errors above." $Red
    exit 1
}

