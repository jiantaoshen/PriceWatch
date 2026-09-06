# Price Watch

A local-first product price monitoring and AI-assisted shopping application built with React, TypeScript, ASP.NET Core, Python, FastAPI, and Ollama.

Price Watch monitors product prices across multiple stores, supports both automatic JSON-LD extraction and manual prices, normalizes different package sizes for fair comparison, tracks historical prices, provides scheduled runs and email notifications, and includes a local AI shopping advisor that can analyze tracked product prices.

## Features

* Multi-store price tracking
* Automatic JSON-LD price extraction with Playwright
* Manual prices for websites that cannot be extracted reliably
* Product-level and store-level scraper switches
* Mixed automatic and manual sources within the same product
* Package quantity and unit price tracking
* Comparable total price calculation across different package sizes
* Target total price and target unit price tracking
* Historical price data
* Suspicious price change detection
* Manual **Run Now** execution
* Email notifications with duplicate-alert protection
* Windows Task Scheduler integration
* Local JSON persistence
* Dashboard-based product management
* **Not run yet**, **Success**, **Failed**, and **Suspicious** product states
* Product detail pages with Edit, Ask AI, and Delete
* Store offer comparison with actual, unit, and normalized prices
* Local AI shopping advisors
* Product-aware AI Chat
* Multiple products can be added to an AI conversation
* Streaming AI responses
* AI replies in the same language as the user's latest message
* Local Ollama integration

## Price Comparison

Stores may sell the same product in different package sizes.

For example:

```text
Apotea
54 SEK for 2 pcs

Amazon
27 SEK for 1 pc
```

Comparing raw package prices directly would incorrectly make Amazon appear cheaper when comparing the same quantity.

Price Watch uses a product-level `comparison_quantity` to normalize store prices.

For a comparison quantity of `2 pcs`:

```text
Apotea
54 / 2 × 2 = 54 SEK

Amazon
27 / 1 × 2 = 54 SEK
```

Each store offer can therefore contain:

```text
Actual price
→ The real package price shown by the store

Unit price
→ Actual price / package quantity

Comparable total
→ Unit price × comparison quantity
```

This allows different package sizes to be compared using the same quantity.

The basic calculation is:

```text
unit_price = actual_price / source.unit_quantity

comparison_price = unit_price × product.comparison_quantity
```

When `comparison_quantity` is configured, Price Watch uses the comparable total when determining the best comparable offer.

Products without `comparison_quantity` continue to use their normal raw package prices.

## Automatic and Manual Prices

Price Watch supports automatic and manual source modes:

```text
Product scraper enabled
        │
        ├── Store scraper enabled
        │     → Open the page with Playwright
        │     → Read Product JSON-LD
        │     → Use the extracted price
        │
        └── Store scraper disabled
              → Use manual price
              → Do not open the store page
```

A product also has a master scraper switch.

When the product-level scraper is disabled, all stores use manual prices and no store pages are opened.

Missing `scraping_enabled` values are treated as enabled for compatibility with older configurations.

### JSON-LD Extraction

Automatic extraction intentionally uses a small generic architecture:

```text
Store page
    ↓
Playwright
    ↓
Product JSON-LD
    ↓
Price found
    ├── Yes → use scraped price
    └── No  → source fails
```

Price Watch does not maintain store-specific scraper implementations.

If a store does not expose a usable price through Product JSON-LD, the recommended workflow is to disable scraping for that source and enter a manual price.

This keeps the scraper architecture small and avoids maintaining custom extraction logic for individual websites.

## Dashboard

The Dashboard combines configured products with the latest scraper results:

```text
products.json
     +
latest.json
     ↓
Dashboard
```

New products appear immediately, even before their first successful run:

```text
Product Name

Lowest Total
—

Not run yet
```

After a successful run, the Dashboard displays the latest calculated prices and product status.

Product details provide access to:

* Latest total and unit prices
* Store offers
* Actual package prices
* Comparable totals
* Price statistics
* Historical charts
* Price history
* Edit
* Ask AI
* Delete

## AI Chat

Price Watch includes a local AI shopping advisor.

The AI is designed to analyze Price Watch price data rather than act as a generic chatbot.

Available advisor styles currently include:

```text
Steady
→ Cautious Buyer

Balanced
→ Value Advisor

Deal Hunter
→ Low-Price Hunter
```

Different advisors may interpret the same price differently, but objective price facts come from Price Watch.

### Product-Aware Conversations

Products can be added to the AI conversation:

```text
AI Chat

Advisor
Balanced · Value Advisor

Considering
[ Product A × ]
[ Product B × ]
[ + Add product ]
```

The React frontend sends only:

```text
advisorId
productIds
messages
```

The browser does not send authoritative price or history data.

ASP.NET Core resolves the selected product IDs and builds the real AI product context from Price Watch data.

The context can include:

* Current price
* Target price
* Previous price
* Historical low
* Historical high
* Historical average
* Recent historical prices

This keeps product price data under backend control.

### Ask AI

A product can be sent directly from its detail page to AI Chat:

```text
Product Detail
    ↓
Ask AI
    ↓
AI Chat
    ↓
Considering
[ Current Product × ]
```

