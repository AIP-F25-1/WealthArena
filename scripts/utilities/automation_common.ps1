#Requires -Version 5.1

<#
.SYNOPSIS
    Common automation functions shared across automation scripts
    
.DESCRIPTION
    Provides shared utility functions for WealthArena automation scripts,
    including service URL resolution.
#>

function Resolve-ServiceUrls {
    param(
        [string]$ResourceGroup,
        [hashtable]$DeploymentConfig
    )
    
    $urls = @{}
    
    try {
        # Check if deployment mode is Container Apps (from config or by detecting container apps)
        $deploymentMode = $DeploymentConfig.Mode
        if (-not $deploymentMode) {
            # Try to detect by checking for container apps in resource group
            $containerApps = az containerapp list --resource-group $ResourceGroup --query "[].name" -o tsv 2>&1
            if ($containerApps -and -not $containerApps.StartsWith("az:") -and -not $containerApps.StartsWith("ERROR")) {
                $deploymentMode = "ContainerApps"
            }
        }
        
        # Use canonical config keys (BackendAppName, ChatbotAppName, RLServiceAppName)
        # These are normalized by Normalize-Config function
        $backendAppName = $DeploymentConfig.BackendAppName
        if (-not $backendAppName) {
            # Fallback for backward compatibility
            $backendAppName = $DeploymentConfig.backend_app_name
        }
        
        if ($backendAppName) {
            try {
                # If deploying Container Apps, query Container App FQDN
                if ($deploymentMode -eq "ContainerApps") {
                    $backendFqdn = az containerapp show --name $backendAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
                    if ($backendFqdn -and -not $backendFqdn.StartsWith("az:") -and -not $backendFqdn.StartsWith("ERROR")) {
                        $urls.Backend = "https://$backendFqdn"
                    }
                    else {
                        # Fallback to App Service format if Container App not found
                        $backendHost = az webapp show --name $backendAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                        if ($backendHost -and -not $backendHost.StartsWith("az:") -and -not $backendHost.StartsWith("ERROR")) {
                            $urls.Backend = "https://$backendHost"
                        }
                        else {
                            $urls.Backend = "https://$backendAppName.azurewebsites.net"
                        }
                    }
                }
                else {
                    # Deploying as App Service
                    $backendHost = az webapp show --name $backendAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                    if ($backendHost -and -not $backendHost.StartsWith("az:") -and -not $backendHost.StartsWith("ERROR")) {
                        $urls.Backend = "https://$backendHost"
                    }
                    else {
                        # Fallback to building from config
                        $urls.Backend = "https://$backendAppName.azurewebsites.net"
                    }
                }
            }
            catch {
                # Fallback to building from config
                $urls.Backend = "https://$backendAppName.azurewebsites.net"
            }
        }
        
        # Use canonical config keys
        $chatbotAppName = $DeploymentConfig.ChatbotAppName
        if (-not $chatbotAppName) {
            # Fallback for backward compatibility
            $chatbotAppName = $DeploymentConfig.chatbot_app_name
        }
        
        if ($chatbotAppName) {
            try {
                # If deploying Container Apps, query Container App FQDN
                if ($deploymentMode -eq "ContainerApps") {
                    $chatbotFqdn = az containerapp show --name $chatbotAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
                    if ($chatbotFqdn -and -not $chatbotFqdn.StartsWith("az:") -and -not $chatbotFqdn.StartsWith("ERROR")) {
                        $urls.Chatbot = "https://$chatbotFqdn"
                    }
                    else {
                        # Fallback to App Service format if Container App not found
                        $chatbotHost = az webapp show --name $chatbotAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                        if ($chatbotHost -and -not $chatbotHost.StartsWith("az:") -and -not $chatbotHost.StartsWith("ERROR")) {
                            $urls.Chatbot = "https://$chatbotHost"
                        }
                        else {
                            $urls.Chatbot = "https://$chatbotAppName.azurewebsites.net"
                        }
                    }
                }
                else {
                    # Deploying as App Service
                    $chatbotHost = az webapp show --name $chatbotAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                    if ($chatbotHost -and -not $chatbotHost.StartsWith("az:") -and -not $chatbotHost.StartsWith("ERROR")) {
                        $urls.Chatbot = "https://$chatbotHost"
                    }
                    else {
                        $urls.Chatbot = "https://$chatbotAppName.azurewebsites.net"
                    }
                }
            }
            catch {
                $urls.Chatbot = "https://$chatbotAppName.azurewebsites.net"
            }
        }
        
        # Use canonical config keys
        $rlServiceAppName = $DeploymentConfig.RLServiceAppName
        if (-not $rlServiceAppName) {
            # Fallback for backward compatibility
            $rlServiceAppName = $DeploymentConfig.rl_service_app_name
        }
        
        if ($rlServiceAppName) {
            try {
                # If deploying Container Apps, query Container App FQDN
                if ($deploymentMode -eq "ContainerApps") {
                    $rlFqdn = az containerapp show --name $rlServiceAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv 2>&1
                    if ($rlFqdn -and -not $rlFqdn.StartsWith("az:") -and -not $rlFqdn.StartsWith("ERROR")) {
                        $urls.RLService = "https://$rlFqdn"
                    }
                    else {
                        # Fallback to App Service format if Container App not found
                        $rlHost = az webapp show --name $rlServiceAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                        if ($rlHost -and -not $rlHost.StartsWith("az:") -and -not $rlHost.StartsWith("ERROR")) {
                            $urls.RLService = "https://$rlHost"
                        }
                        else {
                            $urls.RLService = "https://$rlServiceAppName.azurewebsites.net"
                        }
                    }
                }
                else {
                    # Deploying as App Service
                    $rlHost = az webapp show --name $rlServiceAppName --resource-group $ResourceGroup --query defaultHostName -o tsv 2>&1
                    if ($rlHost -and -not $rlHost.StartsWith("az:") -and -not $rlHost.StartsWith("ERROR")) {
                        $urls.RLService = "https://$rlHost"
                    }
                    else {
                        $urls.RLService = "https://$rlServiceAppName.azurewebsites.net"
                    }
                }
            }
            catch {
                $urls.RLService = "https://$rlServiceAppName.azurewebsites.net"
            }
        }
    }
    catch {
        # Error resolving service URLs - will use fallbacks
    }
    
    return $urls
}

