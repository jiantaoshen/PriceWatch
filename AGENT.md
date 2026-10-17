# AGENT.md

## 1. DESIGN.md is the baseline

Before changing code, read `DESIGN.md`.

`DESIGN.md` is the current functional and architectural baseline.

The implementation must continue to satisfy its:
- Functional Requirements
- Non-Functional Requirements
- Data & API
- High-Level Architecture
- Bottlenecks, Scale, and Reliability

Do not remove or weaken documented behavior just to reduce code.

If the current implementation conflicts with `DESIGN.md`, treat `DESIGN.md` as the intended behavior unless the user says otherwise.

## 2. Better designs require approval

`DESIGN.md` is the baseline, but it is not immutable.

If you find a better design, you may propose it.

Before changing any of these, ask the user first:
- functionality
- API contracts
- persistent data model
- architecture
- security boundaries
- concurrency model
- scheduling behavior
- reliability guarantees
- major workflows
- scale assumptions

Use this format:

```text
Current design
Proposed design
Why it is better
Tradeoffs / risks
What changes
```

Only after explicit approval should you update both `DESIGN.md` and the implementation.

Internal refactors that preserve the design do not require approval.

## 3. Prefer less code

Reduce code whenever it is safe.

Prefer fewer:
- files
- components
- wrappers
- state variables
- API fields
- duplicated conditions
- CSS / className entries
- DOM elements
- duplicate requests
- duplicate configuration

Do not reduce code at the cost of correctness, security, clarity, or maintainability.

## 4. Every piece of code needs a purpose

Every variable, field, component, endpoint, helper, filter, badge, icon, and configuration value must have a unique responsibility.

If two things represent the same fact or perform the same job:

```text
MERGE
DERIVE
or DELETE
```

Before adding something, ask:

> Does this already exist somewhere else?

If two values should never disagree, they probably should not both be stored.

## 5. One source of truth

Prefer:

```text
one authoritative value
→ derived representations
```

Avoid storing the same fact in:

```text
database
+ backend state
+ DTO
+ frontend state
+ filter
+ badge
```

Persist only independent business facts.

## 6. Merge duplicate features

If the same feature appears in multiple places, keep one canonical location unless the second location provides a genuinely different workflow.

When removing duplicate UI, also remove:
- duplicate state
- duplicate requests
- duplicate API fields
- dead components

## 7. Merge duplicate components

If two components differ only by labels or trivial props, prefer one shared component.

Delete wrappers that only forward props.

Do not create large generic abstractions just to remove a few repeated lines.

Prefer deletion over unnecessary abstraction.

## 8. UI rules

Simplify UI where possible.

Remove:
- repeated labels
- repeated counters
- repeated filters
- decorative icons
- unnecessary wrappers
- redundant status text
- unnecessary className entries

If icon and text mean the same thing, keep the text and remove the icon.

Keep icons only when they add information.

## 9. Do not merge truly different states

Similar names do not automatically mean duplication.

Keep states separate when they represent different:
- scopes
- actors
- lifecycle stages
- state machines
- security boundaries
- business facts

Simplification must preserve semantics.

## 10. Security and reliability are not optional duplication

Do not remove security or reliability controls just because similar checks exist elsewhere.

Preserve documented:
- authentication
- authorization
- secret isolation
- input validation
- exception sanitization
- CSRF / origin checks
- SSRF protection
- concurrency protection
- database constraints
- recovery behavior

Different layers may intentionally protect different boundaries.

## 11. Database and API changes

Before changing database schema or API contracts, compare against `DESIGN.md`.

Do not edit historical migrations that may already be applied.

For a schema change:
1. update the model
2. generate a new migration
3. inspect the migration
4. ensure only expected changes appear
5. apply it only after validation

If a simple change generates large unrelated schema changes, stop and fix the configuration mismatch first.

## 12. Existing change sets are part of the baseline

Previously accepted changes remain part of the current baseline unless the user explicitly says they were reverted or changed.

If a previous patch changed files and the user says they did not modify them afterward:
- treat those files as current state
- do not accidentally restore older versions
- apply new changes on top of them

When combining patches, use the newest intended version of overlapping files.

## 13. Validation

Before declaring work complete:
1. confirm affected `DESIGN.md` requirements still hold
2. run available build / type / lint / tests
3. inspect migrations when relevant
4. search for stale references and dead imports
5. confirm deleted concepts are no longer active

A successful build alone is not enough.

If something cannot be verified, say so clearly.

## 14. Definition of done

A change is done when:

```text
DESIGN requirements still pass
+
behavior is correct
+
security/reliability are preserved
+
duplication is reduced where safe
+
dead code is removed
+
available validation passes
```

Priority order:

```text
1. User instruction
2. DESIGN.md
3. Correctness
4. Security / data integrity
5. Simplicity
6. Fewer lines of code
```
