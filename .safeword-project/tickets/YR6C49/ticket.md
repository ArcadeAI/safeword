---
id: YR6C49
slug: glossary-file
title: 'Add glossary (.safeword-project/glossary.md) + structural validation'
type: feature
phase: implement
status: in_progress
epic: bdd-phase-zero-merge
paired_with: KD4BYF
created: 2026-05-24T15:21:54.923Z
last_modified: 2026-05-28T01:08:00.000Z
scope:
  - Template — `packages/cli/templates/glossary-template.md` with canonical format header + commented example showing the rich shape.
  - Canonical entry schema — `## <Term>` header + required `**Definition:**` line; optional `**Used in:**`, `**Example:**`, `**Do not confuse with:**`, `**Aliases:** foo, bar` lines parsed if present, never required. Parser tolerates additional `**Field:**` lines (forward-compat).
  - Scaffold — `safeword setup` writes `.safeword-project/glossary.md` from the template if absent (idempotent, mirrors persona scaffold).
  - Configurable path — register `paths.glossary` in `.safeword/config.json` schema; lookup via `resolveConfiguredPath(cwd, 'glossary', '.safeword-project/glossary.md')`. Inherits K7N2QM pattern verbatim — relative paths against project root, absolute used verbatim, empty-string treated as unset.
  - Parser + validator — `packages/cli/src/utils/glossary.ts` parses `## Term` blocks (HTML-comment / code-fence aware); validates structural well-formedness (non-empty term, Definition present, no duplicate terms, no duplicate aliases, aliases resolve to declared terms). Pure — no I/O. Mirrors `personas.ts` parse/resolve/validate split.
  - Lookup API — `lookupGlossaryReference(terms, input)` + `validateGlossaryReference(cwd, input)`; same shape as `lookupPersonaReference` / `validatePersonaReference`; returns `{ status: 'unknown' }` on any missing-file case, never throws.
  - `safeword check` integration — structural-error reporting with line numbers; configured-but-missing reports loudly (K7N2QM R2.3 pattern); legacy-default advisory when override active (K7N2QM R2.6).
  - Schema registration — `packages/cli/src/schema.ts` adds `glossary.md` managed-file entry with `configKey: 'glossary'` gate so reconcile skips default scaffold when override configured (K7N2QM R3.2).
  - DISCOVERY.md Phase 0 hook — add "Load project glossary" sub-step parallel to the existing persona-loading block; agent reads file, holds terms in context, surfaces undefined-term questions conversationally during scope drafting. No prose extraction, no heuristic flagging.
  - Tests — scaffold-on-setup, parser well-formedness, validator errors (missing Definition, duplicate term, duplicate alias, unresolved alias), configured-path resolution (relative / absolute / missing / no-match / empty — mirrors K7N2QM R1.2-R1.6), safeword check integration, DISCOVERY.md-reads-glossary assertion, arcade-glossary-parses-unchanged fixture.
out_of_scope:
  - Prose-extraction lint (every-noun or heuristic Title-Case scan) — FSE 2025 suppression evidence; promote to opt-in `[[term]]` markup only if drift observed after Y2HCNJ ships spec.md.
  - Spec-local vocabulary — deferred to Y2HCNJ's spec.md Vocabulary section.
  - AC quality coaching — covered in 31W8M3.
  - Automated term-extraction or NLP — humans curate the glossary.
  - Backfill of in-flight tickets — epic D5 grandfathers existing intake artifacts.
  - `.project/` fallback by default — cross-tool reconciliation tracked in P8RJ4M; arcade users opt in via `paths.glossary` override.
done_when:
  - `packages/cli/templates/glossary-template.md` exists with format header + commented rich example.
  - `safeword setup` scaffolds `.safeword-project/glossary.md` from template when absent; idempotent.
  - `paths.glossary` resolves through `resolveConfiguredPath`; relative / absolute / missing / no-match / empty cases all covered by tests.
  - `packages/cli/src/utils/glossary.ts` parses canonical entries (Definition required, others optional), validates structural well-formedness, exposes `lookupGlossaryReference` and `validateGlossaryReference`.
  - `safeword check` reports structural errors with line numbers; configured-but-missing exits non-zero with `glossary-path: <configured>: file not found`; legacy-default advisory zero-exits when override active.
  - `.claude/skills/bdd/DISCOVERY.md` documents the "Load project glossary" sub-step parallel to persona-loading.
  - Arcade's existing `/Users/alex/Projects/arcade-monorepo/.project/glossary.md` parses unchanged under canonical reader (integration fixture).
  - All new unit + integration tests pass; full suite still green.
---

# Add glossary (`.safeword-project/glossary.md`) + structural validation

