---
id: DZ2NM5
slug: bdd-phase-zero-merge
title: 'Epic: Merge product layer (JTBD/persona/AC) into bdd Phase 0'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-zero-merge
paired_with: DXFX02
created: 2026-05-24T15:21:46.756Z
last_modified: 2026-05-26T03:39:00.000Z
---

# Epic: Merge product layer (JTBD/persona/AC) into bdd Phase 0

**Type:** Feature (epic — design + shipping plan)

**Goal:** Absorb the product-framing layer from arcade's `build-spec` pipeline (personas, JTBD, AC, glossary, cross-reference numbering, structured pause-gates) into safeword's `bdd` Phase 0, while keeping safeword's existing engineering-scope discipline (specificity self-test, `scope`/`out_of_scope`/`done_when`, hook-enforced exit criteria, library-version awareness, propose-and-converge, composable escape hatches to `/elicit` and `/figure-it-out`).

**Why:** Today, `bdd` Phase 0 captures _engineering scope_ but not _product motivation_. That's fine when the developer is also the product owner, but it lets scope drift toward implementation-thinking without a persona-and-motivation anchor. Arcade's pipeline runs the opposite trade — strong product framing, weaker engineering exit gate. The two are complementary; neither subsumes the other. A merged Phase 0 captures both why-and-who and what-we'll-touch-how-we'll-know, in that order.

**Sourced from:** Comparative analysis in arcade-monorepo session 2026-05-24, after diffing safeword `bdd/DISCOVERY.md` against arcade `build-spec/SKILL.md`. Both repos are co-edited from worktrees during this work (arcade at `.claude/worktrees/elastic-noether-5c76a3/`, safeword at `/Users/alex/Projects/safeword-arcade-sync/` branch `arcade-pipeline-sync`).

## Tickets

| ID         | Title                                                                      | Arcade Pair | Status | Depends On |
| ---------- | -------------------------------------------------------------------------- | ----------- | ------ | ---------- |
| **7YN5QB** | Add persona model (`.safeword-project/personas.md`) + validation           | BC53PV      | Done   | —          |
| **YR6C49** | Add glossary (`.safeword-project/glossary.md`) + vocabulary validation     | KD4BYF      | Done   | —          |
| **Y2HCNJ** | Add JTBD as Phase 0 artifact (When-I-I-want-so-I-can)                      | 89HX2E      | Done   | 7YN5QB     |
| **31W8M3** | Add Acceptance Criteria layer between JTBD and scenarios                   | T9BNXD      | Done   | Y2HCNJ     |
| **XT1FFM** | Adopt `slug.persona.AC.scenario` numbering for traceability                | QEKGBK      | Done   | 31W8M3     |
| **K7N2QM** | Configurable paths for personas / glossary / architecture (per-file)       | —           | Done   | 7YN5QB     |
| **B0JZQN** | Add structured user-signoff gates between Phase 0 sub-phases               | FFRPSC      | Done   | —          |
| **1J6JKP** | Lint hook hygiene — prettier config detection + scope biome to edited path | —           | Done   | —          |
| **E1K5ZW** | Epic integration: end-to-end Phase 0 worked example + demo                 | —           | Done   | children   |

**Note on 1J6JKP:** Not a Phase-0-merge sub-task — both fixes are unrelated to bdd or the product layer. Filed as a child of this epic because the bugs surfaced during this session's dogfooding work and the user prefers using this epic as the holding pen for safeword improvements discovered along the way. No arcade pair needed — `bunx safeword upgrade` picks up both fixes automatically.

**Related (standalone, not a child):** [MBGQ89](../MBGQ89/ticket.md) — first-class cross-ticket dependency/pairing fields in the ticket schema. Discovered while structuring this epic (we used ad-hoc `epic:`/`paired_with:`/`blocked_on:` fields with no schema backing) but the work is generic; tracked as a standalone safeword improvement, not a child of this epic. Not blocking on it — this epic's children can ship with ad-hoc field usage; MBGQ89 will retroactively bring them under schema.

