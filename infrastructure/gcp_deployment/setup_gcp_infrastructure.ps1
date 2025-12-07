# WealthArena GCP Infrastructure Setup Script
# Provisions all required GCP resources for WealthArena deployment

param(
    [string]$ProjectId = "wealtharena-prod",
    [string]$Region = "us-central1",
    [string]$DbPassword = "WealthArena2024!@#$%"
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

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
Set-Location $scriptDir

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "WealthArena GCP Infrastructure Setup" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Step 1: Verify prerequisites
Write-ColorOutput "Verifying prerequisites..." $Blue
$gcloudVersion = gcloud --version 2>$null
if (-not $gcloudVersion) {
    Write-ColorOutput "❌ gcloud CLI not installed. Please install from: https://cloud.google.com/sdk/docs/install" $Red
    exit 1
}
Write-ColorOutput "✅ gcloud CLI installed" $Green

$authList = gcloud auth list --format="value(account)" 2>$null
if (-not $authList) {
    Write-ColorOutput "❌ Not authenticated. Please run 'gcloud auth login' first." $Red
    exit 1
}
Write-ColorOutput "✅ Authenticated as: $authList" $Green
Write-ColorOutput ""

# Step 2: Create GCP Project (if doesn't exist)
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 2: Creating GCP Project" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$existingProject = gcloud projects describe $ProjectId --format="value(projectId)" 2>$null
if ($existingProject) {
    Write-ColorOutput "✅ Project $ProjectId already exists" $Green
} else {
    Write-ColorOutput "Creating project: $ProjectId..." $Blue
    gcloud projects create $ProjectId --name="WealthArena Production" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Project created: $ProjectId" $Green
    } else {
        Write-ColorOutput "❌ Failed to create project. It may already exist or project ID may be taken." $Red
        exit 1
    }
}

gcloud config set project $ProjectId | Out-Null
Write-ColorOutput "✅ Project set to: $ProjectId" $Green
Write-ColorOutput ""

# Step 3: Link billing account (user needs to do this manually)
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 3: Billing Account" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "⚠️  Please link a billing account manually in GCP Console:" $Yellow
Write-ColorOutput "   https://console.cloud.google.com/billing?project=$ProjectId" $Yellow
Write-ColorOutput ""
$response = Read-Host "Press Enter after linking billing account"
Write-ColorOutput ""

# Step 4: Enable required APIs
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 4: Enabling Required APIs" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$apis = @(
    "appengine.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "iam.googleapis.com"
)

foreach ($api in $apis) {
    Write-ColorOutput "Enabling $api..." $Blue
    gcloud services enable $api --project=$ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ $api enabled" $Green
    } else {
        Write-ColorOutput "⚠️  Failed to enable $api (may already be enabled)" $Yellow
    }
}
Write-ColorOutput ""

# Step 5: Initialize App Engine
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 5: Initializing App Engine" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$appEngineLocation = gcloud app describe --format="value(locationId)" --project=$ProjectId 2>$null
if ($appEngineLocation) {
    Write-ColorOutput "✅ App Engine already initialized in region: $appEngineLocation" $Green
} else {
    Write-ColorOutput "Initializing App Engine in region: $Region..." $Blue
    gcloud app create --region=$Region --project=$ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ App Engine initialized in region: $Region" $Green
    } else {
        Write-ColorOutput "❌ Failed to initialize App Engine" $Red
        exit 1
    }
}
Write-ColorOutput ""

# Step 6: Create Cloud SQL Instance
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 6: Creating Cloud SQL Instance" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "⚠️  This may take 5-8 minutes..." $Yellow
Write-ColorOutput ""