The product is automatically preselected in the conversation.

### AI Recommendations

The advisor can use recommendation labels such as:

```text
BUY
WAIT
NEUTRAL
```

The recommendation is based on available Price Watch data and the selected advisor's strategy.

AI recommendation behavior and prompt tuning are still under active development.

### AI Language

AI configuration and system prompts are written in English.

Responses follow the language of the user's latest message:

```text
Chinese message
→ Chinese response

English message
→ English response

Other clearly recognized language
→ Same language when possible
```

## Architecture

```text
React + TypeScript + Vite + shadcn UI
                    │
                    │ /api
                    ▼
              ASP.NET Core
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
   Python Scraper        Local AI FastAPI
          │                   │
          │                   ▼
          │                Ollama
          │
          ▼
     Playwright
          │
          ▼
 Product JSON-LD
          │
          ▼
    Price Engine

ASP.NET Core
      │
      ├── Product configuration
      ├── Runtime price data
      ├── Historical price data
      ├── Scraper orchestration
      ├── Automation settings
      ├── Email settings
      ├── AI product context
      └── Public local REST API

                    │
                    ▼
                Local JSON
```

The browser communicates only with ASP.NET Core through `/api/*`.

FastAPI is an internal local AI service and is not accessed directly by the React frontend.

Ollama is also kept local.

Typical local services:

```text
React / Vite
http://localhost:5173

ASP.NET Core
/api/*

FastAPI
http://127.0.0.1:8000

Ollama
http://127.0.0.1:11434
```

## Frontend

The React frontend handles:

* Dashboard
* Product creation and editing
* Product details
* Store source configuration
* Scraper switches
* Manual prices
* Offer comparison
* Charts
* History views
* Scraper status
* Automation settings
* Email settings
* AI Chat
* Advisor selection
* AI product selection
* Streaming AI output

Main application views include:

```text
Dashboard
Scraper
Automation
Email
AI Chat
```

## ASP.NET Core Backend

ASP.NET Core is the single API exposed to the frontend.

It handles:

* Product CRUD
* Configuration validation
* Automation settings
* Email settings
* Scraper process orchestration
* Runtime data endpoints
* Historical data endpoints
* Scraper status
* AI advisor endpoints
* AI chat streaming proxy
* AI product context construction

The backend retrieves authoritative Price Watch product data before forwarding an AI request to FastAPI.

```text
React
   ↓
advisorId + productIds + messages
   ↓
ASP.NET Core
   ↓
products.json + latest.json + history
   ↓
AI Product Context
   ↓
FastAPI
```

## Python Price Engine

The scraper and price engine handle:

* Playwright browser automation
* Product JSON-LD extraction
* Manual price processing
* Package quantity calculations
* Unit prices
* Comparable totals
* Price validation
* Historical processing
* Run metadata
* Notifications
* Cross-process run locking

Automatic extraction remains JSON-LD only.

There is no DOM fallback or store-specific scraper architecture.

## Local AI Service

The local AI service is implemented with FastAPI.

It handles:

* Advisor definitions
* Advisor system prompts
* Product context formatting
* Conversation context
* Ollama requests
* Streaming model output

The service is located under:

```text
backend/ai/
```

Typical structure:

```text
backend/ai/
├── .venv/
├── main.py
├── advisor.py
├── prompt_builder.py
└── requirements.txt
```

FastAPI does not require browser CORS configuration because it is accessed by ASP.NET Core rather than directly by React.

Ollama runs independently from the application startup script.

AI configuration can use environment variables such as:

```text
OLLAMA_URL
OLLAMA_MODEL
```

## Storage

Price Watch uses local files rather than an external database.

Typical runtime structure:

```text
backend/
├── data/
│   ├── latest.json
│   ├── history/
│   ├── runs/
│   └── settings/
│
├── python/
│   ├── products.json
│   ├── requirements.txt
│   ├── webscraping.py
│   ├── .state/
│   └── pricewatch/
│
└── ai/
    ├── .venv/
    ├── main.py
    ├── advisor.py
    ├── prompt_builder.py
    └── requirements.txt
```

Key files include:

```text
backend/python/products.json
→ Product configuration

backend/data/latest.json
→ Latest successful product results

backend/data/history/
→ Historical price snapshots

backend/data/runs/
→ Scraper run metadata

backend/data/settings/
→ Application settings

backend/python/.state/
→ Internal scraper state such as notifications and run locking
```

Price Watch currently uses local JSON persistence and does not require an external database.

## Product Status

Products can have the following states:

| Status        | Meaning                                     |
| ------------- | ------------------------------------------- |
| `Not run yet` | Configured but never successfully processed |
| `Success`     | Processed successfully                      |
| `Failed`      | No valid result could be produced           |
| `Suspicious`  | A price was found but failed validation     |

Suspicious and failed results are not written as successful price history.

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn UI
* Lucide

### Backend

* ASP.NET Core
* .NET 10

### Price Processing

* Python
* Playwright
* Pydantic
* JSON-LD

### Local AI

* Python
* FastAPI
* Uvicorn
* HTTPX
* Pydantic
* Ollama

