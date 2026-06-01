---
id: 62PDX1
slug: patterns-catalog
title: 'Patterns catalog — scannable index + per-pattern detail (Rust-API-Guidelines two-part structure)'
type: feature
phase: intake
status: in_progress
created: 2026-05-25T03:44:17.301Z
last_modified: 2026-05-25T04:18:00.000Z
---

# Patterns catalog — scannable index + per-pattern detail

**Goal:** Create a safeword patterns catalog that complements PRINCIPLES.md by holding the MANY named, reusable tactical moves that instantiate the FEW principles. Two-part structure modeled on [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/about.html): a scannable checklist/index at `.safeword/PATTERNS.md` + per-pattern detail files at `.safeword/patterns/<id>.md`. Each pattern has a stable ID, names the principle(s) it instantiates via frontmatter, and documents purpose / context / example / anti-pattern caught.

**Why:** Safeword today has 5 documented principles (in PRINCIPLES.md) but no place for the tactical patterns that instantiate them. Patterns are scattered: AODI mnemonic lives in bdd's SCENARIOS.md, R/G/R checkboxes in TDD.md, propose-and-converge described in SAFEWORD.md, skip annotations in TDD.md, etc. Result: contributors re-discover patterns by reading skill bodies one at a time; cross-cutting patterns aren't visible as a set; new contributors can't get an overview.

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

### Stable ID convention

`P-<NAME>` where NAME is UPPERCASE-HYPHENATED. Short enough to reference inline (`see P-AODI`). Stable — once published, the ID never changes (even if the pattern is renamed for display).

### Seed catalog (~55 stable + 7 proposed = ~62 entries)

Updated 2026-05-25 after parallel audits of safeword and arcade-monorepo found ~50 additional patterns beyond the original 34-entry seed. After dedup, merge, and prune (see Work Log), final shape is below.

**Engineering patterns** (mostly serve principles 1, 2, 5):

- `P-RGR-CHECKBOX` — RED/GREEN/REFACTOR checkboxes with SHA annotations
- `P-SHA-LEDGER` — each `[x]` step carries SHA; ledger validated at done gate (R/G/R is one instance)
- `P-SKIP-ANNOTATION` — `skip: <non-empty reason>` for auditable omissions
- `P-DIMENSIONS-GATE` — dimensions.md must exist before test-definitions.md
- `P-ARTIFACT-PREREQUISITE` — generalized "next step's input must exist before next step starts"
- `P-LOC-GATE` — ~400 LOC commit threshold (blast-radius control)
- `P-AODI` — Atomic/Observable/Deterministic/Independent per-scenario mnemonic
- `P-EVIDENCE-BEFORE-CLAIMS` — show test output; don't claim "tests pass"
- `P-TWO-FORMAT-SPLIT` — discovery shorthand (chat) vs saved (disk)
- `P-LIBRARY-VERSION-CHECK` — read installed-version docs before recommending APIs
- `P-PROPOSE-CONVERGE` — interview shape (instantiates principle 4); includes named contribution techniques (failure modes / boundaries / scenario walkthrough / regret test / UX)
- `P-ESCAPE-HATCH` — delegate to specialist skills (`/elicit`, `/figure-it-out`, `/refactor`, `/quality-review`, `/brainstorm`) for specific gap shapes
- `P-REFACTOR-FILE-PATH-GATE` — REFACTOR commits hard-blocked from touching test files

**Safeword enforcement infrastructure patterns** (newly identified by audit; mostly serve principle 1):

