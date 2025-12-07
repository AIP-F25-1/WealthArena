# WealthArena Model Checkpoints Upload Script
# Upload trained RL model checkpoints from local PC to Azure Blob Storage for cloud inference service access

param(
    [string]$StorageAccount = "stwealtharenadev",
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    [string]$Container = "rl-models"
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

# Get root directory
$root = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $root
Set-Location $root

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena Model Checkpoints Upload" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Verify Azure CLI is installed and logged in
Write-ColorOutput "Verifying Azure CLI connection..." $Blue
$accountOutput = az account show --output json 2>&1
$account = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $account = $accountOutput | ConvertFrom-Json
    } catch {
        Write-ColorOutput "❌ Could not parse Azure account information" $Red
        exit 1
    }
}

if (-not $account -or -not $account.user) {
    Write-ColorOutput "❌ Not logged in to Azure. Please run 'az login' first." $Red
    if ($accountOutput) {
        Write-ColorOutput "Error details: $accountOutput" $Yellow
    }
    exit 1
}
Write-ColorOutput "✅ Connected as: $($account.user.name)" $Green
Write-ColorOutput ""

# Verify storage account exists
Write-ColorOutput "Verifying storage account..." $Blue
$storageOutput = az storage account show --name $StorageAccount --resource-group $ResourceGroup --output json 2>&1
$storage = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $storage = $storageOutput | ConvertFrom-Json
    } catch {
        Write-ColorOutput "❌ Could not parse storage account information" $Red
        exit 1
    }
}

if (-not $storage -or -not $storage.name) {
    Write-ColorOutput "❌ Storage account not found: $StorageAccount" $Red
    Write-ColorOutput "Please run setup_master.ps1 to create infrastructure first." $Yellow
    if ($storageOutput) {
        Write-ColorOutput "Error details: $storageOutput" $Yellow
    }
    exit 1
}
Write-ColorOutput "✅ Storage account exists: $StorageAccount" $Green
Write-ColorOutput ""

# Create blob container if doesn't exist
Write-ColorOutput "Creating blob container if it doesn't exist..." $Blue
$containerCheck = az storage container show `
    --name $Container `
    --account-name $StorageAccount `
    --auth-mode login `
    2>$null

if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "Creating container: $Container" $Yellow
    az storage container create `
        --name $Container `
        --account-name $StorageAccount `
        --auth-mode login `
        2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Container created: $Container" $Green
    } else {
        Write-ColorOutput "❌ Failed to create container" $Red
        exit 1
    }
} else {
    Write-ColorOutput "✅ Container already exists: $Container" $Green
}
Write-ColorOutput ""

# Check if models exist
$checkpointsPath = Join-Path $root "wealtharena_rl" "checkpoints"
if (-not (Test-Path $checkpointsPath)) {
    Write-ColorOutput "⚠️  Warning: Checkpoints directory not found: $checkpointsPath" $Yellow
    Write-ColorOutput "   RL service will operate in mock mode (MODEL_MODE=mock)" $Blue
    Write-ColorOutput "   This is acceptable for demo purposes." $Blue
    Write-ColorOutput ""
    exit 0
}

# Asset classes to upload
$assetClasses = @("asx_stocks", "cryptocurrencies", "currency_pairs", "commodities", "etf")

$totalFiles = 0
$totalSize = 0

Write-ColorOutput "Uploading model checkpoints for each asset class..." $Yellow
Write-ColorOutput ""

