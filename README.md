# PriceWatch

PriceWatch is a personal price-tracking project for products and subscriptions.

It combines a Next.js frontend, an ASP.NET Core Web API, PostgreSQL on Neon, and an optional local/private scraper runner powered by Python + Playwright.

> **Personal-use project**
>
> PriceWatch is intended for personal, non-commercial use. If you enable automated scraping, you are responsible for using it responsibly and in compliance with each website's `robots.txt`, Terms of Service, rate limits, access rules, and applicable law.
>
> Do not use this project to bypass authentication, CAPTCHAs, anti-bot protections, paywalls, access controls, or other technical restrictions. If a site does not permit automated access, do not scrape it.

---

## Features

- Microsoft account sign-in
- Owner-only API access
- Product and subscription tracking
- Multiple stores/providers per item
- Manual, automatic, and hybrid price sources
- Normalized unit-price comparison
- Target price tracking
- Current and previous accepted price
- Historical price changes
- Price-history chart
- Archive / restore
- Permanent delete
- Suspicious scrape review flow
- Manual review override
- Local/private scraper runner
- Local scraper dashboard
- Legacy JSON-to-Neon migration tool

---

## Architecture

```text
Cloud / main app
────────────────────────────────────────

Next.js
   │
   │ HTTPS + Bearer token
   ▼
PriceWatch.WebApi
   │
   │ EF Core / Npgsql
   ▼
Neon PostgreSQL


Private / local automation
────────────────────────────────────────

private-web
   │
   │ localhost only
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

The public Web API and the private scraper runner are intentionally separated.

`PriceWatch.WebApi` does not start Python, control a browser, manage Chrome profiles, or expose scraper configuration.

`PriceWatch.Private` is intended to run only on a trusted local machine.

---

## Price model

PriceWatch compares items using normalized unit price.

Example:

```text
Package price:       54 SEK
Package quantity:    2
Normalized price:    27 SEK / pcs
```

Targets use the same model:

```text
Target price:             50 SEK
Comparison quantity:      2
Target normalized price:  25 SEK / pcs
```

Only accepted **normalized price changes** are written to price history.

If the raw package price changes but the normalized price remains the same, the current raw offer may be updated without creating a new history entry.

---

## Update modes

Each tracked item can use one of three modes:

```text
Manual
Automatic
Hybrid
```

### Manual

The source price is entered manually.

### Automatic

The source price is collected by the local scraper.

### Hybrid

The same item can contain both automatic and manual sources.

Example:

```text
Apotea
  automatic

Amazon
  manual
```

PriceWatch compares valid sources using normalized unit price.

---

## Reviews

Suspicious scrape results are not accepted automatically.

They can be reviewed in the main web application:

```text
Accept
Reject
Manual override
```

A successful accepted price update goes through the same shared price-update service used by normal automatic updates.

Technical scraper failures should not be treated as valid prices.

---

## Archive vs delete

### Archive

Archive is a state.

Archiving an item:

- keeps the item
- keeps sources
- keeps price history
- keeps purchase information
- disables tracking
- allows restore later

Restoring an item does **not** automatically re-enable tracking.

### Delete

Delete is permanent.

Deleting an item removes its item-specific:

- sources
- price history
- scrape results
- alerts
- tracked item record

Shared scrape-run summaries may remain because one run can contain multiple items.

---

## Responsible scraping

If you use the scraper, keep it conservative.

Recommended rules:

- Check and respect the site's `robots.txt`.
- Review the site's Terms of Service before enabling automation.
- Use reasonable request frequency.
- Do not hammer endpoints or refresh pages aggressively.
- Avoid scraping the same page repeatedly when the data has not changed.
- Prefer official APIs or feeds when available.
- Do not bypass login requirements or technical restrictions.
- Do not circumvent CAPTCHAs, bot detection, rate limits, or access controls.
- Stop scraping a source if the site explicitly disallows automated access.
- Keep scraping for personal use unless you have explicit permission for broader use.

PriceWatch does not grant permission to access or scrape any third-party website.

---

## Repository structure

```text
PriceWatch/
├── web/
│   └── Next.js main frontend
│
├── private-web/
│   └── local/private scraper dashboard
│
├── scraper/
│   └── Python + Playwright scraper
│
├── src/
│   ├── PriceWatch.Data/
│   │   └── EF Core entities, DbContext, migrations
│   │
│   ├── PriceWatch.Core/
│   │   └── shared business logic
│   │
│   ├── PriceWatch.WebApi/
│   │   └── authenticated cloud API
│   │
│   └── PriceWatch.Private/
│       └── local scraper orchestration
│
├── tools/
│   └── PriceWatch.Migrator/
│       └── one-time legacy data importer
│
└── PriceWatch.sln
```

---

## Requirements

Recommended development environment:

- .NET 10 SDK
- Node.js 20+
- npm
- Python 3.13
- PostgreSQL-compatible database
- Neon PostgreSQL
- Microsoft Entra app registrations
- Playwright Chromium

Python 3.13 is recommended for the scraper environment.

---

## Main web app setup

### 1. Restore and build .NET

```powershell
dotnet restore
dotnet build
```

### 2. Configure the Web API database connection

Use .NET user-secrets instead of committing credentials.

```powershell
dotnet user-secrets set `
  "ConnectionStrings:Database" `
  "YOUR_NEON_CONNECTION_STRING" `
  --project src/PriceWatch.WebApi
```

