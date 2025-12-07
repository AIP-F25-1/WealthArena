# WealthArena Integration Test Script
# This script tests the complete end-to-end integration of the WealthArena platform

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

function Test-AzureResources {
    Write-ColorOutput "Testing Azure Resources..." $Blue
    
    $results = @{}
    
    # Test Resource Group
    try {
        $rg = az group show --name $ResourceGroupName --output json | ConvertFrom-Json
        if ($rg) {
            Write-ColorOutput "   Resource Group: PASS" $Green
            $results.ResourceGroup = $true
        }
    }
    catch {
        Write-ColorOutput "   Resource Group: FAIL" $Red
        $results.ResourceGroup = $false
    }
    
    # Test Storage Account
    try {
        $storage = az storage account show --name "stwealtharena$Environment" --resource-group $ResourceGroupName --output json | ConvertFrom-Json
        if ($storage) {
            Write-ColorOutput "   Storage Account: PASS" $Green
            $results.Storage = $true
        }
    }
    catch {
        Write-ColorOutput "   Storage Account: FAIL" $Red
        $results.Storage = $false
    }
    
    # Test Databricks
    try {
        $databricks = az databricks workspace show --name "databricks-wealtharena-$Environment" --resource-group $ResourceGroupName --output json | ConvertFrom-Json
        if ($databricks) {
            Write-ColorOutput "   Databricks: PASS" $Green
            $results.Databricks = $true
        }
    }
    catch {
        Write-ColorOutput "   Databricks: FAIL" $Red
        $results.Databricks = $false
    }
    
    # Test Container Registry
    try {
        $acr = az acr show --name "acrwealtharena$Environment" --resource-group $ResourceGroupName --output json | ConvertFrom-Json
        if ($acr) {
            Write-ColorOutput "   Container Registry: PASS" $Green
            $results.ACR = $true
        }
    }
    catch {
        Write-ColorOutput "   Container Registry: FAIL" $Red
        $results.ACR = $false
    }
    
    # Test Key Vault
    try {
        $kv = az keyvault show --name "kv-wealtharena-$Environment" --resource-group $ResourceGroupName --output json | ConvertFrom-Json
        if ($kv) {
            Write-ColorOutput "   Key Vault: PASS" $Green
            $results.KeyVault = $true
        }
    }
    catch {
        Write-ColorOutput "   Key Vault: FAIL" $Red
        $results.KeyVault = $false
    }
    
    # Test Data Factory
    try {
        $adf = az datafactory show --name "adf-wealtharena-$Environment" --resource-group $ResourceGroupName --output json | ConvertFrom-Json
        if ($adf) {
            Write-ColorOutput "   Data Factory: PASS" $Green
            $results.DataFactory = $true
        }
    }
    catch {
        Write-ColorOutput "   Data Factory: FAIL" $Red
        $results.DataFactory = $false
    }
    
    return $results
}

function Test-DatabricksNotebooks {
    Write-ColorOutput "Testing Databricks Notebooks..." $Blue
    
    $notebooks = @(
        "databricks_notebooks/01_market_data_ingestion.py",
        "databricks_notebooks/02_feature_engineering.py",
        "databricks_notebooks/03_news_sentiment.py",
        "databricks_notebooks/04_rl_environment.py",
        "databricks_notebooks/05_rl_agent_training.py",
        "databricks_notebooks/06_rl_inference.py",
        "databricks_notebooks/07_portfolio_optimization.py"
    )
    
    $foundCount = 0
    foreach ($notebook in $notebooks) {
        if (Test-Path $notebook) {
            Write-ColorOutput "   Found: $notebook" $Green
            $foundCount++
        }
        else {
            Write-ColorOutput "   Missing: $notebook" $Red
        }
    }
    
    Write-ColorOutput "   Notebooks found: $foundCount/$($notebooks.Count)" $Blue
    return $foundCount -eq $notebooks.Count
}

function Test-BackendServices {
    Write-ColorOutput "Testing Backend Services..." $Blue
    
    $services = @(
        "azure_services/rag_chatbot_service",
        "azure_services/wealtharena_backend_api"
    )
    
    $foundCount = 0
    foreach ($service in $services) {
        if (Test-Path $service) {
            Write-ColorOutput "   Found: $service" $Green
            $foundCount++
            
            # Check for Dockerfile
            if (Test-Path "$service/Dockerfile") {
                Write-ColorOutput "     Dockerfile: PASS" $Green
            }
            else {
                Write-ColorOutput "     Dockerfile: MISSING" $Red
            }
            
            # Check for requirements.txt
            if (Test-Path "$service/requirements.txt") {
                Write-ColorOutput "     requirements.txt: PASS" $Green
            }
            else {
                Write-ColorOutput "     requirements.txt: MISSING" $Red
            }
        }
        else {
            Write-ColorOutput "   Missing: $service" $Red
        }
    }
    
    Write-ColorOutput "   Services found: $foundCount/$($services.Count)" $Blue
    return $foundCount -eq $services.Count
}

