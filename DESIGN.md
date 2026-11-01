# PriceWatch System Design — Local-first v1

> **Design decision (2026-11-01):** PriceWatch is a **single-user, Windows-local** price tracker. The target architecture is one local Next.js web application, one SQLite data file, an independent existing Python/Playwright scraper orchestrated by a lightweight .NET process, and **Windows Task Scheduler**. Neon/PostgreSQL, public hosting, the two-web-app split and cloud login are retired **only after** a verified migration.
>
> **Implementation status:** This document specifies the target design. The uploaded repository snapshot still uses PostgreSQL/Npgsql, separate `web`/`private-web` applications and two ASP.NET APIs. Phase 1 delivers a **read-only PostgreSQL → SQLite staging-data copy**, not an application switch-over. Do not point the existing .NET services at the staging DB yet.
>
> **Explicit constraints:** SQLite is the only eventual source of truth; **do not rewrite the scraper**; do not add a per-domain allowlist; keep the existing network safety checks; do not enable SQLite WAL as part of the initial migration; preserve the Windows scheduled task and the scraper's independent execution.

---

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

# 4. Non-Functional Requirements — Local-first

## 4.1 Local security boundary

- Bind the sole web application to **127.0.0.1** by default. Local-only does not automatically mean trustworthy: mutating browser endpoints must validate request origin/CSRF and never expose an arbitrary OS command runner.
- The browser never receives database credentials, raw file access, or scraper subprocess control. Only Next.js **server-side** code can access the SQLite file.
- Products and scrape URLs are **entered by the owner**. No separate website/domain allowlist is required. The existing scraper network guard remains in place to block non-public/loopback/internal destinations and invalid protocols at request time, including redirects and subresources; this is a network safety boundary, not a domain allowlist.
- Keep the Playwright worker a separate, low-privilege local process. Do not inject scraped page data into shell commands; treat scraped values as untrusted.
- Do not log passwords, API tokens, email credentials, or raw database connection strings. Keep the SQLite data file and backups out of Git; use appropriate Windows file permissions.

## 4.2 Runtime separation

- **UI (on demand):** a single Next.js application exposes viewing and local management, including former `private-web` features, on `http://127.0.0.1:3000`.
- **Scraper (scheduled independently):** Windows Task Scheduler runs the existing .NET orchestrator + Python/Playwright worker; the task writes to the same local SQLite file and exits without requiring Next.js to run.
- **No always-on Web API:** after the application migration, Next.js server-side Route Handlers / Server Actions handle local CRUD and reads. Retain only the .NET logic needed by the scraper; do not duplicate the price rules in JavaScript without tests.
- **No public cloud access:** Neon, Vercel, Cloud Run and Microsoft cloud login are removed only after an explicit cutover and verification.

## 4.3 Concurrency, reliability and scheduling

- Retain Windows Task Scheduler as the sole scheduled trigger. Configure it **not to start another instance** while a scrape is active.
- Ensure only one scrape writes at a time, including if a manual run is offered later. Replace the PostgreSQL session-level advisory lock with a local-process/file or OS lock before cutover; SQLite's write lock is **not** a substitute for scrape-run coordination.
- Keep transactions short and handle `SQLITE_BUSY` with a bounded timeout or retry. Begin with SQLite's **default rollback journal**; do not enable WAL in v1. Revisit WAL only after actual use suggests contention.
- Preserve recovery for interrupted `Running` runs, validation, Reviews, best-price calculations and notification delivery semantics.
- Back up SQLite consistently, retain the Neon source in read-only mode during validation, and have a rollback path.

## 4.4 Data integrity

- Keep stable item/source/run/observation IDs, UTC timestamps, decimal price precision, archived records, relationships, review states and alert history.
- Enforce nonnegative prices, positive quantities, source-item relationships and uniqueness as in the existing domain rules, adapted for SQLite's type system.
- For the migration: source reads use one **read-only, repeatable-read PostgreSQL snapshot**; output is written to a **new SQLite staging file**. Verify table counts, serialized values, foreign keys and SQLite integrity before making it available. Do not claim the staging schema is already an EF Core SQLite schema.

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

# 6. Local Application Interfaces (target)

- The merged Next.js application offers product and source management, subscriptions, reviews, best-price history, graphs, schedule/run visibility and optional email settings.
- Prefer server-side data access via a **single** SQLite repository layer. Browser-to-server writes use same-origin protections, validated inputs and explicit allowed operations.
- Existing public `/api/items`, `/api/reviews` and private dashboard/run/schedule routes are migration inputs, **not two permanent APIs**. Refactor them into local-only Route Handlers/Server Actions as each feature is moved.
- Keep scraper execution outside the web process. Where the UI exposes “Run now”, it must invoke a constrained local operation rather than accepting shell commands or arbitrary executable paths.

