# DESIGN.md

# PriceWatch System Design

## 1. Product Goal

PriceWatch is a user-defined lowest-price monitoring system.

The target user wants to monitor selected products across selected stores without manually checking every store.

Unlike general comparison sites, the user defines:

- which products to track,
- which stores/sources to track,
- target prices,
- sources that may not exist on public comparison platforms.

The system's main job is:

```text
Maintain each source's latest valid price
→ determine the product's current lowest valid price
→ show which store(s) are currently cheapest
→ record lowest-price history
→ alert the user when automation discovers a new below-target best price state
```

Scraping is only one way to obtain a price.

Manual entry is a fallback observation method, not a separate source type.

---

# 2. Core Domain Model

## 2.1 Source

A Source represents a store or purchasing source for a product.

A Source contains:

```text
Store
URL
DefaultQuantity
ScrapingEnabled
ArchivedAt
Note
```

A Source is not "Automatic" or "Manual".

`ScrapingEnabled` only controls whether the scraper may attempt that source.

Archived Sources:

- are hidden from the normal Product page,
- do not scrape,
- do not participate in current price calculation,
- remain available in Edit under a collapsed Archived Sources section,
- preserve historical attribution.

Sources are archived rather than physically deleted.

---

## 2.2 Price Observation

A Price Observation represents a price known for one Source at one point in time.

Origin:

```text
Scraped
Manual
```

Manual observations are append-only.

Entering a new manual price must not overwrite old prices.

Manual observations are considered user-confirmed and are accepted immediately.

---

## 2.3 Source Effective Price

For each active Source:

```text
LatestEffectivePrice =
latest accepted Scraped observation
or
latest Manual observation
```

These do not change effective price:

```text
Failed scrape
Pending Suspicious result
Rejected Suspicious result
```

If the system cannot obtain a new valid price, the previous effective price remains active.

---

## 2.4 Product Best Price State

The Product's current price is:

```text
minimum LatestEffectivePrice
across all active Sources
```

All Sources tied at the minimum are part of the current best state.

Example:

```text
Amazon   90
Walmart  90
Store C  95
```

Current state:

```text
Price: 90
Stores: Amazon, Walmart
```

The system must support multiple simultaneous lowest-price Sources.

---

# 3. Functional Requirements

## 3.1 Product Management

The user shall be able to:

- create and edit tracked products,
- archive/restore products,
- configure target price,
- configure comparison quantity/unit,
- enable/disable tracking,
- manage Sources.

---

## 3.2 Source Management

The user shall be able to:

- add a Source,
- edit Source details,
- enable/disable scraping,
- archive a Source,
- restore an archived Source.

Archived Sources are excluded from current-price calculation but remain in history.

---

## 3.3 Automatic Scraping

Automatic work requires:

```text
Product tracking enabled
+
Source active
+
Source.ScrapingEnabled = true
```

Scheduled scraping also respects `CheckIntervalMinutes`.

`CheckIntervalMinutes` is a minimum scheduled interval, not a timer.

Actual frequency cannot exceed Windows Task Scheduler cadence.

`Run now` ignores `CheckIntervalMinutes`.

---

## 3.4 First Observation Validation

Suspicious validation baseline priority:

```text
1. same Source's latest effective price
2. Product's current effective price
3. basic sanity validation only
```

The target price must not be used as a market-price baseline.

---

## 3.5 Failed Scrape

A Failed scrape means the system could not obtain a trustworthy current price.

Examples:

- timeout,
- unreachable page,
- parser failure,
- missing price,
- blocked page.

Failed results enter Reviews.

If the Source has a previous effective price, Review actions are:

```text
Use last known price
Enter Manual Price
```

`Use last known price` resolves the review without creating a new price observation.

If no previous effective price exists, only:

```text
Enter Manual Price
```

is available.

---

## 3.6 Suspicious Price

A Suspicious result means a price was obtained but appears unreliable.

Suspicious results enter Reviews.

Review actions:

```text
Confirm scraped price
Use last known price
Enter Manual Price
```

Confirming makes the scraped observation accepted.

Using the last known price rejects the suspicious observation and keeps the previous effective price.

Manual entry rejects/replaces the pending observation operationally by appending a new accepted Manual observation.

---

## 3.7 Pending Review

Pending Reviews do not change the Source effective price.

The last known valid price remains active until the Review is resolved.

Failed and Suspicious share the same Review workflow because both mean:

```text
the system cannot currently determine a trustworthy new price
```

They remain separate statuses only to explain why Review is required.

---

## 3.8 Review Concurrency

Review transitions are allowed only while:

```text
ReviewStatus = Pending
```

Exactly one competing decision may succeed.

Later attempts return:

```text
409 Conflict
```

---

## 3.9 Manual Price

Manual prices:

- belong to a specific Source,
- are appended as new observations,
- are immediately accepted,
- are not checked for Suspicious change,
- do not send email alerts.

A mistaken manual price is corrected directly in the database by the operator; history is not automatically overwritten.

---

## 3.10 Current Lowest Price

After any accepted automatic or manual observation, the system recalculates:

```text
LatestEffectivePrice for each active Source
→ minimum price
→ all Sources tied at that minimum
```

If all new scrape attempts fail or remain Pending, the existing last-known effective prices continue to determine the current lowest price.

---

## 3.11 Lowest Price History / Plot

The main chart shows only Product Best Price State history.

It does not show every Source as a separate price line.

A history state contains:

```text
Timestamp
LowestPrice
LowestSources[]
```

A new state is recorded when either:

```text
LowestPrice changes
OR
LowestSources set changes
```

Example:

```text
90 Amazon
→ 90 Walmart
```

is a real state change even though the price is unchanged.

The chart may rise or fall because it represents the best currently known price, not the all-time record low.

---

## 3.12 Email Price Alerts

Email alerts are triggered only by automatic discovery.

Send an email when:

```text
an accepted automatic observation
causes a new Product Best Price State
AND
LowestPrice <= TargetPrice
```

A new Best Price State means:

```text
price changed
OR
lowest Source set changed
```

Do not send when:

- the Best Price State is unchanged,
- the change was caused by Manual entry,
- the change was caused by user Source archive/restore,
- a Suspicious price was confirmed by the user in Review.

If multiple Sources share the lowest price, the email lists all of them.

Supported SMTP configuration:

```text
Outlook / Microsoft
Gmail
Custom SMTP
```

Sender and recipient may be the same account.

Email settings are managed from the local Private Web `Email` tab. They are stored only on the local execution machine under the Private settings directory. The SMTP password is protected at rest with ASP.NET Core Data Protection, is never returned by the Private API, and never reaches the browser after submission. Leaving the password field blank preserves the existing credential.

Environment-based `Email__*` / `EMAIL_*` values may be used as bootstrap compatibility settings before the first UI save. Once local email settings have been saved, the local settings file is authoritative and changes take effect without restarting the Private backend.

The Private Email tab also supports sending a test message without creating a price alert event.

`PriceAlertEvent` stores durable delivery state and prevents duplicate delivery for the same Best Price State event.

---

# 4. Non-Functional Requirements

## 4.1 Security

The system shall:

- sanitize HTTP errors,
- never expose passwords, tokens, connection strings, stack traces, or raw secret-bearing stderr,
- keep private API credentials server-side,
- preserve authentication/authorization boundaries,
- enforce SSRF protection at execution time,
- fail closed on unsafe network targets.

---

## 4.2 Private API Boundary

`PriceWatch.Private`:

- binds only to loopback,
- requires `X-PriceWatch-Token`,
- rejects unauthenticated direct access.

Browser path:

```text
Browser
→ private-web /api/private/*
→ Next.js server proxy
→ X-PriceWatch-Token
→ PriceWatch.Private
```

Mutation requests also validate same-origin intent.

---

## 4.3 Concurrency and Reliability

Only one scrape run executes globally at a time.

Coordination uses a PostgreSQL session advisory lock.

After acquiring the lock:

```text
stale Running runs
→ Abandoned
```

Individual scrape failures must not corrupt unrelated Source or Product state.

If PostgreSQL is unavailable, the system fails closed.

---

## 4.4 Data Integrity

The database shall enforce core invariants including:

- positive quantities,
- non-negative prices where applicable,
- positive configured intervals,
- valid Source/Product relationships,
- no duplicate result for the same run/source where applicable.

Historical accepted observations must remain attributable to their Source.

---

# 5. Data Model

## 5.1 TrackedItem

Represents a monitored product.

Key state:

```text
TrackingEnabled
CheckIntervalMinutes
TargetPrice
ComparisonQuantity
Current lowest price summary
timestamps
archive state
```

No `UpdateMode`.

---

## 5.2 ItemSource

Represents one store/source.

