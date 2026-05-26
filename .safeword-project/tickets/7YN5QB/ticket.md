---
id: 7YN5QB
slug: personas-file
title: 'Add persona model (.safeword-project/personas.md) + Phase 0 validation'
type: feature
phase: implement
status: in_progress
epic: bdd-phase-zero-merge
paired_with: BC53PV
created: 2026-05-24T15:21:54.876Z
last_modified: 2026-05-26T04:41:55.864Z
scope:
  - Define `.safeword-project/personas.md` format — per-persona block with short code (e.g., `PO`), full name, `Role:` description, optional `Context:` notes; file-level header documents the format with a commented-out example.
  - Auto-derive persona short codes from the full name when the user authors `## <Name>` with no code — multi-word names use first-letter-of-each-word (`Platform Operator` → `PO`); single-word names use first-2-chars (`Auditor` → `AU`); non-alpha stripped before deriving (`Bob's Burger` → `BB`); digits preserved within the derived code (single-word `S3` → `S3`); derivation overflow silently truncates to first 6 characters; digit-first names produce non-conformant codes and surface an explicit-override prompt at `safeword check`.
  - On code collision, append a numeric suffix starting at 2 (`PO` taken → `PO2` → `PO3` → ...).
  - Respect user-authored explicit codes — `## Platform Operator (CUSTOM)` is taken verbatim after pattern validation; no re-derivation.
  - Code pattern — uppercase letters and digits, 2-6 characters, unique within the file, case-sensitive comparison; suggest "did you mean `PO`?" on a casing mismatch.
  - `safeword setup` scaffolds `.safeword-project/personas.md` if absent (idempotent — re-running setup never overwrites existing content).
  - `safeword check` validates the file is well-formed (codes match pattern, codes are unique, persona names are unique, each name is ≥2 characters, each block has a Role line, no headerless blocks) and exits non-zero on malformed content with a clear error pointing at the bad line; digit-first-name surfaces the explicit-override prompt.
  - `packages/cli/src/schema.ts` registers `personas.md` as a safeword-scaffolded, user-owned file — surfaces in `safeword diff` / `safeword reset` like other managed-but-user-owned files.
  - Export `validatePersonaRef(nameOrCode: string)` — reads personas.md and returns `{ status: 'valid' | 'unknown', match?: Persona, suggestion?: string }`; degrades gracefully on missing/unreadable personas.md (returns `unknown`, no throw); strict on casing (returns `unknown` + `suggestion` when the input differs from a known code only by case); consumed later by Y2HCNJ when persona refs appear in spec.md.
  - bdd skill (DISCOVERY.md) reads personas.md at intake start and loads it into agent context; if the file is empty (no actual persona blocks parsed), agent surfaces a soft prompt "personas.md is empty — want to add some now, or proceed without?" — user can answer "proceed without" and Phase 0 advances.
  - Tests in `packages/cli/tests/` cover all 31 scenarios in `test-definitions.md` — scaffold idempotence, derivation (six cases including digit-preservation, digit-first rejection, overflow truncation), collision suffixing, explicit-override pass-through, validation (six cases including single-char-name and duplicate-name rejections), lookup (six cases including missing-file graceful return).
out_of_scope:
  - JTBD authoring (Y2HCNJ).
  - Migrating existing in-flight safeword tickets to reference personas (D5 grandfathers them).
  - A `safeword personas add` interactive command — for v1 the user edits the markdown file directly; auto-derivation runs on `safeword check` or implicitly on next read.
  - Persona deprecation lifecycle (state field, tombstones, history). To retire a persona, the user deletes the block; refs to retired codes surface as unknown automatically.
  - Persona refactor-safety (renaming a persona and updating cross-refs in old tickets/specs) — renames are manual; revisit scope if pain emerges.
  - Cross-tool sync with arcade's `.project/personas.md` — tracked in [P8RJ4M](../P8RJ4M/ticket.md).
