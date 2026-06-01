# Spec: Keep the LOC gate, fix the mid-merge deadlock

## Intent

The 400-LOC commit gate is safeword's blast-radius control: a natural gate that
forces a checkpoint before an uncommitted change grows too large to review or
revert. `/figure-it-out` confirmed it's the right _trigger_ — it's phase-agnostic,
so it reaches the un-phased majority of editing (refactors, mechanical edits,
config, docs, exploration) that a phase/step boundary structurally cannot, while
the per-step TDD ledger already gates the phased path. Its one real defect: it
can't tell agent edits from an in-progress merge, so `git diff HEAD` counts
incoming conflict lines, trips the threshold, and blocks the edits needed to
resolve — a deadlock that can't clear until the merge commit. Keep the gate; make
it git-operation-aware.

## References

- `/figure-it-out` (work log, 2026-06-01): keep (B), not relocate (C) — coverage beats precision here.
- `natural-vs-self-report-gates` learning — LOC is a natural/physics gate, the kind to keep.
- Project memory `project_loc_gate_blocks_merge` — the documented deadlock this fixes.
- `quality-state.ts:9` (LOC_THRESHOLD), `post-tool-quality.ts:122` (arm), `pre-tool-quality.ts:406` (block); git markers via `git rev-parse --git-dir`.

## Personas

- **Safeword Maintainer (SM)** / **Agent-Driven Developer (DEV)** — both hit the gate; the deadlock strands anyone whose agent edits during a merge/rebase/cherry-pick.

## Jobs To Be Done

### loc-gate-vs-phase-placement.DEV1 — Resolve a merge without the blast-radius gate deadlocking me

**Persona:** Agent-Driven Developer (DEV)

> When my agent is mid-merge (or rebase/cherry-pick) and needs to edit files to
> resolve conflicts, I want the LOC gate to stand down, so blast-radius control
> doesn't block the very edits that finish the operation.

#### loc-gate-vs-phase-placement.DEV1.AC1 — The LOC gate does not arm or block while a git merge/rebase/cherry-pick/revert is in progress

#### loc-gate-vs-phase-placement.DEV1.AC2 — Normal blast-radius control is unchanged when no git operation is in progress (≥400 LOC still gates)

## Vocabulary

Uses existing glossary: Gate (the LOC gate specifically), Natural gate. No new terms.

## Outcomes

- A pure `isGitOperationInProgress(projectDirectory)` detects merge/rebase/cherry-pick/revert via the markers under the resolved git dir.
- `post-tool-quality.ts` does not set `gate = 'loc'` while an operation is in progress; `pre-tool-quality.ts` does not deny edits while one is in progress.
- With no operation in progress, ≥400 non-meta LOC still arms and blocks exactly as before (no regression).
- The decision to KEEP (not relocate) the trigger is recorded; threshold-tuning and mechanical-weighting deferred (no documented harm).
