# DESIGN.md

# PriceWatch System Design

## 1. Overview

PriceWatch is a price-tracking system that separates public administration from local scraping execution.

The system allows a user to:

- create and manage tracked products,
- define one or more sources for each product,
- enable or disable scraping per source,
- run scraping manually or through Windows Task Scheduler,
- store scrape results and price history,
- review suspicious results,
- automatically select the best accepted offer,
- and view the latest tracked price through the web UI.

The current design intentionally avoids duplicated state such as `Automatic`, `Manual`, `Hybrid`, or `UpdateMode`.

The authoritative scraping switch is:

```text
ItemSource.ScrapingEnabled
```

The system is split into two execution planes:

```text
Public / Control Plane
- web
- PriceWatch.WebApi

Private / Execution Plane
- private-web
- PriceWatch.Private
- Python Playwright scraper
- Windows Task Scheduler
```

Both planes share PostgreSQL as the source of truth.

---

# 2. Functional Requirements

## 2.1 Product Management

The system shall allow the user to:

- create a tracked product,
- edit product metadata,
- archive or restore a product,
- define target price information,
- define comparison quantity / unit information,
- enable or disable tracking for the whole product.

Each tracked product may contain multiple sources.

## 2.2 Source Management

The system shall allow the user to:

- add a source URL,
- assign a store / source name,
- define default quantity,
- store optional notes,
- enable or disable scraping for each source.

The authoritative scrape state shall be:

```text
ScrapingEnabled = true  -> Scraping ON
ScrapingEnabled = false -> Scraping OFF
```

The system shall not maintain a separate persisted mode such as `Automatic`, `Manual`, `Hybrid`, or `Mixed` because those concepts are derived from configured sources.

## 2.3 Scraping

The system shall support:

- on-demand scraping,
- scheduled scraping,
- scraping only eligible products,
- scraping only sources with `ScrapingEnabled = true`,
- respecting the product tracking state,
- respecting minimum check intervals.

The scraper shall use Playwright to load external product pages.

Before navigation, and during all browser network requests, the scraper shall enforce SSRF protections.

The scraper shall reject unsafe destinations including:

- localhost,
- loopback addresses,
- private networks,
- link-local ranges,
- non-public IP addresses,
- unsafe redirects,
- unsafe iframe / script / image / XHR / fetch destinations.

## 2.4 Scheduled Execution

The system shall support scheduled execution through Windows Task Scheduler.

The scheduled task shall execute the repository's run-once entry point.

The run-once flow shall:

1. load repository configuration,
2. start the private execution path,
3. attempt to acquire the global scrape lock,
4. skip safely if another scrape is already running,
5. execute eligible scrape jobs,
6. persist results,
7. exit normally.

The scheduler shall not require a browser or frontend to be running.

## 2.5 Scrape Run Tracking

Each scrape execution shall create a `ScrapeRun`.

A run shall track:

- start time,
- finish time,
- total items,
- successful results,
- failed results,
- suspicious results,
- run status.

Each result shall be associated with the run that produced it.

## 2.6 Scrape Result Handling

A scrape result shall contain relevant observations such as:

- scraped price,
- scraped quantity,
- calculated unit price,
- source,
- item,
- run,
- timestamp,
- result status,
- review status,
- suspicious reason.

The system shall preserve the real observation timestamp.

Historical results shall not be treated as fresh observations from a newer run.

## 2.7 Best Offer Selection

The system shall select the current price using accepted results from the relevant run.

For an automatic scrape run:

```text
only accepted results from the current run
-> participate in best-offer selection
```

The system shall not reuse an older accepted result as though it were observed in the current run.

If multiple accepted offers are available, the system shall select the lowest valid unit price.

The same offer-selection rule shall be used by both automatic scrape processing and manual review processing.

## 2.8 Suspicious Result Review

Suspicious scrape results shall enter a review workflow.

The user shall be able to:

- accept a result,
- reject a result,
- provide a manual override where supported.

Accepting or overriding a result shall trigger best-offer recalculation using the shared offer-selection logic.

Reviewing an old historical result shall not overwrite a newer current price.

## 2.9 Reviews UI

The system shall expose Reviews through one canonical UI entry.

The header shall display the pending review count, for example:

```text
Reviews 3
```

The Product page shall not duplicate the same pending-review concept as a second filter when that filter adds no independent workflow.

The pending review count should come from a lightweight count endpoint rather than downloading all review rows only to count them.

## 2.10 Dashboard

The private dashboard shall show local execution information such as:

- current / latest run state,
- pending reviews,
- scraping availability,
- scheduling state,
- run-now control.

The private dashboard shall communicate with the private backend only through the Next.js server proxy.

The browser shall not call the private .NET API directly.

---

# 3. Non-Functional Requirements

## 3.1 Security

Backend exceptions exposed over HTTP shall use sanitized responses such as Problem Details.

Client responses shall not contain:

- raw exception messages,
- stack traces,
- connection strings,
- database passwords,
- process stderr containing secrets.

Logs shall avoid recording secret-bearing exception messages where possible.

## 3.2 Private API Isolation

The Private API shall:

- bind only to loopback,
- not be exposed to the LAN,
- require a private authentication token,
- reject direct unauthenticated calls.

The browser shall never receive the private API token.

```text
Browser
  -> private-web
  -> same-origin /api/private/*
  -> Next.js server proxy
  -> X-PriceWatch-Token
  -> PriceWatch.Private
```

The token shall exist only on the server side.

## 3.3 Request Trust Validation

The private-web proxy shall validate that incoming requests are intended for the configured local frontend.

Read requests shall validate:

- expected frontend host,
- private-web client marker.

Mutation requests shall additionally validate same-origin intent using `Origin` or `Sec-Fetch-Site` fallback.

The proxy shall not rely on fragile full-string comparison against `request.url.origin`.

## 3.4 SSRF Protection

SSRF protection shall exist at the execution boundary.

The system shall not rely only on URL validation at data-entry time.

The scraper shall validate:

- scheme,
- hostname,
- port,
- DNS resolution,
- resolved IP ranges,
- redirects,
- subresources.

Unsafe targets shall fail closed.

## 3.5 Concurrency Control

Only one scrape execution shall run globally at a time.

The system shall use a PostgreSQL session advisory lock.

The lock shall be:

- acquired before scraping,
- held on a dedicated connection,
- released automatically when the connection closes,
- shared across scheduler and UI-triggered runs.

## 3.6 Data Integrity

The system shall preserve:

- source-to-item ownership,
- run-to-result relationships,
- result timestamps,
- current-run freshness,
- historical price records,
- accepted/rejected review state.

Data that can be derived should not be redundantly persisted unless required for historical truth or query performance.

## 3.7 Reliability

A failure in one product scrape shall not corrupt unrelated product data.

A network error, parser error, timeout, or suspicious result shall be recorded as a controlled result state.

The system shall fail safely when:

- external sites are unavailable,
- the scraper crashes,
- the private API is unavailable,
- the database cannot be reached,
- the global lock cannot be acquired.

## 3.8 Maintainability

The implementation should favor:

- fewer duplicated state variables,
- fewer duplicated API fields,
- fewer duplicate components,
- shared domain rules,
- simple UI,
- clear security boundaries.

Each business concept should have one authoritative representation.

## 3.9 Observability

Operational failures should provide a traceable identifier without exposing secrets.

Useful operational data includes:

- trace ID,
- run ID,
- result ID,
- timestamps,
- sanitized status,
- failure category.

Sensitive configuration must not be included in user-visible output.

## 3.10 Performance

The system is optimized for a relatively small number of tracked products and sources.

The design should avoid:

- loading all reviews just to count pending ones,
- unnecessary duplicate API calls,
- duplicate scraping of the same source,
- unnecessary browser instances,
- repeated recalculation when a lightweight projection is sufficient.

---

# 4. Data & API

## 4.1 Core Data Model

### TrackedItem

Represents a tracked product.

Important fields include:

```text
Id
Name
ItemType
Currency
TrackingEnabled
CheckIntervalMinutes
TargetPrice
TargetUnitPrice
ComparisonQuantity
CurrentPrice
CurrentQuantity
CurrentUnitPrice
CurrentSourceId
PreviousPrice
PreviousQuantity
PreviousUnitPrice
PreviousSourceId
LastCheckedAt
LastSuccessfulPriceAt
LastPriceChangedAt
ArchivedAt
CreatedAt
UpdatedAt
```