**Related (standalone, not a child):** [P8RJ4M](../P8RJ4M/ticket.md) — reconcile arcade's `.project/` convention and architecture-tracking model with safeword for users running both tools. This epic locked in strict `.safeword-project/` ownership for personas/glossary; P8RJ4M covers cross-tool bridging, sync gestures, and architecture-convention alignment. Not blocking — DZ2NM5 ships first; P8RJ4M handles the coexistence story after.

**Paired arcade epic:** [DXFX02](../../../../../arcade-monorepo/.claude/worktrees/elastic-noether-5c76a3/.safeword-project/tickets/DXFX02/ticket.md) — arcade-side adoption/decommission for each safeword change.

## Sequencing

1. **7YN5QB** and **YR6C49** in parallel — foundational data files, no upstream deps.
2. **Y2HCNJ** — depends on 7YN5QB (JTBDs reference personas).
3. **31W8M3** — depends on Y2HCNJ (ACs live under JTBDs).
4. **XT1FFM** — depends on 31W8M3 (numbering scheme references AC).
5. **B0JZQN** — independent conversational-pattern change; can ship anytime in parallel.
6. **K7N2QM** — depends on 7YN5QB (refactors `validatePersonaReference` to read configured path); ships after personas but before YR6C49/Y2HCNJ if order matters (so glossary/JTBD inherit the configurable-path pattern from day one).

## Decisions required before execution

These affect every child ticket. Resolved decisions are recorded with rationale; open decisions still gate progression.

### Resolved 2026-05-25 (via `/figure-it-out`)

1. **Sub-ordering inside Phase 0** — **product-first.** Order: orientation → JTBD → AC → engineering scope/done-when → specificity self-test. Why: this epic exists because scope drift toward implementation-thinking is the failure mode; engineering-first preserves the very failure mode the merge is meant to fix. The "humans struggle with why upfront" cost is absorbed by arcade's existing patient-coaching cue (`Y2HCNJ`). Matches driver's working assumption.

2. **Storage shape** — **`spec.md` sibling inside the ticket folder.** Path: `.safeword-project/tickets/{id}-{slug}/spec.md`. Sections: Intent → References → Personas (refs) → Vocabulary (optional) → Jobs To Be Done (with nested Acceptance Criteria) → Outcomes. `ticket.md` keeps `scope` / `out_of_scope` / `done_when` frontmatter, the phase machine, the work log, and a one-line `**Goal:**` engineering-objective stub with a `**See:** [spec.md](./spec.md)` pointer. The existing `**Why:**` section is **dropped** from the ticket template — product motivation lives in `spec.md`'s `## Intent` as the single source of truth, preventing drift during Phase 0 intent-refinement. Why this split: extends safeword's existing sibling-artifact pattern (`test-definitions.md`, `verify.md`) without bloating `ticket.md`, honors SSoT discipline on the section that actually evolves (Intent), and keeps `ticket.md` self-orienting via the stub. **Diverges from driver's working assumption** (which was fold-into-ticket).

3. **Personas/glossary file location** — **`.safeword-project/personas.md` and `.safeword-project/glossary.md`.** Safeword reads and writes only its own namespace; cross-tool reconciliation with arcade's `.project/` is tracked separately in [P8RJ4M](../P8RJ4M/ticket.md). Why: anything safeword scaffolds in a fresh customer install belongs under its own prefix; generic `.project/` is unfamiliar to safeword-only customers and risks confusion/misedits.

### Resolved 2026-05-26

4. **Sizing classifier interaction** — **features only.** Tasks and patches do not pay the persona/JTBD/AC tax. Why: tasks are typically one-file changes where the product-anchor cost outweighs benefit; users who realize a "task" should be a feature can promote via `/bdd`. Matches driver's working assumption.

