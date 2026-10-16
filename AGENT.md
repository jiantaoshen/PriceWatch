# AGENT.md

## Purpose

This repository follows a **minimal-state, minimal-code, single-responsibility** engineering style.

The agent should prefer removing, merging, and deriving over adding new abstractions.

The goal is:

> **Reduce code, duplicated concepts, duplicated UI, duplicated state, and maintenance paths without reducing correctness, security, clarity, or reliability.**

---

# 1. Baseline and Change-Set Rules

Treat previously accepted changes as part of the current baseline unless the user explicitly says they were reverted or modified afterward.

If an earlier change modified files and the user says those files were not changed afterward:

- treat those files as authoritative current state,
- do not apply a later patch against an older version,
- do not silently restore concepts that were intentionally removed.

When combining multiple change sets:

1. Start from the newest valid baseline.
2. Apply later changes on top of it.
3. Resolve conflicts using the newest intended behavior.
4. Preserve unrelated user changes.
5. List any files that must be deleted.

Never assume that an incremental patch includes earlier required changes.

---

# 2. Core Engineering Rules

## Rule 1 — Prefer less code

Whenever it is safe, reduce:

- files,
- classes,
- components,
- wrappers,
- state variables,
- DTO fields,
- API fields,
- configuration values,
- CSS / utility classes,
- repeated conditions,
- duplicated derived values,
- duplicated UI controls,
- duplicated requests,
- and duplicated documentation.

Reducing unnecessary `className` entries and DOM wrappers also counts.

Do not reduce code at the cost of:

- correctness,
- readability,
- security,
- accessibility,
- data integrity,
- testability,
- or maintainability.

The goal is **minimal necessary code**, not code golf.

---

## Rule 2 — Every piece of code needs a unique responsibility

Every:

- variable,
- field,
- property,
- class,
- component,
- endpoint,
- helper,
- service,
- hook,
- API response field,
- UI control,
- badge,
- icon,
- filter,
- configuration value

must have a clear independent purpose.

If two things represent the same fact or perform the same job, assume they should be:

1. merged,
2. derived from one source,
3. or one of them deleted.

Before adding something new, ask:

> “Does this already exist somewhere else?”

Before keeping two similar concepts, ask:

> “Can these ever legitimately disagree?”

If they should never disagree, they probably should not both be stored.

---

## Rule 3 — Prefer one source of truth

A business fact should have one authoritative representation.

Avoid storing the same fact in multiple forms such as:

```text
database field
+ DTO field
+ frontend state
+ display mode
+ filter flag
+ badge flag
```

Prefer:

```text
authoritative state
    ↓
derived values when needed
```

Derived values should normally be calculated rather than persisted.

Persist a value only when it represents an independent business fact.

---

# 3. Detect and Remove Duplicate State

For every state field, ask:

1. Is this an independent fact?
2. Can it be derived from existing state?
3. Can this value disagree with another value that is supposed to mean the same thing?
4. Does storing it require synchronization logic?
5. Does removing it simplify the system without losing information?

If a value is fully derivable, prefer deriving it.

Avoid duplicate concepts such as:

```text
ModeA / ModeB
isAutomatic / automaticMode
countA / hasA
status flag / equivalent enum
```

when one authoritative field already describes the behavior.

---

# 4. Keep Legitimately Different States Separate

Do not merge fields merely because their names look similar.

Two values should remain separate when they represent:

- different scopes,
- different actors,
- different lifecycle stages,
- different state machines,
- different security boundaries,
- or different business facts.

Examples of valid distinctions:

```text
entity enabled
vs
child feature enabled
```

```text
execution status
vs
human review status
```

```text
requested state
vs
observed state
```

Simplification must preserve semantics.

---

# 5. Derived State Rules

Derived state should be:

- deterministic,
- cheap enough to calculate,
- based on authoritative data,
- clearly named as derived,
- not independently persisted unless justified.

Prefer names such as:

```text
hasX
canY
pendingCount
isDue
displayStatus
```

Avoid derived names that look like new authoritative domain states.

If a derived field is sent through an API for query efficiency, it must not become a second source of truth.

---

# 6. Merge Duplicate Features

If the same feature appears in multiple places, identify one canonical location.

A second entry should remain only if it provides a genuinely different workflow.

Bad:

```text
Header:
Reviews

Page filter:
Reviews 3
```

when both represent the same pending review concept.

Preferred:

```text
Header:
Reviews 3
```

One feature, one canonical entry.

When merging:

- preserve the useful information,
- remove the redundant entry,
- remove duplicate requests/state used only by the deleted entry.

---

# 7. Merge Duplicate Components

Two components that differ only by labels, minor props, or trivial wrappers should usually become one shared component.

Bad:

```text
ProductToolbar
SubscriptionToolbar
CommonToolbar
```

when all three render the same structure.

Preferred:

```text
ItemToolbar
```

configured only by the differences that truly matter.

Delete wrappers that only forward props.

A wrapper is justified only when it adds:

- real behavior,
- policy,
- state,
- lifecycle,
- security,
- or meaningful layout semantics.

---

# 8. Avoid Over-Abstraction

Removing duplication does **not** mean building a generic framework for every similarity.

Avoid:

- inheritance trees for minor differences,
- generic factories for two trivial cases,
- interfaces with one implementation and no boundary value,
- services that only forward another service call,
- hooks that wrap one line without adding behavior,
- helper functions used once when inline code is clearer,
- “Manager”, “Provider”, “Handler”, or “Util” classes without a distinct responsibility.

Prefer deletion over abstraction when both solve the same problem.

An abstraction is justified only when it makes the system smaller, clearer, or more consistent.

---

# 9. UI Simplification Rules

For each screen or component, review:

- duplicated labels,
- duplicated counters,
- repeated status text,
- repeated filters,
- decorative icons,
- unnecessary wrappers,
- unnecessary borders,
- repeated button groups,
- duplicated headings,
- repeated derived values,
- redundant explanatory text.

Prefer:

- one obvious action,
- one canonical location per feature,
- text-first labels,
- fewer visual layers,
- fewer repeated status indicators.

Do not remove UI that carries unique information, prevents mistakes, or improves accessibility.

---

# 10. Icon Rules

If text already clearly communicates the meaning, remove the icon.

Bad:

```text
[box icon] Products
[review icon] Reviews
[edit icon] Edit
[logout icon] Sign out
```

Preferred:

```text
Products
Reviews
Edit
Sign out
```

Keep an icon only when it adds information that the text does not already provide.

Good uses include:

- trend direction,
- warning severity,
- compact icon-only actions with established meaning,
- state differentiation that materially improves scanning,
- information that would otherwise require extra text.

Do not keep icons purely for decoration.

---

# 11. CSS and Markup Reduction

Treat markup and styling as code.

Remove unnecessary:

- wrapper elements,
- nested containers,
- duplicated layout classes,
- duplicated spacing classes,
- redundant width/height declarations,
- classes already inherited or implied,
- styling variants that are visually identical.

Prefer semantic structure over deeply nested layout wrappers.

Do not reduce markup if doing so harms:

- accessibility,
- keyboard navigation,
- responsive layout,
- or semantic HTML.

---

# 12. API Response Rules

Do not return fields that the client can safely and deterministically derive from already-returned authoritative data.

Example:

If the response already contains:

```text
currentValue
targetValue
```

avoid also returning:

```text
belowTarget
```

when it is simply:

```text
currentValue <= targetValue
```

unless the backend definition contains additional business rules that the client cannot reproduce safely.

Every API field should justify:

- payload size,
- type maintenance,
- mapping code,
- tests,
- and client coupling.

---

# 13. Avoid Duplicate Requests

UI duplication often creates network duplication.

Look for cases where a page:

- fetches a full collection only to display a count,
- makes two requests for overlapping data,
- loads data for a control that was removed,
- separately fetches something already available in page data.

Prefer a lightweight query when only a small projection is needed.

Example:

```text
Bad:
fetch all records
→ count them in the client

Better:
GET /pending/count
```

But do not create a new endpoint if the same count already exists in a response that is naturally loaded.

---

# 14. Configuration Rules

Configuration should also have one source of truth.

Avoid:

- storing the same setting in multiple files,
- frontend and backend copies of the same secret,
- environment variables with overlapping meanings,
- legacy configuration paths that silently override the current one.

Separate configuration by trust boundary.

A process should receive only the values it needs.

Do not pass backend secrets to frontend/server processes unnecessarily.

---

# 15. Security Is Not Duplicate Code

Do not remove security controls simply because similar checks exist at multiple layers.

Defense-in-depth is intentional when different layers protect different boundaries.

Examples:

```text
input validation
+
authorization
+
database constraint
```

```text
HTTP sanitization
+
log redaction
```

```text
application-level network validation
+
network sandbox
```

Before deleting a security check, identify exactly which boundary it protects.

Never simplify by weakening:

- authentication,
- authorization,
- secret isolation,
- exception sanitization,
- origin validation,
- CSRF protection,
- SSRF protection,
- concurrency protection,
- database constraints,
- or auditability.

---

# 16. Data Correctness Beats Code Reduction

Do not delete code that preserves important data semantics.

Keep independent rules for:

- freshness,
- concurrency,
- ordering,
- timestamps,
- idempotency,
- conflict detection,
- consistency,
- transaction boundaries,
- recovery.

If a shorter implementation makes it harder to prove correctness, prefer the clearer implementation.

---

# 17. Database Design Rules

Before adding a database column, ask:

1. Is this an independent business fact?
2. Can it be derived?
3. Can it become inconsistent with another field?
4. Will storing it require synchronization logic?
5. Is it needed for query performance or historical truth?

Do not persist display-only or convenience state without a strong reason.

Prefer database constraints for true invariants.

Examples:

```text
CHECK
UNIQUE
FOREIGN KEY
NOT NULL
```

when the rule belongs to the data model.

---

# 18. Migration Safety