`UpdateMode` is intentionally not part of the current model.

### ItemSource

Represents a source from which the product may be observed.

Important fields include:

```text
Id
ItemId
Store
Url
DefaultQuantity
ManualPrice
ScrapingEnabled
Note
CreatedAt
UpdatedAt
```

`ScrapingEnabled` is the authoritative source-level scrape switch.

### ScrapeRun

Represents one execution of the scraping pipeline.

```text
Id
StartedAt
FinishedAt
Status
TotalItems
Successful
Failed
Suspicious
```

### ScrapeResult

Represents one source observation produced during a scrape run.

```text
Id
RunId
ItemId
SourceId
ScrapedPrice
ScrapedQuantity
ScrapedUnitPrice
ManualPrice
ManualQuantity
ManualUnitPrice
ResultStatus
ReviewStatus
ReviewNote
ReviewedAt
SuspiciousReason
Error
CreatedAt
```

### PriceHistory

Stores historical accepted price observations.

```text
Id
ItemId
SourceId
ScrapeResultId
Price
Quantity
UnitPrice
Origin
RecordedAt
```

### PriceAlertEvent

Represents a recorded price alert event.

```text
Id
ItemId
PriceHistoryId
UnitPrice
TargetUnitPrice
Status
Error
SentAt
CreatedAt
```

This part of the system is currently less central than scraping and review.

## 4.2 Relationships

```text
TrackedItem
  ├── ItemSource[]
  ├── PriceHistory[]
  ├── CurrentSource
  └── PreviousSource

ScrapeRun
  └── ScrapeResult[]

ScrapeResult
  ├── TrackedItem
  ├── ItemSource
  └── ScrapeRun

PriceHistory
  ├── TrackedItem
  ├── ItemSource
  └── ScrapeResult
```

## 4.3 Public Web API

Responsibilities:

- product management,
- source management,
- review management,
- public/admin data operations,
- authentication / owner authorization.

Example logical endpoints:

```text
GET    /api/items
GET    /api/items/{id}
POST   /api/items
PUT    /api/items/{id}
DELETE /api/items/{id}

GET    /api/reviews
GET    /api/reviews/pending/count
POST   /api/reviews/{id}/accept
POST   /api/reviews/{id}/reject
POST   /api/reviews/{id}/override
```

Exact route naming may vary, but the responsibilities remain separate.

## 4.4 Private API

Responsibilities:

- run scraping,
- return execution dashboard data,
- manage local scheduling,
- expose local execution status.

Typical logical endpoints:

```text
GET  /api/private/dashboard
POST /api/private/run
GET  /api/private/schedule
POST /api/private/schedule
```

The Private API is not called directly by the browser.

## 4.5 Private Proxy API

The private Next.js frontend exposes `/api/private/*` as a same-origin proxy.

Responsibilities:

1. validate the browser request,
2. build the private backend target URL,
3. attach `X-PriceWatch-Token`,
4. forward allowed headers/body,
5. return the upstream response without exposing the token.

## 4.6 Internal Scraper Interface

The Private API starts the Python scraper as a process.

The scraper receives the required job data and returns structured execution results.

Raw stderr should not be exposed directly to the client.

Secrets must be redacted from process output.

---

# 5. High-Level Architecture

## 5.1 Component View

