# Architecture & Design Documentation Guide

**See:** `@.safeword/guides/llm-writing-guide.md` for LLM-consumable documentation principles.

---

## Two Architecture Documents (Know Which You're Looking At)

A safeword project carries two architecture documents. They are different genres
that rot differently — keep them apart and never edit one as if it were the other.

|               | Generated state doc                                                                                         | Hand-curated decision doc                   |
| ------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **File**      | `<namespace-root>/architecture.generated.md` (plus `packages/<pkg>/architecture.generated.md` in monorepos) | `ARCHITECTURE.md` (or `paths.architecture`) |
| **Answers**   | "What the system **is** right now"                                                                          | "**Why** we decided X"                      |
| **Owner**     | Machine — carries a `generator: safeword-architecture` marker                                               | Humans                                      |
| **Editing**   | Never by hand; regenerated deterministically                                                                | In place, by people                         |
| **Freshness** | Self-heals at session start; enforced in commits + CI                                                       | Reviewed like any doc                       |

The rest of this guide is the how-to for the **hand-curated decision doc** — the
genre you author. The generated state doc is summarized next: you read it, you
don't write it.

## The Generated State Document (read it, don't write it)

Safeword keeps a deterministic, point-in-time map of the system fresh on its own
(no LLM):

- **What it is** — a Markdown file at `<namespace-root>/architecture.generated.md`
  carrying a `generator: safeword-architecture` marker, listing the top-level
  `src/` modules with a code reference and one-line purpose each. In a monorepo it
  is a thin **root index** (package list + one-line purposes + inter-package
  dependency edges) plus a colocated **leaf doc** in every package that has a
  `src/` tree (`packages/<pkg>/architecture.generated.md`).
- **Stays fresh on its own** — a SessionStart hook re-extracts the structure and
  re-stamps a shape-fingerprint, so structural facts are always current (even
  after out-of-band human edits). Prose that has fallen behind the structure is
  flagged `⚠ stale` rather than left silently wrong. A doc safeword does not own
  (no marker) is never touched.
- **Enforced, not just suggested** — `safeword architecture --check` fails CI when
  a committed doc is stale; a commit-time hook regenerates and stages it
  automatically. Both honor `architectureDocEnforcement` (default-on; set `false`
  to opt out).
- **Don't hand-edit it** — your edits are overwritten on the next heal. Record
  durable decisions in the hand-curated doc below instead.

---

## Survey & Reconcile (Before You Propose)

The order is load-bearing (full version in `@.safeword/SAFEWORD.md` → Clarify):

1. **Frame** the hard constraints — data model, non-negotiable framework idioms, prior decisions.
2. **Design the ideal** with `/figure-it-out`, as if the codebase didn't exist. This is your yardstick.
3. **Survey** the existing patterns in the area — _now_, not before. Surveying first anchors the design to the status quo.
4. **Reconcile** — conform by default; record the call when your ideal diverges.

### Survey: what to look for

- **Sibling implementations** — grep the layer/feature for code that solves the same shape of problem. How is it structured?
- **Prior decisions** — search `ARCHITECTURE.md` and tickets for an existing ruling on this pattern.
- **Tests near the code** — they encode the conventions you'd be expected to match.
- **Call-site count** — how many places use the existing pattern? Write the number down; it is the cost of deviating.

### Reconcile: conform by default

Default to the existing pattern. Per Google's code-review standard, conform "as long as that doesn't worsen the overall code health of the system" — deviate only when your ideal is a _real_ improvement, not your taste.

**Ideal and existing agree → no decision, no record.** When they diverge, record the call (below). You can't silently conform your ideal away (that is how mediocre patterns calcify), and you can't silently deviate (that is how a codebase splits in two).

### The reconcile record

Required only when the ideal diverges from what exists:

| Field                       | Notes                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Direction**               | Conform, or deviate                                                                                             |
| **Reason**                  | The load-bearing why                                                                                            |
| **Health defect** (deviate) | A _named_ failure of the existing pattern the ideal fixes. "Cleaner" is not a defect.                           |
| **Inconsistency cost**      | The call-site count you're splitting (from the survey)                                                          |
| **Pre-mortem**              | One line: "assume deviating was wrong — what broke?" Prospective hindsight surfaces costs you're discounting.   |
| **Uplevel ticket**          | The tracked follow-up to migrate the rest. Track it; don't migrate every call site now (avoid the rabbit-hole). |

**Depth scales with reversibility:**

