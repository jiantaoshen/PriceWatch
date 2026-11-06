param(
    [Parameter(Mandatory = $true)]
    [string]$PythonPath,
    [string]$DatabasePath = ''
)
# Fixed Task Scheduler entrypoint. Keep independent of the web server and retain exit codes.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (-not $DatabasePath) { $DatabasePath = Join-Path $root 'data\pricewatch.sqlite3' }
if (-not [IO.Path]::IsPathRooted($DatabasePath)) { $DatabasePath = Join-Path $root $DatabasePath }
$dbPath = [IO.Path]::GetFullPath($DatabasePath)
$scriptPath = Join-Path $root 'scraper\run_once.py'
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$now = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
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
    Add-Content -LiteralPath $summaryLog -Value "$(Get-Date -Format o) Started"
    $process = Start-Process -FilePath $PythonPath -ArgumentList $arguments `
        -WorkingDirectory $root -PassThru -Wait `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    $code = $process.ExitCode
    Add-Content -LiteralPath $summaryLog -Value "$(Get-Date -Format o) Finished exit=$code"
    exit $code
} catch {
    Add-Content -LiteralPath $summaryLog -Value "$(Get-Date -Format o) Error: $($_.Exception.Message)"
    exit 2
}