```text
                    ┌──────────────────────────┐
                    │          User            │
                    └────────────┬─────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
                ▼                                 ▼
      ┌───────────────────┐             ┌───────────────────┐
      │   Public Web      │             │   Private Web     │
      │     Next.js       │             │     Next.js       │
      │                   │             │ 127.0.0.1:3001    │
      └─────────┬─────────┘             └─────────┬─────────┘
                │                                 │
                │                                 │ /api/private/*
                ▼                                 ▼
      ┌───────────────────┐             ┌───────────────────┐
      │ PriceWatch.WebApi │             │ Next.js Proxy     │
      │    ASP.NET Core   │             │ server-side token │
      └─────────┬─────────┘             └─────────┬─────────┘
                │                                 │
                │                                 ▼
                │                       ┌───────────────────┐
                │                       │ PriceWatch.Private│
                │                       │    ASP.NET Core   │
                │                       │ 127.0.0.1:5188    │
                │                       └─────────┬─────────┘
                │                                 │
                │                    ┌────────────┼────────────┐
                │                    │            │            │
                ▼                    ▼            ▼            ▼
      ┌───────────────────┐   ┌────────────┐ ┌──────────┐ ┌──────────────┐
      │ Neon PostgreSQL   │   │ PG Global  │ │ Python   │ │ Task         │
      │ Source of Truth   │   │ Advisory   │ │ Scraper  │ │ Scheduler    │
      │                   │   │ Lock       │ │Playwright│ │ run-once     │
      └───────────────────┘   └────────────┘ └────┬─────┘ └──────────────┘
                                                  │
                                                  ▼
                                         ┌───────────────────┐
                                         │ Public Websites   │
                                         │ Product Sources   │
                                         └───────────────────┘
```

## 5.2 Control Plane

The public control plane consists of:

```text
web
+
PriceWatch.WebApi
```

Responsibilities:

- product configuration,
- source configuration,
- review workflow,
- administrative UI,
- authenticated user operations.

## 5.3 Execution Plane

The private execution plane consists of:

```text
private-web
+
PriceWatch.Private
+
Python scraper
+
Windows Task Scheduler
```

Responsibilities:

- local execution,
- browser automation,
- scheduling,
- run-now,
- operational dashboard.

The execution plane is intentionally local-only.

## 5.4 Shared Data Plane

Both public and private services use Neon PostgreSQL as the common source of truth.

This avoids maintaining separate public/private databases or synchronization pipelines.

---

# 6. Main Workflows

## 6.1 Scrape Workflow

```text
User / Scheduler
    ↓
Run request
    ↓
PriceWatch.Private
    ↓
Acquire PostgreSQL advisory lock
    ↓
Select eligible tracked items
    ↓
Select ScrapingEnabled sources
    ↓
Check interval eligibility
    ↓
Create ScrapeRun
    ↓
Invoke Python scraper
    ↓
SSRF guard
    ↓
Playwright navigation
    ↓
Parse price / quantity
    ↓
Persist ScrapeResult
    ↓
Suspicious?
 ┌──┴───┐
 │      │
Yes     No
 │      │
Review  Acceptable result
 │      │
 └──┬───┘
    ↓
Best-offer selection
    ↓
Update current price / history
    ↓
Finish ScrapeRun
    ↓
Release advisory lock
```

## 6.2 Review Workflow

```text
Pending suspicious result
    ↓
Reviews UI
    ↓
Accept / Reject / Override
    ↓
Update review state
    ↓
If accepted/overridden:
recompute valid offers for relevant run
    ↓
Apply best offer
    ↓
Update history/current price if appropriate
    ↓
Refresh pending review count
```

## 6.3 Private Proxy Workflow

```text
Browser
    ↓
private-web /api/private/*
    ↓
Validate Host
    ↓
Validate client marker
    ↓
For mutation:
validate Origin / Sec-Fetch-Site
    ↓
Attach server-only token
    ↓
127.0.0.1:5188
    ↓
Private API token validation
    ↓
Endpoint execution
```

---

# 7. Bottlenecks, Scale, and Reliability

## 7.1 Current Scale Assumption

The current architecture is appropriate for:

- one primary user,
- relatively small numbers of tracked products,
- relatively small numbers of sources per product,
- periodic scraping rather than continuous high-frequency crawling.

It is not designed as a high-throughput distributed crawler.

## 7.2 Global Scrape Lock

The PostgreSQL advisory lock intentionally serializes scrape runs.

```text
one active scrape run globally
```

Advantages:

- prevents duplicate runs,
- prevents conflicting writes,
- works across scheduler and UI,
- does not require Redis or another coordination system.

Bottleneck:

```text
maximum scrape-run concurrency = 1
```

This is acceptable for the current scale.

If scrape duration becomes too long, this is likely the first major scaling limit.

## 7.3 Browser Automation Throughput

The Python scraper favors controlled execution over high concurrency.

Potential bottlenecks:

- page load latency,
- slow external websites,
- browser startup,
- JavaScript-heavy pages,
- network timeouts.