Never casually edit historical migrations that may already have been applied.

For schema changes:

1. modify the current model,
2. generate a new migration,
3. inspect the generated migration,
4. verify that only expected schema changes appear,
5. apply it only after validation.

If a simple change generates massive unrelated:

- column renames,
- PK/FK rebuilds,
- index renames,
- table changes,

stop.

That usually indicates model configuration drift between:

- runtime,
- design-time tooling,
- or snapshot history.

Fix the configuration mismatch before applying the migration.

---

# 19. Naming Rules

Names should describe current responsibility, not historical implementation.

Prefer names that reveal behavior.

Good:

```text
hasItems
isDue
pendingCount
onDemand
scrapingEnabled
```

Avoid names that preserve obsolete architecture:

```text
oldMode
hybridMode
manualTrigger
legacyState
temporaryFlag2
```

Rename concepts when their responsibility changes.

---

# 20. Delete Dead Code

After replacing or merging code, delete the old implementation.

Do not leave:

- unused components,
- unused files,
- stale imports,
- commented-out alternatives,
- old DTO properties,
- obsolete endpoints,
- dead helpers,
- compatibility fields with no consumer.

A repository should not become an archive of abandoned designs.

Historical migrations are an exception when they are part of database history.

---

# 21. Refactoring Workflow

Use this process for cleanup work.

## Step 1 — Identify the authoritative source

Find the real source of truth.

## Step 2 — Search all representations

Search:

- entities,
- models,
- DTOs,
- API contracts,
- frontend types,
- client state,
- UI controls,
- filters,
- helpers,
- configuration,
- database columns,
- tests,
- documentation.

## Step 3 — Classify every occurrence

Use:

```text
KEEP
DERIVE
MERGE
DELETE
```

## Step 4 — Remove duplicate state first

Avoid compatibility variables unless an actual migration requires them.

## Step 5 — Merge duplicate behavior

Reuse the smallest suitable existing abstraction.

## Step 6 — Simplify UI and markup

Remove redundant controls, icons, wrappers, counters, and labels.

## Step 7 — Remove dead code

Delete replaced files and stale references.

## Step 8 — Check downstream effects

Search for:

- broken imports,
- stale API types,
- deleted fields,
- obsolete tests,
- unused styles,
- migration references.

## Step 9 — Verify behavior

Run the relevant checks before declaring completion.

---

# 22. Validation Requirements

Use every relevant validation available in the environment.

Examples:

```text
compiler/build
type checking
lint
unit tests
integration tests
frontend build
backend build
database migration inspection
database update on a safe environment
search for obsolete identifiers
search for dead imports
search for deleted component references
```

After removing a concept, verify that active references are zero.

Historical migrations or changelogs may legitimately contain old names.

Do not edit history merely to make text search return zero.

---

# 23. Regression Rule

A refactor is successful only if:

```text
same or better behavior
+
less duplication
+
less code or lower conceptual complexity
```

If a cleanup introduces:

- new bugs,
- new hidden state,
- extra requests,
- new synchronization logic,
- extra abstractions,
- harder debugging,

then the cleanup is not successful even if line count decreased.

---

# 24. Patch and Delivery Rules

When the user asks for changed files only:

- include only files changed for the requested change,
- do not silently include unrelated previous work.

When earlier changes are required:

- state that dependency clearly,
- or provide a combined patch when requested.

When combining patches:

1. use the newest valid baseline,
2. apply changes in order,
3. resolve overlapping files using the newest intended behavior,
4. preserve unrelated user edits,
5. list deleted files explicitly.

Do not describe a file as modified unless it is actually part of the delivered change set.

---

# 25. Review Checklist

Before keeping a piece of code, ask:

```text
Does it represent unique information?
Does it perform unique behavior?
Can it be derived from authoritative state?
Does another UI element already provide the same function?
Does another component already render the same controls?
Can these two states legitimately disagree?
Does this abstraction reduce total complexity?
Does this icon add information?
Does this API field add information?
Does this wrapper add behavior?
Would removing it weaken security or correctness?
```

If it has no unique responsibility, merge or delete it.

---

# 26. Priority Order

When cleaning a codebase, prioritize:

1. correctness,
2. security,
3. data integrity,
4. clear ownership / source of truth,
5. removal of duplicated state,
6. removal of duplicated behavior,
7. removal of duplicated UI,
8. reduced network work,
9. reduced code,
10. cosmetic cleanup.

Never optimize line count before correctness.

---

# 27. Final Principle

Prefer architecture shaped like:

```text
One fact
    ↓
One authoritative source
    ↓
Derived representations when needed
    ↓
One canonical behavior
    ↓
One canonical UI entry
```

Avoid:

```text
One fact
    ↓
database state
+ backend state
+ DTO state
+ frontend state
+ filter state
+ badge state
+ duplicate navigation
+ duplicate components
```

The agent should continuously move a repository toward:

> **fewer states, fewer concepts, fewer components, fewer duplicate features, fewer visual elements, and clearer responsibility — while preserving correctness, security, and maintainability.**
