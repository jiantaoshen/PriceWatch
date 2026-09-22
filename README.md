# PriceWatch

PriceWatch is a personal price-tracking system for products and subscriptions.

It combines a cloud web application with a local/private scraper workflow. The cloud app manages tracked items, reviews price changes, and displays price history, while the local service runs browser automation and scraper operations.

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, shadcn/ui
- **API:** ASP.NET Core Web API, C#
- **Database:** PostgreSQL on Neon, EF Core, Npgsql
- **Authentication:** Microsoft Entra / MSAL
- **Scraping:** Python, Playwright
- **Hosting:** Vercel + Azure App Service
- **Frontend architecture:** npm workspaces with shared UI, design system, formatting, and HTTP utilities

## Architecture

```text
Cloud
────────────────────────────────────────

web / Next.js / Vercel
        │
        │ HTTPS + Microsoft access token
        ▼
PriceWatch.WebApi / Azure App Service
        │
        │ EF Core + Npgsql
        ▼
Neon PostgreSQL


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


Shared frontend foundations
────────────────────────────────────────

web ───────────────┐
                   ├── packages/design-system
private-web ───────┤── packages/ui
                   ├── packages/shared
                   └── packages/api
```

The cloud and private applications remain separate, while common UI, styling, formatting, and HTTP infrastructure are shared.

PriceWatch supports multiple sources per item, manual/automatic/hybrid updates, normalized unit-price comparison, price history, archive/restore, and review of suspicious scrape results.

## Usage

Restore and build the .NET solution:

```powershell
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
NEXT_PUBLIC_API_URL=https://localhost:YOUR_API_PORT
NEXT_PUBLIC_MICROSOFT_REDIRECT_URI=http://localhost:3000/redirect
```

Install frontend dependencies once from the repository root:

```powershell
npm install
```

Start the cloud frontend:

```powershell
npm run dev:web
```

Optional local/private workflow:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install -r scraper\requirements.txt
python -m playwright install chromium

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

PriceWatch currently uses a single production Neon database for the application and local scraper workflow.

Automated scraping should only be used where permitted by the target site's terms, access rules, and applicable law.