A future scaling strategy should prefer a bounded worker pool rather than unlimited parallelism.

Any future concurrency must preserve:

- per-source isolation,
- SSRF enforcement,
- rate limiting,
- database consistency,
- external-site friendliness.

## 7.4 Database Growth

As history grows, the main growth tables are expected to be:

```text
scrape_results
price_history
scrape_runs
```

Likely future requirements:

- targeted indexes,
- pagination,
- latest-per-source queries,
- retention strategy,
- archival strategy.

The application should avoid loading full history when only the latest observation is required.

## 7.5 Reviews Count

The header pending-review counter should remain a lightweight query.

Avoid:

```text
load all reviews
-> count in browser
```

Prefer:

```text
COUNT pending reviews
```

## 7.6 External Website Reliability

External websites are outside the system's control.

Expected failure modes:

- HTML changes,
- anti-bot behavior,
- rate limits,
- slow pages,
- JavaScript failures,
- redirects,
- login walls,
- geo restrictions,
- temporary outages.

The scraper should treat parser failures as normal operational failures rather than application crashes.

## 7.7 Hard Crash Recovery

The PostgreSQL advisory lock is automatically released when its database connection disappears.

However, a hard crash can leave a `ScrapeRun` row with:

```text
Status = Running
```

even though no process is still running.

A future reliability improvement should mark stale running rows as `Abandoned` or `Failed` during startup or before the next run.

This is a data-status recovery problem, not a lock problem.

## 7.8 Review Concurrency

Concurrent review actions can create a race if two requests attempt to review the same pending result.

A future hardening step should use a conditional update such as:

```text
UPDATE ...
WHERE review_status = Pending
```

and verify exactly one affected row.

If no row is updated, return:

```text
409 Conflict
```

## 7.9 Database Availability

PostgreSQL is a central dependency.

If Neon PostgreSQL is unavailable:

- public data operations fail,
- scrape execution cannot coordinate,
- the advisory lock cannot be acquired,
- results cannot be persisted.

The system currently prefers fail-closed behavior rather than operating with divergent local state.

## 7.10 Scheduler Reliability

Windows Task Scheduler provides simple local scheduling.

Advantages:

- no always-running background worker required,
- easy local administration,
- integrates with the run-once command.

Limitations:

- machine must be running,
- task configuration is local machine state,
- scheduling is not distributed,
- missed jobs depend on Windows task configuration.

If the system becomes multi-machine or cloud-native, scheduling should move to a centralized job runner.

## 7.11 Private Frontend Polling

The private dashboard periodically refreshes status.

At current scale this is acceptable.

Potential future optimization:

- increase interval,
- pause polling when the tab is hidden,
- use server events or WebSocket only if real-time behavior becomes necessary.

Do not introduce real-time infrastructure unless polling becomes an actual bottleneck.

---

# 8. Reliability Principles

The current system follows these reliability principles:

```text
Fail closed on unsafe network access.
Fail closed when authentication is missing.
Do not expose secrets in errors.
Serialize scrape execution.
Preserve historical observations.
Do not treat stale data as fresh.
Keep one database source of truth.
Allow individual scrape failures without corrupting the whole run.
```

---

# 9. Current Known Limitations

1. Review actions should gain optimistic concurrency protection.
2. Stale `Running` scrape runs should be recovered after crashes.
3. Database constraints can be strengthened for quantities, prices, and run/source uniqueness.
4. Large history tables will eventually require query/index tuning.
5. Python scraper concurrency is intentionally limited.
6. SSRF DNS validation still has a theoretical DNS TOCTOU window.
7. Windows Task Scheduler is local-machine infrastructure rather than distributed scheduling.
8. Browser automation remains dependent on third-party site stability.

These are acceptable limitations for the current project scale.

---

# 10. Design Principles Summary

The current architecture is intentionally based on:

```text
one source of truth
one global scrape coordinator
one shared best-offer rule
one canonical review workflow
one local private execution boundary
one server-side private API token
one execution-time SSRF guard
```

The system should continue to prefer:

- derived state over duplicated persisted state,
- shared business rules over duplicated logic,
- simple local execution over premature distributed infrastructure,
- explicit security boundaries,
- and fewer moving parts wherever correctness is preserved.
