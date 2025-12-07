# WealthArena Database Connectivity Diagnostic Script
# Diagnoses SQL connectivity issues including ENOTFOUND/DNS and firewall problems

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "rg-wealtharena-northcentralus",
    
    [Parameter(Mandatory=$false)]
    [string]$SqlServerName = ""
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

Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Database Connectivity Diagnostic" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

# Derive SQL Server name if not provided
if ([string]::IsNullOrWhiteSpace($SqlServerName)) {
    if ($ResourceGroup -match 'rg-wealtharena-(\w+)') {
        $suffix = $matches[1]
        $SqlServerName = "sql-wealtharena-$suffix"
    } else {
        Write-ColorOutput "ERROR: Could not derive SQL Server name from Resource Group" $Red
        Write-ColorOutput "Please provide -SqlServerName parameter" $Yellow
        exit 1
    }
}
Write-ColorOutput "Resource Group: $ResourceGroup" $Cyan
Write-ColorOutput "SQL Server: $SqlServerName" $Cyan
Write-ColorOutput ""

$allChecksPassed = $true
$checkResults = @()

# Check 1: Azure login and Resource Group existence
Write-ColorOutput "Check 1: Azure login and Resource Group existence" $Blue
Write-ColorOutput "---------------------------------------------------" $Blue

$accountOutput = az account show --output json 2>&1
$account = $null

if ($LASTEXITCODE -eq 0) {
    try {
        $account = $accountOutput | ConvertFrom-Json
        if ($account -and $account.user) {
            Write-ColorOutput "   PASS: Azure login verified" $Green
            Write-ColorOutput "   User: $($account.user.name)" $Green
            $checkResults += @{Name="Azure Login"; Status="PASS"}
        } else {
            Write-ColorOutput "   FAIL: Azure login invalid" $Red
            Write-ColorOutput "   Run 'az login' to authenticate" $Yellow
            $checkResults += @{Name="Azure Login"; Status="FAIL"}
            $allChecksPassed = $false
        }
    } catch {
        Write-ColorOutput "   FAIL: Azure login check failed" $Red
        Write-ColorOutput "   Error: Could not parse account information" $Yellow
        Write-ColorOutput "   Run 'az login' to authenticate" $Yellow
        $checkResults += @{Name="Azure Login"; Status="FAIL"}
        $allChecksPassed = $false
    }
} else {
    Write-ColorOutput "   FAIL: Not logged in to Azure" $Red
    Write-ColorOutput "   Run 'az login' to authenticate" $Yellow
    if ($accountOutput) {
        Write-ColorOutput "   Error details: $accountOutput" $Yellow
    }
    $checkResults += @{Name="Azure Login"; Status="FAIL"}
    $allChecksPassed = $false
}

if ($allChecksPassed) {
    $rgOutput = az group show --name $ResourceGroup --output json 2>&1
    $rg = $null
    
    if ($LASTEXITCODE -eq 0) {
        try {
            $rg = $rgOutput | ConvertFrom-Json
            if ($rg -and $rg.name) {
                Write-ColorOutput "   PASS: Resource Group exists: $ResourceGroup" $Green
                Write-ColorOutput "   Location: $($rg.location)" $Green
                $checkResults += @{Name="Resource Group"; Status="PASS"}
            } else {
                Write-ColorOutput "   FAIL: Resource Group not found: $ResourceGroup" $Red
                Write-ColorOutput "   Create with: az group create --name $ResourceGroup --location <location>" $Blue
                $checkResults += @{Name="Resource Group"; Status="FAIL"}
                $allChecksPassed = $false
            }
        } catch {
            Write-ColorOutput "   FAIL: Could not parse Resource Group information" $Red
            Write-ColorOutput "   Error details: $rgOutput" $Yellow
            $checkResults += @{Name="Resource Group"; Status="FAIL"}
            $allChecksPassed = $false
        }
    } else {
        Write-ColorOutput "   FAIL: Resource Group not found: $ResourceGroup" $Red
        Write-ColorOutput "   Create with: az group create --name $ResourceGroup --location <location>" $Blue
        if ($rgOutput) {
            Write-ColorOutput "   Error details: $rgOutput" $Yellow
        }
        $checkResults += @{Name="Resource Group"; Status="FAIL"}
        $allChecksPassed = $false
    }
} else {
    Write-ColorOutput "   SKIP: Resource Group check skipped (Azure login failed)" $Yellow
    $checkResults += @{Name="Resource Group"; Status="SKIP"}
}

Write-ColorOutput ""

# Check 2: SQL Server existence
Write-ColorOutput "Check 2: SQL Server existence" $Blue
Write-ColorOutput "---------------------------------------------------" $Blue