### Storage and Automation

* Local JSON
* Windows Task Scheduler
* PowerShell

## Project Structure

```text
WishList/
├── .venv/
├── .setup/
│
├── backend/
│   ├── PriceWatch.Api/
│   │
│   ├── python/
│   │   ├── products.json
│   │   ├── requirements.txt
│   │   ├── webscraping.py
│   │   ├── .state/
│   │   └── pricewatch/
│   │
│   └── ai/
│       ├── .venv/
│       ├── main.py
│       ├── advisor.py
│       ├── prompt_builder.py
│       └── requirements.txt
│
├── src/
├── package.json
├── vite.config.ts
└── start.ps1
```

The root `.venv` is used by the scraper.

The AI service uses its own virtual environment:

```text
backend/ai/.venv
```

## Getting Started

Clone the repository and run:

```powershell
.\start.ps1
```

The startup script:

* Checks Node.js, npm, .NET, and Python
* Installs frontend dependencies when required
* Creates the scraper Python virtual environment
* Installs scraper dependencies when required
* Installs Playwright Firefox when required
* Creates the AI Python virtual environment when required
* Installs AI dependencies when required
* Restores ASP.NET Core dependencies
* Starts the local FastAPI AI service
* Starts the ASP.NET Core API
* Starts the Vite frontend

Dependencies are skipped on later runs unless their relevant dependency files change.

Ollama runs independently and must be available locally for AI Chat to generate responses.

To run the scraper once before starting the application:

```powershell
.\start.ps1 -RunScraper
```

If PowerShell blocks local scripts:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Typical Workflow

1. Add a product from the Dashboard.
2. Add one or more store sources.
3. Enable automatic extraction or manual pricing for each store.
4. Set each store's package quantity when applicable.
5. Optionally configure a comparison quantity.
6. Set target total and unit prices.
7. Run the scraper manually or through automation.
8. Review prices, offers, history, and status from the Dashboard.
9. If a store cannot be extracted through JSON-LD, disable scraping for that source and enter a manual price.
10. Open a Product Detail page for deeper analysis.
11. Use **Ask AI** to open AI Chat with that product already selected.
12. Select an advisor and ask whether the current tracked price looks attractive.

Example price comparison:

```text
Product comparison quantity
2 pcs

Apotea

Actual price:      54 SEK
Package quantity:   2 pcs
Unit price:        27 SEK/pcs
Comparable total:  54 SEK

Amazon

Actual price:      27 SEK
Package quantity:   1 pc
Unit price:        27 SEK/pcs
Comparable total:  54 SEK
```

Example AI flow:

```text
Product Detail
    ↓
Ask AI
    ↓
Balanced · Value Advisor
    ↓
Considering
[ Product × ]
    ↓
"Should I buy this?"
```

## Scraper Behavior

The effective scraper state is:

```text
Product scraping_enabled
        │
        ├── false
        │     → all sources use manual_price
        │     → browser pages are not opened
        │
        └── true
              │
              ├── Source scraping_enabled = true
              │     → Playwright + JSON-LD
              │
              └── Source scraping_enabled = false
                    → manual_price
                    → source URL is not opened
```

When every configured source is manual, the scraper skips browser startup entirely.

Automatic sources are retried briefly in case JSON-LD is populated after page load.

If no valid JSON-LD price is found, that source is treated as failed rather than falling back to store-specific extraction logic.

## Notifications

Price Watch can send summary email notifications for:

* Products reaching their target price
* Suspicious price changes
* Failed scraper runs

Notification state is stored locally to avoid repeatedly sending the same alert.

A target alert is re-armed if the price later rises above the target again.

Suspicious prices are also deduplicated so the same suspicious value is not repeatedly emailed.

## Automation

Windows Task Scheduler can be configured through the application to run Price Watch automatically.

The ASP.NET Core backend manages the scheduled task and invokes the Python scraper using the configured local environment.

Manual execution remains available through the application using **Run Now**.

## Local-First Design

Price Watch is designed to keep its core workflow local:

```text
Browser
   ↓
ASP.NET Core
   ├── Local files
   ├── Python scraper
   └── FastAPI
          ↓
        Ollama
```

Product configuration, runtime prices, historical data, scraper state, and AI price context remain part of the local Price Watch environment.

The frontend does not communicate directly with Ollama or FastAPI.

## Development Status

Price Watch is under active development.

The core application workflow currently includes:

* Multi-store product tracking
* JSON-LD automatic price extraction
* Manual price sources
* Product and source scraper controls
* Package normalization
* Comparable total pricing
* Unit price tracking
* Historical data
* Suspicious price detection
* Automation
* Email notifications
* Dashboard-based product management
* Local AI Chat
* Multiple AI shopping advisors
* Product-aware AI context
* Streaming AI responses
* Product Detail → Ask AI workflow

Current development work includes continued improvement of AI recommendation quality and prompt behavior.

The project currently uses local JSON persistence and is intended primarily as a local-first price monitoring and shopping decision-support application.

The scraper architecture intentionally avoids store-specific adapters: automatic sources use Product JSON-LD, while unsupported stores can be configured with manual prices.