### 3. Configure the owner account

The API uses an owner-only authorization policy.

Store the allowed Microsoft account object ID in user-secrets:

```powershell
dotnet user-secrets set `
  "Owner:Oid" `
  "YOUR_MICROSOFT_ACCOUNT_OID" `
  --project src/PriceWatch.WebApi
```

### 4. Start the Web API

```powershell
dotnet run --project src/PriceWatch.WebApi
```

### 5. Configure the Next.js frontend

Create:

```text
web/.env.local
```

Example:

```env
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=YOUR_WEB_CLIENT_ID
NEXT_PUBLIC_MICROSOFT_TENANT=consumers
NEXT_PUBLIC_API_SCOPE=api://YOUR_API_CLIENT_ID/access_as_user
NEXT_PUBLIC_API_URL=https://localhost:YOUR_API_PORT
NEXT_PUBLIC_MICROSOFT_REDIRECT_URI=http://localhost:3000/redirect
```

### 6. Start the frontend

```powershell
cd web
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Private scraper setup

The private scraper is optional.

It is intended to run only on your own machine.

### 1. Create a Python virtual environment

From the repository root:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Install Python dependencies

```powershell
python -m pip install --upgrade pip
python -m pip install -r scraper\requirements.txt
python -m playwright install chromium
```

### 3. Configure the Private service

Database:

```powershell
dotnet user-secrets set `
  "ConnectionStrings:Database" `
  "YOUR_NEON_CONNECTION_STRING" `
  --project src/PriceWatch.Private
```

Python executable:

```powershell
dotnet user-secrets set `
  "Private:PythonExecutable" `
  "$PWD\.venv\Scripts\python.exe" `
  --project src/PriceWatch.Private
```

### 4. Run the private service

```powershell
dotnet run --project src/PriceWatch.Private
```

The local API should only be exposed on loopback / localhost.

### 5. Run one scrape cycle manually

```powershell
dotnet run --project src/PriceWatch.Private -- --run-once
```

---

## Private dashboard

The optional local UI lives in:

```text
private-web/
```

Start it with:

```powershell
cd private-web
npm install
npm run dev
```

Typical local address:

```text
http://localhost:3001
```

It can be used to inspect:

- active items
- automatic/manual sources
- scrape runs
- scrape results
- pending review counts
- local schedule settings

---

## Database migrations

`PriceWatch.Data` is the only EF Core schema/migration owner.

Create migrations with:

```powershell
dotnet ef migrations add MigrationName `
  --project src/PriceWatch.Data `
  --startup-project src/PriceWatch.WebApi `
  --output-dir Migrations
```

Apply migrations with:

```powershell
dotnet ef database update `
  --project src/PriceWatch.Data `
  --startup-project src/PriceWatch.WebApi
```

Do not maintain a second schema migration system in Python.

---

## Legacy data importer

`tools/PriceWatch.Migrator` is a one-time migration utility for old local PriceWatch JSON data.

It is not part of the production runtime.

Dry run:

```powershell
.\import-legacy-data.ps1 `
  -ZipPath "C:\path\to\data.zip"
```

Apply:

```powershell
.\import-legacy-data.ps1 `
  -ZipPath "C:\path\to\data.zip" `
  -Apply
```

Do not commit legacy data archives or database credentials.

---

## Security

Important rules used by this project:

- Database credentials are not stored in the frontend.
- Microsoft client secrets are not stored in the browser.
- The main Web API validates Microsoft access tokens.
- Data-changing endpoints are protected by the owner-only policy.
- The local scraper service should bind only to localhost.
- Python does not need the Neon connection string.
- Browser profiles, local scraper state, `.env.local`, and user-secrets should stay out of Git.
- Production secrets should be stored using the hosting platform's secret/configuration system.

---

## Development status

The project is actively evolving.

Current areas include:

- cloud frontend
- products
- subscriptions
- archived items
- reviews
- normalized price history
- local scraper orchestration
- Playwright extraction
- scheduled local runs
- production deployment/hardening

---

## Disclaimer

This repository is provided for personal development and personal price tracking.

Third-party websites remain subject to their own rules, licenses, Terms of Service, `robots.txt`, technical restrictions, and applicable law.

You are responsible for deciding whether automated access is permitted for each source you configure.

Do not use PriceWatch to circumvent technical protections or access data you are not authorized to access.