- `P-NATURAL-GATE-HIERARCHY` — 4-tier enforcement (natural gates > independent observation > reminders > self-report)
- `P-NEXT-IMPERATIVE-LINE` — `**Next:** <imperative>` required ending; parsed for re-entry log
- `P-PHASE-AWARE-REMINDER` — per-phase one-liner injected by prompt hook
- `P-BASH-INJECTION-PROOF` — skills emit session-tagged log lines via `!` bash; hand-written artifacts can't satisfy
- `P-RESUME-BY-PHASE` — phase frontmatter + "find first unchecked checkbox" resume protocol
- `P-CONFIDENT-OR-BLOCKED` — binary terminal verdict shape; "Tried/Need" required on BLOCKED
- `P-DISQUALIFICATION` — compose-in disqualifiers that strip the CONFIDENT option
- `P-FAILURE-TELEMETRY-ESCALATION` — per-session failure recording + cross-session counter; threshold suggests promotion
- `P-LOOP-GUARD` — `stop_hook_active` short-circuit; two-tier `hardBlockDone` vs `softBlock`
- `P-RE-ENTRY-BRIEF` — stop appends to re-entry.md; session-start re-injects
- `P-DIRTY-FILE-CONFLICT-DETECTION` — compare other sessions' edits against `git status --porcelain`
- `P-CASCADE-AND-NAVIGATE` — ticket-done walks parent hierarchy
- `P-WARN-NOT-BLOCK-FOR-SEMANTIC` — inoculation pattern for fabricated stamps (warn via additionalContext, not block)
- `P-COEXISTENCE` — old and new formats / rules coexist; tool reads both, writes only new (absorbs P-LEGACY-COMPAT-FORWARD-ONLY + P-DEPRECATION-COEXISTENCE)
- `P-SPECIFICITY-SELF-TEST` — 3-question gate before scope exit (what changes / what stays / observable done)
- `P-IRON-LAW-DECLARATION` — single all-caps "Iron Law: X" line per skill
- `P-RESEARCH-DEPTH-MATCHES-CLAIM` — code/docs for syntax; primary literature for design claims
- `P-DOMAIN-ENUMERATION-FIRST` — list 3+ domains before research (figure-it-out)

**Product / spec-discipline patterns** (absorbed from arcade):

- `P-JTBD-FORMAT` — "When I, I want, so I can"
- `P-PERSONA-VALIDATION` — refuse-to-invent against `.project/personas.md`
- `P-AC-LAYER` — capability/guarantee statement between JTBD and scenarios
- `P-CROSS-REF-NUMBERING` — persona-anchored scenario IDs (`<slug>.<persona><JTBD#>.AC<#>.<name>`)
- `P-PHASED-WORKFLOW-WITH-INPUT-GATE` — numbered phases with Phase 0 precondition + per-phase signoff (refinement of original P-PAUSE-CONFIRM-GATE)
- `P-PRECONDITION-SHORT-CIRCUIT` — detect "nothing to do" and exit cleanly
- `P-VACUOUS-PASS-TEST` — mentally remove implementation; could scenario still pass?
- `P-NEGATIVE-CASE-COVERAGE` — each happy-path needs a rejection counterpart
- `P-STRUCTURED-FINDINGS` — h4 per finding, Current → explanation → Proposed, 3-tier severity, bulk template for ≥3-scenario patterns, cross-cutting categories (conflict / boundary / failure / security / persona-consistency), plain-English why-it-matters per finding (absorbs P-BULK-FINDINGS, P-CROSS-CUTTING-CATEGORIES, P-CHAIN-AS-ONE-FINDING, P-EXPLAIN-WHY-IT-MATTERS)
- `P-IMPL-PLAN-5-SECTION` — Approach / Decisions / Arch alignment / Known deviations / Assessment triggers
- `P-ADR-CONSULTATION` — read project ADRs, populate Arch alignment, prompt for first ADR if missing
- `P-PLAN-VS-ACTUAL` — reconcile impl plan against shipped reality at Phase 6 exit
- `P-HARNESS-DEGRADATION` — check test-harness availability, gracefully degrade to existing service patterns
- `P-LIFECYCLE-STATUS-MACHINE` — typed status enum, only the matching skill can advance; backwards transitions allowed when new info arrives (absorbs P-TWO-STATE-DONE)

**Arcade-discipline patterns** (newly identified by audit; generalizable):