$sqlServer = $null
if ($allChecksPassed) {
    $sqlServerOutput = az sql server show --name $SqlServerName --resource-group $ResourceGroup --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        try {
            $sqlServer = $sqlServerOutput | ConvertFrom-Json
            if ($sqlServer -and $sqlServer.name) {
                Write-ColorOutput "   PASS: SQL Server exists: $SqlServerName" $Green
                Write-ColorOutput "   Location: $($sqlServer.location)" $Green
                Write-ColorOutput "   FQDN: $SqlServerName.database.windows.net" $Green
                $checkResults += @{Name="SQL Server"; Status="PASS"}
            } else {
                Write-ColorOutput "   FAIL: SQL Server not found: $SqlServerName" $Red
                Write-ColorOutput "   Create with: az sql server create --name $SqlServerName --resource-group $ResourceGroup --location <location> --admin-user wealtharena_admin --admin-password <password>" $Blue
                $checkResults += @{Name="SQL Server"; Status="FAIL"}
                $allChecksPassed = $false
            }
        } catch {
            Write-ColorOutput "   FAIL: Could not parse SQL Server output" $Red
            Write-ColorOutput "   Error details: $sqlServerOutput" $Yellow
            $checkResults += @{Name="SQL Server"; Status="FAIL"}
            $allChecksPassed = $false
        }
    } else {
        Write-ColorOutput "   FAIL: SQL Server not found: $SqlServerName" $Red
        Write-ColorOutput "   Create with: az sql server create --name $SqlServerName --resource-group $ResourceGroup --location <location> --admin-user wealtharena_admin --admin-password <password>" $Blue
        Write-ColorOutput "   Or run infrastructure setup: setup_master.ps1 (Phase 6)" $Blue
        if ($sqlServerOutput) {
            Write-ColorOutput "   Error details: $sqlServerOutput" $Yellow
        }
        $checkResults += @{Name="SQL Server"; Status="FAIL"}
        $allChecksPassed = $false
    }
} else {
    Write-ColorOutput "   SKIP: SQL Server check skipped (prerequisites failed)" $Yellow
    $checkResults += @{Name="SQL Server"; Status="SKIP"}
}

Write-ColorOutput ""

# Check 3: DNS resolution
Write-ColorOutput "Check 3: DNS resolution" $Blue
Write-ColorOutput "---------------------------------------------------" $Blue

$sqlFqdn = "$SqlServerName.database.windows.net"

if ($sqlServer) {
    try {
        $dnsResult = Resolve-DnsName -Name $sqlFqdn -ErrorAction SilentlyContinue 2>&1
        if ($dnsResult -and $dnsResult.Count -gt 0) {
            $ipAddress = $null
            foreach ($record in $dnsResult) {
                if ($record.IPAddress) {
                    $ipAddress = $record.IPAddress
                    break
                }
            }
            if ($ipAddress) {
                Write-ColorOutput "   PASS: DNS resolution successful" $Green
                Write-ColorOutput "   FQDN: $sqlFqdn" $Green
                Write-ColorOutput "   Resolved IP: $ipAddress" $Green
                $checkResults += @{Name="DNS Resolution"; Status="PASS"}
            } else {
                Write-ColorOutput "   FAIL: DNS resolution returned no IP address" $Red
                Write-ColorOutput "   This indicates the SQL Server DNS record is missing or invalid" $Yellow
                $checkResults += @{Name="DNS Resolution"; Status="FAIL"}
                $allChecksPassed = $false
            }
        } else {
            Write-ColorOutput "   FAIL: DNS resolution failed" $Red
            Write-ColorOutput "   FQDN: $sqlFqdn" $Yellow
            Write-ColorOutput "   This indicates the SQL Server doesn't exist or has DNS issues" $Yellow
            Write-ColorOutput "   Wait a few minutes after creating SQL Server for DNS propagation" $Blue
            $checkResults += @{Name="DNS Resolution"; Status="FAIL"}
            $allChecksPassed = $false
        }
    } catch {
        Write-ColorOutput "   FAIL: DNS resolution failed" $Red
        Write-ColorOutput "   FQDN: $sqlFqdn" $Yellow
        Write-ColorOutput "   Error: $($_.Exception.Message)" $Yellow
        Write-ColorOutput "   This usually means the SQL Server doesn't exist" $Yellow
        $checkResults += @{Name="DNS Resolution"; Status="FAIL"}
        $allChecksPassed = $false
    }
} else {
    Write-ColorOutput "   SKIP: DNS check skipped (SQL Server not found)" $Yellow
    $checkResults += @{Name="DNS Resolution"; Status="SKIP"}
}

Write-ColorOutput ""

