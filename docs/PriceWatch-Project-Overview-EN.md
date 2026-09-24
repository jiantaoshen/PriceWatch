# Price Watch Project Overview

## Project Overview

Price Watch is a personal product price tracking and subscription expense management system composed of a cloud web application, a local private management interface, and a local scraping workflow.

The system treats two domains separately:

- **Product**: tracks product prices, sources, target prices, price history, and scraping results.
- **Subscription**: records recurring subscription expenses, focusing on name, monthly price, currency, and archive status.

The cloud application is responsible for managing products, subscriptions, review workflows, and price history. A separate local `private-web` application is used for scraping operations and scheduling.

The two frontends remain independent, but share the design system, UI components, common types, formatting utilities, and HTTP infrastructure through npm workspaces.

## Problem to Solve

The same product may be sold in different stores with different package sizes and quantities. Comparing only the total price shown on each page does not provide a fair way to determine which source is actually cheaper.

Price Watch normalizes prices by quantity into comparable unit prices and records historical price changes.

Products can use manual, automatic, or hybrid update modes. Suspicious scraping results are not written directly into official price history and instead enter a review workflow first.

At the same time, the system also needs to track recurring subscription expenses. Since subscriptions do not naturally use product concepts such as target price, scraping sources, or price history, Subscription is designed as a separate and simpler expense model.

## Solution

The system separates cloud data management, local browser automation, and shared frontend infrastructure.

The cloud Next.js application obtains an Access Token through Microsoft Authentication and accesses data through an authenticated ASP.NET Core Web API.

The Web API uses EF Core and Npgsql to connect to Neon PostgreSQL and is responsible for core business rules and data persistence.

A separate local `private-web` application communicates with `PriceWatch.Private`, which starts the Python Playwright scraper. Valid scraping results are written back to the same production database.

The two frontends share the following packages through npm workspaces:

```text
design-system
ui
shared
api
```

This keeps visual design, types, and HTTP infrastructure consistent while still allowing Cloud Web and Private Web to run and evolve independently.

## Core Features

### Product Price Tracking

Product is used for items that require real price comparison and historical analysis.

Each product can include:

```text
Name
Currency
Unit
Target Price
Comparison Quantity
Update Mode
Tracking Status
Archive Status
Multiple Price Sources
```

Product supports three update modes:

```text
Manual
Automatic
Hybrid
```

### Subscription Expense Management

Subscription is used to track recurring fixed expenses rather than product price tracking.

The user mainly manages:

```text
Name
Monthly Price
Currency
```

Subscription does not expose Product concepts such as:

```text
Target Price
Previous Price
Update Mode
Tracking
Check Interval
Sources
Price History
```

Active subscriptions are included in the monthly total.

An archived subscription represents a subscription that has been cancelled or stopped. It is excluded from the Monthly Total, but its record is preserved and can be restored.

### Multi-Source Product Price Comparison

Each Product can have multiple store sources.

The system stores both source price and quantity information, then calculates a normalized unit price so that different package sizes can be compared fairly.

For example:

```text
100 SEK / 2 kg
→ 50 SEK / kg

60 SEK / 1 kg
→ 60 SEK / kg
```

This allows the system to compare products using a common unit even when their displayed total prices differ.

### Price History

Valid Product price changes are written to price history.

Price history is used to:

```text
Observe long-term changes
Compare historical prices
Identify price drops or increases
Analyze the current price position
```

Only accepted or confirmed prices become official historical data.

### Manual, Automatic, and Hybrid Updates

Product can use:

```text
Manual
→ User-maintained prices

Automatic
→ Prices collected by Playwright

Hybrid
→ Manual and automatic sources used together
```

Different sources are ultimately converted into comparable price data.

### Review Workflow

Suspicious or abnormal prices collected automatically do not immediately become official prices.

They can enter Pending Review and be handled through:

```text
Accept
Reject
Manual Override
```

After review, confirmed data can become part of the official price state and price history.

This prevents incorrect scraping results from polluting long-term historical data.

### Archive and Restore

Archive is not the same as Delete.

The system uses:

```text
ArchivedAt
```

to represent whether an item is archived.

For Product, Archive means stopping active tracking while preserving:

```text
Sources
Price History
Last Known Price
Other Historical Data
```

Restore returns the item to the Active state.

For Subscription, Archive means the subscription has stopped and should no longer be included in the monthly total.