- `P-INDISTINGUISHABLE-FAILURE-COLLAPSE` — map distinct internal failures to one user-visible string (avoid side-channel-probe)
- `P-FORWARD-ONLY-MOTION` — promotions go forward only; backwards needs a different artifact
- `P-LOCKSTEP-COUPLED-CHANGES` — when two artifacts must move together, the tool always touches both
- `P-ONE-CHANGE-TEST-COMMIT` — atomic loop with revert (not fix) on failure
- `P-DEFINE-THEN-APPLY-SPLIT` — two-skill migration pattern (define artifact + apply later)
- `P-DETERMINISTIC-THEN-LLM` — cheap deterministic checks before invoking LLM/subagents
- `P-FINDING-VALIDATION-PASS` — every generative finding gets parallel validation subagent
- `P-WIDE-NET-THEN-TRIAGE` — cast wide, triage in separate phase
- `P-ALL-OR-NONE-COVERAGE-GATE` — partial coverage hard-stops
- `P-RULE-FIRST-THEN-MIGRATE` — convention documented in rules before code migration
- `P-LOCAL-VS-CI-DIVERGENCE` — Makefiles for local feedback; CI invokes tools directly with stricter flags
- `P-EVIDENCE-OVER-COMMIT-LOG` — user-facing artifacts must not embed internal refs (PR numbers, ticket codes, SHAs)

**Product-systems patterns** (`status: proposed` — not observed in either codebase yet; aspirational from GNSJ6P epic):

- `P-LOOP-CLOSE-IN-FLOW` — feedback loops close inside agent flow, not as TODOs
- `P-KILL-CRITERIA` — hypothesis with explicit threshold below which feature is sunset
- `P-SUNSET-DISCIPLINE` — feature removal is named action, not failure narrative
- `P-CROSS-FEATURE-COMP` — initiatives surface composition concerns
- `P-FLOW-OVER-PRED` — fast, small, reversible decisions over long-term plan accuracy
- `P-PLATFORM-AS-PRODUCT` — internal tools/infra treated with JTBD/AC/signals discipline
- `P-TOOLS-AS-DATA` — existing tools (Productboard, Linear) are data sources, not workflow

### Dropped from earlier draft (below the pattern bar)

These appeared in the initial 34-seed and were promoted by audit, but on review don't pay rent as catalog entries:

- `P-MANDATORY-FEATURE-TAG` — single field convention (below bar)
- `P-FOUR-SIGNAL-OPTIONS` — a menu/template, not a pattern
- `P-PER-VERSION-ARTIFACT-OUTSIDE-PACKAGE` — too release-notes-specific
- `P-SESSION-VS-PROJECT-STATE` — internal safeword implementation detail
- `P-META-PATH-EXEMPTION` — sub-detail of P-LOC-GATE
- `P-COVERS-LINE` — single format quirk for learnings files
- `P-WRITE-THEN-RENAME-ATOMIC` — generic file-handling, not safeword-discipline
- `P-FALLBACK-CLASSIFICATION` — too narrow (one default rule)
- `P-IN-ORDER-DECISION-TREE` — formatting convention more than discipline
- `P-SCOPE-DEFAULTING-CHECK` — single-skill appearance
- `P-MATCH-EXISTING-STYLE` — generic engineering taste, not safeword-specific

### Merged into siblings

- `P-PAUSE-CONFIRM-GATE` → folded into `P-PHASED-WORKFLOW-WITH-INPUT-GATE`
- `P-BULK-FINDINGS`, `P-CROSS-CUTTING-CATEGORIES`, `P-CHAIN-AS-ONE-FINDING`, `P-EXPLAIN-WHY-IT-MATTERS` → folded into `P-STRUCTURED-FINDINGS`
- `P-LEGACY-COMPAT-FORWARD-ONLY`, `P-DEPRECATION-COEXISTENCE` → merged into `P-COEXISTENCE`
- `P-TWO-STATE-DONE` → folded into `P-LIFECYCLE-STATUS-MACHINE`
- `P-CONTRIBUTION-TECHNIQUES` → folded into `P-PROPOSE-CONVERGE`
- `P-DIVERGE-BEFORE-CONVERGE` → folded into `P-ESCAPE-HATCH`

### Linkage from skills

Skills that USE a pattern can reference it inline: "Apply [P-AODI](../patterns/P-AODI.md) per scenario." This replaces the current pattern of inlining the AODI table in SCENARIOS.md (or duplicating it everywhere it applies).

