
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$env:PriceWatch__SqlitePath = Join-Path $projectRoot "data\pricewatch.sqlite3"

Set-Location $projectRoot

try {
    dotnet run --no-launch-profile `
        --project ".\src\PriceWatch.Private\PriceWatch.Private.csproj" `
        -- --run-once

    exit $LASTEXITCODE
}
finally {
    Remove-Item Env:PriceWatch__SqlitePath -ErrorAction SilentlyContinue
}
