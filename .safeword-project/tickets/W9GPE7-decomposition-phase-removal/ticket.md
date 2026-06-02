---
id: W9GPE7
slug: decomposition-phase-removal
type: task
phase: implement
status: backlog
epic: bdd-chain-hardening
parent: EECVXB
created: 2026-06-02T15:01:21.748Z
last_modified: 2026-06-02T15:01:21.748Z
---

# Remove deprecated decomposition phase — enum value, DECOMPOSITION.md, Cursor rule, migrate ticket 153

**Goal:** Complete the decomposition retirement started in FSX1PP — delete the now-deprecated `decomposition` machinery once nothing references it.

**Why:** FSX1PP collapsed the behavior (scenario-gate → implement) and deprecated `decomposition`, but kept the enum value, `DECOMPOSITION.md`, and the Cursor rule for back-compat because a live ticket (`153-boundary-resilience`) sits at `phase: decomposition` and the removal is cross-cutting. This ticket finishes the job once that's safe.

**Scope:**

- Migrate `153-boundary-resilience` off `phase: decomposition` (advance or re-home it).
- Remove `decomposition` from the phase enum (`lib/quality.ts` `BddPhase` union + the `PHASE_EVIDENCE` map) and the `prompt-questions.ts` reminder map.
- Delete `packages/cli/templates/skills/bdd/DECOMPOSITION.md` + its dogfood copy, and the Cursor rule `bdd-decomposition.mdc` + its dogfood copy.
- Update `schema.ts` `managedFiles` (drop the removed files) and the `skill-cursor-pairs` parity fixture; update `quality.test.ts`'s phase lists and `stop-quality.ts`'s `phasesRequiringTestDefs`.
- Update `SKILL.md` phase tables / `SPLITTING.md` references to drop the phase entirely (not just deprecate).

**Out of scope:** the behavior collapse + ADR (done in FSX1PP).

**Depends on:** `153-boundary-resilience` being clear of `phase: decomposition`.

**Done when:** `decomposition` no longer appears in the phase enum, hooks, skill files, schema, or fixtures; full suite + parity green; no ticket references the removed phase.

**Blocked/deferred:** backlog — pick up after 153 is migrated. The deprecated machinery is harmless in the meantime (FSX1PP routes new work scenario-gate → implement).

## Work Log

- 2026-06-02T15:01:21.748Z Started: Created ticket W9GPE7
- 2026-06-02T15:01Z Filed as the staged follow-up to FSX1PP (decomposition removal). Backlog until ticket 153 is migrated off the phase.
