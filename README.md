# PriceWatch

PriceWatch is a personal price-tracking system for products and subscriptions.

It combines a cloud web app with a local/private scraper runner. The web app manages tracked items, reviews price changes, and shows price history, while the local scraper collects prices from configured sources.

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, shadcn/ui
- **API:** ASP.NET Core Web API, C#
- **Database:** PostgreSQL on Neon, EF Core, Npgsql
- **Authentication:** Microsoft Entra / MSAL
- **Scraping:** Python, Playwright
- **Hosting:** Vercel + Azure App Service

## Architecture

```text
Cloud
────────────────────────────────────────

Next.js / Vercel
        │
        │ HTTPS + Microsoft access token
        ▼
ASP.NET Core Web API / Azure App Service
        │
        │ EF Core + Npgsql
        ▼
Neon PostgreSQL


Local / Private
────────────────────────────────────────

private-web
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
```

The cloud API and local scraper are intentionally separated. Browser automation stays on the local machine, while the Web API remains stateless.

PriceWatch supports multiple sources per item, manual/automatic/hybrid updates, normalized unit-price comparison, price history, archive/restore, and review of suspicious scrape results.

## Usage

Build the .NET projects:

```powershell
dotnet restore
dotnet build
```

Configure the Web API with a Neon connection string and the allowed Microsoft account:

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

Start the frontend:

```powershell
cd web
npm install
npm run dev
```

Optional local scraper:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r scraper\requirements.txt
python -m playwright install chromium

dotnet run --project src/PriceWatch.Private
```

For normal development, use a Neon development branch. Production services should connect only to the production branch.

Automated scraping should only be used where permitted by the target site's terms, access rules, and applicable law.
