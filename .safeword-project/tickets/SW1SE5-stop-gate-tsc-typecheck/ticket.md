---
id: SW1SE5
slug: stop-gate-tsc-typecheck
type: feature
phase: done
status: done
created: 2026-05-28T18:03:05.512Z
last_modified: 2026-05-28T23:51:00.000Z
scope:
  - Add an incremental whole-program `tsc --noEmit` to `stop-quality.ts`'s NON-done (implement-phase) stop path, for TypeScript projects only.
  - Gate execution: run only when (a) a tsconfig.json exists at or above ≥1 changed TS file (find-up — root OR a package dir, so monorepos work), AND (b) ≥1 `.ts`/`.tsx`/`.mts`/`.cts` file changed this session, AND using `--incremental` (a cached `.tsbuildinfo`) so repeat runs are fast.
  - Surface any type errors as ADVICE in the stop output (soft, like the existing non-done quality-review prompt) — does NOT hard-block the stop.
  - Skip cleanly (no run, no output) for non-TS projects and when no TS files changed this session.
  - New lib helper for the TS-detection + changed-files gate + tsc runner; sync template ↔ dogfood copies.
out_of_scope:
  - Hard-blocking the stop on type errors — the done gate (`/verify`→`/lint`→tsc) stays the hard backstop.
  - Per-edit (post-tool) typecheck — wrong cadence; whole-program tsc can't run file-local.
  - Touching the done-phase stop path — it already typechecks via /verify.
  - Bootstrapping safeword's `personas.md` or authoring a product JTBD — SW1SE5 is internal dev-tooling (JTBD skipped via the Y2HCNJ valve; see spec.md).
done_when:
  - On an implement-phase stop in a TS project with a type error in changed code, the stop output surfaces the tsc error as advice (stop still allowed).
  - Clean types, or no TS files changed, or non-TS project → no tsc run and no added output.
  - Repeat runs reuse the incremental cache (no full recheck each stop).
  - Unit tests for the gate logic + integration test for the stop-hook branch; full suite + lint green.
---

# Stop-gate incremental tsc for TS projects

**Goal:** Add an incremental whole-program `tsc --noEmit` to the stop-quality gate for TypeScript projects, so type errors surface at the stop boundary instead of riding silently to the done gate.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-05-28T18:03:05.512Z Started: Created ticket SW1SE5
- 2026-05-28T23:46:00.000Z Re-validated on pickup (5JN5E4 practice). Premise HOLDS: `lib/lint.ts` still eslint+prettier only, no tsc in any shipped hook, type errors first surface at the done gate (`/verify`→`/lint`). REFINEMENT: `stop-quality.ts` runs `runTests` ONLY in the `currentPhase === 'done'` block (line ~340); non-done stops just do a soft quality-review prompt with no commands. So adding tsc to the done block would NOT move feedback earlier (done already typechecks via /verify). To actually catch type debt early, the incremental tsc must run at **implement-phase (non-done) stops**, surfaced as advice (matching the existing non-done softBlock model), not a hard block, gated on TS-files-changed-this-session + incremental cache. Open decision for build: soft-surface vs hard-block at implement-stop (lean soft — a hard block on every implement turn is too heavy).
- 2026-05-29T19:15:00.000Z Scenario-gate adversarial pass surfaced 2 gaps. (1) "Root tsconfig" framing was too narrow — the safeword repo itself has NO root tsconfig (only `packages/cli/tsconfig.json`), so the gate would skip in its own dogfood. Refined: find-up nearest tsconfig from each changed TS file (monorepo-aware). Added scenario for the monorepo case. (2) "TS files" was implicit — clarified to cover `.ts`/`.tsx`/`.mts`/`.cts`. Added scenario for the non-`.ts` extensions. Scope/dimensions/test-definitions all updated in lockstep.
- 2026-05-29T21:23:00.000Z Done (full BDD). Built bottom-up TDD: Rule 1 gate (4fa3a94b), tsc runner + composition (97a5497c), git-diff source + stop-quality wiring (69302789), hook-level integration test (b5dc92b5), ledger (69b4698f). `/figure-it-out` decided soft-surface (measured warm tsc ≈0.7s, silent-when-clean → run every implement-stop, not LOC-throttled) + write `.tsbuildinfo` to OS temp (c9fefc2e, no repo pollution). Full suite caught a real false-positive: TS18003 "no inputs" (config error) was surfaced as a type error, hijacking the review prompt in 13 hooks.test.ts E2E tests — fixed by surfacing only file-level diagnostics (3d6e3825). Final: 2229 green, /verify + /audit passed (audit: 0 errors, 1 pre-existing orphan warning unrelated to SW1SE5). Spun off 3 tickets en route: 04HK04 (skill-log git-root fallback, done), SXSCJQ (remove LOC review throttle, open). status → done.
