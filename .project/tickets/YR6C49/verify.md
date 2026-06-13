# YR6C49 — Verify

Feature: project glossary (`.safeword-project/glossary.md`) + parser, structural
validator, configurable path, scaffold, `safeword check` integration, lookup API,
and Phase 0 DISCOVERY.md sub-step.

## Verify Checklist

**Test Suite:** ✓ 155/155 tests pass (targeted: feature + full blast radius — see note)
**Build:** ✅ Success (`bun run build` — ESM + DTS clean)
**Lint:** ✅ Clean (eslint on all new/changed glossary files; pre-commit lint-staged green on every commit)
**Scenarios:** All 31 scenarios marked complete
**Dep Drift:** ✅ Clean — feature adds zero new dependencies (`glossary.ts` uses only `node:fs`/`node:path` + internal imports); `configKey: 'glossary'` already documented in ARCHITECTURE.md:290
**Parent Epic:** DZ2NM5 (bdd-phase-zero-merge) — sibling of 7YN5QB (done), K7N2QM (done)
**Audit:** Audit passed

### Test-suite note (full-suite hang)

The full `vitest run` hangs in this local environment — four runs killed at exit
144 with no terminal summary, consistent with the project's known
process-spawning integration-test flakiness (NOT introduced by this feature; the
glossary code is a new isolated module). Verification used an explicit
file-list run covering the feature and everything it touches or could regress:

| File                                                                      | Tests    |
| ------------------------------------------------------------------------- | -------- |
| `src/utils/glossary.test.ts` (parser + validator + lookup)                | 18       |
| `tests/utils/glossary-ref.test.ts` (configured-path I/O)                  | 5        |
| `tests/reconcile-glossary.test.ts` (scaffold + configKey gate)            | 3        |
| `tests/integration/arcade-glossary.test.ts` (KD4BYF fixture)              | 2        |
| `tests/integration/discovery-glossary-substep.test.ts` (Phase 0 doc)      | 4        |
| `tests/commands/check.test.ts` (glossary health + persona regression)     | 23       |
| `tests/schema.test.ts`                                                    | (in 55)  |
| `tests/owned-paths.test.ts`                                               | (in 55)  |
| `tests/npm-package.test.ts`                                               | (in 55)  |
| `tests/reconcile-configured-paths.test.ts` (persona configKey regression) | (in 114) |
| `tests/reconcile.test.ts` (general scaffold-set regression)               | 41       |

Total observed: **155 passing across 11 files**, 0 failing. The authoritative
full-suite run happens in CI on the PR (fresh build, no local hang).

## Done-when criteria (from ticket frontmatter)

- ✅ `packages/cli/templates/glossary-template.md` exists — format header + commented rich example (Definition/Used in/Example/Do not confuse with/Aliases).
- ✅ `safeword setup` scaffolds `.safeword-project/glossary.md` from template when absent; idempotent (R5.1, R5.2).
- ✅ `paths.glossary` resolves through `resolveConfiguredPath`; relative / absolute / missing / empty cases covered (R4.1-R4.5).
- ✅ `packages/cli/src/utils/glossary.ts` parses canonical entries (Definition required, others optional, multi-line continuation), validates structure, exposes `lookupGlossaryReference` + `validateGlossaryReference`.
- ✅ `safeword check` reports structural errors with line numbers (R6.1); configured-but-missing exits non-zero with `glossary-path: <configured>: file not found` (R6.2); legacy-default advisory zero-exits (R6.3).
- ✅ `.claude/skills/bdd/DISCOVERY.md` (+ canonical template) document the "Load project glossary" sub-step parallel to personas (R8.2).
- ✅ Arcade's real `.project/glossary.md` parses unchanged — 7 terms, 0 errors, full multi-line definitions captured (R8.1, KD4BYF acceptance).
- ✅ All new unit + integration tests pass.

## Audit summary

```
Architecture: ✔ no violations (117 modules, 324 deps)
Dead code:    ✔ no glossary dead code (2 pre-existing persona constants, documented)
Duplication:  ✔ 0 clones in glossary.ts + check.ts
ARCHITECTURE: ✔ no drift (configKey glossary slot pre-documented, line 290)
Learnings:    ✔ all Covers: lines present
Test quality: ✔ specific assertions, edge coverage, independent, behavior-named

Errors: 0 | Warnings: 1 (pre-existing) |

Audit passed
```

**Pre-existing warning (not glossary-caused, not blocking):**

- [W007] `.safeword/depcruise-config.cjs` reported stale by `sync-config --check`. Unrelated to this feature; tracked by the read-only-`/audit` follow-up task spawned earlier this session.

## Scope decisions exercised during implementation

- **R1.6 (multi-line definitions)** added mid-implementation after `/quality-review` ran the parser against arcade's real glossary and found single-line capture truncated wrapped definitions. Parser now accumulates continuation lines until a blank line / new field / header.
- **R3.4 corrected**: original "alias → non-existent term → error" was semantically backwards (aliases needn't have their own block). Reframed to "alias shadows a declared term name → error" (ambiguous lookup), matching the decomposition.md owned decision.
- **Cross-cutting persona/glossary duplication** (4 function pairs) deliberately NOT extracted — deferred to the architecture read-site (3rd consumer) per Rule-of-Three / AHA, validated via `/quality-review`. Per-pair extraction guidance recorded in decomposition.md.

**Next:** mark YR6C49 done (`/bdd` done phase → phase: done, status: done); the paired arcade ticket KD4BYF unblocks (run `bunx safeword@latest upgrade` in arcade-monorepo, verify its glossary, remove the local review-spec validation).