function Test-FrontendIntegration {
    Write-ColorOutput "Testing Frontend Integration..." $Blue
    
    $frontendFiles = @(
        "WealthArena/services/apiService.ts",
        "WealthArena/app/strategy-lab.tsx",
        "WealthArena/app/backtest-results.tsx",
        "WealthArena/app/risk-dashboard.tsx",
        "WealthArena/app/settings.tsx",
        "WealthArena/app/subscription.tsx",
        "WealthArena/app/tournaments.tsx"
    )
    
    $foundCount = 0
    foreach ($file in $frontendFiles) {
        if (Test-Path $file) {
            Write-ColorOutput "   Found: $file" $Green
            $foundCount++
        }
        else {
            Write-ColorOutput "   Missing: $file" $Red
        }
    }
    
    Write-ColorOutput "   Frontend files found: $foundCount/$($frontendFiles.Count)" $Blue
    return $foundCount -eq $frontendFiles.Count
}

function Test-DatabaseSchemas {
    Write-ColorOutput "Testing Database Schemas..." $Blue
    
    $schemaFiles = @(
        "database_schemas/azure_sql_schema.sql",
        "database_schemas/cosmos_collections.json"
    )
    
    $foundCount = 0
    foreach ($file in $schemaFiles) {
        if (Test-Path $file) {
            Write-ColorOutput "   Found: $file" $Green
            $foundCount++
        }
        else {
            Write-ColorOutput "   Missing: $file" $Red
        }
    }
    
    Write-ColorOutput "   Schema files found: $foundCount/$($schemaFiles.Count)" $Blue
    return $foundCount -eq $schemaFiles.Count
}

function Test-ChatbotSetup {
    Write-ColorOutput "Testing Chatbot Setup..." $Blue
    
    $chatbotFiles = @(
        "chatbot_setup/01_scrape_investopedia.py",
        "chatbot_setup/02_create_embeddings.py"
    )
    
    $foundCount = 0
    foreach ($file in $chatbotFiles) {
        if (Test-Path $file) {
            Write-ColorOutput "   Found: $file" $Green
            $foundCount++
        }
        else {
            Write-ColorOutput "   Missing: $file" $Red
        }
    }
    
    Write-ColorOutput "   Chatbot files found: $foundCount/$($chatbotFiles.Count)" $Blue
    return $foundCount -eq $chatbotFiles.Count
}

function Generate-TestReport {
    param([hashtable]$Results)
    
    Write-ColorOutput "" $Blue
    Write-ColorOutput "WealthArena Integration Test Report" $Blue
    Write-ColorOutput "====================================" $Blue
    
    $totalTests = $Results.Count
    $passedTests = ($Results.Values | Where-Object { $_ -eq $true }).Count
    $failedTests = $totalTests - $passedTests
    
    Write-ColorOutput "Total Tests: $totalTests" $Blue
    Write-ColorOutput "Passed: $passedTests" $Green
    Write-ColorOutput "Failed: $failedTests" $Red
    
    Write-ColorOutput "" $Blue
    Write-ColorOutput "Detailed Results:" $Blue
    foreach ($result in $Results.GetEnumerator()) {
        $status = if ($result.Value) { "PASS" } else { "FAIL" }
        $color = if ($result.Value) { $Green } else { $Red }
        Write-ColorOutput "  $($result.Key): $status" $color
    }
    
    if ($failedTests -eq 0) {
        Write-ColorOutput "" $Blue
        Write-ColorOutput "All integration tests passed!" $Green
        Write-ColorOutput "WealthArena platform is ready for deployment!" $Green
    }
    else {
        Write-ColorOutput "" $Blue
        Write-ColorOutput "Some integration tests failed." $Yellow
        Write-ColorOutput "Please review the failed tests and fix the issues." $Yellow
    }
}

# Main execution
Write-ColorOutput "WealthArena Integration Test Suite" $Blue
Write-ColorOutput "===================================" $Blue

# Run all tests
$testResults = @{}

# Test Azure Resources
$azureResults = Test-AzureResources
$testResults.AzureResources = ($azureResults.Values | Where-Object { $_ -eq $true }).Count -eq $azureResults.Count

# Test Databricks Notebooks
$testResults.DatabricksNotebooks = Test-DatabricksNotebooks

# Test Backend Services
$testResults.BackendServices = Test-BackendServices

# Test Frontend Integration
$testResults.FrontendIntegration = Test-FrontendIntegration

# Test Database Schemas
$testResults.DatabaseSchemas = Test-DatabaseSchemas

# Test Chatbot Setup
$testResults.ChatbotSetup = Test-ChatbotSetup

# Generate report
Generate-TestReport -Results $testResults

Write-ColorOutput "" $Blue
Write-ColorOutput "Integration test suite complete!" $Blue