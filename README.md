# PriceWatch (Updated 2026-10)

PriceWatch is a personal price-tracking system with two execution paths:

- **Web** - public Next.js UI + ASP.NET Core API
- **Private** - local operator UI + private ASP.NET Core API + Playwright scraper

Both paths use the same PostgreSQL database.

## Architecture

```text
web                 private-web
 │                       │
 ▼                       ▼
PriceWatch.WebApi    PriceWatch.Private
 │                       │
 └──────────┬────────────┘
            ▼
      PostgreSQL / Neon
            ▲
            │
     Python + Playwright
```

### Repository layout

```text
src/
  PriceWatch.Core/       Shared application logic
  PriceWatch.Data/       EF Core model and migrations
  PriceWatch.WebApi/     Public API
  PriceWatch.Private/    Local/private API and scraper orchestration

web/                     Public Next.js application
private-web/             Local operator application
packages/                Shared frontend packages
scraper/                 Python / Playwright worker
scripts/dev-stack.mjs    Local stack launcher
```

## Stack

- .NET / ASP.NET Core
- Entity Framework Core + Npgsql
- PostgreSQL / Neon
- Next.js + React + TypeScript
- Python + Playwright
- Microsoft Identity Platform
- Docker / Cloud Run / GitHub Actions

## Local development

### Requirements

- .NET SDK
- Node.js + npm
- Python 3
- Access to a PostgreSQL-compatible database

Install JavaScript dependencies:

```bash
npm ci
```

For the scraper on Windows:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r scraper\requirements.txt
.\.venv\Scripts\python.exe -m playwright install firefox
```

## Configuration

Local development uses a single repository-level `.env.local`.

```powershell
Copy-Item .env.example .env.local
```

Minimum database configuration:

```dotenv
DATABASE_CONNECTION_STRING="Host=<host>;Port=5432;Database=<database>;Username=<user>;Password=<password>;SSL Mode=Require"
```

Use the **Npgsql connection-string format** above. Do not pass the Neon/PostgreSQL URI form (`postgresql://...`) directly to the .NET applications.

The remaining variables are documented in [`.env.example`](.env.example), including:

- frontend/API URLs
- Microsoft authentication
- owner authorization
- private scraper runtime options

`.env.local` is ignored by Git and must never be committed.

## Running the project

### Web stack

Starts `PriceWatch.WebApi` and `web` together:

```bash
npm run dev:web:all
```

Default endpoints:

```text
Web      http://localhost:3000
Web API  http://localhost:5128
```

### Private stack

Starts `PriceWatch.Private` and `private-web` together:

```bash
npm run dev:private:all
```

Default endpoints:

```text
Private Web  http://localhost:3001
Private API  http://127.0.0.1:5188
```

Windows launchers are also available:

```text
dev-web.cmd
dev-private.cmd
```

### Individual processes

```bash
npm run dev:web
npm run dev:web:api

npm run dev:private
npm run dev:private:api
```

The repository launcher loads `.env.local` and maps its values to ASP.NET Core and Next.js configuration. Running a backend directly with `dotnet run` bypasses that launcher.

## Database migrations

Apply migrations using the same `.env.local` configuration:

```bash
npm run db:update
```

EF Core migrations live in `src/PriceWatch.Data`.

## Validation

Frontend:

```bash
npm run lint
npm run build:web
npm run build:private
```

.NET:

```bash
dotnet restore PriceWatch.slnx
dotnet build PriceWatch.slnx -c Release --no-restore
dotnet test PriceWatch.slnx -c Release --no-build
```

Scraper:

```powershell
.\.venv\Scripts\python.exe -m pytest scraper\tests
```

## Deployment

`PriceWatch.WebApi` is containerized with `Dockerfile.webapi` and deployed through GitHub Actions / Cloud Run.

The public and private applications intentionally remain separate: browser automation and operator-only functionality belong to the trusted local path and should not be exposed publicly.

Production secrets must be supplied by the deployment platform, not `.env.local`.

## Security

- Never commit database credentials, tokens, certificates, or `.env.local`.
- Rotate credentials immediately if they appear in logs, screenshots, commits, issues, or chat.
- Keep `PriceWatch.Private` bound to a trusted/local environment.
- Treat scraper output as untrusted external input until validated.