Delete is mainly used for removing incorrect or duplicate records.

### Local Scraping

Python Playwright runs only on the local device.

The cloud Web API:

```text
Does not start browsers
Does not manage local browser processes
Does not expose the local scraping environment
```

Scraping orchestration remains inside the trusted local environment:

```text
private-web
↓
PriceWatch.Private
↓
Python Playwright
```

## Frontend Data Loading Architecture

Cloud Web follows a unified data loading flow:

```text
Auth
↓
Access Token
↓
fetchXxxData()
↓
apiFetch()
↓
ASP.NET Core API
↓
React State
↓
Render
```

Responsibilities are divided as follows:

```text
AuthProvider
→ Login state and Access Token

fetchXxxData
→ Fetch and compose data

apiFetch / request
→ HTTP transport

React Page
→ Loading / Error / Data state
```

Fetch functions are responsible only for reading and returning data and do not directly modify React State.

API requests consistently use:

```text
Authorization: Bearer <token>
cache: no-store
```

After actions such as Archive, Restore, or Review, the frontend usually fetches the server state again instead of duplicating backend business rules in the browser.

## Challenges and Design Decisions

### Separating Product and Subscription

Early versions of Subscription reused too many Product concepts.

As the project evolved, the two domains were explicitly separated:

```text
Product
→ price tracking

Subscription
→ recurring expense tracking
```

This keeps the Subscription UI simple and prevents product-specific tracking logic from leaking into the subscription domain.

### Separating Cloud and Private Components

Cloud Web and the Web API can be deployed independently, while scraping orchestration and browser automation remain on a trusted local device.

This keeps cloud services simple and avoids exposing Playwright or the local scraping environment to the public internet.

### Shared Frontend Foundation

Cloud Web and Private Web are two independent Next.js applications.

They do not share page-level business logic, but they share the following through npm workspaces:

```text
Design System
UI Components
Shared Types / Utilities
HTTP Infrastructure
```

This keeps application responsibilities separate while avoiding duplicated foundation code.

### Keeping Price Comparison Consistent

Different product sources may use different package sizes and quantities.

The system does not compare products directly by displayed total price. Instead, it calculates normalized unit prices based on quantity.

This gives product comparison a consistent standard.

### Separating Archive and Delete

Archive is used when an item should stop being actively used or tracked while preserving its history.

Delete is used to permanently remove incorrect or duplicate data.

This avoids losing historical records simply because an item is temporarily no longer active.

### Single Production Database

Cloud services and local production components use the same Neon PostgreSQL production database.

Local scraping results, Cloud Web actions, and Web API data therefore operate against the same source of truth.

The local development environment currently uses the same data source as well, reducing the complexity of maintaining and synchronizing multiple databases.

## Deployment

The current deployment structure is:

```text
Cloud Web
→ Vercel

ASP.NET Core Web API
→ Azure App Service

PostgreSQL
→ Neon

private-web
→ Local

PriceWatch.Private
→ Local

Python Playwright Scraper
→ Local
```

Cloud Web accesses data through the authenticated Web API.

Local private components are responsible for scraping and scheduling and remain synchronized with production data.

## Future Work

Future development will mainly focus on:

```text
Improving scraping stability
Refining the review workflow
Improving error handling
Adding notification capabilities
Enhancing long-term price analysis
Increasing test coverage
Continuing to standardize Cloud / Private Web development practices
```

As data volume and frontend complexity grow, the project can later reevaluate whether more advanced caching, retry logic, or client-side data management is needed.

## Additional Notes

### Project Background

Price Watch is a personal full-stack project that is actively maintained over time.

It is designed to solve real product price tracking and subscription expense management needs while also providing practical experience with:

```text
Next.js
React
TypeScript
ASP.NET Core
EF Core
PostgreSQL
Microsoft Authentication
Vercel
Azure
Neon
Python
Playwright
npm Workspaces
Shared UI Architecture
Multi-runtime System Design
```

The project's current design principles can be summarized as:

```text
Product ≠ Subscription

Archive ≠ Delete

Automatic Data ≠ Trusted Data

Auth ≠ Fetch ≠ State

Cloud ≠ Local Scraping

Frontend ≠ Business Logic
```

The project architecture has evolved from an early functional prototype into a system focused on **clear responsibilities, consistent conventions, stable operation, and long-term maintainability**.
