# WealthArena Database Schema Deployment Script
# This script deploys database schemas to Azure SQL and Cosmos DB

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

function Deploy-AzureSQLSchema {
    param([string]$ServerName, [string]$DatabaseName, [string]$ResourceGroup)
    
    Write-ColorOutput "Deploying Azure SQL Schema..." $Blue
    
    try {
        # Read the SQL schema file
        $schemaFile = "database_schemas/azure_sql_schema.sql"
        if (-not (Test-Path $schemaFile)) {
            Write-ColorOutput "SQL schema file not found: $schemaFile" $Red
            return $false
        }
        
        $schemaContent = Get-Content $schemaFile -Raw
        
        # Execute the schema
        $connectionString = "Server=tcp:$ServerName.database.windows.net,1433;Initial Catalog=$DatabaseName;Persist Security Info=False;User ID=wealtharena_admin;Password=WealthArena2024!@#$%;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
        
        # Use sqlcmd to execute the schema
        $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
        $schemaContent | Out-File -FilePath $tempFile -Encoding UTF8
        
        try {
            sqlcmd -S "$ServerName.database.windows.net" -d $DatabaseName -U "wealtharena_admin" -P "WealthArena2024!@#$%" -i $tempFile -o "sql_deployment.log"
            
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "Azure SQL schema deployed successfully" $Green
                return $true
            }
            else {
                Write-ColorOutput "Failed to deploy Azure SQL schema" $Red
                return $false
            }
        }
        catch {
            Write-ColorOutput "Error executing SQL schema: $($_.Exception.Message)" $Red
            return $false
        }
        finally {
            if (Test-Path $tempFile) {
                Remove-Item $tempFile -Force
            }
        }
    }
    catch {
        Write-ColorOutput "Error deploying Azure SQL schema: $($_.Exception.Message)" $Red
        return $false
    }
}

function Deploy-CosmosDBSchema {
    param([string]$AccountName, [string]$ResourceGroup)
    
    Write-ColorOutput "Deploying Cosmos DB Collections..." $Blue
    
    try {
        # Read the Cosmos DB collections file
        $collectionsFile = "database_schemas/cosmos_collections.json"
        if (-not (Test-Path $collectionsFile)) {
            Write-ColorOutput "Cosmos DB collections file not found: $collectionsFile" $Red
            return $false
        }
        
        $collections = Get-Content $collectionsFile | ConvertFrom-Json
        
        # Create collections
        foreach ($collection in $collections.collections) {
            try {
                Write-ColorOutput "Creating collection: $($collection.name)" $Blue
                
                # Create collection using Azure CLI
                az cosmosdb sql container create `
                    --account-name $AccountName `
                    --resource-group $ResourceGroup `
                    --database-name "wealtharena" `
                    --name $collection.name `
                    --partition-key-path $collection.partitionKey `
                    --throughput $collection.throughput `
                    --output none
                
                Write-ColorOutput "   Collection '$($collection.name)' created successfully" $Green
            }
            catch {
                Write-ColorOutput "   Warning: Failed to create collection '$($collection.name)': $($_.Exception.Message)" $Yellow
            }
        }
        
        Write-ColorOutput "Cosmos DB collections deployment completed" $Green
        return $true
    }
    catch {
        Write-ColorOutput "Error deploying Cosmos DB schema: $($_.Exception.Message)" $Red
        return $false
    }
}

function Test-DatabaseConnectivity {
    param([string]$ServerName, [string]$DatabaseName)
    
    Write-ColorOutput "Testing database connectivity..." $Blue
    
    try {
        $connectionString = "Server=tcp:$ServerName.database.windows.net,1433;Initial Catalog=$DatabaseName;Persist Security Info=False;User ID=wealtharena_admin;Password=WealthArena2024!@#$%;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
        
        # Test connection with a simple query
        $testQuery = "SELECT 1 as test"
        $result = sqlcmd -S "$ServerName.database.windows.net" -d $DatabaseName -U "wealtharena_admin" -P "WealthArena2024!@#$%" -Q $testQuery -h -1
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Database connectivity test passed" $Green
            return $true
        }
        else {
            Write-ColorOutput "Database connectivity test failed" $Red
            return $false
        }
    }
    catch {
        Write-ColorOutput "Error testing database connectivity: $($_.Exception.Message)" $Red
        return $false
    }
}

# Main execution
Write-ColorOutput "WealthArena Database Schema Deployment" $Blue
Write-ColorOutput "=======================================" $Blue

# Check if sqlcmd is available
try {
    $sqlcmdVersion = sqlcmd -?
    Write-ColorOutput "sqlcmd found and ready" $Green
}
catch {
    Write-ColorOutput "sqlcmd not found. Please install SQL Server command line tools." $Red
    Write-ColorOutput "You can download from: https://docs.microsoft.com/en-us/sql/tools/sqlcmd-utility" $Blue
    exit 1
}

# Deploy Azure SQL Schema
$sqlServerName = "sql-wealtharena-$Environment"
$sqlDatabaseName = "wealtharena_db"

Write-ColorOutput "Deploying to Azure SQL Database..." $Blue
Write-ColorOutput "Server: $sqlServerName" $Blue
Write-ColorOutput "Database: $sqlDatabaseName" $Blue

# Test connectivity first
if (Test-DatabaseConnectivity -ServerName $sqlServerName -DatabaseName $sqlDatabaseName) {
    $sqlDeployed = Deploy-AzureSQLSchema -ServerName $sqlServerName -DatabaseName $sqlDatabaseName -ResourceGroup $ResourceGroupName
}
else {
    Write-ColorOutput "Cannot connect to SQL Database. Skipping schema deployment." $Yellow
    $sqlDeployed = $false
}

# Deploy Cosmos DB Schema
$cosmosAccountName = "cosmos-wealtharena-$Environment"

Write-ColorOutput "Deploying to Cosmos DB..." $Blue
Write-ColorOutput "Account: $cosmosAccountName" $Blue

$cosmosDeployed = Deploy-CosmosDBSchema -AccountName $cosmosAccountName -ResourceGroup $ResourceGroupName

# Summary
Write-ColorOutput "" $Blue
Write-ColorOutput "Deployment Summary:" $Blue
Write-ColorOutput "==================" $Blue

if ($sqlDeployed) {
    Write-ColorOutput "Azure SQL Schema: DEPLOYED" $Green
}
else {
    Write-ColorOutput "Azure SQL Schema: FAILED" $Red
}

if ($cosmosDeployed) {
    Write-ColorOutput "Cosmos DB Schema: DEPLOYED" $Green
}
else {
    Write-ColorOutput "Cosmos DB Schema: FAILED" $Red
}

if ($sqlDeployed -and $cosmosDeployed) {
    Write-ColorOutput "" $Blue
    Write-ColorOutput "All database schemas deployed successfully!" $Green
    Write-ColorOutput "Next steps:" $Blue
    Write-ColorOutput "1. Upload Databricks notebooks" $Blue
    Write-ColorOutput "2. Deploy backend services" $Blue
    Write-ColorOutput "3. Run integration tests" $Blue
}
else {
    Write-ColorOutput "" $Blue
    Write-ColorOutput "Some database schemas failed to deploy." $Yellow
    Write-ColorOutput "Please check the errors above and retry." $Yellow
}

Write-ColorOutput "" $Blue
Write-ColorOutput "Database schema deployment complete!" $Blue
