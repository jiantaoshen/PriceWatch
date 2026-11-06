param(
    [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')]
    [string]$At = '09:00',
    [string]$PythonPath = ''
)
# Backward-compatible command-line installer. The UI invokes manage-scheduler.ps1 directly.
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'manage-scheduler.ps1') -Operation save -At $At -Frequency daily -PythonPath $PythonPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