- **Reversible + local** → the record is a few lines in the ticket.
- **Irreversible or cross-cutting** (data model, public API) → promote to a full Architecture Doc decision (What / Why / Trade-off / Alternatives, below) and get a second opinion that tries to _refute_ the deviation before committing.

---

## Document Type Decision Tree

The first matching row picks the doc type:

| If the work is a…                  | Doc              |
| ---------------------------------- | ---------------- |
| technology or library choice       | Architecture Doc |
| new data model or schema change    | Architecture Doc |
| project-wide pattern or convention | Architecture Doc |
| specific feature implementation    | Design Doc       |

**Tie-breaker:** If a feature requires a new tech/schema choice, document the tech/schema in Architecture Doc first, then reference it in Design Doc.

| Term                 | Definition                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| Technology choice    | Selecting a library, framework, database, or tool                          |
| Schema change        | Adding/modifying entities, tables, relationships, or data types            |
| Project-wide pattern | Convention that applies to 2+ features or multiple developers              |
| Major decision       | Affects 2+ components, costs >$100/month, or cannot be easily reversed     |
| Living document      | Updated in place (not immutable); changes tracked via version/status       |
| ADR                  | Architecture Decision Record—legacy pattern of separate files per decision |

---

## Quick Decision Matrix

| Scenario                        | Doc Type                        | Rationale                          |
| ------------------------------- | ------------------------------- | ---------------------------------- |
| Choosing between technologies   | Architecture                    | Tech choice affects whole project  |
| Data model design               | Architecture                    | Schema is project-wide             |
| Implementing a new feature      | Design                          | Feature-scoped implementation      |
| Recording a trade-off           | Architecture                    | Trade-offs inform future decisions |
| Project-wide principles         | Architecture                    | Principles apply everywhere        |
| Component breakdown for feature | Design                          | Implementation detail              |
| Feature needs new schema        | Architecture first, then Design | Schema in Arch, feature in Design  |

---

## Architecture Document

**Use when**: Project-wide decisions, data models, system design

**Characteristics**:

- One per project/package (in monorepos)
- Living document (updated in place—not immutable ADRs)
- Documents WHY behind all major decisions
- Includes version, status, table of contents

**Location**: Project root (`ARCHITECTURE.md`)

**Edge cases:**

- Schema change for one feature → Architecture Doc (schema is project-wide)
- Library for one feature → Architecture Doc if precedent-setting; Design Doc if one-off
- Performance optimization → Architecture Doc if changes patterns; Design Doc if feature-specific

### Required Sections

- **Header**: Version, Last Updated, Status (Production/Design/Proposed/Deprecated)
- **Table of Contents**: Section links
- **Overview**: Technology choices, data model philosophy, high-level architecture
- **Data Model / Schema**: Tables, types, relationships
- **Key Decisions**: What, Why, Trade-off, Alternatives Considered
- **Best Practices**: Domain-specific patterns
- **Migration Strategy**: How to evolve architecture

---

## Best Practices

### 1. One Architecture Doc Per Project/Package

**✅ GOOD:**

```plaintext
project/
├── ARCHITECTURE.md
└── docs/design/
    ├── feature-a.md
    └── feature-b.md
```

**❌ BAD:** `docs/adr/001-use-typescript.md, 002-adopt-monorepo.md...` (50+ files = fragmented context)

### 2. Living Document (Not Immutable)

Update in place with version/status tracking:

```markdown
### Decision: State Management

**Status**: Active (Updated 2025-01-20)
**What**: Migrated from localStorage to IndexedDB
**Why**: Hit 5MB limit, needed unlimited storage
**Migration**: Completed 2025-01-20, users auto-migrated on load
```

**Edge cases:**

- Decision reversed → Update original with "Superseded" status
- Major shift → Bump version (v1 → v2), add migration section
- Affects multiple subsystems → Update main Architecture Doc, not separate files

### 3. Document WHY, Not Just WHAT

**✅ GOOD:**

```markdown
### Principle: Separation of Concerns

**What**: Static data → immutable storage; Mutable state → persistent storage
**Why**: Static data saves NKB per instance; updates affect all instances instantly
**Trade-off**: More complex loading (fetch static + query persistent)
**Alternatives Considered**: All localStorage (rejected: 5MB limit); All IndexedDB (rejected: overkill for config)
```

**❌ BAD:** `Database: PostgreSQL, State: Zustand, UI: React` (no rationale)

**Required fields:**

