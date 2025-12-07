# PowerShell script to run the complete data preparation and training pipeline
# This script ensures all dependencies are installed and runs the full pipeline

param(
    [switch]$SkipJupyterInstall,
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Function to print colored output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Function to check if a command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to run a command and capture output
function Invoke-CommandWithOutput {
    param(
        [string]$Command,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = "."
    )
    
    if ($Verbose) {
        Write-ColorOutput "Running: $Command $($Arguments -join ' ')" "Yellow"
    }
    
    $process = Start-Process -FilePath $Command -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -Wait -PassThru -NoNewWindow -RedirectStandardOutput "temp_output.txt" -RedirectStandardError "temp_error.txt"
    
    $output = Get-Content "temp_output.txt" -Raw
    $error = Get-Content "temp_error.txt" -Raw
    
    # Clean up temp files
    Remove-Item "temp_output.txt" -ErrorAction SilentlyContinue
    Remove-Item "temp_error.txt" -ErrorAction SilentlyContinue
    
    return @{
        ExitCode = $process.ExitCode
        Output = $output
        Error = $error
    }
}

# Main execution
try {
    Write-ColorOutput "===============================================" "Cyan"
    Write-ColorOutput "ONE-BUTTON PIPELINE: Data Export → Training" "Cyan"
    Write-ColorOutput "===============================================" "Cyan"
    Write-ColorOutput ""
    
    # Check if we're in the right directory
    if (-not (Test-Path "scripts\pipeline_prepare_and_train.py")) {
        Write-ColorOutput "ERROR: pipeline_prepare_and_train.py not found!" "Red"
        Write-ColorOutput "Please run this script from the WealthArena root directory." "Red"
        exit 1
    }
    
    # Check Python installation
    Write-ColorOutput "Checking Python installation..." "Yellow"
    if (-not (Test-Command "python")) {
        Write-ColorOutput "ERROR: Python not found in PATH!" "Red"
        Write-ColorOutput "Please install Python 3.11+ and add it to your PATH." "Red"
        exit 1
    }
    
    $pythonVersion = python --version 2>&1
    Write-ColorOutput "Found: $pythonVersion" "Green"
    
    # Check and install Jupyter if needed
    if (-not $SkipJupyterInstall) {
        Write-ColorOutput "Checking Jupyter installation..." "Yellow"
        if (-not (Test-Command "jupyter")) {
            Write-ColorOutput "Jupyter not found. Installing..." "Yellow"
            $result = Invoke-CommandWithOutput "python" @("-m", "pip", "install", "jupyter")
            if ($result.ExitCode -ne 0) {
                Write-ColorOutput "ERROR: Failed to install Jupyter!" "Red"
                Write-ColorOutput "Error output: $($result.Error)" "Red"
                exit 1
            }
            Write-ColorOutput "Jupyter installed successfully!" "Green"
        } else {
            Write-ColorOutput "Jupyter already installed." "Green"
        }
    } else {
        Write-ColorOutput "Skipping Jupyter installation check." "Yellow"
    }
    
    # Run the main pipeline
    Write-ColorOutput "Starting pipeline execution..." "Yellow"
    Write-ColorOutput "This may take several minutes depending on your hardware." "Yellow"
    Write-ColorOutput ""
    
    $result = Invoke-CommandWithOutput "python" @("scripts\pipeline_prepare_and_train.py")
    
    if ($result.ExitCode -eq 0) {
        Write-ColorOutput "Pipeline completed successfully!" "Green"
        Write-ColorOutput ""
        
        # Run data validation
        Write-ColorOutput "Running data validation..." "Yellow"
        $validationResult = Invoke-CommandWithOutput "python" @("scripts\check_data.py")
        
        if ($validationResult.ExitCode -eq 0) {
            Write-ColorOutput "Data validation passed!" "Green"
        } else {
            Write-ColorOutput "WARNING: Data validation failed!" "Yellow"
            Write-ColorOutput "Validation output: $($validationResult.Output)" "Yellow"
            Write-ColorOutput "Validation errors: $($validationResult.Error)" "Yellow"
        }
        
        Write-ColorOutput ""
        Write-ColorOutput "===============================================" "Cyan"
        Write-ColorOutput "PIPELINE COMPLETED SUCCESSFULLY!" "Green"
        Write-ColorOutput "===============================================" "Cyan"
        Write-ColorOutput ""
        Write-ColorOutput "Generated files:" "White"
        Write-ColorOutput "  - data/finance_sentiment_*.csv (dataset files)" "White"
        Write-ColorOutput "  - models/sentiment-finetuned/ (trained model)" "White"
        Write-ColorOutput "  - models/sentiment-finetuned/metrics.json (performance metrics)" "White"
        Write-ColorOutput ""
        Write-ColorOutput "Next steps:" "White"
        Write-ColorOutput "  - Check the metrics.json file for model performance" "White"
        Write-ColorOutput "  - Use the trained model for sentiment analysis" "White"
        Write-ColorOutput "  - Run notebooks/02_finetune_sentiment.ipynb for detailed analysis" "White"
        
    } else {
        Write-ColorOutput "ERROR: Pipeline failed with exit code $($result.ExitCode)" "Red"
        Write-ColorOutput ""
        Write-ColorOutput "Pipeline output:" "Yellow"
        Write-ColorOutput $result.Output "White"
        Write-ColorOutput ""
        Write-ColorOutput "Pipeline errors:" "Yellow"
        Write-ColorOutput $result.Error "Red"
        exit $result.ExitCode
    }
    
} catch {
    Write-ColorOutput "FATAL ERROR: $($_.Exception.Message)" "Red"
    exit 1
}

Write-ColorOutput ""
Write-ColorOutput "Pipeline execution completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "Cyan"

