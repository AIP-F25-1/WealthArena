# WealthArena Azure SQL Firewall Configuration Script
# Adds local IP address to Azure SQL Server firewall rules for development access

param(
    [string]$ResourceGroupName = "rg-wealtharena-northcentralus",
    [string]$ServerName = "sql-wealtharena-dev",
    [string]$RuleName = "AllowLocalDevelopment"
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

function Get-PublicIP {
    try {
        # Try using ipify.org API
        $ip = (Invoke-WebRequest -Uri 'https://api.ipify.org' -UseBasicParsing -TimeoutSec 10).Content.Trim()
        if ($ip -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
            return $ip
        }
    }
    catch {
        Write-ColorOutput "Warning: Could not detect IP via ipify.org" $Yellow
    }
    
    # Fallback: try Azure CLI
    try {
        $ip = az rest --method get --uri 'https://api.ipify.org' --output tsv 2>$null
        if ($ip -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
            return $ip
        }
    }
    catch {
        Write-ColorOutput "Warning: Could not detect IP via Azure CLI" $Yellow
    }
    
    return $null
}

function Test-FirewallRule {
    param([string]$Server, [string]$ResourceGroup, [string]$Rule)
    
    try {
        $rule = az sql server firewall-rule show `
            --name $Rule `
            --server $Server `
            --resource-group $ResourceGroup `
            --output json 2>$null | ConvertFrom-Json
        
        return $null -ne $rule
    }
    catch {
        return $false
    }
}

function Get-FirewallRules {
    param([string]$Server, [string]$ResourceGroup)
    
    try {
        $rules = az sql server firewall-rule list `
            --server $Server `
            --resource-group $ResourceGroup `
            --output json | ConvertFrom-Json
        
        return $rules
    }
    catch {
        return @()
    }
}

# Main execution
Write-ColorOutput "Configuring Azure SQL Firewall Rules" $Blue
Write-ColorOutput "====================================" $Blue
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

# Detect public IP
Write-ColorOutput "Detecting public IP address..." $Blue
$myPublicIP = Get-PublicIP

if (-not $myPublicIP) {
    Write-ColorOutput "❌ Could not detect public IP address" $Red
    Write-ColorOutput "Please provide your IP address manually:" $Yellow
    $myPublicIP = Read-Host "Enter your public IP address"
    
    if (-not ($myPublicIP -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')) {
        Write-ColorOutput "❌ Invalid IP address format" $Red
        exit 1
    }
}

Write-ColorOutput "✅ Your public IP: $myPublicIP" $Green
Write-ColorOutput "" $Blue

# Check existing firewall rules
Write-ColorOutput "Checking existing firewall rules..." $Blue
$existingRules = Get-FirewallRules -Server $ServerName -ResourceGroup $ResourceGroupName

# Check if AllowAzureServices rule exists
$allowAzureExists = Test-FirewallRule -Server $ServerName -ResourceGroup $ResourceGroupName -Rule "AllowAzureServices"
if ($allowAzureExists) {
    Write-ColorOutput "✅ AllowAzureServices rule exists (0.0.0.0 - 0.0.0.0)" $Green
} else {
    Write-ColorOutput "⚠️  AllowAzureServices rule not found (will be created if needed)" $Yellow
}

Write-ColorOutput "" $Blue

# Check if local development rule already exists
$localRuleExists = Test-FirewallRule -Server $ServerName -ResourceGroup $ResourceGroupName -Rule $RuleName

if ($localRuleExists) {
    Write-ColorOutput "⚠️  Firewall rule '$RuleName' already exists" $Yellow
    Write-ColorOutput "Updating with current IP address..." $Blue
    
    try {
        az sql server firewall-rule update `
            --resource-group $ResourceGroupName `
            --server $ServerName `
            --name $RuleName `
            --start-ip-address $myPublicIP `
            --end-ip-address $myPublicIP `
            --output none
        
        Write-ColorOutput "✅ Firewall rule updated: $RuleName ($myPublicIP)" $Green
    }
    catch {
        Write-ColorOutput "❌ Failed to update firewall rule: $($_.Exception.Message)" $Red
        exit 1
    }
} else {
    Write-ColorOutput "Adding local development rule..." $Blue
    
    try {
        az sql server firewall-rule create `
            --resource-group $ResourceGroupName `
            --server $ServerName `
            --name $RuleName `
            --start-ip-address $myPublicIP `
            --end-ip-address $myPublicIP `
            --output none
        
        Write-ColorOutput "✅ Firewall rule created: $RuleName ($myPublicIP)" $Green
    }
    catch {
        Write-ColorOutput "❌ Failed to create firewall rule: $($_.Exception.Message)" $Red
        exit 1
    }
}

Write-ColorOutput "" $Blue

# Display current firewall rules
Write-ColorOutput "Current firewall rules:" $Blue
$rules = Get-FirewallRules -Server $ServerName -ResourceGroup $ResourceGroupName

Write-ColorOutput "" $Blue
Write-ColorOutput "Name                    Start IP        End IP" $Blue
Write-ColorOutput "----------------------  --------------  --------------" $Blue

foreach ($rule in $rules) {
    Write-ColorOutput "$($rule.name.PadRight(22))  $($rule.startIpAddress.PadRight(15))  $($rule.endIpAddress)" $Blue
}

Write-ColorOutput "" $Blue
Write-ColorOutput "✅ Firewall configured successfully" $Green
Write-ColorOutput "You can now connect from your local machine" $Green
Write-ColorOutput "" $Blue
Write-ColorOutput "Security Note:" $Yellow
Write-ColorOutput "For production, remove the local IP rule or restrict to specific IP ranges." $Yellow
Write-ColorOutput "The AllowAzureServices rule (0.0.0.0) is required for Azure Web Apps to connect." $Yellow
