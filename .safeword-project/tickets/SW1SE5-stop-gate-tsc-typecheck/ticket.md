---
id: SW1SE5
slug: stop-gate-tsc-typecheck
type: feature
phase: scenario-gate
status: in_progress
created: 2026-05-28T18:03:05.512Z
last_modified: 2026-05-28T23:51:00.000Z
scope:
  - Add an incremental whole-program `tsc --noEmit` to `stop-quality.ts`'s NON-done (implement-phase) stop path, for TypeScript projects only.
  - Gate execution: run only when (a) a tsconfig.json exists at project root, AND (b) ≥1 TypeScript file changed this session, AND using `--incremental` (a cached `.tsbuildinfo`) so repeat runs are fast.
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