5. **Backward compat** — **new tickets only.** Existing in-flight tickets keep their current shape; the merged Phase 0 applies only to tickets that enter intake after the change lands. Detection mechanism: hook routes to old/new flow based on `spec.md` presence in the ticket folder. Why: avoids forced backfill of 10+ in-flight tickets at merge time; split is temporary and flushes naturally as old tickets ship. Matches driver's working assumption.

## Out of scope (this epic)

- Absorbing the rest of arcade's spec pipeline (`review-spec`, `codify-spec`, `update-spec`, `implement-spec`, `build-signals`). Those are separate epics — this one is strictly Phase 0.
- Sizing classifier changes. The patch/task/feature rules stay as they are.
- Pre-Phase-0 work (intake routing, ticket creation). The merged work starts after a ticket exists.

## Files affected (rollup)

Inventory of safeword surfaces the epic's children touch. Each child ticket re-confirms and refines its slice when it kicks off; this is the planning-level rollup, not a binding contract.

### 7YN5QB — Personas

- `packages/cli/templates/personas-template.md` — new template (scaffold content with format header + commented example).
- `packages/cli/src/commands/setup.ts` — scaffold `.safeword-project/personas.md` if absent.
- `packages/cli/src/schema.ts` — register `personas.md` as a safeword-owned/managed file.
- `packages/cli/src/commands/check.ts` — validate persona references in `spec.md` resolve against `personas.md`.
- `.claude/skills/bdd/DISCOVERY.md` — Phase 0 reads `personas.md`; flags unknown persona references.
- `packages/cli/tests/` — new tests: scaffolding, unknown-ref flagging, valid-ref pass-through.

### YR6C49 — Glossary

- `packages/cli/templates/glossary-template.md` — new template (term → definition format).
- `packages/cli/src/commands/setup.ts` — scaffold `.safeword-project/glossary.md` if absent.
- `packages/cli/src/schema.ts` — register `glossary.md`.
- `packages/cli/src/commands/check.ts` — vocabulary-mismatch lint (new-term prompt).
- `.claude/skills/bdd/DISCOVERY.md` — Phase 0 reads `glossary.md`; vocabulary mismatches surface a prompt.
- `packages/cli/tests/` — new tests: scaffolding, new-term prompt, alias resolution.

### Y2HCNJ — JTBD artifact

- `packages/cli/templates/spec-template.md` — **new** spec.md template (empty section headers: Intent / References / Personas / Vocabulary / JTBDs / Outcomes).
- `packages/cli/src/commands/ticket-new.ts` — scaffold `spec.md` alongside `ticket.md` for `type: feature`.
- `packages/cli/src/utils/ticket-writer.ts` — write the spec.md scaffold; update the ticket.md template to use `**Goal:**` one-liner + `**See:** spec.md` pointer (drop `**Why:**`).
- `packages/cli/src/schema.ts` — register per-ticket `spec.md` in the schema (managed at ticket creation, owned by the user thereafter).
- `.claude/skills/bdd/DISCOVERY.md` — JTBD sub-step content with coaching cues (patient guidance, draft-from-statements, one-persona-per-JTBD).
- `packages/cli/templates/hooks/pre-tool-quality.ts` — intake-exit gate extended: when `spec.md` exists, require ≥1 JTBD with a persona ref that resolves against `personas.md`.
- `packages/cli/templates/SAFEWORD.md` — Phase 0 description updated to mention JTBD sub-step.
- `packages/cli/tests/` — new tests: spec.md scaffold on ticket-new, gate behavior on missing JTBD, persona-ref enforcement.

### 31W8M3 — Acceptance Criteria

- `.claude/skills/bdd/DISCOVERY.md` — AC sub-step content with quality coaching (descriptive-capability, split-test heuristic, ~10-scenarios-per-AC threshold).
- `packages/cli/templates/spec-template.md` — AC section structure under each JTBD.
- `packages/cli/templates/hooks/pre-tool-quality.ts` — gate: validate ≥1 AC under each JTBD.
- `.claude/skills/bdd/SCENARIOS.md` — Phase 3 update so each scenario links to a parent AC.
- `packages/cli/tests/` — new tests: gate behavior on JTBD without AC, AC-quality coaching trigger.