done_when:
  - `.safeword-project/personas.md` format is documented in the safeword template (`personas-template.md`) with a worked example.
  - `safeword setup` scaffolds the file if absent and never overwrites existing content (idempotent across repeated runs).
  - `safeword check` validates the file is well-formed and exits non-zero on malformed content with a clear error pointing at the bad line.
  - Short codes auto-derive from names per the documented algorithm; collisions resolved with numeric suffix; user-authored explicit codes respected verbatim after pattern validation.
  - `validatePersonaRef()` is exported, returns valid/unknown status with optional match, and is covered by tests.
  - bdd Phase 0 (DISCOVERY.md) reads personas.md at intake start and exposes it in agent context; empty-file case surfaces a soft prompt.
  - All new behaviors are covered by vitest tests in `packages/cli/tests/` following the existing patterns in `tests/hooks/` and `tests/commands/`.
---

# Add persona model (`.safeword-project/personas.md`) + Phase 0 validation

**Goal:** Introduce a project-wide personas file as the source of truth for who features serve, and validate persona references in `bdd` Phase 0 against it.

**Why:** Today, "who is this for" is implicit in safeword's `scope`/`done_when`. That elides the question and lets feature scoping drift toward implementation. Persona-anchored motivation is more stable than scope anchored to behavior.

**Parent epic:** [DZ2NM5](../DZ2NM5/ticket.md)

**Depends on:** —

## Design decisions

Three intake-time questions resolved before advancing to `define-behavior`. Two inherit from the parent epic; the third is local.

### File location (inherits DZ2NM5/D3)

`.safeword-project/personas.md`. Safeword owns the namespace; the user authors the content. Cross-tool reconciliation with arcade's `.project/personas.md` is out of scope here — tracked in [P8RJ4M](../P8RJ4M/ticket.md).

### Short-code authoring (resolved via `/figure-it-out`, convention-over-configuration)

The user authors a persona by writing `## <Name>` and a `Role:` line. **Safeword derives the short code** from the name and writes it back into the file. The derivation rule:

- **Multi-word names** → first letter of each word, uppercased. "Platform Operator" → `PO`. "End User" → `EU`. "Site Reliability Engineer" → `SRE`.
- **Single-word names** → first 2 characters, uppercased. "Auditor" → `AU`. "Architect" → `AR`.
- **Non-alpha stripped** before deriving. "Bob's Burger" → "Bobs Burger" → `BB`.
- **Collision** → append a numeric suffix starting at 2. If `PO` is taken, try `PO2`, then `PO3`, etc.
- **Explicit override** — if the user writes `## Platform Operator (CUSTOM)`, safeword respects it verbatim after pattern validation. No re-derivation.
- **`safeword check`** validates the final state (uniqueness, pattern), regardless of whether the code was user-authored or system-derived.

Pattern: `^[A-Z][A-Z0-9]{1,5}$` — uppercase letters and digits, 2-6 characters. Case-sensitive comparison; on a casing mismatch the validator suggests "did you mean `PO`?"

