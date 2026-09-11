# ============================================================================
# File: start-local.ps1
# Purpose:
#   Starts the complete PriceWatch local development stack and forces the AI
#   Advisor to use local Ollama/Qwen3-8B. No Google Cloud Run authentication or
#   Cloud Run endpoint is used by this script.
#
# Main functions:
#   - Verifies Node/npm/.NET/Python/Ollama prerequisites.
#   - Installs frontend, scraper and local-AI dependencies only when inputs change.
#   - Ensures Ollama is reachable and qwen3:8b is installed.
#   - Starts Local AI (127.0.0.1:8000), ASP.NET Core (localhost:5074) and Vite.
#   - Optionally runs the scraper once before application startup.
#
# Inputs:
#   -RunScraper: run backend/python/webscraping.py once before starting services.
#   -AiModel: Ollama model name; defaults to qwen3:8b.
#
# Outputs:
#   Separate PowerShell windows for Local AI, ASP.NET Core and Vite. React uses
#   /api -> ASP.NET Core -> Local AI -> Ollama.
# ============================================================================

param(
    [switch]$RunScraper,
    [string]$AiModel = "qwen3:8b"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$FrontendDir = $ProjectRoot

$BackendRoot = Join-Path $ProjectRoot "backend"
$BackendProject = Join-Path $BackendRoot "PriceWatch.Api"
$PythonDir = Join-Path $BackendRoot "python"
$AiDir = Join-Path $BackendRoot "ai"

$VenvDir = Join-Path $ProjectRoot ".venv"
$AiVenvDir = Join-Path $AiDir ".venv"
$SetupDir = Join-Path $ProjectRoot ".setup"

$LocalAiUrl = "http://127.0.0.1:8000"
$OllamaUrl = "http://127.0.0.1:11434"
$BackendUrl = "http://localhost:5074"
$FrontendUrl = "http://localhost:5173"


# ============================================================
# Helpers
# ============================================================

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Require-Command($name, $installHint) {
    if (Get-Command $name -ErrorAction SilentlyContinue) { return }

    Write-Host "Missing required command: $name" -ForegroundColor Red
    Write-Host $installHint -ForegroundColor Yellow
    exit 1
}

function Get-FileHashValue($path) {
    if (-not (Test-Path $path)) { return "" }
    return (Get-FileHash $path -Algorithm SHA256).Hash
}

function Test-HashChanged($sourceFile, $markerFile) {
    if (-not (Test-Path $sourceFile)) { return $false }
    if (-not (Test-Path $markerFile)) { return $true }

    return (Get-FileHashValue $sourceFile) -ne (Get-Content $markerFile -Raw).Trim()
}

function Save-Hash($sourceFile, $markerFile) {
    Set-Content `
        -Path $markerFile `
        -Value (Get-FileHashValue $sourceFile) `
        -Encoding utf8
}

function Test-HttpOk($url) {
    try {
        $response = Invoke-WebRequest `
            -Uri $url `
            -UseBasicParsing `
            -TimeoutSec 2 `
            -ErrorAction Stop

        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
    }
    catch {
        return $false
    }
}

function Wait-ForHttp($url, $name, $attempts = 30) {
    for ($i = 1; $i -le $attempts; $i++) {
        if (Test-HttpOk $url) {
            Write-Host "$name is ready." -ForegroundColor Green
            return
        }

        Start-Sleep -Seconds 1
    }

    throw "$name did not become ready: $url"
}


# ============================================================
# Required tools
# ============================================================

Write-Step "Checking local development tools"

Require-Command "node" "Install Node.js, then run this script again."
Require-Command "npm" "Install npm / Node.js, then run this script again."
Require-Command "dotnet" "Install the .NET 10 SDK, then run this script again."
Require-Command "python" "Install Python 3.11+, then run this script again."
Require-Command "ollama" "Install Ollama, then run this script again."

New-Item -ItemType Directory -Force -Path $SetupDir | Out-Null
Write-Host "Required tools found." -ForegroundColor Green


# ============================================================
# Validate directories
# ============================================================

foreach ($path in @($BackendRoot, $BackendProject, $PythonDir, $AiDir)) {
    if (-not (Test-Path $path)) {
        throw "Required directory not found: $path"
    }
}

$AiEntry = Join-Path $AiDir "main.py"
if (-not (Test-Path $AiEntry)) {
    throw "AI entry point not found: $AiEntry"
}


# ============================================================
# Frontend dependencies
# ============================================================

$PackageJson = Join-Path $FrontendDir "package.json"
$PackageLock = Join-Path $FrontendDir "package-lock.json"
$NodeModules = Join-Path $FrontendDir "node_modules"
$NpmMarker = Join-Path $SetupDir "npm.hash"
$NpmSource = if (Test-Path $PackageLock) { $PackageLock } else { $PackageJson }

if (-not (Test-Path $PackageJson)) {
    throw "package.json not found: $PackageJson"
}

if (
    -not (Test-Path $NodeModules) -or
    (Test-HashChanged $NpmSource $NpmMarker)
) {
    Write-Step "Installing frontend dependencies"
    Push-Location $FrontendDir

    try {
        if (Test-Path $PackageLock) {
            npm ci
        }
        else {
            npm install
        }

        if ($LASTEXITCODE -ne 0) {
            throw "npm dependency installation failed."
        }

        Save-Hash $NpmSource $NpmMarker
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "Frontend dependencies already installed. Skipping." -ForegroundColor DarkGray
}


# ============================================================
# Scraper Python environment
# ============================================================

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Step "Creating scraper Python virtual environment"
    python -m venv $VenvDir

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create scraper Python virtual environment."
    }
}

$Requirements = Join-Path $PythonDir "requirements.txt"
$PythonMarker = Join-Path $SetupDir "scraper-requirements.hash"

if (Test-Path $Requirements) {
    if (Test-HashChanged $Requirements $PythonMarker) {
        Write-Step "Installing scraper Python dependencies"
        & $VenvPython -m pip install --upgrade pip
        & $VenvPython -m pip install -r $Requirements

        if ($LASTEXITCODE -ne 0) {
            throw "Scraper Python dependency installation failed."
        }

        & $VenvPython -m playwright install firefox

        if ($LASTEXITCODE -ne 0) {
            throw "Playwright Firefox installation failed."
        }

        Save-Hash $Requirements $PythonMarker
    }
    else {
        Write-Host "Scraper Python dependencies already installed. Skipping." -ForegroundColor DarkGray
    }
}


# ============================================================
# Local AI Python environment
# ============================================================

$AiPython = Join-Path $AiVenvDir "Scripts\python.exe"
$AiRequirements = Join-Path $AiDir "requirements-local.txt"
$AiMarker = Join-Path $SetupDir "ai-local-requirements.hash"

if (-not (Test-Path $AiRequirements)) {
    throw "Local AI requirements not found: $AiRequirements"
}

if (-not (Test-Path $AiPython)) {
    Write-Step "Creating Local AI Python virtual environment"
    python -m venv $AiVenvDir

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create Local AI Python virtual environment."
    }
}

if (Test-HashChanged $AiRequirements $AiMarker) {
    Write-Step "Installing Local AI dependencies"
    & $AiPython -m pip install --upgrade pip
    & $AiPython -m pip install -r $AiRequirements

    if ($LASTEXITCODE -ne 0) {
        throw "Local AI dependency installation failed."
    }

    Save-Hash $AiRequirements $AiMarker
}
else {
    Write-Host "Local AI dependencies already installed. Skipping." -ForegroundColor DarkGray
}

& $AiPython -c "import fastapi, httpx, pydantic, pydantic_settings, uvicorn"
if ($LASTEXITCODE -ne 0) {
    throw "Local AI environment is incomplete."
}


# ============================================================
# Ollama
# ============================================================

Write-Step "Checking Ollama"

if (-not (Test-HttpOk "$OllamaUrl/api/tags")) {
    Write-Host "Ollama server is not running. Starting ollama serve..." -ForegroundColor Yellow
    Start-Process powershell `
        -ArgumentList "-NoExit", "-Command", "ollama serve"

    Wait-ForHttp "$OllamaUrl/api/tags" "Ollama"
}
else {
    Write-Host "Ollama is already running." -ForegroundColor DarkGray
}

$ModelInstalled = ollama list | Select-String -SimpleMatch $AiModel
if (-not $ModelInstalled) {
    Write-Host ""
    Write-Host "Local AI model is not installed: $AiModel" -ForegroundColor Red
    Write-Host "Install it with:" -ForegroundColor Yellow
    Write-Host "  ollama pull $AiModel" -ForegroundColor Yellow
    exit 1
}

Write-Host "Local AI model found: $AiModel" -ForegroundColor Green


# ============================================================
# ASP.NET Core restore
# ============================================================

$ProjectFile = Get-ChildItem $BackendProject -Filter "*.csproj" | Select-Object -First 1

if ($null -eq $ProjectFile) {
    throw "No .csproj file found in $BackendProject"
}

$ProjectAssets = Join-Path $BackendProject "obj\project.assets.json"
$DotnetMarker = Join-Path $SetupDir "dotnet.hash"

if (
    -not (Test-Path $ProjectAssets) -or
    (Test-HashChanged $ProjectFile.FullName $DotnetMarker)
) {
    Write-Step "Restoring ASP.NET Core dependencies"
    dotnet restore $ProjectFile.FullName

    if ($LASTEXITCODE -ne 0) {
        throw "dotnet restore failed."
    }

    Save-Hash $ProjectFile.FullName $DotnetMarker
}
else {
    Write-Host ".NET dependencies already restored. Skipping." -ForegroundColor DarkGray
}


# ============================================================
# Optional scraper run
# ============================================================

if ($RunScraper) {
    Write-Step "Running scraper once"

    $ScraperEntry = Join-Path $PythonDir "webscraping.py"
    if (-not (Test-Path $ScraperEntry)) {
        throw "Scraper entry point not found: $ScraperEntry"
    }

    Push-Location $PythonDir
    try {
        & $VenvPython $ScraperEntry
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Scraper finished with exit code $LASTEXITCODE." -ForegroundColor Yellow
        }
    }
    finally {
        Pop-Location
    }
}