$existingInstance = gcloud sql instances describe wealtharena-db --format="value(name)" --project=$ProjectId 2>$null
if ($existingInstance) {
    Write-ColorOutput "✅ Cloud SQL instance 'wealtharena-db' already exists" $Green
} else {
    Write-ColorOutput "Creating Cloud SQL instance..." $Blue
    gcloud sql instances create wealtharena-db `
        --database-version=POSTGRES_15 `
        --tier=db-f1-micro `
        --region=$Region `
        --storage-type=SSD `
        --storage-size=10GB `
        --backup-start-time=03:00 `
        --project=$ProjectId 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Cloud SQL instance created" $Green
    } else {
        Write-ColorOutput "❌ Failed to create Cloud SQL instance" $Red
        exit 1
    }
}

# Get connection name
$connectionName = gcloud sql instances describe wealtharena-db --format="value(connectionName)" --project=$ProjectId
Write-ColorOutput "✅ Connection name: $connectionName" $Green
Write-ColorOutput ""

# Step 7: Create Database and User
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 7: Creating Database and User" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "Creating database 'wealtharena_db'..." $Blue
gcloud sql databases create wealtharena_db --instance=wealtharena-db --project=$ProjectId 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ Database created" $Green
} else {
    Write-ColorOutput "⚠️  Database may already exist" $Yellow
}

Write-ColorOutput "Creating user 'wealtharena_admin'..." $Blue
gcloud sql users create wealtharena_admin --instance=wealtharena-db --password=$DbPassword --project=$ProjectId 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ User created" $Green
} else {
    Write-ColorOutput "⚠️  User may already exist" $Yellow
}
Write-ColorOutput ""

# Step 8: Create Cloud Storage Bucket
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 8: Creating Cloud Storage Bucket" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$bucketExists = gsutil ls -b gs://wealtharena-models 2>$null
if ($bucketExists) {
    Write-ColorOutput "✅ Bucket 'wealtharena-models' already exists" $Green
} else {
    Write-ColorOutput "Creating bucket 'wealtharena-models'..." $Blue
    gsutil mb -l $Region -c STANDARD gs://wealtharena-models --project=$ProjectId 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Bucket created" $Green
    } else {
        Write-ColorOutput "❌ Failed to create bucket" $Red
        exit 1
    }
}

Write-ColorOutput "Setting public access prevention..." $Blue
gsutil pap set enforced gs://wealtharena-models 2>&1 | Out-Null
Write-ColorOutput "✅ Access prevention configured" $Green
Write-ColorOutput ""

# Step 9: Create Secret Manager Secrets
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 9: Creating Secret Manager Secrets" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

Write-ColorOutput "Creating db-password secret..." $Blue
$dbPasswordSecret = echo -n $DbPassword | gcloud secrets create db-password --data-file=- --project=$ProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ db-password secret created" $Green
} else {
    Write-ColorOutput "⚠️  Secret may already exist" $Yellow
}

Write-ColorOutput "Creating jwt-secret secret..." $Blue
$jwtSecretResult = echo -n $jwtSecret | gcloud secrets create jwt-secret --data-file=- --project=$ProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ jwt-secret secret created" $Green
} else {
    Write-ColorOutput "⚠️  Secret may already exist" $Yellow
}
Write-ColorOutput ""

# Step 10: Grant IAM Permissions
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 10: Granting IAM Permissions" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

$serviceAccount = "$ProjectId@appspot.gserviceaccount.com"

Write-ColorOutput "Granting Cloud SQL Client role..." $Blue
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$serviceAccount" `
    --role="roles/cloudsql.client" `
    --condition=None 2>&1 | Out-Null
Write-ColorOutput "✅ Cloud SQL Client role granted" $Green

Write-ColorOutput "Granting Storage Object Viewer role..." $Blue
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$serviceAccount" `
    --role="roles/storage.objectViewer" `
    --condition=None 2>&1 | Out-Null
Write-ColorOutput "✅ Storage Object Viewer role granted" $Green

Write-ColorOutput "Granting Secret Manager Accessor role..." $Blue
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$serviceAccount" `
    --role="roles/secretmanager.secretAccessor" `
    --condition=None 2>&1 | Out-Null
Write-ColorOutput "✅ Secret Manager Accessor role granted" $Green
Write-ColorOutput ""

# Step 11: Generate Configuration Summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Step 11: Configuration Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

Write-ColorOutput "✅ GCP Project: $ProjectId" $Green
Write-ColorOutput "✅ Region: $Region" $Green
Write-ColorOutput "✅ Cloud SQL Instance: wealtharena-db" $Green
Write-ColorOutput "✅ Connection Name: $connectionName" $Green
Write-ColorOutput "✅ Database: wealtharena_db" $Green
Write-ColorOutput "✅ User: wealtharena_admin" $Green
Write-ColorOutput "✅ Cloud Storage Bucket: gs://wealtharena-models" $Green
Write-ColorOutput "✅ Secrets: db-password, jwt-secret" $Green
Write-ColorOutput ""

# Get public IP if available
$publicIp = gcloud sql instances describe wealtharena-db --format="value(ipAddresses[0].ipAddress)" --project=$ProjectId 2>$null
if ($publicIp) {
    Write-ColorOutput "✅ Cloud SQL Public IP: $publicIp" $Green
}

Write-ColorOutput ""
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Next Steps:" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""
Write-ColorOutput "1. Deploy PostgreSQL schema:" $Yellow
Write-ColorOutput "   psql -h <ip> -U wealtharena_admin -d wealtharena_db -f database_schemas/postgresql_schema.sql" $Yellow
Write-ColorOutput ""
Write-ColorOutput "2. Deploy services:" $Yellow
Write-ColorOutput "   cd scripts/gcp_deployment" $Yellow
Write-ColorOutput "   .\deploy_all_services.ps1" $Yellow
Write-ColorOutput ""
Write-ColorOutput "3. Upload model checkpoints:" $Yellow
Write-ColorOutput "   gsutil -m cp -r wealtharena_rl/checkpoints/* gs://wealtharena-models/latest/" $Yellow
Write-ColorOutput ""

Write-ColorOutput "✅ Infrastructure setup complete!" $Green