### XT1FFM — Cross-reference numbering

- `.claude/skills/bdd/SCENARIOS.md` — document `<slug>.<persona-code><JTBD#>.AC<#>.<scenario_name>` scheme with worked example.
- `packages/cli/templates/SAFEWORD.md` — scheme reference.
- `packages/cli/src/commands/check.ts` — coverage check (every AC has ≥1 scenario; no orphan scenarios).
- `packages/cli/templates/hooks/pre-tool-quality.ts` — validate scenario names follow the scheme.
- `test-definitions.md` template (wherever it lives) — show numbering format in scaffolded scenarios.
- `packages/cli/tests/` — new tests: scheme validation, coverage check, orphan detection.

### B0JZQN — Pause-and-confirm gates

- `.claude/skills/bdd/DISCOVERY.md` — gate pattern docs with closing-question template per sub-phase (orientation, JTBD, AC, scope).
- `packages/cli/templates/hooks/prompt-questions.ts` (or new hook) — surface current sub-phase + whether the closing question has been asked. v1 is conversational only; hook-enforced sub-phase tracking deferred.
- YOLO-mode interaction documented (auto-confirm + work-log entry).
- `packages/cli/tests/` — new tests: closing-question trip, gate-on-resume behavior.

### 1J6JKP — Lint hook hygiene (orphan; not Phase-0-related)

- `packages/cli/templates/hooks/session-lint-check.ts` — extend prettier config detection set (line 31) to recognize all valid prettier config filenames + the `"prettier"` key in `package.json`.
- `packages/cli/src/templates/config.ts` (or wherever `.claude/settings.json` template lives) — scope the PostToolUse biome invocation to `$CLAUDE_FILE_PATHS` instead of project-wide.
- `packages/cli/tests/` — new tests: prettier-config variants, biome-scoping verification.

### Epic-level (DZ2NM5 integration deliverables)

