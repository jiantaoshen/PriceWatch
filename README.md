# PriceWatch (Updated 2026-10)
## Overview

This is a personal product price-tracking and subscription expense-management system composed of a cloud-based web application, a private local management interface, and a local scraping workflow.

## Problem

The system treats two domains separately:

- **Product**: tracks product prices, sources, target prices, price history, and scraping results.
- **Subscription**: records recurring subscription expenses, focusing on the subscription name, monthly price, currency, and archive status.

The cloud application is responsible for managing products, subscriptions, review workflows, and price history. The local management interface handles scraping operations and scheduling. The data in database are used as the single source of truth.

The goal of this project is to track product prices and monthly subscription costs to find cheaper products, keep subscriptions within budget, and save money. The system should also have clear responsibilities, consistent conventions, stable operation, and long-term maintainability.

## Trade off

### Multi-Source Product Price Comparison

Each Product can have multiple store sources. The system stores both source price and quantity information, then calculates a normalized unit price so that different package sizes can be compared fairly.

For example:

```text
100 SEK / 2 kg => 50 SEK / kg
```

### Separating Product and Subscription

Early versions of Subscription reused too many Product concepts. As the project evolved, the two domains were explicitly separated:

- **Product** => price tracking
- **Subscription** => recurring expense tracking

This keeps the Subscription UI simple and prevents product-specific tracking logic from leaking into the subscription domain.

### Shared Frontend Foundation

Cloud Web and Private Web are two independents Next.js applications. They do not share page-level business logic, but they share the following through npm workspaces:

- Design System
- UI Components
- Shared Types / Utilities
- HTTP Infrastructure

This keeps application responsibilities separate while avoiding duplicated foundation code.

### Single Production Database

Cloud services and local production components use the same Neon PostgreSQL production database. Local scraping results, Cloud Web actions, and Web API data therefore operate against the same source of truth, reducing the complexity of maintaining and synchronizing multiple databases.

### Separating Cloud and Private Components

The Cloud Web and Web API can be deployed independently, while scraping orchestration and browser automation remain on a trusted local device. The main reason for this separation is that some cloud providers do not support browser-based scraping workloads, and some target websites block scraping traffic from cloud environments.


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