### Linkage from principles

Principles do NOT enumerate their patterns (would bloat PRINCIPLES.md). The index file (`PATTERNS.md`) groups patterns by principle for navigation, but PRINCIPLES.md itself stays narrative.

### Lifecycle

Pattern `status` field tracks: `proposed` (drafted, not yet observed in code) → `stable` (in active use; observed in at least one skill/hook) → `deprecated` (superseded; kept for reference, marked DO NOT USE).

## Out of scope

- Writing all ~62 catalog patterns to full detail in this ticket — this ticket establishes the STRUCTURE and seeds the IDs. Full detail authoring is incremental per pattern.
- Building a CLI tool to manage the catalog (`safeword patterns list`, etc.) — defer; flat-file is fine for v1.
- Cross-language pattern variants — patterns are framework-agnostic.
- Importing community patterns from outside safeword — start with the in-house seed.
- Hook-enforced "every skill must cite a pattern" — patterns are reference, not gated.

## Done when

- `.safeword/PATTERNS.md` index exists with all ~62 patterns listed (grouped by principle + alphabetical).
- `.safeword/patterns/` directory exists with stub files for all ~55 stable patterns (proposed-status ones get stubs marked `status: proposed`).
- Detail files written in full for ~12 highest-priority patterns: P-AODI, P-RGR-CHECKBOX, P-SHA-LEDGER, P-SKIP-ANNOTATION, P-DIMENSIONS-GATE, P-ARTIFACT-PREREQUISITE, P-PROPOSE-CONVERGE, P-EVIDENCE-BEFORE-CLAIMS, P-LOC-GATE, P-ESCAPE-HATCH, P-NATURAL-GATE-HIERARCHY, P-CONFIDENT-OR-BLOCKED.
- At least one skill body (e.g., bdd/SCENARIOS.md) is updated to reference patterns via stable ID instead of inlining.
- PRINCIPLES.md unchanged by this ticket (separate concern; owned by 3N3Q7B).
- Convention documented: stable-ID rules, frontmatter shape, linkage direction, status lifecycle.

## Open questions

- **ID convention** — `P-<NAME>` flat, or `P-<DOMAIN>-<NAME>` namespaced? Driver leans flat for v1.
- **Versioning patterns** — same ID with `version:` bump, or new ID with old marked `superseded-by`? Driver leans new-ID-old-superseded.
- **Pattern → principle linkage strictness** — must every pattern instantiate at least one principle? Driver leans yes.
- **`P-PROPOSE-CONVERGE` overlap with principle 4** — keep as pattern (specific interview shape) or drop (principle 4 IS this)? Driver leans keep-as-pattern.
- **Promotion path for `proposed`-status patterns** — when does a proposed pattern get promoted to stable? Driver leans "after observed in ≥1 skill or hook" — i.e., once GNSJ6P's skills ship, the 7 proposed product-systems patterns get promoted.

## Related

- **3N3Q7B** (principles ticket) — sibling; 3N3Q7B owns PRINCIPLES.md, this owns PATTERNS.md and patterns/.
- **4RD1NS** (product-systems candidates) — feeds the 7 proposed product-systems patterns into this catalog.
- **MBGQ89** (ticket-deps schema) — patterns may want to reference each other; MBGQ89's dependency-field work generalizes.
- Existing skill bodies (bdd, refactor, debug, etc.) — eventually updated to cite patterns by ID instead of inlining.

## Work Log

- 2026-05-25T03:44:17.301Z Started: Created ticket 62PDX1
- 2026-05-25T03:45:00.000Z Drafted: Two-part Rust-API-Guidelines structure; 34-pattern seed catalog; ID convention; linkage rules; 4 open questions
- 2026-05-25T04:18:00.000Z Audit-driven update: parallel subagent audits of safeword and arcade found ~50 additional patterns beyond the original 34. After dedup (3 explicit dupes), merge (7 absorptions into sibling patterns), prune (11 below the bar), and demotion of 7 aspirational product-systems items to `status: proposed`, final shape is ~55 stable + ~7 proposed = ~62 catalog entries. Sized in line with Rust API Guidelines (~60 items).