- `.claude/skills/bdd/DISCOVERY.md` — worked-example walkthrough exercising all four artifact types (persona refs, JTBDs, ACs, engineering scope) end-to-end.
- `packages/cli/templates/SAFEWORD.md` — overall Phase 0 narrative reflects the merged flow.
- `.safeword/SAFEWORD.md` (this repo's dogfood copy) — kept in sync with the template.
- An example feature ticket or end-to-end test demonstrates the new flow.

### Files explicitly NOT touched

- `.claude/skills/bdd/TDD.md`, `DECOMPOSITION.md`, `VERIFY.md`, `DONE.md` — downstream phases, unaffected.
- `.claude/skills/bdd/SPLITTING.md` — splitting rules unchanged.
- `packages/cli/templates/guides/architecture-guide.md` — architecture-check work lives in [M6D315](../M6D315/ticket.md), not this epic.
- Existing ticket folders for in-flight tickets — D5 grandfathers them; no retroactive `spec.md` scaffold.

## Done when

- `bdd` Phase 0 (DISCOVERY.md + skill body) captures all four artifact types (persona refs, JTBDs, ACs, engineering scope) with hook-enforced exit criteria.
- `.safeword-project/personas.md` and `.safeword-project/glossary.md` are first-class read targets in the Phase 0 flow.
- Cross-reference numbering scheme is documented and used by Phase 3 scenarios.
- All child tickets are `done` (9/9: 7YN5QB, YR6C49, Y2HCNJ, 31W8M3, XT1FFM, K7N2QM, B0JZQN, 1J6JKP, E1K5ZW ✓).
- The merged DISCOVERY.md includes a worked example walkthrough that exercises all four artifact types — done by **E1K5ZW** ✓.
- A test (or example ticket) demonstrates the new flow end-to-end — done by **E1K5ZW** (`tests/integration/phase0-walkthrough.test.ts`) ✓.

## Related

- **172** (phase-step enforcement) — complementary; this epic adds new step content, 172 enforces step execution. Coordinate on whether new Phase 0 sub-steps need 172-style hooks.
- **G2E72G** (yolo-mode) — interacts via the pause-and-confirm gates (B0JZQN) — under YOLO, gates auto-confirm.

## Work Log

- 2026-05-24T15:21:46.756Z Started: Created ticket DZ2NM5
- 2026-05-24T15:25:00.000Z Drafted: Epic shell with 6 child tickets, sequencing, and 5 open design decisions
- 2026-05-25T22:59:48.763Z Resolved: Decisions 1, 2, 3 via `/figure-it-out`. Product-first sub-ordering; `spec.md` sibling in ticket folder; `.safeword-project/` for personas/glossary with `.project/` fallback when present. Decisions 4 and 5 remain open (don't block 7YN5QB / YR6C49 kickoff). Architecture-check pattern also discussed — consultation-gate model (not arcade's rules-auto-load); location `.safeword-project/architecture.md` flat, `.safeword-project/architecture/<package>.md` folder for monorepos; that work belongs to Phase 2 epic [M6D315](../M6D315/ticket.md), not recorded as a child of this epic.
- 2026-05-26T03:20:00.000Z Refined: Removed `.project/` fallback from D3 — safeword reads/writes only `.safeword-project/` for personas/glossary. Cross-tool reconciliation with arcade's `.project/` and architecture-tracking conventions extracted to standalone ticket [P8RJ4M](../P8RJ4M/ticket.md). DZ2NM5 ships without the bridge; coexistence story lives in P8RJ4M.
- 2026-05-26T03:29:00.000Z Resolved: Decisions 4 and 5. D4 = features-only (tasks/patches skip the product layer). D5 = new-tickets-only (`spec.md` presence routes hook between old/new Phase 0 flows; existing in-flight tickets grandfathered). All five epic decisions now locked; no remaining gates on child kickoff.
- 2026-05-26T03:39:00.000Z Refined: D2 storage shape now specifies the SSoT split between `ticket.md` (one-line `**Goal:**` stub + `spec.md` pointer; `**Why:**` dropped from template) and `spec.md` (canonical `## Intent`). Resolved via `/figure-it-out` — Option D (stub + canonical) won over keep-both and manifest-only on SSoT-vs-orientation tradeoff. Added "Files affected (rollup)" section enumerating the safeword surfaces each child touches, with explicit NOT-touched list to bound scope.
- 2026-05-28T05:37:00.000Z Child done: **YR6C49** (glossary + structural validation) shipped — `.safeword-project/glossary.md` parser/validator, `paths.glossary` config (inherits K7N2QM), `safeword setup` scaffold + template, `safeword check` health reporting, and the "Load project glossary" Phase 0 sub-step in DISCOVERY.md. 31 scenarios, 155 tests green, audit passed. Schema ruling: required Definition + optional rich fields (Used in/Example/Do not confuse with/Aliases); strictness = structural-only + agent-conversational (no prose extraction). Arcade's real `.project/glossary.md` parses unchanged → KD4BYF (arcade adoption) unblocked. **Epic progress: 3/8 children done (7YN5QB, K7N2QM, YR6C49).** Remaining: Y2HCNJ, 31W8M3, XT1FFM, B0JZQN, 1J6JKP.
- 2026-05-31T03:55:00.000Z Child done: **1J6JKP** (lint hook hygiene) shipped — session-lint-check now detects eslint/prettier config by exact known-filename enumeration (fixes the `eslint.config.ts` false-negative AND the `.bak`-disabled false-positive); biome Issue 2 dropped (superseded). **Epic progress: 8/9 children done. Only E1K5ZW (integration walkthrough) remains.**
- 2026-05-31T04:39:33.277Z Child done — **EPIC COMPLETE (9/9): E1K5ZW** (integration walkthrough + e2e demo) shipped. DISCOVERY.md gains a "Worked example: Phase 0 end to end" capstone threading one feature (`oauth-flow` / Platform Operator) through all four artifacts (persona ref → JTBD → AC → engineering scope → numbered Phase-3 scenario + coverage advisory) with B0JZQN's sub-phase gates at each transition; the engineering-scope-only `--verbose` example is retired. SAFEWORD.md Clarify exit reordered into one arc with the `personas.md` anchor. New `tests/integration/phase0-walkthrough.test.ts` proves the flow composes through real code: spec scaffold → JTBD/AC gates (pre-tool-quality hook) → numbered scenarios → `safeword check` coverage report, plus a doc-presence guard over canonical+dogfood. test:done 209/209, demo 11/11, parity 13/13, build + lint clean; /audit + /verify passed. **Both epic-level done-whens (unified worked example + e2e demo) now satisfied — DZ2NM5 ready to close.** Paired arcade epic DXFX02 covers arcade-side adoption.
- 2026-05-31T01:55:00.000Z Child done: **B0JZQN** (sub-phase gates) shipped — DISCOVERY.md gains a named "Sub-phase gates" convention (present → ask closing question → wait) with a per-sub-phase question table, resume rule, and YOLO note; inline JTBD/AC pause lines cross-link it. Reframed feature→task (v1 conversational-only; enforcement hook deferred to open epic 172). Doc-presence test + full suite 2295/2295 green. **Epic progress: 7/8 children done. Remaining: 1J6JKP (rescope to Issue 1 — Issue 2 superseded), E1K5ZW (integration walkthrough).**
- 2026-05-31T01:36:00.000Z Revalidation pass (all children): **6/8 done** — 7YN5QB, YR6C49, Y2HCNJ, 31W8M3, XT1FFM, K7N2QM all closed with verify.md. Refreshed the stale child table (XT1FFM/31W8M3/7YN5QB/YR6C49/K7N2QM were mis-marked Open). **Remaining children: B0JZQN** (signoff gates — scope still valid, premise strengthened now that the JTBD/AC sub-phases exist; v1 conversational-only is unblocked) and **1J6JKP** (lint hygiene — Issue 1 prettier-config detection still live at `session-lint-check.ts:31`; **Issue 2 biome-project-wide appears superseded** by the move to `post-tool-lint.ts`, needs rescope at pickup). **Gap closed:** the epic-level integration deliverables (all-four-artifact worked example + e2e demo) had no owning ticket — carved out as new child **E1K5ZW**. Every epic done-when item now maps to a ticket.
- 2026-05-28T17:55:00.000Z Child done: **Y2HCNJ** (JTBD as Phase 0 artifact) shipped — per-ticket `spec.md` scaffold for features (six product-framing sections; JTBD example HTML-commented), type-aware `ticket.md` body (features get `**See:** spec.md` + drop `**Why:**`; tasks/patches unchanged), `hooks/lib/jtbd.ts` (JTBD-section parser + lightweight gate-level persona resolution + `evaluateJtbdGate`), intake-exit JTBD gate in `pre-tool-quality.ts` (routes on spec.md presence per D5; denies until ≥1 JTBD resolves against personas.md, or `skip: <reason>`), and the "Author Jobs To Be Done" Phase 0 sub-step in DISCOVERY.md + Clarify mention in SAFEWORD.md. 30 scenarios; full suite 2199 green; audit passed. Decisions baked: gate uses a dimensions.md-style `skip:` escape valve (not a hard block); Y2HCNJ assigns the JTBD-level id `<slug>.<persona-code><n>` (XT1FFM extends downward). Built across sessions + survived an `origin/main` merge mid-flight (ticket-writer import conflict resolved as union). **Epic progress: 4/8 children done (7YN5QB, K7N2QM, YR6C49, Y2HCNJ).** Remaining: 31W8M3, XT1FFM, B0JZQN, 1J6JKP. Next sequencing-child: 31W8M3 (AC layer, depends on Y2HCNJ ✓).
