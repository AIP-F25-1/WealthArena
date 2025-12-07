# Define the list of relevant extensions.
$extensions = @(
    '*.ps1',
    '*.js', '*.jsx',
    '*.ts', '*.tsx',
    '*.py',
    '*.sql',
    '*.json',
    '*.yml', '*.yaml',
    '*.env',
    '*.html', '*.css',
    '*.md'
)

# Define the folders to exclude (virtual environments, dependencies—add more if needed).
$excludedFolders = @('node_modules', '.venv', 'venv', '__pycache__')

$totalLines = 0
foreach ($ext in $extensions) {
    Get-ChildItem -Path . -Recurse -Filter $ext -File -ErrorAction SilentlyContinue | Where-Object {
        # Only count if NOT in excluded directories
        $exclude = $false
        foreach ($folder in $excludedFolders) {
            if ($_.FullName -match "\\$folder\\") { $exclude = $true }
        }
        return -not $exclude
    } | ForEach-Object {
        try {
            $lines = (Get-Content $_.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
            $totalLines += $lines
        } catch { }
    }
}

Write-Host "Total lines of YOUR code: $totalLines"