---

# 7. Target High-Level Architecture

```text
         Browser (only while user opens PriceWatch)
                           |
                           v
            Next.js Local Web (127.0.0.1:3000)
                   server-side data access
                           |
                           v
                 data/pricewatch.sqlite3
                  (single source of truth)
                           ^
                           |
            lightweight .NET scrape orchestrator
                           |
                   Python + Playwright
                           ^
                           |
                Windows Task Scheduler
                 (runs, then exits)
```

**Migration order:** (1) stage and validate data in SQLite, (2) switch the scraper data layer/locking to SQLite without rewriting its extraction logic, (3) merge `private-web` features into `web` and replace API data access, (4) cut over and retire Neon / cloud deployments. Throughout the transition the existing PostgreSQL application remains operational; do **not** run the old PostgreSQL-writing worker and a new SQLite-writing worker as independent authoritative sources.

---

# 8. Workflows

**Scheduled crawl (no UI required):**

```text
Windows scheduled task
→ start lightweight .NET runner
→ acquire local single-run lock
→ read due active sources from SQLite
→ call existing Python Playwright worker
→ validate accepted/failed/suspicious results
→ update source-effective prices and best-price history
→ write scrape results/reviews/alerts to SQLite
→ release lock and exit
```

**Interactive read/edit:**

```text
User launches Next.js
→ browser opens 127.0.0.1:3000
→ Next.js server-side code reads/writes SQLite
→ view charts, history, sources, reviews and management
→ user closes site / stops Next.js (scheduled crawl unaffected)
```

The existing manual observation and email-alert semantics from sections 2–3 continue unchanged unless explicitly revised.

---

# 9. Migration Plan and Acceptance Gates

## Phase 1 — SQLite data migration (first)

- Keep the legacy PostgreSQL/Neon system unchanged. Use `scripts/migrate_postgres_to_sqlite.py` for a PostgreSQL **read-only** snapshot into `data/pricewatch-staging.sqlite3`.
- Export the eight business tables: `tracked_items`, `item_sources`, `scrape_runs`, `scrape_results`, `price_history`, `best_price_states`, `best_price_state_sources`, `price_alert_events`.
- Carry UUIDs and timestamps as text, booleans as integers, and numeric/decimal values as **exact text** in the staging copy to avoid premature float conversion. This staging format is **not yet** the definitive EF Core SQLite runtime mapping; computed PG values are copied as ordinary columns for auditing.
- Verify each table's row count and content hash, composite relations, `PRAGMA foreign_key_check` and `PRAGMA integrity_check`. Abort on any mismatch. Source Neon data is never deleted or modified.
- The archive has schema/code, **not actual Neon rows or connection credentials**. Real data export must run on the owner's computer using a read-only credential. Instructions: [`docs/SQLITE_MIGRATION.md`](docs/SQLITE_MIGRATION.md).

## Phase 2 — Runtime SQLite integration (later, separately validated)

- Create SQLite-provider EF Core migrations and resolve date/decimal/computed-column semantics (including `DateTimeOffset` ordering and exact decimal arithmetic).
- Import the verified snapshot to the provider-compatible schema; reconcile IDs, observations, history, counts and checksums again.
- Replace Npgsql-based DB access and PostgreSQL advisory lock with SQLite/local equivalents. Leave Python extraction logic and Windows Task Scheduler cadence intact.
- Test scheduled crawl with the web process **stopped**, and test web reads while a crawl writes.

## Phase 3 — Consolidate local UI and retire cloud (later)

- Merge `private-web` pages into `web`, keep shared UI/core contracts, remove redundant API and cloud login after validation.
- Verify product CRUD, manual price, reviews, price graphs, alerts, task execution and Windows restart behavior.
- Only then disable Neon access, revoke its credentials and retire cloud infrastructure. Keep an offline archive/backup for rollback.

## Release criteria

- Same item/source/history/alert counts and meaningful price results before and after migration.
- No missing relationships or corrupted timestamps/price precision.
- Windows Task Scheduler can run the scraper alone; closing Next.js does not stop scheduled crawls.
- Website listens only on loopback and no untrusted browser mutation can trigger arbitrary local commands.
- The active system has **one** authoritative SQLite database, and recurring backups are defined before deleting legacy data.

---

# 10. Design Baseline

The authoritative business chain is unchanged:

```text
Source → Price Observation → Source Latest Effective Price
→ Product Best Price State → Lowest Price History
→ Optional Automatic Email Alert
```

Local-first architectural decisions override the legacy deployment topology; the business and validation rules in sections 1–3 and 5 are preserved. Any future change to business behavior, scraper extraction, scheduling cadence, SQLite journal mode, or trust boundaries requires the user's explicit approval.