| Field        | Required        | Description                                 |
| ------------ | --------------- | ------------------------------------------- |
| What         | Always          | The decision (1-2 sentences)                |
| Why          | Always          | Rationale with specifics (numbers, metrics) |
| Trade-off    | Always          | What we gave up or accepted                 |
| Alternatives | Major decisions | Other options and why rejected              |
| Migration    | If breaking     | How to evolve from previous state           |

**Edge cases:**

- Obvious choice → Still document; future devs may question
- Inherited decision → Document as "Inherited: [reason]"
- Temporary decision → Mark "Temporary" with planned review date

### 4. Include Code References

**✅ GOOD:**

```markdown
**Implementation**: See `src/stores/gameStore.ts:12-45`
**Usage example**: See `src/components/GamePanel.tsx`
```

**❌ BAD:** "We use Zustand for state management" (no reference to actual code)

- Key patterns → file + line range
- Simple utilities → file path only (no line numbers)
- Frequently changing code → file path only (line numbers go stale)

### 5. Version and Track Status

| Status     | Meaning                            |
| ---------- | ---------------------------------- |
| Design     | Initial draft, not yet implemented |
| Production | Live in production                 |
| Proposed   | Planned extension to production    |
| Deprecated | Being phased out                   |

**Version bumps:** Major schema changes → v1 → v2; New sections → v1.0 → v1.1; Clarifications → no bump

---

## TDD Workflow Integration

**Workflow Order**:

1. User Stories → What we're building
2. Test Definitions → How we'll verify
3. Design Doc → How we'll build it
4. Check Architecture Doc → New tech/schema needed?
5. Implement (RED → GREEN → REFACTOR)
6. Update Architecture Doc if needed

### When to Update Architecture Doc

| Trigger                                     | Example                          |
| ------------------------------------------- | -------------------------------- |
| New data model concept                      | New "Subscription" entity        |
| Technology choice                           | "Chose Resend for email"         |
| New pattern/convention                      | "All forms use react-hook-form"  |
| Architectural insight during implementation | "IndexedDB needed for offline"   |
| Performance bottleneck requiring change     | "Migrated to Redis for sessions" |

### When NOT to Update

| Scenario                        | Where Instead            |
| ------------------------------- | ------------------------ |
| Single feature implementation   | Design Doc               |
| Bug fix                         | Code comments if complex |
| Refactor without pattern change | PR description           |

**Edge case:** Bug fix reveals architectural flaw → Document flaw and fix in Architecture Doc.

---

## Common Mistakes

### Architecture Doc Anti-Patterns

| Anti-Pattern             | Fix                                 |
| ------------------------ | ----------------------------------- |
| ADR sprawl (001, 002...) | One comprehensive `ARCHITECTURE.md` |
| No decision rationale    | Add What/Why/Trade-off              |
| Missing version/status   | Add header with Version and Status  |
| Implementation details   | Move to Design Doc or code          |

**❌ BAD:** `GET /api/users → Returns users from PostgreSQL` (implementation detail)

**✅ GOOD:** `API Design: RESTful routes with input validation at boundary` (principle)

---

## Re-evaluation Path (When Unclear)

The first matching row picks the doc type:

| If the work…                                 | Doc              |
| -------------------------------------------- | ---------------- |
| affects 2+ features                          | Architecture Doc |
| is a technology/data-model choice            | Architecture Doc |
| future developers need for the whole project | Architecture Doc |
| is only for this feature                     | Design Doc       |

**Tie-breaker:** When still unclear, default to Design Doc. Easier to promote later than to split.

### Worked Example: Adding User Notifications

**Scenario:** Add email notifications when users complete a purchase.

1. **Affects 2+ features?** No, only checkout → Continue
2. **Tech choice?** Yes, need to choose email service (SendGrid vs SES) → **Architecture Doc**

**Result:**

- `ARCHITECTURE.md` → "Email Service: SendGrid (Why: deliverability, cost, SDK quality)"
- `planning/design/checkout-notifications.md` → Feature implementation referencing email decision

---

## File Organization

```plaintext
project/
├── ARCHITECTURE.md                    # Single comprehensive doc
├── <namespace-root>/tickets/
│   └── {ID}-{slug}/
│       ├── ticket.md
│       ├── test-definitions.md
│       └── design.md                  # Feature-specific design docs
└── src/
```

---

## Layers & Boundaries

**Purpose:** Define architectural layers and enforce dependency rules to prevent circular dependencies, god modules, and leaky abstractions.

### Layer Definitions

