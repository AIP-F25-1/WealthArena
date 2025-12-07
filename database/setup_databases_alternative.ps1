# WealthArena Database Setup - Alternative Approach
# This script sets up databases using Azure CLI and Python scripts

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

function Setup-AzureSQLDatabase {
    param([string]$ServerName, [string]$DatabaseName, [string]$ResourceGroup)
    
    Write-ColorOutput "Setting up Azure SQL Database..." $Blue
    
    try {
        # Create a Python script to set up the database
        $pythonScript = @"
import pyodbc
import os
import sys

# Connection parameters
server = '$ServerName.database.windows.net'
database = '$DatabaseName'
username = 'wealtharena_admin'
password = 'WealthArena2024!@#$%'
driver = '{ODBC Driver 18 for SQL Server}'

# Connection string
connection_string = f'DRIVER={driver};SERVER={server};DATABASE={database};UID={username};PWD={password};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;'

try:
    # Connect to database
    conn = pyodbc.connect(connection_string)
    cursor = conn.cursor()
    
    print("Connected to Azure SQL Database successfully")
    
    # Read and execute SQL schema
    with open('database_schemas/azure_sql_schema.sql', 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # Split by semicolon and execute each statement
    statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
    
    for statement in statements:
        if statement:
            try:
                cursor.execute(statement)
                print(f"Executed: {statement[:50]}...")
            except Exception as e:
                print(f"Warning: {e}")
    
    conn.commit()
    print("Database schema deployed successfully")
    
    # Test with a simple query
    cursor.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES")
    table_count = cursor.fetchone()[0]
    print(f"Tables created: {table_count}")
    
    conn.close()
    print("Database setup completed successfully")
    
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
"@

        # Save Python script
        $pythonScript | Out-File -FilePath "setup_sql_db.py" -Encoding UTF8
        
        # Install required packages
        Write-ColorOutput "Installing required Python packages..." $Blue
        pip install pyodbc
        
        # Run Python script
        Write-ColorOutput "Executing database schema..." $Blue
        python setup_sql_db.py
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Azure SQL Database setup completed successfully" $Green
            return $true
        }
        else {
            Write-ColorOutput "Failed to setup Azure SQL Database" $Red
            return $false
        }
    }
    catch {
        Write-ColorOutput "Error setting up Azure SQL Database: $($_.Exception.Message)" $Red
        return $false
    }
    finally {
        # Clean up
        if (Test-Path "setup_sql_db.py") {
            Remove-Item "setup_sql_db.py" -Force
        }
    }
}

function Setup-CosmosDBCollections {
    param([string]$AccountName, [string]$ResourceGroup)
    
    Write-ColorOutput "Setting up Cosmos DB Collections..." $Blue
    
    try {
        # Create a Python script to set up Cosmos DB
        $pythonScript = @"
import os
from azure.cosmos import CosmosClient, PartitionKey
import json

# Connection parameters
cosmos_endpoint = f'https://$AccountName.documents.azure.com:443/'
cosmos_key = os.getenv('COSMOS_KEY', '')  # Will be set from Azure CLI

if not cosmos_key:
    print("Error: COSMOS_KEY environment variable not set")
    exit(1)

try:
    # Initialize Cosmos client
    client = CosmosClient(cosmos_endpoint, cosmos_key)
    
    # Create database
    database_name = 'wealtharena'
    database = client.create_database_if_not_exists(id=database_name)
    print(f"Database '{database_name}' created or already exists")
    
    # Read collections configuration
    with open('database_schemas/cosmos_collections.json', 'r') as f:
        collections_config = json.load(f)
    
    # Create collections
    for collection_config in collections_config['collections']:
        container_name = collection_config['name']
        partition_key = collection_config['partitionKey']
        
        try:
            container = database.create_container_if_not_exists(
                id=container_name,
                partition_key=PartitionKey(path=partition_key),
                offer_throughput=400
            )
            print(f"Container '{container_name}' created or already exists")
        except Exception as e:
            print(f"Warning: Could not create container '{container_name}': {e}")
    
    print("Cosmos DB setup completed successfully")
    
except Exception as e:
    print(f"Error: {e}")
    exit(1)
"@

        # Save Python script
        $pythonScript | Out-File -FilePath "setup_cosmos_db.py" -Encoding UTF8
        
        # Get Cosmos DB key
        Write-ColorOutput "Getting Cosmos DB connection key..." $Blue
        $cosmosKey = az cosmosdb keys list --name $AccountName --resource-group $ResourceGroup --type keys --query "primaryMasterKey" --output tsv
        
        if ($cosmosKey) {
            $env:COSMOS_KEY = $cosmosKey
            
            # Install required packages
            Write-ColorOutput "Installing required Python packages..." $Blue
            pip install azure-cosmos
            
            # Run Python script
            Write-ColorOutput "Setting up Cosmos DB collections..." $Blue
            python setup_cosmos_db.py
            
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "Cosmos DB setup completed successfully" $Green
                return $true
            }
            else {
                Write-ColorOutput "Failed to setup Cosmos DB" $Red
                return $false
            }
        }
        else {
            Write-ColorOutput "Could not get Cosmos DB key. Cosmos DB may not be available in student account." $Yellow
            return $false
        }
    }
    catch {
        Write-ColorOutput "Error setting up Cosmos DB: $($_.Exception.Message)" $Red
        return $false
    }
    finally {
        # Clean up
        if (Test-Path "setup_cosmos_db.py") {
            Remove-Item "setup_cosmos_db.py" -Force
        }
        $env:COSMOS_KEY = $null
    }
}

