param(
    [Parameter(Mandatory = $true)]
    [string]$ZipPath,

    [switch]$Apply
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root

try {
    $mode = if ($Apply) { "--apply" } else { "--dry-run" }

    Write-Host ""
    Write-Host "PriceWatch legacy -> Neon importer" -ForegroundColor Cyan
    Write-Host "Zip : $ZipPath"
    Write-Host "Mode: $mode"
    Write-Host ""

    dotnet run `
        --project tools/PriceWatch.Migrator `
        -- `
        --zip $ZipPath `
        $mode

    if ($LASTEXITCODE -ne 0) {
        throw "Importer exited with code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