Why this shape: users author personas in product language ("Platform Operator"), not in tool-syntax language. The convention-over-configuration pattern keeps the easy path easy and exposes the override for users who want a specific code. See [Convention over configuration — Wikipedia](https://en.wikipedia.org/wiki/Convention_over_configuration).

### Empty-file behavior at intake

`safeword setup` scaffolds `personas.md` at install time with format header + commented example. The file exists but contains no real persona blocks until the user adds them.

At feature intake, the agent reads personas.md. If zero persona blocks are parsed, the agent surfaces a **soft prompt**: "personas.md is empty — want to add some now, or proceed without?" The user can answer "proceed without" and Phase 0 advances. The same prompt fires later only when a Phase 0 turn tries to reference a persona the file doesn't contain.

Soft block, not hard block — pre-Y2HCNJ there's no JTBD consumption to enforce against, so empty-personas is a valid intermediate state.

## Sibling tickets

- [YR6C49](../YR6C49/ticket.md) — glossary file. Independent of personas (no shared file/code); ships in parallel under the same epic.
- [Y2HCNJ](../Y2HCNJ/ticket.md) — JTBD authoring. Depends on 7YN5QB landing first — JTBDs reference personas, and their hook gate uses `validatePersonaRef()` from this ticket.

## Worked example

What the user writes:

```markdown
## Platform Operator

**Role:** Owns the platform infrastructure for an organization — registers servers, sets rate limits, manages projects.

**Context:** Has Dashboard admin access; may have infra access.

## End User

**Role:** Signs in to use the product.
```

What safeword writes back on next save:

```markdown
## Platform Operator (PO)

**Role:** Owns the platform infrastructure for an organization — registers servers, sets rate limits, manages projects.

**Context:** Has Dashboard admin access; may have infra access.

## End User (EU)

**Role:** Signs in to use the product.
```

The codes appear automatically. The user can override either by writing the code explicitly (`## Platform Operator (PLATOPS)`) — safeword respects the override.

## Work Log

- 2026-05-24T15:21:54.876Z Started: Created ticket 7YN5QB.
- 2026-05-24T15:22:00.000Z Drafted: Initial scope, dependencies, open questions; linked to epic [DZ2NM5](../DZ2NM5/ticket.md).
- 2026-05-26T04:21:27.168Z Resolved Phase 0: File location inherits from DZ2NM5/D3 (`.safeword-project/`). Short-code rules resolved via `/figure-it-out` — auto-derive from name (first-letter-of-each-word for multi-word, first-2-chars for single-word), append numeric suffix on collision, respect user-authored explicit codes. Empty-file at intake → soft prompt, not hard block. Scope / out_of_scope / done_when written to frontmatter. Title updated to reflect resolved location. Phase advanced from `intake` to `define-behavior`.
- 2026-05-26T04:29:42.934Z Phase 3 complete: Wrote [dimensions.md](./dimensions.md) (8 dimensions × ~30 partitions across setup, derivation, collision, override, validation, lookup) and [test-definitions.md](./test-definitions.md) (6 rules, 25 scenarios in G/W/T form with R/G/R checkboxes). Resolved local open question — `validatePersonaRef` is strict on casing (returns `{ status: 'unknown', suggestion: 'PO' }` for `"po"` against existing `PO`); lenient matching would silently alias persona codes that differ by case. Agent-loop behaviors (empty-file prompt, Phase 0 context load) explicitly out-of-scope for vitest — covered by DZ2NM5 epic worked-example walkthrough.
- 2026-05-26T04:41:55.864Z Phase 4 complete (AODI + adversarial): All 25 scenarios pass AODI (atomic G/W/T triples, observable file/exit-code/return-value assertions, deterministic content-based outcomes, no inter-scenario dependencies). Adversarial pass surfaced 5 edge cases; resolved via `/figure-it-out` and added 6 scenarios — single-char-name rejected (modern Postel strict-by-default), digits preserved in derivation with digit-first-name override prompt (codes legitimately allow digits), 6-char silent truncation on overflow (git SHA / POSIX precedent), duplicate persona names rejected (names are unique identifiers), `validatePersonaRef` returns unknown on missing file (degrade gracefully at I/O boundary). Frontmatter scope expanded to cover all 5 new policies. test-definitions.md now 31 scenarios across 6 rules. Phase advanced to `decomposition`.
- 2026-05-26T04:54:40.533Z Phase 5 skipped: Architecture is clear from converged scope — A. pure-function `derivePersonaCode` and `parsePersonas` in `packages/cli/src/utils/personas.ts`; B. `validatePersonaRef` + `validatePersonasFile` building on A; C. `personas-template.md` + `schema.ts` registration; D. `setup.ts` idempotent scaffold; E. `check.ts` file validation; F. `.claude/skills/bdd/DISCOVERY.md` reads personas.md at intake. Test layers: unit tests under `packages/cli/tests/utils/personas.test.ts` for pure functions; integration tests under `packages/cli/tests/commands/` for setup/check wiring. Dependency chain A → B → {C, D, E} → F. User signed off on autonomous full-ticket execution mode and personas.ts file placement.
- 2026-05-26T04:54:40.533Z Phase 6 started: Implement slice A — pure-function derivation. Writing RED tests first.
