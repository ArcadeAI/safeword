---
id: SW1SE5
slug: stop-gate-tsc-typecheck
type: feature
phase: intake
status: in_progress
created: 2026-05-28T18:03:05.512Z
last_modified: 2026-05-28T18:03:05.512Z
---

# Stop-gate incremental tsc for TS projects

**Goal:** Add an incremental whole-program `tsc --noEmit` to the stop-quality gate for TypeScript projects, so type errors surface at the stop boundary instead of riding silently to the done gate.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-05-28T18:03:05.512Z Started: Created ticket SW1SE5
- 2026-05-28T23:46:00.000Z Re-validated on pickup (5JN5E4 practice). Premise HOLDS: `lib/lint.ts` still eslint+prettier only, no tsc in any shipped hook, type errors first surface at the done gate (`/verify`→`/lint`). REFINEMENT: `stop-quality.ts` runs `runTests` ONLY in the `currentPhase === 'done'` block (line ~340); non-done stops just do a soft quality-review prompt with no commands. So adding tsc to the done block would NOT move feedback earlier (done already typechecks via /verify). To actually catch type debt early, the incremental tsc must run at **implement-phase (non-done) stops**, surfaced as advice (matching the existing non-done softBlock model), not a hard block, gated on TS-files-changed-this-session + incremental cache. Open decision for build: soft-surface vs hard-block at implement-stop (lean soft — a hard block on every implement turn is too heavy).
