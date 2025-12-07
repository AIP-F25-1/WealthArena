# ==================================================================================================
# Module: InteractivePrompts.ps1
# Description: Interactive user prompt utilities for WealthArena automation system
# Author: Clifford Addison
# Company: WealthArena
# Year: 2025
# ==================================================================================================

Set-StrictMode -Version Latest

function Show-Instructions {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $Instructions
    )

    Write-Host '============================================================'
    Write-Host $Instructions
    Write-Host '============================================================'
}

function Get-UserConfirmation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $Prompt,
        [ValidateSet('Y','N','Yes','No')][string] $Default = 'Y'
    )

    $response = Read-Host "$Prompt (Y/N) [Default: $Default]"
    if ([string]::IsNullOrWhiteSpace($response)) {
        $response = $Default
    }
    return $response.ToUpper()
}

function Get-UserInput {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $Prompt,
        [switch] $AsSecure,
        [scriptblock] $Validator
    )

    while ($true) {
        $value = if ($AsSecure) {
            $secure = Read-Host -Prompt $Prompt -AsSecureString
            [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
            )
        }
        else {
            Read-Host -Prompt $Prompt
        }

        if (-not $Validator) {
            return $value
        }

        $isValid = & $Validator $value
        if ($isValid) {
            return $value
        }

        Write-Host 'Input validation failed. Please try again.'
    }
}

function Test-APIKeyFormat {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $KeyValue
    )

    return (-not [string]::IsNullOrWhiteSpace($KeyValue)) -and ($KeyValue.Length -ge 8)
}

function Get-APIKeyTemplateMetadata {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $KeyName,
        [Parameter(Mandatory = $true)][string] $EnvTemplatePath
    )

    if (-not (Test-Path $EnvTemplatePath)) {
        return @{
            Comments = @()
            Example  = ''
        }
    }

    $lines = Get-Content -Path $EnvTemplatePath
    $comments = New-Object System.Collections.Generic.List[string]
    $example = ''

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match ("^\s*{0}=" -f [Regex]::Escape($KeyName))) {
            $parts = $line -split '=', 2
            if ($parts.Count -eq 2) {
                $example = $parts[1].Trim()
            }

            $j = $i - 1
            while ($j -ge 0) {
                $prevLine = $lines[$j]
                if ([string]::IsNullOrWhiteSpace($prevLine)) {
                    if ($comments.Count -gt 0) {
                        break
                    }
                    $j--
                    continue
                }

                if ($prevLine.Trim().StartsWith('#')) {
                    $comments.Add(($prevLine.TrimStart('#')).Trim())
                    $j--
                    continue
                }
                break
            }
            break
        }
    }

    if ($comments.Count -gt 0) {
        $comments = $comments | Select-Object -Reverse
    }

    return @{
        Comments = $comments
        Example  = $example
    }
}

function Show-APIKeyPrompt {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $KeyName,
        [Parameter(Mandatory = $true)][string] $Instructions,
        [Parameter(Mandatory = $true)][string] $EnvTemplatePath,
        [Parameter(Mandatory = $true)][string] $EnvFilePath
    )

    $envValue = [Environment]::GetEnvironmentVariable($KeyName)
    if (-not [string]::IsNullOrWhiteSpace($envValue)) {
        Write-Host "Key $KeyName already configured in environment. Skipping."
        return $true
    }

    $templateInfo = Get-APIKeyTemplateMetadata -KeyName $KeyName -EnvTemplatePath $EnvTemplatePath

    $instructionLines = New-Object System.Collections.Generic.List[string]
    $instructionLines.Add("[IMPORTANT] Configure API Key: $KeyName")

    if ($templateInfo.Comments.Count -gt 0) {
        for ($idx = 0; $idx -lt $templateInfo.Comments.Count; $idx++) {
            $instructionLines.Add(("{0}. {1}" -f ($idx + 1), $templateInfo.Comments[$idx]))
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($Instructions)) {
        $instructionLines.Add($Instructions)
    }

    if (-not [string]::IsNullOrWhiteSpace($templateInfo.Example)) {
        $instructionLines.Add(("Example format: {0}={1}" -f $KeyName, $templateInfo.Example))
    }

    Show-Instructions -Instructions ($instructionLines -join [Environment]::NewLine)

    if (-not (Test-Path $EnvFilePath) -and (Test-Path $EnvTemplatePath)) {
        Copy-Item -Path $EnvTemplatePath -Destination $EnvFilePath
    }

    $existing = if (Test-Path $EnvFilePath) {
        (Select-String -Path $EnvFilePath -Pattern ("^{0}=" -f [Regex]::Escape($KeyName))) | Select-Object -First 1
    }

    if ($existing) {
        Write-Host "Key $KeyName already configured. Skipping."
        return $true
    }

    $keyValue = Get-UserInput -Prompt "Enter value for $KeyName" -AsSecure -Validator { Test-APIKeyFormat -KeyValue $_ }
    $confirmation = Get-UserConfirmation -Prompt "Confirm storing key for $KeyName?" -Default 'Y'
    if ($confirmation -notin @('Y','YES')) {
        Write-Host "Skipping storage for $KeyName by user request."
        return $false
    }

    Add-Content -Path $EnvFilePath -Value ("{0}={1}" -f $KeyName, $keyValue)
    Write-Host "Stored $KeyName in .env file."
    return $true
}

function Show-ManualTaskPrompt {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $PromptMessage,
        [string[]] $Options = @('Yes','No','Redo')
    )

    while ($true) {
        $input = Read-Host "$PromptMessage (Options: $($Options -join '/'))"
        if ($Options -contains $input) {
            return $input
        }
        Write-Host 'Invalid selection. Please try again.'
    }
}

function Show-NotebookExecutionPrompt {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $NotebookPath
    )

    $prompt = "Execute notebook $NotebookPath now? (Y)es/(N)o/(S)kip"
    while ($true) {
        $response = Read-Host $prompt
        switch ($response.ToUpper()) {
            'Y' { return 'Yes' }
            'N' { return 'No' }
            'S' { return 'Skip' }
            default { Write-Host 'Invalid response. Please enter Y, N, or S.' }
        }
    }
}