# Check 4: Firewall rules
Write-ColorOutput "Check 4: Firewall rules" $Blue
Write-ColorOutput "---------------------------------------------------" $Blue

$allowAzureIps = $false
if ($sqlServer) {
    $firewallOutput = az sql server firewall-rule list --server $SqlServerName --resource-group $ResourceGroup --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        try {
            $firewallRules = $firewallOutput | ConvertFrom-Json
            $hasRules = $false
            
            if ($firewallRules -and $firewallRules.Count -gt 0) {
                $hasRules = $true
                foreach ($rule in $firewallRules) {
                    if ($rule.name -eq "AllowAllWindowsAzureIps" -or 
                        ($rule.startIpAddress -eq "0.0.0.0" -and $rule.endIpAddress -eq "0.0.0.0")) {
                        $allowAzureIps = $true
                        Write-ColorOutput "   PASS: Azure services allowed" $Green
                        Write-ColorOutput "   Rule: $($rule.name)" $Green
                        Write-ColorOutput "   IP Range: $($rule.startIpAddress) - $($rule.endIpAddress)" $Green
                        $checkResults += @{Name="Firewall Rules"; Status="PASS"}
                        break
                    }
                }
            }
            
            if (-not $allowAzureIps) {
                if ($hasRules) {
                    Write-ColorOutput "   FAIL: Azure services not allowed" $Red
                    Write-ColorOutput "   Found $($firewallRules.Count) firewall rule(s) but none allow Azure services" $Yellow
                } else {
                    Write-ColorOutput "   FAIL: No firewall rules found" $Red
                }
                Write-ColorOutput "   This is required for Container Apps to connect" $Yellow
                Write-ColorOutput "   Add rule: az sql server firewall-rule create --server $SqlServerName --resource-group $ResourceGroup --name AllowAllWindowsAzureIps --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0" $Blue
                $checkResults += @{Name="Firewall Rules"; Status="FAIL"}
                $allChecksPassed = $false
            }
        } catch {
            Write-ColorOutput "   WARN: Could not parse firewall rules output" $Yellow
            Write-ColorOutput "   Error: $($_.Exception.Message)" $Yellow
            $checkResults += @{Name="Firewall Rules"; Status="WARN"}
        }
    } else {
        Write-ColorOutput "   WARN: Could not retrieve firewall rules" $Yellow
        Write-ColorOutput "   Error details: $firewallOutput" $Yellow
        $checkResults += @{Name="Firewall Rules"; Status="WARN"}
    }
} else {
    Write-ColorOutput "   SKIP: Firewall check skipped (SQL Server not found)" $Yellow
    $checkResults += @{Name="Firewall Rules"; Status="SKIP"}
}

Write-ColorOutput ""

# Check 5: Network connectivity
Write-ColorOutput "Check 5: Network connectivity" $Blue
Write-ColorOutput "---------------------------------------------------" $Blue

if ($sqlFqdn) {
    try {
        $testConnection = Test-NetConnection -ComputerName $sqlFqdn -Port 1433 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue 2>&1
        if ($testConnection -and $testConnection.TcpTestSucceeded -eq $true) {
            Write-ColorOutput "   PASS: Network connectivity successful" $Green
            Write-ColorOutput "   Port 1433: Open" $Green
            Write-ColorOutput "   TcpTestSucceeded: $($testConnection.TcpTestSucceeded)" $Green
            $checkResults += @{Name="Network Connectivity"; Status="PASS"}
        } else {
            Write-ColorOutput "   WARN: Network connectivity failed (port 1433)" $Yellow
            Write-ColorOutput "   TcpTestSucceeded: $($testConnection.TcpTestSucceeded)" $Yellow
            Write-ColorOutput "   This is expected if your local IP is not in firewall rules" $Yellow
            Write-ColorOutput "   Container Apps use Azure service IPs, not your local IP" $Blue
            Write-ColorOutput "   Verify firewall rules allow Azure services (Check 4)" $Blue
            $checkResults += @{Name="Network Connectivity"; Status="WARN"}
        }
    } catch {
        Write-ColorOutput "   WARN: Could not test network connectivity" $Yellow
        Write-ColorOutput "   Error: $($_.Exception.Message)" $Yellow
        Write-ColorOutput "   This is expected if your IP is not in firewall rules" $Yellow
        $checkResults += @{Name="Network Connectivity"; Status="WARN"}
    }
} else {
    Write-ColorOutput "   SKIP: Network connectivity check skipped (no FQDN available)" $Yellow
    $checkResults += @{Name="Network Connectivity"; Status="SKIP"}
}

Write-ColorOutput ""