Key state:

```text
ItemId
Store
Url
DefaultQuantity
ScrapingEnabled
ArchivedAt
Note
```

No persistent "Manual Source" or "Automatic Source" mode.

---

## 5.3 Price Observation

The system needs an append-only observation history per Source.

Required logical fields:

```text
ItemId
SourceId
Origin: Scraped | Manual
Price
Quantity
UnitPrice
ObservedAt
Status
ScrapeResultId where applicable
```

The implementation may reuse/refactor existing tables, but behavior must match this model.

---

## 5.4 ScrapeRun

Represents one automatic scrape execution.

States:

```text
Running
Success
Partial
Failed
Abandoned
```

---

## 5.5 ScrapeResult

Represents one scrape attempt.

It records:

```text
RunId
ItemId
SourceId
scraped values when available
ResultStatus
ReviewStatus
SuspiciousReason
sanitized Error
ObservedAt
```

A Failed result may have no price.

---

## 5.6 Best Price History

Stores or deterministically reconstructs Product Best Price State changes:

```text
Timestamp
LowestPrice
LowestSources[]
```

The implementation should avoid duplicated persisted state unless needed for reliable history, plotting, or notifications.

---

## 5.7 PriceAlertEvent

Represents durable email notification state.

It must identify the Best Price State that triggered the alert and support:

```text
Pending
Sent
Failed
```

Duplicate delivery for the same state must be prevented.

---

# 6. APIs

## 6.1 Public API

Responsibilities:

```text
Products
Sources
Reviews
History
Owner-authenticated administration
```

Logical routes include:

```text
/api/items
/api/reviews
/api/reviews/pending/count
/api/reviews/{id}/confirm
/api/reviews/{id}/use-last
/api/reviews/{id}/manual
```

Exact route naming may vary.

---

## 6.2 Private API

Responsibilities:

```text
Dashboard
Run now
Schedule
Email alert settings
Local execution status
```

Logical routes include:

```text
GET    /api/private/dashboard
POST   /api/private/run
GET    /api/private/schedule
PUT    /api/private/schedule
DELETE /api/private/schedule
GET    /api/private/email-settings
PUT    /api/private/email-settings
POST   /api/private/email-settings/test
```

Browser access is proxy-only.

---

# 7. High-Level Architecture

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
              │      ┌───────┼────────┐
              ▼      ▼       ▼        ▼
           Neon PG  PG Lock Python   Task
                            Scraper  Scheduler
                               │
                               ▼
                        Public Websites
```

Neon PostgreSQL is the shared source of truth.

The execution plane remains local-only.

---

# 8. Main Workflow

```text
Scheduler / Run now
→ acquire global lock
→ recover stale runs
→ scrape eligible Sources
→ validate each result
→ Accepted / Failed / Suspicious
→ Failed or Suspicious enters Review
→ Pending keeps last known effective price
→ accepted observation updates Source effective price
→ recalculate Product Best Price State
→ record history state if price or Source set changed
→ automatic below-target state queues an email alert
→ SMTP outbox sender delivers/retries queued alerts
→ finish run
```

Manual workflow:

```text
User enters Source-specific Manual price
→ append accepted Manual observation
→ recalculate Product Best Price State
→ record history state if changed
→ no email
```

---

# 9. Scale, Bottlenecks, Reliability

Current target:

```text
one primary user
small-to-moderate number of products and Sources
periodic scraping
one local execution environment
```

Main bottlenecks:

- global scrape serialization,
- Playwright/external website latency,
- growing observation/history tables.

Future scaling may use bounded concurrency, stronger indexing, pagination, and retention policies if needed.

Do not introduce distributed infrastructure before current scale requires it.

Known limitations:

1. SMTP delivery is at-least-once; a process crash after provider acceptance but before the Sent status commit can duplicate one message.
2. First-ever Source observations without any baseline can only receive sanity validation.
3. SSRF DNS validation retains a theoretical DNS TOCTOU window.
4. Task scheduling is local-machine infrastructure.
5. Large history datasets may eventually require additional indexing/retention.

---

# 10. Design Baseline

The authoritative business chain is:

```text
Source
→ Price Observation
→ Source Latest Effective Price
→ Product Best Price State
→ Lowest Price History
→ Optional Automatic Email Alert
```

Any future change to functionality, data/API contracts, architecture, security boundaries, concurrency, scheduling, or reliability requires explicit user approval before implementation.
