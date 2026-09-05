param(
    [switch]$RunScraper
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


# ============================================================
# Required tools
# ============================================================

Write-Step "Checking required tools"

Require-Command "node" "Install Node.js, then run this script again."
Require-Command "npm" "Install npm / Node.js, then run this script again."
Require-Command "dotnet" "Install the .NET 10 SDK, then run this script again."
Require-Command "python" "Install Python, then run this script again."

New-Item -ItemType Directory -Force -Path $SetupDir | Out-Null

Write-Host "Required tools found." -ForegroundColor Green


# ============================================================
# Validate directories
# ============================================================

if (-not (Test-Path $BackendRoot)) {
    throw "Backend directory not found: $BackendRoot"
}

if (-not (Test-Path $BackendProject)) {
    throw "ASP.NET Core project directory not found: $BackendProject"
}

if (-not (Test-Path $PythonDir)) {
    throw "Scraper directory not found: $PythonDir"
}

if (-not (Test-Path $AiDir)) {
    throw "AI directory not found: $AiDir"
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
# Scraper Python virtual environment
# ============================================================

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Step "Creating scraper Python virtual environment"

    python -m venv $VenvDir

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create scraper Python virtual environment."
    }
}
else {
    Write-Host "Scraper Python virtual environment already exists. Skipping." -ForegroundColor DarkGray
}


# ============================================================
# Scraper Python dependencies
# ============================================================

$Requirements = Join-Path $PythonDir "requirements.txt"
$PythonMarker = Join-Path $SetupDir "scraper-requirements.hash"

if (Test-Path $Requirements) {
    if (Test-HashChanged $Requirements $PythonMarker) {
        Write-Step "Installing scraper Python dependencies"

        & $VenvPython -m pip install --upgrade pip

        if ($LASTEXITCODE -ne 0) {
            throw "Failed to update scraper pip."
        }

        & $VenvPython -m pip install -r $Requirements

        if ($LASTEXITCODE -ne 0) {
            throw "Scraper Python dependency installation failed."
        }

        Write-Step "Installing Playwright Firefox"

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
else {
    Write-Host "backend\python\requirements.txt not found. Skipping." -ForegroundColor Yellow
}


# ============================================================
# Local AI virtual environment
# ============================================================

$AiPython = Join-Path $AiVenvDir "Scripts\python.exe"
$AiEntry = Join-Path $AiDir "main.py"

if (-not (Test-Path $AiEntry)) {
    throw "AI entry point not found: $AiEntry"
}

if (-not (Test-Path $AiPython)) {
    Write-Step "Creating Local AI Python virtual environment"

    python -m venv $AiVenvDir

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create Local AI Python virtual environment."
    }
}
else {
    Write-Host "Local AI virtual environment already exists. Skipping." -ForegroundColor DarkGray
}


# ============================================================
# Local AI dependencies
# ============================================================

$AiRequirements = Join-Path $AiDir "requirements.txt"
$AiMarker = Join-Path $SetupDir "ai-requirements.hash"

if (Test-Path $AiRequirements) {
    if (Test-HashChanged $AiRequirements $AiMarker) {
        Write-Step "Installing Local AI dependencies"

        & $AiPython -m pip install --upgrade pip

        if ($LASTEXITCODE -ne 0) {
            throw "Failed to update Local AI pip."
        }

        & $AiPython -m pip install -r $AiRequirements

        if ($LASTEXITCODE -ne 0) {
            throw "Local AI dependency installation failed."
        }

        Save-Hash $AiRequirements $AiMarker
    }
    else {
        Write-Host "Local AI dependencies already installed. Skipping." -ForegroundColor DarkGray
    }
}
else {
    Write-Host "backend\ai\requirements.txt not found. Using existing AI environment." -ForegroundColor Yellow
}


# ============================================================
# Verify Local AI
# ============================================================

Write-Step "Checking Local AI environment"

& $AiPython -c "import fastapi, httpx, pydantic, uvicorn"

if ($LASTEXITCODE -ne 0) {
    throw "Local AI dependencies are incomplete. Install fastapi, httpx, pydantic and uvicorn."
}

Write-Host "Local AI environment is ready." -ForegroundColor Green


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
# Start Local AI
# ============================================================

Write-Step "Starting Local AI"

$AiCommand = "& `"$AiPython`" -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

Start-Process powershell `
    -WorkingDirectory $AiDir `
    -ArgumentList "-NoExit", "-Command", $AiCommand


# ============================================================
# Start ASP.NET Core
# ============================================================

Write-Step "Starting ASP.NET Core API"

$BackendCommand = "dotnet run --project `"$($ProjectFile.FullName)`""

Start-Process powershell `
    -WorkingDirectory $BackendRoot `
    -ArgumentList "-NoExit", "-Command", $BackendCommand


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
Write-Host "Price Watch started." -ForegroundColor Green
Write-Host ""

Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  Frontend:       http://localhost:5173"
Write-Host "  Local AI:       http://127.0.0.1:8000"
Write-Host "  Ollama:         http://127.0.0.1:11434"
Write-Host "  ASP.NET Core:   see API PowerShell window"
Write-Host ""

Write-Host "Architecture:" -ForegroundColor Cyan
Write-Host "  React"
Write-Host "    -> ASP.NET Core"
Write-Host "         -> Local AI"
Write-Host "              -> Ollama"
Write-Host "         -> Python Scraper"
Write-Host ""

Write-Host "Normal start:"
Write-Host "  .\start.ps1"
Write-Host ""

Write-Host "Run scraper once before starting:"
Write-Host "  .\start.ps1 -RunScraper"
Write-Host ""