function Get-FirewallGuidanceMessage {
    param(
        [string]$ResourceGroup = "",
        [string]$ServerName = "",
        [hashtable]$Config = $null
    )

    # Use config values if parameters not provided
    if ([string]::IsNullOrEmpty($ResourceGroup) -and $null -ne $Config -and $null -ne $Config.Azure -and $null -ne $Config.Azure.ResourceGroup) {
        $ResourceGroup = $Config.Azure.ResourceGroup
    }
    if ([string]::IsNullOrEmpty($ServerName) -and $null -ne $Config -and $null -ne $Config.Deployment -and $null -ne $Config.Deployment.sql_server) {
        $ServerName = $Config.Deployment.sql_server
    }
    
    # Fallback to default values if still empty
    if ([string]::IsNullOrEmpty($ResourceGroup)) {
        $ResourceGroup = "rg-wealtharena-northcentralus"
    }
    if ([string]::IsNullOrEmpty($ServerName)) {
        $ServerName = "sql-wealtharena-jg1ve2"
    }

    return "You may need to add your IP address to Azure SQL firewall rules.`n`nGet your public IP: curl ifconfig.me`n`nAdd firewall rule via Azure CLI:`n  az sql server firewall-rule create --resource-group $ResourceGroup --server $ServerName --name AllowMyIP --start-ip-address YOUR_IP --end-ip-address YOUR_IP`n`nOr use Azure Portal: https://portal.azure.com → SQL Databases → Your Database → Networking`n`nAfter fixing, press Y to retry."
}

function Show-FirewallGuidance {
    param(
        [string]$ResourceGroup = "",
        [string]$ServerName = "",
        [hashtable]$Config = $null
    )

    # Use config values if parameters not provided
    if ([string]::IsNullOrEmpty($ResourceGroup) -and $null -ne $Config -and $null -ne $Config.Azure -and $null -ne $Config.Azure.ResourceGroup) {
        $ResourceGroup = $Config.Azure.ResourceGroup
    }
    if ([string]::IsNullOrEmpty($ServerName) -and $null -ne $Config -and $null -ne $Config.Deployment -and $null -ne $Config.Deployment.sql_server) {
        $ServerName = $Config.Deployment.sql_server
    }
    
    # Fallback to default values if still empty
    if ([string]::IsNullOrEmpty($ResourceGroup)) {
        $ResourceGroup = "rg-wealtharena-northcentralus"
    }
    if ([string]::IsNullOrEmpty($ServerName)) {
        $ServerName = "sql-wealtharena-jg1ve2"
    }

    Write-Host ""
    Write-Host "To fix Azure SQL firewall issues, you can:" -ForegroundColor Yellow
    Write-Host "  1. Get your public IP: curl ifconfig.me" -ForegroundColor Yellow
    Write-Host "  2. Add firewall rule via Azure CLI:" -ForegroundColor Yellow
    Write-Host "     az sql server firewall-rule create --resource-group $ResourceGroup --server $ServerName --name AllowMyIP --start-ip-address YOUR_IP --end-ip-address YOUR_IP" -ForegroundColor Yellow
    Write-Host "  3. Or use Azure Portal: https://portal.azure.com → SQL Databases → Your Database → Networking" -ForegroundColor Yellow
    Write-Host ""
}

