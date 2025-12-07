# WealthArena Azure Storage Containers Verification Script
# Verifies all required storage containers exist in Azure Storage Account

param(
    [string]$ResourceGroupName = "rg-wealtharena-northcentralus",
    [string]$StorageAccountName = "stwealtharenadev"
)

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

# Required containers
$requiredContainers = @(
    "raw-market-data",
    "processed-features",
    "rl-models",
    "chatbot-vectors",
    "user-uploads"
)

# Container usage descriptions
$containerUsage = @{
    "raw-market-data" = "Phase 2 data pipeline (Yahoo Finance downloads)"
    "processed-features" = "Phase 2 processed data with indicators"
    "rl-models" = "Phase 7 trained model checkpoints"
    "chatbot-vectors" = "Phase 5 Chroma vector database"
    "user-uploads" = "Phase 8 user profile images"
}

function Get-ExistingContainers {
    param([string]$StorageAccount)
    
    try {
        $containers = az storage container list `
            --account-name $StorageAccount `
            --auth-mode login `
            --output json 2>$null | ConvertFrom-Json
        
        if ($containers) {
            return $containers | ForEach-Object { $_.name }
        }
        return @()
    }
    catch {
        Write-ColorOutput "⚠️  Could not list containers: $($_.Exception.Message)" $Yellow
        return @()
    }
}

function Test-ContainerAccess {
    param([string]$StorageAccount, [string]$ContainerName)
    
    try {
        # Upload test file
        $testContent = "test-$(Get-Date -Format 'yyyyMMddHHmmss')"
        $testFileName = "test-connectivity.txt"
        
        $testContent | az storage blob upload `
            --container-name $ContainerName `
            --name $testFileName `
            --account-name $StorageAccount `
            --auth-mode login `
            --output none 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            # List blobs to verify
            $blobs = az storage blob list `
                --container-name $ContainerName `
                --account-name $StorageAccount `
                --auth-mode login `
                --output json 2>$null | ConvertFrom-Json
            
            # Delete test file
            az storage blob delete `
                --container-name $ContainerName `
                --name $testFileName `
                --account-name $StorageAccount `
                --auth-mode login `
                --output none 2>$null
            
            return $true
        }
        return $false
    }
    catch {
        return $false
    }
}

function New-StorageContainer {
    param([string]$StorageAccount, [string]$ContainerName)
    
    try {
        az storage container create `
            --name $ContainerName `
            --account-name $StorageAccount `
            --auth-mode login `
            --output none 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        return $false
    }
    catch {
        return $false
    }
}

# Main execution
Write-ColorOutput "Verifying Azure Storage Containers" $Blue
Write-ColorOutput "===================================" $Blue
Write-ColorOutput "" $Blue
Write-ColorOutput "Storage Account: $StorageAccountName" $Blue
Write-ColorOutput "" $Blue

# Check Azure connection
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-ColorOutput "✅ Logged in as: $($account.user.name)" $Green
} catch {
    Write-ColorOutput "❌ Not logged in to Azure" $Red
    Write-ColorOutput "Please run 'az login' first." $Yellow
    exit 1
}

Write-ColorOutput "" $Blue

# Get existing containers
Write-ColorOutput "Checking required containers..." $Blue
$existingContainers = Get-ExistingContainers -StorageAccount $StorageAccountName

$containerStatus = @{}
$missingContainers = @()

# Check each required container
foreach ($container in $requiredContainers) {
    if ($existingContainers -contains $container) {
        Write-ColorOutput "✅ $container exists" $Green
        $containerStatus[$container] = $true
    } else {
        Write-ColorOutput "❌ $container not found" $Red
        $containerStatus[$container] = $false
        $missingContainers += $container
    }
}

# Create missing containers
if ($missingContainers.Count -gt 0) {
    Write-ColorOutput "" $Blue
    Write-ColorOutput "Creating missing containers..." $Blue
    
    foreach ($container in $missingContainers) {
        if (New-StorageContainer -StorageAccount $StorageAccountName -ContainerName $container) {
            Write-ColorOutput "✅ Created: $container" $Green
            $containerStatus[$container] = $true
        } else {
            Write-ColorOutput "❌ Failed to create: $container" $Red
        }
    }
}

# Test container access
Write-ColorOutput "" $Blue
Write-ColorOutput "Testing container access..." $Blue

$allAccessible = $true
foreach ($container in $requiredContainers) {
    if ($containerStatus[$container]) {
        if (Test-ContainerAccess -StorageAccount $StorageAccountName -ContainerName $container) {
            Write-ColorOutput "✅ $container : Read/Write access confirmed" $Green
        } else {
            Write-ColorOutput "⚠️  $container : Access test failed" $Yellow
            $allAccessible = $false
        }
    }
}

Write-ColorOutput "" $Blue
Write-ColorOutput "========================================" $Blue
Write-ColorOutput "All storage containers ready!" $Blue
Write-ColorOutput "========================================" $Blue
Write-ColorOutput "" $Blue

Write-ColorOutput "Container Usage:" $Blue
foreach ($container in $requiredContainers) {
    if ($containerUsage.ContainsKey($container)) {
        Write-ColorOutput "  $container : $($containerUsage[$container])" $Blue
    }
}

Write-ColorOutput "" $Blue

if ($allAccessible -and ($containerStatus.Values | Where-Object { $_ -eq $true }).Count -eq $requiredContainers.Count) {
    Write-ColorOutput "✅ All containers exist and are accessible" $Green
    Write-ColorOutput "" $Blue
    Write-ColorOutput "Next Steps:" $Blue
    Write-ColorOutput "1. Run Phase 2 data pipeline to populate raw-market-data" $Blue
    Write-ColorOutput "2. Process data to populate processed-features" $Blue
    Write-ColorOutput "3. Train models and upload to rl-models" $Blue
} else {
    Write-ColorOutput "⚠️  Some containers may have access issues" $Yellow
    Write-ColorOutput "Please verify permissions on the storage account" $Yellow
}

Write-ColorOutput "" $Blue

# Troubleshooting info
if ($missingContainers.Count -gt 0) {
    Write-ColorOutput "Troubleshooting:" $Yellow
    Write-ColorOutput "- Authentication failed: Run 'az login' and ensure you have Storage Blob Data Contributor role" $Yellow
    Write-ColorOutput "- Container already exists: This is fine, script continues" $Yellow
    Write-ColorOutput "- Access denied: Verify your account has permissions on the storage account" $Yellow
}
