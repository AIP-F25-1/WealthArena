# Shared function to discover resource suffix
# This function discovers the actual suffix used by resources, prioritizing:
# 1. Automation state file (UniqueSuffix)
# 2. Existing SQL Server resources
# 3. Existing Key Vault resources
# 4. Resource group name
# 5. Default "dev"

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,
    
    [Parameter(Mandatory=$false)]
    [string]$StateFile = ""
)

$discoveredSuffix = $null

# Priority 1: Check automation state file (if master_automation.ps1 created resources)
if ([string]::IsNullOrWhiteSpace($StateFile)) {
    $StateFile = Join-Path $PSScriptRoot "..\..\automation_state.json"
}

if (Test-Path $StateFile) {
    try {
        $automationState = Get-Content $StateFile -Raw | ConvertFrom-Json
        if ($automationState -and $automationState.UniqueSuffix) {
            $discoveredSuffix = $automationState.UniqueSuffix
            return $discoveredSuffix
        }
    } catch {
        # Ignore errors reading state file
    }
}

# Priority 2: Discover from existing SQL Server
$sqlListOutput = az sql server list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
if ($LASTEXITCODE -eq 0 -and $sqlListOutput) {
    $sqlOutputString = $sqlListOutput.ToString()
    if ($sqlOutputString -match 'sql-wealtharena-([^\s]+)') {
        $discoveredSuffix = $matches[1]
        return $discoveredSuffix
    }
}

# Priority 3: Discover from Key Vault
$kvListOutput = az keyvault list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
if ($LASTEXITCODE -eq 0 -and $kvListOutput) {
    $kvOutputString = $kvListOutput.ToString()
    if ($kvOutputString -match 'kv-wealtharena-([^\s]+)') {
        $discoveredSuffix = $matches[1]
        return $discoveredSuffix
    }
}

# Priority 4: Fallback to resource group name
if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
    $discoveredSuffix = $matches[1]
    return $discoveredSuffix
}

# Priority 5: Default
return "dev"

