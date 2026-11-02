param(
    [Parameter(Mandatory = $true)]
    [string]$PythonPath
)
# Task Scheduler entrypoint: run the working Python crawler and retain its exit code.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dbPath = Join-Path $root 'data\pricewatch.sqlite3'
$scriptPath = Join-Path $root 'scraper\run_once.py'
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$now = Get-Date -Format 'yyyyMMdd-HHmmss'
$outLog = Join-Path $logDir "scrape-$now.stdout.log"
$errLog = Join-Path $logDir "scrape-$now.stderr.log"
$summaryLog = Join-Path $logDir 'scheduler.log'

try {
    if (-not (Test-Path -LiteralPath $PythonPath -PathType Leaf)) {
        throw "Python was not found: $PythonPath"
    }
    if (-not (Test-Path -LiteralPath $dbPath -PathType Leaf)) {
        throw "SQLite database was not found: $dbPath"
    }
    $env:PRICEWATCH_SQLITE_PATH = $dbPath
    $arguments = '"{0}"' -f $scriptPath
    Add-Content -Path $summaryLog -Value "$(Get-Date -Format o) Started"
    $process = Start-Process -FilePath $PythonPath -ArgumentList $arguments `
        -WorkingDirectory $root -PassThru -Wait `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    $code = $process.ExitCode
    Add-Content -Path $summaryLog -Value "$(Get-Date -Format o) Finished exit=$code"
    exit $code
}
catch {
    Add-Content -Path $summaryLog -Value "$(Get-Date -Format o) Error: $($_.Exception.Message)"
    exit 2
}