foreach ($assetClass in $assetClasses) {
    $checkpointDir = Join-Path $checkpointsPath $assetClass $assetClass
    
    if (-not (Test-Path $checkpointDir)) {
        Write-ColorOutput "⚠️  Skipping $assetClass: Checkpoint directory not found" $Yellow
        continue
    }
    
    # Check if directory has model files
    $modelFiles = Get-ChildItem -Path $checkpointDir -Filter "*.pt" -ErrorAction SilentlyContinue
    $pklFiles = Get-ChildItem -Path $checkpointDir -Filter "*.pkl" -ErrorAction SilentlyContinue
    $jsonFiles = Get-ChildItem -Path $checkpointDir -Filter "*.json" -ErrorAction SilentlyContinue
    
    if ($modelFiles.Count -eq 0 -and $pklFiles.Count -eq 0 -and $jsonFiles.Count -eq 0) {
        Write-ColorOutput "⚠️  Skipping $assetClass: No model files found" $Yellow
        continue
    }
    
    Write-ColorOutput "Uploading $assetClass model..." $Blue
    
    # Upload files to blob storage
    $blobDestination = "$Container/latest/$assetClass"
    
    try {
        # Upload each file type separately (Azure CLI doesn't support multiple --pattern flags)
        $uploadedFiles = @()
        
        # Upload .pt files
        $ptFiles = Get-ChildItem -Path $checkpointDir -Filter "*.pt" -ErrorAction SilentlyContinue
        if ($ptFiles.Count -gt 0) {
            az storage blob upload-batch `
                --source $checkpointDir `
                --destination $blobDestination `
                --account-name $StorageAccount `
                --auth-mode login `
                --pattern "*.pt" `
                2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $uploadedFiles += $ptFiles
            }
        }
        
        # Upload .pkl files
        $pklFiles = Get-ChildItem -Path $checkpointDir -Filter "*.pkl" -ErrorAction SilentlyContinue
        if ($pklFiles.Count -gt 0) {
            az storage blob upload-batch `
                --source $checkpointDir `
                --destination $blobDestination `
                --account-name $StorageAccount `
                --auth-mode login `
                --pattern "*.pkl" `
                2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $uploadedFiles += $pklFiles
            }
        }
        
        # Upload .json files
        $jsonFiles = Get-ChildItem -Path $checkpointDir -Filter "*.json" -ErrorAction SilentlyContinue
        if ($jsonFiles.Count -gt 0) {
            az storage blob upload-batch `
                --source $checkpointDir `
                --destination $blobDestination `
                --account-name $StorageAccount `
                --auth-mode login `
                --pattern "*.json" `
                2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $uploadedFiles += $jsonFiles
            }
        }
        
        if ($uploadedFiles.Count -gt 0) {
            # Verify uploaded blobs and get actual sizes
            $blobList = az storage blob list `
                --container-name $Container `
                --account-name $StorageAccount `
                --prefix "latest/$assetClass/" `
                --auth-mode login `
                --output json 2>$null | ConvertFrom-Json
            
            if ($blobList) {
                $fileCount = $blobList.Count
                $totalFiles += $fileCount
                
                # Calculate size using properties.contentLength
                $sizeBytes = 0
                foreach ($blob in $blobList) {
                    if ($blob.properties.contentLength) {
                        $sizeBytes += [long]$blob.properties.contentLength
                    }
                }
                $sizeMB = [math]::Round($sizeBytes / 1MB, 2)
                $totalSize += $sizeMB
                
                Write-ColorOutput "✅ $assetClass: Uploaded $fileCount file(s) (~$sizeMB MB)" $Green
            } else {
                Write-ColorOutput "⚠️ $assetClass: Files uploaded but verification failed" $Yellow
            }
        } else {
            Write-ColorOutput "⚠️ $assetClass: No files to upload" $Yellow
        }
    } catch {
        Write-ColorOutput "❌ Error uploading $assetClass`: $($_.Exception.Message)" $Red
    }
    
    Write-ColorOutput ""
}

# Summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Upload Summary" $Cyan
Write-ColorOutput "========================================" $Cyan

if ($totalFiles -gt 0) {
    Write-ColorOutput "✅ Upload complete!" $Green
    Write-ColorOutput "   Total files: $totalFiles" $Blue
    Write-ColorOutput "   Total size: ~$totalSize MB" $Blue
    Write-ColorOutput ""
    Write-ColorOutput "📁 Blob container: $Container/latest/" $Cyan
    Write-ColorOutput ""
    Write-ColorOutput "📝 Next Steps:" $Blue
    Write-ColorOutput "   1. Verify uploads:" $Blue
    Write-ColorOutput "      az storage blob list --container-name $Container --account-name $StorageAccount --prefix latest/ --auth-mode login --output table" $Blue
    Write-ColorOutput "   2. Update RL service MODEL_PATH to: /home/site/models/latest" $Blue
    Write-ColorOutput "   3. Restart RL service to load models" $Blue
} else {
    Write-ColorOutput "⚠️  No model files found to upload" $Yellow
    Write-ColorOutput ""
    Write-ColorOutput "ℹ️  Alternative: Skip Model Upload for Demo" $Blue
    Write-ColorOutput "   If models not trained in Phase 7:" $Blue
    Write-ColorOutput "   - RL service operates in mock mode (MODEL_MODE=mock)" $Blue
    Write-ColorOutput "   - No model upload needed" $Blue
    Write-ColorOutput "   - Service uses RLModelService heuristics for predictions" $Blue
    Write-ColorOutput "   - Suitable for demo purposes" $Blue
}

Write-ColorOutput ""

# Verify uploads
Write-ColorOutput "Verifying uploaded blobs..." $Blue
try {
    $allBlobsOutput = az storage blob list `
        --container-name $Container `
        --account-name $StorageAccount `
        --prefix "latest/" `
        --auth-mode login `
        --output json 2>&1
    
    $allBlobs = $null
    if ($LASTEXITCODE -eq 0) {
        try {
            $allBlobs = $allBlobsOutput | ConvertFrom-Json
        } catch {
            Write-ColorOutput "⚠️  Could not parse blob list" $Yellow
        }
    }
    
    if ($allBlobs) {
        Write-ColorOutput "✅ Verification complete. Found $($allBlobs.Count) blob(s) in container." $Green
    }
} catch {
    Write-ColorOutput "⚠️  Could not verify uploads: $($_.Exception.Message)" $Yellow
}

Write-ColorOutput ""

