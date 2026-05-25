---
id: 62PDX1
slug: patterns-catalog
title: "Patterns catalog — scannable index + per-pattern detail (Rust-API-Guidelines two-part structure)"
type: feature
phase: intake
status: in_progress
created: 2026-05-25T03:44:17.301Z
last_modified: 2026-05-25T03:45:00.000Z
---

# Patterns catalog — scannable index + per-pattern detail

**Goal:** Create a safeword patterns catalog that complements PRINCIPLES.md by holding the MANY named, reusable tactical moves that instantiate the FEW principles. Two-part structure modeled on [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/about.html): a scannable checklist/index at `.safeword/PATTERNS.md` + per-pattern detail files at `.safeword/patterns/<id>.md`. Each pattern has a stable ID, names the principle(s) it instantiates via frontmatter, and documents purpose / context / example / anti-pattern caught.

**Why:** Safeword today has 5 documented principles (in PRINCIPLES.md) but no place for the tactical patterns that instantiate them. Patterns are scattered: AODI mnemonic lives in bdd's SCENARIOS.md, R/G/R checkboxes in TDD.md, propose-and-converge described in SAFEWORD.md, skip annotations in TDD.md, etc. Result: contributors re-discover patterns by reading skill bodies one at a time; cross-cutting patterns aren't visible as a set; new contributors can't get an overview. The 30+ tactical moves identified during the spec-pipeline absorption work need a home that isn't PRINCIPLES.md (which would violate principle 5's "few, not 15" rule).

**Authority:** This structure is grounded in (a) [Rust API Guidelines two-part model](https://rust-lang.github.io/api-guidelines/about.html) — scannable checklist + topical chapters; (b) [SOLID vs GoF asymmetry](https://www.tutorialsteacher.com/articles/difference-between-design-principle-and-design-pattern) — principles few, patterns many; (c) [Cowan working-memory limit](https://pmc.ncbi.nlm.nih.gov/articles/PMC2864034/) — chunking by stable ID is what lets a catalog scale; (d) safeword's existing skill-per-file convention at `.safeword/skills/`.

## Scope

### Two-part structure (S5 hybrid)

1. **`.safeword/PATTERNS.md`** — the scannable index/checklist. Each entry: stable ID, one-line description, link to detail file, principle(s) instantiated. Designed for fast triage during review.
2. **`.safeword/patterns/<id>.md`** — per-pattern detail file. Frontmatter + body.

### Per-pattern file format

```markdown
---
id: P-<stable-name>
name: Short human-readable name
instantiates: [principle-1-structure-enforces, ...]
applies-in: [skill-name, skill-name, ...]
status: stable | proposed | deprecated
---

# {Name}

**Purpose:** One sentence — what the pattern accomplishes.

**Apply when:** Conditions that signal this pattern is the right move.

**How it works:** Concrete description of the tactical move — what the agent does, what hook fires, what artifact gates.

**Example:** A worked example showing the pattern in action.

**Anti-pattern caught:** What predictable failure this pattern prevents.

**References:** Links to skill files / hook files / external research where applicable.
```

### Index file format (`.safeword/PATTERNS.md`)

```markdown
# Safeword Patterns

> Patterns are named, reusable tactical moves that instantiate the principles in [PRINCIPLES.md](../PRINCIPLES.md). They're scannable for review and lookup; each has a stable ID for cross-reference.

## By Principle

### Structure enforces (principle 1)

- **[P-RGR-CHECKBOX](patterns/P-RGR-CHECKBOX.md)** — RED/GREEN/REFACTOR checkboxes with SHA annotations parsed by hook
- **[P-DIMENSIONS-GATE](patterns/P-DIMENSIONS-GATE.md)** — dimensions.md must exist before test-definitions.md
- **[P-SKIP-ANNOTATION](patterns/P-SKIP-ANNOTATION.md)** — skip: `<non-empty reason>` for auditable omissions
- ...

### Fire at boundaries (principle 2)

- **[P-LOC-GATE](patterns/P-LOC-GATE.md)** — ~400 LOC commit-threshold reminder
- ...

### Contribute then converge (principle 4)

- **[P-PROPOSE-CONVERGE](patterns/P-PROPOSE-CONVERGE.md)** — interview shape that leads with perspective
- **[P-AODI](patterns/P-AODI.md)** — Atomic/Observable/Deterministic/Independent mnemonic per scenario
- ...

## Alphabetical (full list)

- P-AODI
- P-CROSS-FEATURE-COMP
- P-DIMENSIONS-GATE
- ...
```

### Stable ID convention

`P-<NAME>` where NAME is UPPERCASE-HYPHENATED. Short enough to reference inline (`see P-AODI`). Stable — once published, the ID never changes (even if the pattern is renamed for display).

### Initial catalog (seed set)

From the 30+ patterns identified during the spec-pipeline absorption work + the demotions from 4RD1NS:

**Engineering patterns** (mostly serve principles 1, 2, 5):

- `P-RGR-CHECKBOX` — RED/GREEN/REFACTOR checkboxes with SHA annotations
- `P-SKIP-ANNOTATION` — skip: `<non-empty reason>` for auditable omissions
- `P-DIMENSIONS-GATE` — dimensions.md must exist before test-definitions.md
- `P-LOC-GATE` — ~400 LOC commit threshold
- `P-AODI` — Atomic/Observable/Deterministic/Independent per-scenario mnemonic
- `P-EVIDENCE-BEFORE-CLAIMS` — show test output; don't claim "tests pass"
- `P-TWO-FORMAT-SPLIT` — discovery shorthand (chat) vs saved (disk)
- `P-LIBRARY-VERSION-CHECK` — read installed-version docs before recommending APIs
- `P-PROPOSE-CONVERGE` — interview shape (instantiates principle 4)
- `P-ESCAPE-HATCH` — delegate to `/elicit`, `/figure-it-out`, `/refactor`, `/quality-review`

**Product patterns** (absorbed from arcade, mostly serve principles 1, 4, plus "Outcomes cascade" if it graduates):

- `P-JTBD-FORMAT` — "When I, I want, so I can"
- `P-PERSONA-VALIDATION` — refuse-to-invent against `.project/personas.md`
- `P-AC-LAYER` — capability/guarantee statement between JTBD and scenarios
- `P-CROSS-REF-NUMBERING` — slug.persona.AC.scenario IDs
- `P-PAUSE-CONFIRM-GATE` — present-list, ask, iterate until signed off
- `P-VACUOUS-PASS-TEST` — mentally remove implementation; could scenario still pass?
- `P-NEGATIVE-CASE-COVERAGE` — each happy-path needs a rejection counterpart
- `P-STRUCTURED-FINDINGS` — h4 per finding, Current → explanation → Proposed, 3-tier severity
- `P-BULK-FINDINGS` — when same pattern hits ≥3 scenarios, use Representative + Affected list
- `P-CROSS-CUTTING-CATEGORIES` — conflict / boundary / failure / security / persona-consistency
- `P-IMPL-PLAN-5-SECTION` — Approach / Decisions / Arch alignment / Known deviations / Assessment triggers
- `P-ADR-CONSULTATION` — read project ADRs, populate Arch alignment, prompt for first ADR if missing
- `P-PLAN-VS-ACTUAL` — reconcile impl plan against shipped reality at Phase 6 exit
- `P-HARNESS-DEGRADATION` — check test-harness availability, gracefully degrade to existing service patterns
- `P-MANDATORY-FEATURE-TAG` — `feature:<slug>` on all signals/monitors
- `P-FOUR-SIGNAL-OPTIONS` — monitor / insight / cron / synthetic implementation menu
- `P-TWO-STATE-DONE` — merge-ready vs outcome-validated

**Product-systems patterns** (from 4RD1NS demotion):

- `P-LOOP-CLOSE-IN-FLOW` — feedback loops close inside agent flow, not as TODOs
- `P-KILL-CRITERIA` — hypothesis with explicit threshold below which feature is sunset
- `P-SUNSET-DISCIPLINE` — feature removal is named action, not failure narrative
- `P-CROSS-FEATURE-COMP` — initiatives surface composition concerns
- `P-FLOW-OVER-PRED` — fast, small, reversible decisions over long-term plan accuracy
- `P-PLATFORM-AS-PRODUCT` — internal tools/infra treated with JTBD/AC/signals discipline
- `P-TOOLS-AS-DATA` — existing tools (Productboard, Linear) are data sources, not workflow

~34 patterns in the seed catalog. All link to their instantiated principle(s); ID convention preserves them across renames; index makes them scannable.

### Linkage from skills

Skills that USE a pattern can reference it inline: "Apply [P-AODI](../patterns/P-AODI.md) per scenario." This replaces the current pattern of inlining the AODI table in SCENARIOS.md (or duplicating it everywhere it applies).

### Linkage from principles

Principles do NOT enumerate their patterns (would bloat PRINCIPLES.md). The index file (`PATTERNS.md`) groups patterns by principle for navigation, but PRINCIPLES.md itself stays narrative.

### Lifecycle

Pattern `status` field tracks: `proposed` (drafted, not yet ratified) → `stable` (in active use) → `deprecated` (superseded; kept for reference, marked DO NOT USE).

## Out of scope

- Writing all 34 seed-catalog patterns to full detail in this ticket — this ticket establishes the STRUCTURE and seeds the IDs. Full detail authoring is incremental per pattern.
- Building a CLI tool to manage the catalog (`safeword patterns list`, etc.) — defer; flat-file is fine for v1.
- Cross-language pattern variants (a pattern that exists in TS but not Python) — patterns are framework-agnostic.
- Importing community patterns from outside safeword — start with the in-house seed set; future ticket for community contribution flow.
- Hook-enforced "every skill must cite a pattern" — patterns are reference, not gated.

## Done when

- `.safeword/PATTERNS.md` index exists with all 34 seed-catalog patterns listed (grouped by principle + alphabetical).
- `.safeword/patterns/` directory exists with stub files for all 34 (frontmatter populated, body may be placeholder for the long tail).
- Detail files written in full for ~10 highest-priority patterns (those already cited by multiple skills — P-AODI, P-RGR-CHECKBOX, P-SKIP-ANNOTATION, P-DIMENSIONS-GATE, P-PROPOSE-CONVERGE, P-EVIDENCE-BEFORE-CLAIMS, P-LOC-GATE, P-ESCAPE-HATCH, P-TWO-FORMAT-SPLIT, P-LIBRARY-VERSION-CHECK).
- At least one skill body (e.g., bdd/SCENARIOS.md) is updated to reference patterns via stable ID instead of inlining (proves the cross-reference convention works).
- PRINCIPLES.md is unchanged by this ticket (separate concern; owned by 3N3Q7B).
- Convention documented: stable-ID rules, frontmatter shape, linkage direction.

## Open questions

- **ID convention** — `P-<NAME>` flat, or `P-<DOMAIN>-<NAME>` namespaced (e.g., `P-BDD-AODI`)? Driver leans flat for v1 (avoid pre-mature namespacing); namespacing can be added later if collisions emerge.
- **Versioning patterns** — if a pattern evolves substantively (different procedure), is it the same ID with a `version:` bump, or a new ID with the old marked `superseded-by`? Driver leans new-ID-old-superseded for clean history.
- **Pattern → principle linkage strictness** — must every pattern instantiate at least one principle? Driver leans yes — patterns that don't trace to a principle are suspect (either the principle is missing or the pattern is junk).
- **`P-PROPOSE-CONVERGE` overlap with principle 4** — principle 4 ("Contribute, then converge") IS this pattern. Should it be a pattern at all, or just live in the principle? Driver leans pattern (the principle is the general behavior; the pattern is the specific interview shape with named turns). But borderline.

## Related

- **3N3Q7B** (principles ticket) — sibling; 3N3Q7B owns PRINCIPLES.md, this owns PATTERNS.md and patterns/.
- **4RD1NS** (product-systems candidates) — feeds 7 patterns into this catalog (the 7 demoted from principle-graduation).
- **MBGQ89** (ticket-deps schema) — patterns may want to reference each other; if so, MBGQ89's dependency-field work generalizes to patterns (e.g., `depends_on:` between patterns).
- Existing skill bodies (bdd, refactor, debug, etc.) — eventually updated to cite patterns by ID instead of inlining.

## Work Log

- 2026-05-25T03:44:17.301Z Started: Created ticket 62PDX1
- 2026-05-25T03:45:00.000Z Drafted: Two-part Rust-API-Guidelines structure; 34-pattern seed catalog; ID convention; linkage rules; 4 open questions
