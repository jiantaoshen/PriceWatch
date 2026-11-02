param(
    [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')]
    [string]$At = '09:00',
    [string]$PythonPath = ''
)
# One-time installer: daily Task Scheduler job, also triggered by the site's Run now.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$launcher = Join-Path $PSScriptRoot 'run-scraper.ps1'
$dbPath = Join-Path $root 'data\pricewatch.sqlite3'
if (-not (Test-Path -LiteralPath $dbPath -PathType Leaf)) {
    throw "SQLite database not found: $dbPath"
}
if (-not $PythonPath) {
    $venv = Join-Path $root '.venv\Scripts\python.exe'
    if (Test-Path -LiteralPath $venv -PathType Leaf) {
        $PythonPath = $venv
    }
    else {
        $PythonPath = (Get-Command python.exe -ErrorAction Stop).Source
    }
}
$PythonPath = (Resolve-Path -LiteralPath $PythonPath).Path
$check = & $PythonPath -c 'import sqlite3, playwright; print("Python dependencies OK")'
if ($LASTEXITCODE -ne 0) { throw 'Chosen Python cannot import Playwright' }
$powerShell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$args = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -PythonPath "{1}"' -f $launcher, $PythonPath
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $args -WorkingDirectory $root
$time = [datetime]::ParseExact($At, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew `
    -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'PriceWatchLocalScraper' -TaskPath '\' `
    -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
    -Description 'PriceWatch SQLite scraper: independent daily run' -Force | Out-Null
Write-Host "Installed PriceWatchLocalScraper for $user, every day at $At"
Write-Host "Python: $PythonPath"
Write-Host 'Use Schedule > Run now or: Start-ScheduledTask -TaskName PriceWatchLocalScraper'
Write-Host 'This setup runs only while the Windows user is logged in.'