**Goal:** Introduce a project-wide glossary file as the source of truth for domain terms, parsed and validated by safeword, loaded into `bdd` Phase 0 so the agent surfaces undefined-term questions conversationally during intake.

**Why:** Without a glossary, domain terms drift across tickets — "session", "token", "auth", "user" mean subtly different things in different specs. Drift compounds; readers can't tell whether two scenarios are talking about the same thing.

**Parent epic:** DZ2NM5

**Depends on:** 7YN5QB (personas pattern — mirrors structure), K7N2QM (configurable paths — inherits `paths.glossary`)

**Couples with:** KD4BYF (arcade-side adoption — arcade's existing `.project/glossary.md` must parse unchanged under safeword's canonical reader)

## Scope

- **Template:** `packages/cli/templates/glossary-template.md` — new template, scaffold comment + commented example. Format documents the canonical entry shape.
- **Canonical entry schema:** `## <Term>` header + **required** `**Definition:**` line. Optional `**Used in:**`, `**Example:**`, `**Do not confuse with:**` lines are parsed if present, never required. Optional `**Aliases:** foo, bar` line for term synonyms. Lenient parser tolerates additional `**Field:**` lines (forward-compat for arcade and similar consumers).
- **Scaffold:** `packages/cli/src/commands/setup.ts` writes `.safeword-project/glossary.md` from the template if absent. Mirrors persona scaffolding.
- **Configurable path:** Register `paths.glossary` in `.safeword/config.json` schema; lookup via `resolveConfiguredPath(cwd, 'glossary', '.safeword-project/glossary.md')`. Inherits K7N2QM pattern verbatim — supports legacy `.project/glossary.md` for arcade and other prior-art consumers via config override (not by default fallback — explicit opt-in).
- **Parser + validator:** `packages/cli/src/utils/glossary.ts` — parse `## Term` blocks (HTML-comment / code-fence aware, same as personas), validate structural well-formedness: term name non-empty, `**Definition:**` present, no duplicate terms, no duplicate aliases, alias references resolve to declared terms. Pure — no I/O. Mirrors `personas.ts` parse/resolve/validate split.
- **Lookup API:** `lookupGlossaryReference(terms, input)` and `validateGlossaryReference(cwd, input)` — same shape as `lookupPersonaReference` / `validatePersonaReference`. Used by Phase 0 agent context, not by a prose extractor.
- **`safeword check`:** invokes `validateGlossary` on the configured path; reports structural errors with line numbers; reports configured-but-missing loudly (per K7N2QM's R2.3 pattern); legacy default-file advisory when override is active (per K7N2QM R2.6).
- **Schema registration:** `packages/cli/src/schema.ts` registers `glossary.md` as a safeword-managed file with a `configKey: 'glossary'` gate (so reconcile skips the default scaffold when an override is configured — K7N2QM R3.2 pattern).
- **DISCOVERY.md (Phase 0):** add a "Load project glossary" sub-step at intake start (parallel to the persona-loading block 7YN5QB shipped). Agent reads `.safeword-project/glossary.md`, holds terms in working context, and surfaces undefined-term questions conversationally when scope drafts reference an unknown term. No prose extraction, no heuristic flagging. Soft-prompt behavior identical to personas: empty file → "want to add some now, or proceed without?"; unknown reference during intake → flag, don't invent.
- **Tests:** scaffold-on-setup, parser well-formedness, structural-validator errors (missing Definition, duplicate term, duplicate alias, unresolved alias), configured-path resolution (relative, absolute, missing override, no match, empty string — mirrors K7N2QM R1.2-R1.6 coverage), `safeword check` integration, DISCOVERY.md-reads-glossary integration assertion.

## Out of scope

- **Prose-extraction lint** (every-noun or heuristic Title-Case scan). Rejected: documentation-linter suppression research (FSE 2025) shows heuristic prose linters get suppressed into noise. Promote to explicit `[[term]]` markup only if drift is observed after Y2HCNJ ships and we have a real spec.md text surface.
- **Spec-local vocabulary.** Project-wide terms only. Per-ticket vocabulary lives in `spec.md`'s Vocabulary section, scaffolded by Y2HCNJ — not this ticket.
- **AC quality coaching** — covered in 31W8M3.
- **Automated term-extraction or NLP** — humans curate the glossary.
- **Backfill of in-flight tickets.** Per epic D5, vocabulary-aware Phase 0 applies new tickets only. No retroactive migration of existing ticket folders.
- **`.project/` fallback by default.** Cross-tool reconciliation with arcade's `.project/` convention is tracked separately in P8RJ4M. Safeword reads/writes `.safeword-project/` by default; arcade users get parity via `paths.glossary = '.project/glossary.md'` config override.

## Done when

- `packages/cli/templates/glossary-template.md` exists, documents the canonical format header + commented example.
- `safeword setup` scaffolds `.safeword-project/glossary.md` from the template when absent.
- `paths.glossary` config key resolves through `resolveConfiguredPath`; tests cover relative, absolute, missing, no-match, empty cases.
- `packages/cli/src/utils/glossary.ts` parses canonical entries (Definition required, others optional), validates structural well-formedness, exposes `lookupGlossaryReference` and `validateGlossaryReference`.
- `safeword check` reports glossary structural errors with line numbers; configured-but-missing reports loudly; legacy-default advisory when override is active.
- `.claude/skills/bdd/DISCOVERY.md` includes a "Load project glossary" sub-step parallel to the existing persona-loading block.
- Arcade's existing `/Users/alex/Projects/arcade-monorepo/.project/glossary.md` parses unchanged under the canonical reader (verified via test fixture or integration assertion).
- Tests pass for all surfaces above.

## Open questions

None blocking. Locked decisions:

- **Schema richness** → required Definition + optional Used-in / Example / Do-not-confuse-with / Aliases (resolved via `/figure-it-out` 2026-05-27).
- **Strictness of vocabulary check** → structural-only + agent-uses-glossary-in-context; no prose extraction (resolved via `/figure-it-out` 2026-05-27).
- **File location** → `.safeword-project/glossary.md` (epic D3).
- **Spec-local vocabulary** → deferred to Y2HCNJ spec.md (epic D2).
- **Backward compat** → new tickets only (epic D5).
- **Configurable paths** → inherit K7N2QM `paths.*` pattern verbatim (epic sequencing #6).

## Work Log

- 2026-05-24T15:21:54.923Z Started: Created ticket YR6C49
- 2026-05-24T15:22:00.000Z Drafted: Scope, depends, open questions; linked to epic DZ2NM5
- 2026-05-28T00:58:05.000Z Refreshed: Rewrote scope, out-of-scope, done-when, and open-questions to reflect epic decisions (D2/D3/D5), K7N2QM `paths.*` inheritance, and `/figure-it-out` rulings on schema richness (required Definition + optional rest) and strictness (structural-only, no prose extraction). KD4BYF arcade-pair constraint pinned to scope (arcade glossary must parse unchanged). Replaced "lint-style check" framing with agent-conversational handling that mirrors the just-shipped persona pattern. Added `packages/cli/src/utils/glossary.ts` to scope explicitly. All five original open questions resolved.
- 2026-05-28T01:08:00.000Z Complete: Phase 0-2 - Understanding converged, scope established. Frontmatter scope/out_of_scope/done_when fields populated as condensed one-liners mirroring the markdown sections (K7N2QM/7YN5QB convention). Phase advanced to define-behavior.
- 2026-05-28T01:12:00.000Z Complete: Phase 3 - 26 scenarios defined across 7 rules. Dimensions table derived from intake + arcade-prototype inspection (8 dimensions). Coverage: 5 parser shapes, 3 skip-mask cases, 5 validator errors, 5 path-resolution states, 3 setup behaviors, 3 check-reporting branches, 4 lookup outcomes, 2 integration assertions (arcade fixture + DISCOVERY.md sub-step). Owned implementation decision: unresolved-alias is an error (matches strictness of duplicate-term / missing-Definition); downgrade-to-warning option recorded inline if friction observed during implementation.
- 2026-05-28T02:01:00.000Z Complete: Phase 4 - Scenarios validated (AODI) + adversarial pass. AODI clean: all 30 scenarios atomic (one G/W/T), observable (return/exit/file-state), deterministic (pure or temp-dir/fixture), independent (self-contained Given). Adversarial findings (no new scenarios needed): CRLF / BOM / non-UTF8 / h3-headers all implicitly covered by mirrored persona-parser semantics; repeated-Definition-within-entry semantics (first-wins vs last-wins) flagged as decomposition-time call; alias-pointing-to-other-canonical edge case flagged for decomposition. Mixed-error-types scenario gap noted but low-risk (R3.2 / R3.3 already assert list-shape, not throw-shape). (Corrects earlier scenario count: 30, not 26 — R7=4 lookup scenarios, R8=2 integration scenarios.)
- 2026-05-28T02:05:00.000Z Complete: Phase 5 - Decomposed into 6 tasks. Sequencing: T1 parser core (8 scenarios), T2 validator (5), T3 lookup + path (9), T4 template + scaffold + configKey gate (3), T5 check command (3), T6 arcade fixture + DISCOVERY.md sub-step (2). T2 and T4 can run in parallel after T1. All 30 scenarios allocated. Owned implementation decisions (decomposition.md notes): repeated-Definition is first-wins (matches persona Role semantics); alias-collision-with-canonical treated as duplicate-alias error. T6 must edit both dogfood and canonical DISCOVERY.md (pre-commit canonical-first discipline).
