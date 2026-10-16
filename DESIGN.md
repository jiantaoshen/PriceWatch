# PriceWatch System Design

## 1. Overview

PriceWatch is a price-tracking system with two planes:

```text
Control Plane
- web
- PriceWatch.WebApi

Execution Plane
- private-web
- PriceWatch.Private
- Python Playwright scraper
- Windows Task Scheduler
```

Both planes use Neon PostgreSQL as the shared source of truth.

Core rules:

- `ItemSource.ScrapingEnabled` is the only source-level scraping switch.
- No persisted `Automatic` / `Manual` / `Hybrid` / `UpdateMode`.
- Only accepted results from the relevant current run may update automatic current price.
- Suspicious results require review.
- Only one scrape run executes globally at a time.
- Private execution remains local-only.
- Unsafe network targets fail closed.

# 2. Functional Requirements

## 2.1 Products and Sources

The user shall be able to create, edit, archive, and restore products; configure target/comparison values; enable or disable item tracking; and manage multiple sources.

A source may contain store, URL, default quantity, manual price, note, and:

```text
ScrapingEnabled = true  -> Scraping ON
ScrapingEnabled = false -> Scraping OFF
```

Do not add a second persisted mode representing the same fact.

## 2.2 Scraping

The system shall support on-demand and scheduled scraping.

Eligible automatic work requires:

```text
item is tracked
+
source.ScrapingEnabled = true
```

Scheduled runs also respect `CheckIntervalMinutes`.

The scraper uses Playwright and execution-time SSRF protection.

First-observation baseline priority:

```text
same-source accepted history
-> current accepted item price
-> basic sanity validation only
```

Target price is not a market-price baseline.

## 2.3 Scheduling

Windows Task Scheduler runs the repository run-once entry point.

Scheduled flow:

```text
load config
-> acquire global lock
-> skip if already locked
-> recover stale Running -> Abandoned
-> evaluate eligible work
-> scrape
-> persist
-> finish
```

The frontend is not required.

`CheckIntervalMinutes` is a minimum scheduled interval, not a timer. Actual frequency cannot exceed the Task Scheduler cadence. `Run now` ignores this interval.

## 2.4 Runs and Results

Each execution creates a `ScrapeRun`.

Supported states:

```text
Running
Success
Partial
Failed
Abandoned
```

`Abandoned` means a previous process disappeared while the row remained `Running`.

Each `ScrapeResult` keeps the run, item, source when applicable, observed values/time, result status, review status, and sanitized failure/suspicious information.

Historical results must not be treated as new observations.

## 2.5 Best Offer

Automatic current price selection uses only accepted results from the relevant current run.

If multiple accepted offers exist, choose the lowest valid unit price.

The same offer-selection rule is used by normal scraping and review acceptance/override.

Old historical reviews must not overwrite newer current price.

`LastSuccessfulPriceAt` represents observation time.

## 2.6 Reviews

Suspicious results enter Pending review.

Supported actions:

```text
Accept
Reject
Manual Override
```

Review transitions are atomic and allowed only while `ReviewStatus = Pending`.

Exactly one competing decision may succeed. Later attempts return `409 Conflict`.

Accept/Override recomputes the best offer.

The UI has one canonical Reviews entry with a lightweight pending count in the header.

## 2.7 Private Dashboard

The private dashboard provides:

- latest/local run status,
- pending review count,
- run-now control,
- schedule state,
- scraping availability.

The browser never calls `PriceWatch.Private` directly; it uses the Next.js server proxy.

## 2.8 Email Price Alerts — Planned

`PriceAlertEvent` is reserved for email price alerts.

When an **accepted automatic observation** has unit price at or below the target unit price, the system shall send email to the configured recipient.

Supported SMTP modes shall include:

```text
Outlook / Microsoft
Gmail
Custom SMTP
```

Sender and recipient may be the same account.

SMTP credentials remain server-side.

`PriceAlertEvent` provides durable delivery state:

```text
Pending
Sent
Failed
```

and prevents duplicate alerts for the same accepted `PriceHistory` event.

**Status:** planned; SMTP delivery is not implemented yet.

# 3. Non-Functional Requirements

## 3.1 Security

The system shall:

- sanitize HTTP errors and process failures,
- never expose passwords, tokens, connection strings, raw stack traces, or secret-bearing stderr,
- keep private API credentials server-side,
- preserve authentication/authorization boundaries,
- enforce SSRF checks at execution time,
- fail closed for unsafe targets.

## 3.2 Private API Boundary

`PriceWatch.Private` binds only to loopback and requires `X-PriceWatch-Token`.

Browser path:

```text
Browser
-> private-web /api/private/*
-> Next.js server proxy
-> X-PriceWatch-Token
-> PriceWatch.Private
```

The proxy validates expected frontend host and client marker; mutation requests also validate `Origin` or `Sec-Fetch-Site`.

The browser never receives the private token.

## 3.3 SSRF

The scraper validates:

```text
scheme
hostname
port
DNS
resolved IP ranges
redirects
browser subresources
```

Localhost, loopback, private, link-local, and other non-public targets are blocked.

## 3.4 Concurrency and Reliability

A PostgreSQL session advisory lock allows only one global scrape run.

After acquiring the lock, the process marks stale `Running` rows as `Abandoned` before creating a new run.

Individual scrape failures shall not corrupt unrelated results.

If PostgreSQL is unavailable, the system fails closed.

## 3.5 Data Integrity

Database constraints back application validation.

Required invariants include:

```text
positive quantities
non-negative prices where applicable
positive configured check intervals
unique non-null (run_id, source_id)
```

Derived state should not be persisted unless required for historical truth or query performance.

## 3.6 Maintainability and Performance

Prefer:

```text
one source of truth
shared domain rules
few duplicate components/API fields
lightweight projections
simple local infrastructure
```

Operational errors should be traceable without exposing secrets.

# 4. Data & API

## 4.1 Core Data Model

### TrackedItem
Tracked product, tracking state, schedule interval, target/comparison data, current/previous accepted price state, timestamps, archive state.

`UpdateMode` does not exist.

### ItemSource
Source metadata plus `ScrapingEnabled`, the authoritative scrape switch.

### ScrapeRun
One execution with status, timestamps, and aggregate counts.

### ScrapeResult
One run observation with item/source, scraped/manual values, result/review status, review metadata, and sanitized error data.

### PriceHistory
Accepted historical observation with item/source/result, price, quantity, unit price, origin, and recorded time.

### PriceAlertEvent
Durable email-delivery record linked uniquely to the triggering `PriceHistory` event.

## 4.2 Relationships

```text
TrackedItem -> ItemSource[]
TrackedItem -> PriceHistory[]
ScrapeRun -> ScrapeResult[]
ScrapeResult -> TrackedItem / ItemSource / ScrapeRun
PriceHistory -> TrackedItem / ItemSource / ScrapeResult
PriceAlertEvent -> TrackedItem / PriceHistory
```

## 4.3 Public Web API

Responsibilities:

```text
products
sources
reviews
owner-authenticated administration
```

Logical routes include:

```text
/api/items
/api/reviews
/api/reviews/pending/count
/api/reviews/{id}/accept
/api/reviews/{id}/reject
/api/reviews/{id}/override
```

## 4.4 Private API

Responsibilities:

```text
dashboard
run-now
schedule
local execution state
```

Logical routes include:

```text
GET  /api/private/dashboard
POST /api/private/run
GET  /api/private/schedule
POST /api/private/schedule
```

Browser access is proxy-only.

## 4.5 Scraper Interface

`PriceWatch.Private` launches the Python scraper and consumes structured results.

Raw stderr is not returned to users; sensitive values are redacted.

## 4.6 Planned SMTP Interface

Future server-side SMTP configuration contains:

```text
provider/mode
host
port
TLS mode
sender/username
credential
recipient
```

Notifications consume accepted `PriceHistory`, not raw scraper output.

# 5. High-Level Architecture

```text
                 User
           ┌──────┴──────┐
           ▼             ▼
      Public Web     Private Web
        Next.js        Next.js
           │             │
           ▼             ▼
        WebApi       Server Proxy
       ASP.NET            │
           │              ▼
           │         Private API
           │          ASP.NET
           │              │
           │       ┌──────┼────────┐
           ▼       ▼      ▼        ▼
        Neon PG  PG Lock Python   Task
                        Scraper  Scheduler
                           │
                           ▼
                    Public Websites
```

Control plane:

```text
web + PriceWatch.WebApi
```

Execution plane:

```text
private-web + PriceWatch.Private + Python scraper + Task Scheduler
```

Execution is local-only. Neon PostgreSQL is the shared data plane.

Planned notification path:

```text
Accepted automatic PriceHistory
-> target comparison
-> PriceAlertEvent
-> server-side SMTP
```

# 6. Main Workflows

## 6.1 Scrape

```text
User / Scheduler
-> Private API
-> acquire advisory lock
-> recover Running -> Abandoned
-> select eligible item/source work
-> apply schedule interval when applicable
-> create ScrapeRun
-> Python + Playwright + SSRF guard
-> persist ScrapeResult
-> review suspicious results
-> choose best accepted current-run offer
-> update PriceHistory/current price
-> planned email check
-> finish run
-> release lock
```

## 6.2 Review

```text
Pending result
-> Accept / Reject / Override
-> atomic Pending-only transition
-> 409 if already reviewed
-> recompute best offer when accepted/overridden
-> update current/history only when valid
```

# 7. Bottlenecks, Scale, and Reliability

## 7.1 Scale Assumption

Current target:

```text
one primary user
small-to-moderate product/source count
periodic scraping
one local execution environment
```

This is not a distributed high-throughput crawler.

## 7.2 Main Bottlenecks

### Global serialization
Only one scrape run executes globally. This is intentional for current scale.

If runtime becomes unacceptable, prefer bounded concurrency rather than removing coordination.

### Browser automation
Latency mainly comes from external websites, JavaScript-heavy pages, timeouts, and anti-bot behavior.

### Database growth
Main growth tables:

```text
scrape_results
price_history
scrape_runs
```

Future scale may require additional indexes, pagination, latest-per-source queries, and retention/archive policies.

## 7.3 External Dependencies

PostgreSQL is required for data, coordination, run state, reviews, and history. If unavailable, fail closed.

Windows Task Scheduler is local-machine infrastructure; actual scheduled frequency cannot exceed its cadence.

Third-party sites may fail because of HTML changes, rate limits, anti-bot controls, redirects, outages, login, or geography. These are controlled operational failures, not application crashes.

## 7.4 Known Limitations

1. Email alerts are planned; SMTP delivery is not implemented.
2. First-ever observations without an accepted baseline receive only sanity validation.
3. SSRF DNS protection retains a theoretical DNS TOCTOU window.
4. Browser scraping throughput is intentionally limited.
5. Scheduling is local-machine infrastructure.
6. Large historical datasets will eventually need query/index/retention tuning.

# 8. Design Baseline

The required baseline is:

```text
one shared database source of truth
one global scrape coordinator
one shared best-offer rule
concurrency-safe review transitions
one canonical Reviews entry
one local private execution boundary
one server-side private API token
execution-time SSRF protection
stale Running -> Abandoned recovery
database-backed integrity constraints
```

Changes to functionality, data/API contracts, architecture, security boundaries, concurrency, scheduling, or reliability require explicit approval before implementation.