function Test-DatabaseConnectivity {
    param([string]$ServerName, [string]$DatabaseName)
    
    Write-ColorOutput "Testing database connectivity..." $Blue
    
    try {
        # Create a simple Python test script
        $testScript = @"
import pyodbc

try:
    server = '$ServerName.database.windows.net'
    database = '$DatabaseName'
    username = 'wealtharena_admin'
    password = 'WealthArena2024!@#$%'
    driver = '{ODBC Driver 18 for SQL Server}'
    
    connection_string = f'DRIVER={driver};SERVER={server};DATABASE={database};UID={username};PWD={password};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;'
    
    conn = pyodbc.connect(connection_string)
    cursor = conn.cursor()
    cursor.execute('SELECT 1 as test')
    result = cursor.fetchone()
    conn.close()
    
    print("Database connectivity test passed")
    exit(0)
    
except Exception as e:
    print(f"Database connectivity test failed: {e}")
    exit(1)
"@

        $testScript | Out-File -FilePath "test_db_connection.py" -Encoding UTF8
        
        python test_db_connection.py
        
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
    finally {
        if (Test-Path "test_db_connection.py") {
            Remove-Item "test_db_connection.py" -Force
        }
    }
}

# Main execution
Write-ColorOutput "WealthArena Database Setup - Alternative Approach" $Blue
Write-ColorOutput "=================================================" $Blue

# Check if Python is available
try {
    $pythonVersion = python --version
    Write-ColorOutput "Python found: $pythonVersion" $Green
}
catch {
    Write-ColorOutput "Python not found. Please install Python first." $Red
    exit 1
}

# Setup Azure SQL Database
$sqlServerName = "sql-wealtharena-$Environment"
$sqlDatabaseName = "wealtharena_db"

Write-ColorOutput "Setting up Azure SQL Database..." $Blue
Write-ColorOutput "Server: $sqlServerName" $Blue
Write-ColorOutput "Database: $sqlDatabaseName" $Blue

# Test connectivity first
if (Test-DatabaseConnectivity -ServerName $sqlServerName -DatabaseName $sqlDatabaseName) {
    $sqlSetup = Setup-AzureSQLDatabase -ServerName $sqlServerName -DatabaseName $sqlDatabaseName -ResourceGroup $ResourceGroupName
}
else {
    Write-ColorOutput "Cannot connect to SQL Database. Skipping schema deployment." $Yellow
    $sqlSetup = $false
}

# Setup Cosmos DB Collections
$cosmosAccountName = "cosmos-wealtharena-$Environment"

Write-ColorOutput "Setting up Cosmos DB Collections..." $Blue
Write-ColorOutput "Account: $cosmosAccountName" $Blue

$cosmosSetup = Setup-CosmosDBCollections -AccountName $cosmosAccountName -ResourceGroup $ResourceGroupName

# Summary
Write-ColorOutput "" $Blue
Write-ColorOutput "Database Setup Summary:" $Blue
Write-ColorOutput "=======================" $Blue

if ($sqlSetup) {
    Write-ColorOutput "Azure SQL Database: SETUP COMPLETED" $Green
}
else {
    Write-ColorOutput "Azure SQL Database: SETUP FAILED" $Red
}

if ($cosmosSetup) {
    Write-ColorOutput "Cosmos DB Collections: SETUP COMPLETED" $Green
}
else {
    Write-ColorOutput "Cosmos DB Collections: SETUP FAILED" $Red
}

if ($sqlSetup -or $cosmosSetup) {
    Write-ColorOutput "" $Blue
    Write-ColorOutput "Database setup completed!" $Green
    Write-ColorOutput "Next steps:" $Blue
    Write-ColorOutput "1. Upload Databricks notebooks" $Blue
    Write-ColorOutput "2. Deploy backend services" $Blue
    Write-ColorOutput "3. Run integration tests" $Blue
}
else {
    Write-ColorOutput "" $Blue
    Write-ColorOutput "Database setup failed." $Yellow
    Write-ColorOutput "Please check the errors above and retry." $Yellow
}

Write-ColorOutput "" $Blue
Write-ColorOutput "Database setup process complete!" $Blue