| Layer  | Directory     | Responsibility                 |
| ------ | ------------- | ------------------------------ |
| app    | `src/app/`    | UI, routing, composition       |
| domain | `src/domain/` | Business rules, pure logic     |
| infra  | `src/infra/`  | IO, APIs, DB, external SDKs    |
| shared | `src/shared/` | Utilities usable by all layers |

### Allowed Dependencies

| From   | To     | Allowed | Rationale                                         |
| ------ | ------ | ------- | ------------------------------------------------- |
| app    | domain | ✅      | UI composes business logic                        |
| app    | infra  | ✅      | UI triggers side effects                          |
| app    | shared | ✅      | Utilities available everywhere                    |
| domain | app    | ❌      | Domain must be framework-agnostic                 |
| domain | infra  | ❌      | Domain contains pure logic only                   |
| domain | shared | ✅      | Utilities available everywhere                    |
| infra  | domain | ✅      | Adapters may use domain types                     |
| infra  | app    | ❌      | Infra should not depend on UI                     |
| infra  | shared | ✅      | Utilities available everywhere                    |
| shared | \*     | ❌      | Shared has no dependencies (except external libs) |

**Note:** This template allows direct app→infra. Alternative: force app→domain→infra for stricter separation (hexagonal/ports-adapters pattern).

### Edge Cases

| Scenario                             | Solution                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Project doesn't fit 3-layer model    | Document actual layers, same boundary rules apply                         |
| Feature module needs another feature | Import via public API (`index.ts`) only                                   |
| Shared utilities                     | Create `shared/` layer, all layers may import                             |
| Brownfield adoption                  | Start with warnings-only mode, fix violations incrementally, then enforce |
| Monorepo with multiple apps          | Each app has own layers; shared packages are explicit dependencies        |

### Enforcing Boundaries (Polyglot)

The layer rules above are a language-agnostic _concept_: who may import whom.
`ARCHITECTURE.md` is the single source of truth for the rules; enforce them with
the tool native to each language. Safeword wires up the JS/TS one for you.

| Language   | Enforcement                                 | How                                                                                                                                                                                                       |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JS/TS**  | **dependency-cruiser** (safeword-generated) | `safeword sync-config` generates `.safeword/depcruise-config.cjs` from your detected layers; `bun run deps` and CI fail on a forbidden edge. `eslint-plugin-boundaries` is a viable IDE-time alternative. |
| **Python** | **import-linter**                           | Declare layer contracts in your `importlinter` config; `lint-imports` fails on a forbidden import. (Circular imports also fail at runtime.)                                                               |
| **Go**     | **the compiler** (+ depguard)               | Circular package imports are a build error — if it builds, there are none. Enforce directional layer rules with `depguard` via golangci-lint.                                                             |
| **Rust**   | **the compiler** (+ cargo-deny)             | The module system rejects circular module dependencies at build time. Gate crate-level dependencies with `cargo-deny`.                                                                                    |

**Concept → config:** define the layers and allowed dependencies in
`ARCHITECTURE.md` (the table above), then let the per-language tool be the gate.
Don't restate the rules in tool config as a second source of truth — generate or
derive the tool config from the documented layers where you can (safeword does
this for JS/TS via `sync-config`).

**Common issues (any tool):**

| Issue                            | Fix                                                                         |
| -------------------------------- | --------------------------------------------------------------------------- |
| "Unknown file" / unlayered files | Ensure every source file maps to a defined layer (or is explicitly ignored) |
| False positives on tests         | Exclude test files from the layer globs                                     |
| External library imports flagged | External deps are allowed by default; check the tool's ignore setting       |

---

## Data Architecture

**Escalate to `data-architecture-guide.md` when ANY apply:**

- Adding a second data store (database, cache, queue)
- Complex schema (5+ entities OR cross-feature relationships)
- Designing ETL, sync, or data pipeline flows
- Data compliance requirements (GDPR, HIPAA, audit trails)
- Performance-critical queries needing optimization strategy
- Multi-service data ownership questions

**The guide covers:** Data quality principles, governance policies, flow documentation, performance targets.

**Skip for:** Single-store CRUD, simple schema additions, feature-scoped entities.

---

## Quality Checklist

**Architecture Doc:**

- [ ] Sequential decision tree or clear structure
- [ ] All decisions have What/Why/Trade-off
- [ ] Version and Status in header
- [ ] Code references for key patterns
- [ ] No implementation details

---

## Key Takeaways

- One Architecture Doc per project—not scattered ADRs
- Every decision needs: What / Why / Trade-off / Alternatives
- Update when adding: technology, schema, or project-wide pattern
- Living document—update in place with version/status tracking
