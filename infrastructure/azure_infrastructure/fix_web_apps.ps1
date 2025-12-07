# WealthArena Web Apps Fix Script
# This script fixes the web app deployments with proper Python configuration

param(
    [string]$ResourceGroupName = "rg-wealtharena-northcentralus",
    [string]$Environment = "dev"
)

# Set error action preference
$ErrorActionPreference = "Continue"

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Blue = "Blue"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Fix-BackendApp {
    Write-ColorOutput "Fixing Backend App Configuration..." $Blue
    
    try {
        $backendAppName = "wealtharena-backend-$Environment"
        
        # Configure Python version
        Write-ColorOutput "Setting Python version..." $Blue
        az webapp config set --resource-group $ResourceGroupName --name $backendAppName --python-version "3.10"
        
        # Set startup command
        Write-ColorOutput "Setting startup command..." $Blue
        az webapp config set --resource-group $ResourceGroupName --name $backendAppName --startup-file "app.py"
        
        # Create a proper Flask app
        $flaskApp = @"
from flask import Flask, request, jsonify
import json
import uuid
from datetime import datetime

app = Flask(__name__)

# Mock data
users_db = {
    "test@wealtharena.com": {
        "user_id": "user-123",
        "username": "testuser",
        "email": "test@wealtharena.com",
        "password": "testpassword123"
    }
}

trading_signals = [
    {
        "signal_id": str(uuid.uuid4()),
        "symbol": "AAPL",
        "signal_type": "BUY",
        "confidence": 0.85,
        "entry_price": 154.00,
        "take_profit1": 160.00,
        "stop_loss": 150.00
    },
    {
        "signal_id": str(uuid.uuid4()),
        "symbol": "MSFT",
        "signal_type": "SELL",
        "confidence": 0.75,
        "entry_price": 302.00,
        "take_profit1": 295.00,
        "stop_loss": 310.00
    }
]

@app.route('/')
def home():
    return jsonify({
        "message": "WealthArena Backend API",
        "version": "1.0.0",
        "status": "running"
    })

@app.route('/healthz')
def health():
    return jsonify({
        "status": "healthy",
        "service": "wealtharena-backend",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    user_id = str(uuid.uuid4())
    users_db[data['email']] = {
        "user_id": user_id,
        "username": data['username'],
        "email": data['email'],
        "password": data['password']
    }
    return jsonify({"message": "User registered successfully", "user_id": user_id})

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if data['email'] in users_db and users_db[data['email']]['password'] == data['password']:
        user = users_db[data['email']]
        return jsonify({
            "access_token": f"token_{user['user_id']}",
            "user_id": user['user_id'],
            "username": user['username']
        })
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/signals/top')
def get_signals():
    limit = request.args.get('limit', 3, type=int)
    return jsonify(trading_signals[:limit])

@app.route('/api/portfolio/<user_id>')
def get_portfolio(user_id):
    return jsonify({
        "user_id": user_id,
        "total_value": 105000.00,
        "cash_balance": 50000.00,
        "total_gain": 5000.00,
        "total_gain_percent": 5.00
    })

@app.route('/api/game/leaderboard')
def get_leaderboard():
    return jsonify([
        {"user_id": "user-123", "username": "testuser", "score": 5000.00, "rank": 1},
        {"user_id": "user-456", "username": "trader_pro", "score": 4500.00, "rank": 2}
    ])

@app.route('/api/market/<symbol>')
def get_market_data(symbol):
    return jsonify({
        "symbol": symbol,
        "price": 154.00,
        "change": 2.50,
        "change_percent": 1.65,
        "volume": 1000000
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
"@

        # Stage files in a temp directory to avoid file locks
        $tempDir = Join-Path $env:TEMP ("backend_fix_" + [System.Guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

        # Save Flask app to temp directory
        $backendAppPath = Join-Path $tempDir "backend_app.py"
        $flaskApp | Out-File -FilePath $backendAppPath -Encoding UTF8

        # Create requirements.txt in temp directory
        $requirements = @"
Flask==2.3.3
Werkzeug==2.3.7
"@
        $backendReqPath = Join-Path $tempDir "backend_requirements.txt"
        $requirements | Out-File -FilePath $backendReqPath -Encoding UTF8

        # Small delay to ensure no file locks linger
        Start-Sleep -Milliseconds 200

        # Deploy using zip from temp directory
        Write-ColorOutput "Deploying backend app..." $Blue
        $backendZip = Join-Path $env:TEMP "backend-fix.zip"
        if (Test-Path $backendZip) { Remove-Item $backendZip -Force }
        Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $backendZip -Force
        
        az webapp deployment source config-zip --resource-group $ResourceGroupName --name $backendAppName --src $backendZip
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Backend app fixed successfully" $Green
            return $true
        }
        else {
            Write-ColorOutput "Failed to fix backend app" $Red
            return $false
        }
    }
    catch {
        Write-ColorOutput "Error fixing backend app: $($_.Exception.Message)" $Red
        return $false
    }
    finally {
        # Clean up temp artifacts
        if ($tempDir -and (Test-Path $tempDir)) { Remove-Item $tempDir -Recurse -Force }
        $backendZip = Join-Path $env:TEMP "backend-fix.zip"
        if (Test-Path $backendZip) { Remove-Item $backendZip -Force }
    }
}

function Fix-ChatbotApp {
    Write-ColorOutput "Fixing Chatbot App Configuration..." $Blue
    
    try {
        $chatbotAppName = "wealtharena-chatbot-$Environment"
        
        # Configure Python version
        Write-ColorOutput "Setting Python version..." $Blue
        az webapp config set --resource-group $ResourceGroupName --name $chatbotAppName --python-version "3.10"
        
        # Set startup command
        Write-ColorOutput "Setting startup command..." $Blue
        az webapp config set --resource-group $ResourceGroupName --name $chatbotAppName --startup-file "chatbot_app.py"
        
        # Create a proper Flask chatbot app
        $chatbotApp = @"
from flask import Flask, request, jsonify
import json
import uuid
from datetime import datetime

app = Flask(__name__)

# Mock financial knowledge
financial_responses = {
    "trading": "Trading involves buying and selling financial instruments. Key principles include risk management, technical analysis, and emotional discipline.",
    "investing": "Investing is about building long-term wealth through strategic asset allocation and diversification.",
    "rsi": "RSI (Relative Strength Index) measures overbought/oversold conditions. Values above 70 indicate overbought, below 30 indicate oversold.",
    "macd": "MACD shows momentum changes through the relationship between two moving averages.",
    "risk": "Risk management is crucial in trading. Never risk more than you can afford to lose, use stop-losses, and diversify your portfolio."
}

@app.route('/')
def home():
    return jsonify({
        "message": "WealthArena RAG Chatbot",
        "version": "1.0.0",
        "status": "running"
    })

@app.route('/healthz')
def health():
    return jsonify({
        "status": "healthy",
        "service": "rag-chatbot",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json()
    message = data.get('message', '').lower()
    
    # Simple response logic
    if 'trading' in message:
        response = financial_responses['trading']
    elif 'invest' in message:
        response = financial_responses['investing']
    elif 'rsi' in message:
        response = financial_responses['rsi']
    elif 'macd' in message:
        response = financial_responses['macd']
    elif 'risk' in message:
        response = financial_responses['risk']
    else:
        response = "I'm your WealthArena AI assistant! I can help with trading strategies, technical analysis, risk management, and financial education. What would you like to know?"
    
    return jsonify({
        "reply": response,
        "tools_used": ["financial_knowledge_base"],
        "trace_id": str(uuid.uuid4())
    })

@app.route('/api/explain/signal/<signal_id>')
def explain_signal(signal_id):
    return jsonify({
        "signal_id": signal_id,
        "explanation": f"This signal was generated using advanced RL algorithms analyzing market conditions, technical indicators, and risk factors.",
        "details": "The model considers multiple factors including price action, volume, sentiment, and market volatility."
    })

@app.route('/api/explain/indicator/<indicator_name>')
def explain_indicator(indicator_name):
    if indicator_name.lower() == 'rsi':
        explanation = financial_responses['rsi']
    elif indicator_name.lower() == 'macd':
        explanation = financial_responses['macd']
    else:
        explanation = f"{indicator_name} is a technical analysis tool used to identify trading opportunities."
    
    return jsonify({
        "indicator": indicator_name,
        "explanation": explanation,
        "usage": "Use this indicator in conjunction with other technical analysis tools."
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
"@

        # Save chatbot app
        $chatbotApp | Out-File -FilePath "chatbot_app.py" -Encoding UTF8
        
        # Create requirements.txt
        $requirements = @"
Flask==2.3.3
Werkzeug==2.3.7
"@
        $requirements | Out-File -FilePath "chatbot_requirements.txt" -Encoding UTF8
        
        # Deploy using zip
        Write-ColorOutput "Deploying chatbot app..." $Blue
        Compress-Archive -Path "chatbot_app.py", "chatbot_requirements.txt" -DestinationPath "chatbot-fix.zip" -Force
        
        az webapp deployment source config-zip --resource-group $ResourceGroupName --name $chatbotAppName --src "chatbot-fix.zip"
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Chatbot app fixed successfully" $Green
            return $true
        }
        else {
            Write-ColorOutput "Failed to fix chatbot app" $Red
            return $false
        }
    }
    catch {
        Write-ColorOutput "Error fixing chatbot app: $($_.Exception.Message)" $Red
        return $false
    }
    finally {
        # Clean up
        if (Test-Path "chatbot_app.py") { Remove-Item "chatbot_app.py" -Force }
        if (Test-Path "chatbot_requirements.txt") { Remove-Item "chatbot_requirements.txt" -Force }
        if (Test-Path "chatbot-fix.zip") { Remove-Item "chatbot-fix.zip" -Force }
    }
}

function Test-FixedServices {
    Write-ColorOutput "Testing Fixed Services..." $Blue
    
    $backendUrl = "https://wealtharena-backend-$Environment.azurewebsites.net"
    $chatbotUrl = "https://wealtharena-chatbot-$Environment.azurewebsites.net"
    
    # Wait a bit for deployment
    Write-ColorOutput "Waiting for services to start..." $Blue
    Start-Sleep -Seconds 30
    
    # Test backend
    Write-ColorOutput "Testing Backend API..." $Blue
    try {
        $response = Invoke-WebRequest -Uri "$backendUrl/healthz" -Method GET -TimeoutSec 30
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "Backend API: HEALTHY" $Green
        }
    }
    catch {
        Write-ColorOutput "Backend API: NOT READY" $Yellow
    }
    
    # Test chatbot
    Write-ColorOutput "Testing RAG Chatbot..." $Blue
    try {
        $response = Invoke-WebRequest -Uri "$chatbotUrl/healthz" -Method GET -TimeoutSec 30
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "RAG Chatbot: HEALTHY" $Green
        }
    }
    catch {
        Write-ColorOutput "RAG Chatbot: NOT READY" $Yellow
    }
    
    # Test API endpoints
    Write-ColorOutput "Testing API endpoints..." $Blue
    try {
        $response = Invoke-WebRequest -Uri "$backendUrl/api/signals/top" -Method GET -TimeoutSec 30
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "Signals API: WORKING" $Green
        }
    }
    catch {
        Write-ColorOutput "Signals API: NOT READY" $Yellow
    }
    
    try {
        $chatRequest = @{
            message = "Hello, can you help me with trading?"
            userId = "test-user"
        } | ConvertTo-Json
        
        $response = Invoke-WebRequest -Uri "$chatbotUrl/api/chat" -Method POST -Body $chatRequest -ContentType "application/json" -TimeoutSec 30
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "Chatbot API: WORKING" $Green
        }
    }
    catch {
        Write-ColorOutput "Chatbot API: NOT READY" $Yellow
    }
}

# Main execution
Write-ColorOutput "WealthArena Web Apps Fix" $Blue
Write-ColorOutput "========================" $Blue

# Fix backend app
$backendFixed = Fix-BackendApp

# Fix chatbot app
$chatbotFixed = Fix-ChatbotApp

# Test fixed services
$servicesTested = Test-FixedServices

# Summary
Write-ColorOutput "" $Blue
Write-ColorOutput "Web Apps Fix Summary:" $Blue
Write-ColorOutput "====================" $Blue

if ($backendFixed) {
    Write-ColorOutput "Backend App: FIXED" $Green
}
else {
    Write-ColorOutput "Backend App: FAILED" $Red
}

if ($chatbotFixed) {
    Write-ColorOutput "Chatbot App: FIXED" $Green
}
else {
    Write-ColorOutput "Chatbot App: FAILED" $Red
}

Write-ColorOutput "" $Blue
Write-ColorOutput "Service URLs:" $Blue
Write-ColorOutput "Backend API: https://wealtharena-backend-$Environment.azurewebsites.net" $Blue
Write-ColorOutput "RAG Chatbot: https://wealtharena-chatbot-$Environment.azurewebsites.net" $Blue

Write-ColorOutput "" $Blue
Write-ColorOutput "Web apps fix complete!" $Blue
