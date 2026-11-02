# Windows one-command verification: install, inspect a DB copy, test and build.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Run-Checked {
    param([string]$Command, [string[]]$Arguments)
    Write-Host "`n> $Command $($Arguments -join ' ')" -ForegroundColor Cyan
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE"
    }
}

if (-not (Test-Path "data/pricewatch.sqlite3") -and
    -not $env:PRICEWATCH_SQLITE_PATH) {
    throw "Copy your migrated database into data/pricewatch.sqlite3 first."
}

Run-Checked "npm.cmd" @("install")
Run-Checked "python" @("-m", "pip", "install", "-r", "scraper/requirements.txt")
Run-Checked "python" @("-m", "playwright", "install", "firefox")
Run-Checked "npm.cmd" @("run", "check:db")
Run-Checked "npm.cmd" @("run", "smoke:db")
Run-Checked "python" @("-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v")
Run-Checked "python" @("-m", "pytest", "scraper/tests", "-q")
Run-Checked "npm.cmd" @("run", "typecheck")
Run-Checked "npm.cmd" @("run", "build")
Write-Host "`nALL CHECKS PASSED. Start with: npm run dev" -ForegroundColor Green