# ============================================================
# Start Local AI (forced local provider)
# ============================================================

Write-Step "Starting Local AI (Ollama / $AiModel)"

$AiCommand = @"
`$env:PRICEWATCH_AI_PROVIDER = 'local'
`$env:PRICEWATCH_AI_LOCAL_MODEL = '$AiModel'
`$env:PRICEWATCH_AI_LOCAL_URL = '$OllamaUrl/api/chat'
& '$AiPython' -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
"@

Start-Process powershell `
    -WorkingDirectory $AiDir `
    -ArgumentList "-NoExit", "-Command", $AiCommand

Wait-ForHttp "$LocalAiUrl/health" "Local AI"


# ============================================================
# Start ASP.NET Core (forced to Local AI)
# ============================================================

Write-Step "Starting ASP.NET Core API"

$BackendCommand = @"
`$env:ASPNETCORE_URLS = '$BackendUrl'
`$env:Ai__BaseUrl = '$LocalAiUrl/'
dotnet run --project '$($ProjectFile.FullName)' --no-launch-profile
"@

Start-Process powershell `
    -WorkingDirectory $BackendRoot `
    -ArgumentList "-NoExit", "-Command", $BackendCommand

Wait-ForHttp "$BackendUrl/api/health" "ASP.NET Core"


# ============================================================
# Start Vite
# ============================================================

Write-Step "Starting Vite frontend"

Start-Process powershell `
    -WorkingDirectory $FrontendDir `
    -ArgumentList "-NoExit", "-Command", "npm run dev"


# ============================================================
# Done
# ============================================================

Write-Host ""
Write-Host "PriceWatch LOCAL stack started." -ForegroundColor Green
Write-Host ""

Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  React:          $FrontendUrl"
Write-Host "  ASP.NET Core:   $BackendUrl"
Write-Host "  Local AI:       $LocalAiUrl"
Write-Host "  Ollama:         $OllamaUrl"
Write-Host "  Model:          $AiModel"
Write-Host ""

Write-Host "Local AI path:" -ForegroundColor Cyan
Write-Host "  React"
Write-Host "    -> /api/ai/recommend"
Write-Host "    -> ASP.NET Core"
Write-Host "    -> $LocalAiUrl/recommend"
Write-Host "    -> Ollama $AiModel"
Write-Host ""

Write-Host "Open in browser:" -ForegroundColor Cyan
Write-Host "  $FrontendUrl"
Write-Host "  Then open the AI Advisor tab and run a product test."
Write-Host ""

Write-Host "Normal local start:"
Write-Host "  .\start-local.ps1"
Write-Host ""

Write-Host "Run scraper once first:"
Write-Host "  .\start-local.ps1 -RunScraper"
Write-Host ""