# Check 6: Database existence
Write-ColorOutput "Check 6: Database existence" $Blue
Write-ColorOutput "---------------------------------------------------" $Blue

if ($sqlServer) {
    $dbOutput = az sql db show --name wealtharena_db --server $SqlServerName --resource-group $ResourceGroup --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        try {
            $db = $dbOutput | ConvertFrom-Json
            if ($db -and $db.name) {
                Write-ColorOutput "   PASS: Database exists: wealtharena_db" $Green
                Write-ColorOutput "   Status: $($db.status)" $Green
                Write-ColorOutput "   Service Objective: $($db.currentServiceObjectiveName)" $Green
                $checkResults += @{Name="Database"; Status="PASS"}
            } else {
                Write-ColorOutput "   FAIL: Database not found: wealtharena_db" $Red
                Write-ColorOutput "   Create with: az sql db create --name wealtharena_db --server $SqlServerName --resource-group $ResourceGroup --service-objective S0" $Blue
                $checkResults += @{Name="Database"; Status="FAIL"}
                $allChecksPassed = $false
            }
        } catch {
            Write-ColorOutput "   FAIL: Could not parse database output" $Red
            Write-ColorOutput "   Error details: $dbOutput" $Yellow
            $checkResults += @{Name="Database"; Status="FAIL"}
            $allChecksPassed = $false
        }
    } else {
        Write-ColorOutput "   FAIL: Database not found: wealtharena_db" $Red
        Write-ColorOutput "   Create with: az sql db create --name wealtharena_db --server $SqlServerName --resource-group $ResourceGroup --service-objective S0" $Blue
        if ($dbOutput) {
            Write-ColorOutput "   Error details: $dbOutput" $Yellow
        }
        $checkResults += @{Name="Database"; Status="FAIL"}
        $allChecksPassed = $false
    }
} else {
    Write-ColorOutput "   SKIP: Database check skipped (SQL Server not found)" $Yellow
    $checkResults += @{Name="Database"; Status="SKIP"}
}

Write-ColorOutput ""

# Summary
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput "Diagnostic Summary" $Cyan
Write-ColorOutput "========================================" $Cyan
Write-ColorOutput ""

foreach ($result in $checkResults) {
    $status = $result.Status
    $name = $result.Name
    $color = switch ($status) {
        "PASS" { $Green }
        "FAIL" { $Red }
        "WARN" { $Yellow }
        default { "White" }
    }
    Write-ColorOutput "  $status : $name" $color
}

Write-ColorOutput ""

if ($allChecksPassed) {
    Write-ColorOutput "Overall Status: PASS" $Green
    Write-ColorOutput ""
    Write-ColorOutput "Database connectivity should be working." $Green
    Write-ColorOutput "If you're still seeing 'getaddrinfo ENOTFOUND' errors:" $Yellow
    Write-ColorOutput "  1. Wait a few minutes for DNS propagation" $Blue
    Write-ColorOutput "  2. Check Container App logs: az containerapp logs show --name wealtharena-backend --resource-group $ResourceGroup --follow" $Blue
    Write-ColorOutput "  3. Verify firewall rules allow Azure services" $Blue
    exit 0
} else {
    Write-ColorOutput "Overall Status: FAIL" $Red
    Write-ColorOutput ""
    Write-ColorOutput "Remediation steps:" $Cyan
    
    if (-not $sqlServer) {
        Write-ColorOutput ""
        Write-ColorOutput "1. Create SQL Server:" $Blue
        Write-ColorOutput "   az sql server create --name $SqlServerName --resource-group $ResourceGroup --location <location> --admin-user wealtharena_admin --admin-password <password>" $Blue
    }
    
    if ($sqlServer -and -not $allowAzureIps) {
        Write-ColorOutput ""
        Write-ColorOutput "2. Add firewall rule for Azure services:" $Blue
        Write-ColorOutput "   az sql server firewall-rule create --server $SqlServerName --resource-group $ResourceGroup --name AllowAllWindowsAzureIps --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0" $Blue
    }
    
    $dbCheck = $checkResults | Where-Object { $_.Name -eq "Database" }
    if ($dbCheck -and $dbCheck.Status -eq "FAIL") {
        Write-ColorOutput ""
        Write-ColorOutput "3. Create database:" $Blue
        Write-ColorOutput "   az sql db create --name wealtharena_db --server $SqlServerName --resource-group $ResourceGroup --service-objective S0" $Blue
    }
    
    Write-ColorOutput ""
    Write-ColorOutput "Or run infrastructure setup: setup_master.ps1 (Phase 6)" $Blue
    Write-ColorOutput ""
    Write-ColorOutput "See TROUBLESHOOTING_PHASE7.md for detailed guidance." $Yellow
    exit 1
}
