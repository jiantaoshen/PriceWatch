# PriceWatch

PriceWatch is a personal system for product price tracking and subscription expense management.

It combines a cloud web application with a local/private scraping workflow. Products support price tracking, multiple sources, price history, and review of suspicious scrape results, while subscriptions are kept as a simpler recurring-expense model.

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, shadcn/ui
- **API:** ASP.NET Core Web API, .NET 10, C#
- **Database:** PostgreSQL on Neon, EF Core, Npgsql
- **Authentication:** Microsoft Entra / MSAL
- **Scraping:** Python, Playwright
- **Hosting:** Vercel + Google Cloud Run
- **Container Registry:** GitHub Container Registry (GHCR)
- **Frontend architecture:** npm workspaces with shared UI, design system, utilities, and HTTP infrastructure

## Architecture

```text
Cloud
────────────────────────────────────────

web / Next.js / Vercel
        │
        │ HTTPS + Microsoft access token
        ▼
PriceWatch.WebApi / Google Cloud Run
        │
        │ EF Core + Npgsql
        ▼
Neon PostgreSQL


Container delivery
────────────────────────────────────────

GitHub
   │
   ▼
GHCR
   │
   ▼
Google Cloud Run


Local / Private
────────────────────────────────────────

private-web / Next.js
        │
        ▼
PriceWatch.Private
        │
        ├── reads/writes Neon
        │
        └── starts Python
                 │
                 ▼
          Playwright scraper


Shared frontend packages
────────────────────────────────────────

web ───────────────┐
                   ├── packages/design-system
private-web ───────┤── packages/ui
                   ├── packages/shared
                   └── packages/api
```

The cloud and private applications remain separate while sharing common frontend foundations.

## Features

### Products

- Multiple price sources
- Manual, automatic, and hybrid updates
- Normalized unit-price comparison
- Target prices
- Price history
- Archive / restore
- Review of suspicious scraped prices

### Subscriptions

- Name
- Monthly price
- Currency
- Monthly expense total
- Archive / restore

Product and Subscription are intentionally treated as separate domains.

## Local Development

Install .NET 10 and build:

```powershell
winget install Microsoft.DotNet.SDK.10

dotnet restore
dotnet build
```

Configure the Web API:

```powershell
dotnet user-secrets set `
  "ConnectionStrings:Database" `
  "YOUR_NEON_CONNECTION_STRING" `
  --project src/PriceWatch.WebApi

dotnet user-secrets set `
  "Owner:Sub" `
  "YOUR_MICROSOFT_ACCOUNT_SUB" `
  --project src/PriceWatch.WebApi
```

Apply migrations and start the API:

```powershell
dotnet tool install --global dotnet-ef

dotnet ef database update `
  --project src/PriceWatch.Data `
  --startup-project src/PriceWatch.WebApi

dotnet run --project src/PriceWatch.WebApi
```

Create `web/.env.local`:

```env
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=YOUR_WEB_CLIENT_ID
NEXT_PUBLIC_MICROSOFT_TENANT=consumers
NEXT_PUBLIC_API_SCOPE=api://YOUR_API_CLIENT_ID/access_as_user
NEXT_PUBLIC_API_URL=http://localhost:YOUR_API_PORT
NEXT_PUBLIC_MICROSOFT_REDIRECT_URI=http://localhost:3000/redirect
```

Install frontend dependencies from the repository root:

```powershell
npm install
npm run dev:web
```

## Local Scraper Workflow

```powershell
py install 3.13
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install -r scraper\requirements.txt
python -m playwright install firefox
```

Configure and start `PriceWatch.Private`:

```powershell
dotnet user-secrets set `
  "ConnectionStrings:Database" `
  "YOUR_NEON_CONNECTION_STRING" `
  --project src/PriceWatch.Private

dotnet user-secrets set `
  "Private:PythonExecutable" `
  "$PWD\.venv\Scripts\python.exe" `
  --project src/PriceWatch.Private

dotnet run --project src/PriceWatch.Private
npm run dev:private
```

## Production

The Web API is containerized and published to:

```text
ghcr.io/jiantaoshen/pricewatch-webapi
```

The container runs on Google Cloud Run.

Production secrets such as the Neon connection string and owner identity are stored in Google Secret Manager and injected into Cloud Run at runtime.

The frontend is deployed on Vercel and uses the Cloud Run service URL through:

```text
NEXT_PUBLIC_API_URL
```

PriceWatch currently uses a single Neon production database across the cloud application and local scraper workflow.

Automated scraping should only be used where permitted by the target site's terms, access rules, and applicable law.
