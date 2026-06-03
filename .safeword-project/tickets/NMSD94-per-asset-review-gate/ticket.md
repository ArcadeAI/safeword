---
id: NMSD94
slug: per-asset-review-gate
type: feature
phase: intake
status: backlog
created: 2026-06-03T03:23:27.177Z
last_modified: 2026-06-03T03:45:00.000Z
---

# Phase-exit "review-ran" stamp ledger (reshaped from per-asset gate)

**Goal:** Make "a quality review actually ran before advancing" enforceable at each **phase exit**, by extending the existing `skill-invocation-log` ledger (which already gates `done` on `/verify` + `/audit` stamps) to require a `/quality-review` stamp at the other phase boundaries — closing the demonstrated gap where review is under-triggered without building new per-asset machinery.

**Why (revalidated 2026-06-03 — supersedes the original A→C scope):** A `/figure-it-out` against the actual code changed the design:

- **Original Option A (per-asset structural gate) is largely redundant.** The existing intake-exit gate (`pre-tool-quality.ts`) already blocks scenario creation until `scope`/`out_of_scope`/`done_when` exist + are non-empty, the phase advanced, and the JTBD + AC gates pass. The only real gap is that AC↔scenario lineage coverage is computed (`scenario-coverage.ts`) but **deliberately advisory** (`check.ts`: "Zero-exit — advisory, never a gate") — made non-blocking on purpose to avoid over-fire.
- **Original Option C (per-asset `context: fork` reviewer) is over-cost + shape-mismatched.** A fork-subagent per Phase-0 asset AND per TDD step is heavy; its verdict is itself an LLM judgment (proves review _ran_, not _correct_); and the defects review actually caught this session were cross-cutting/implementation (found by _epic-level_ `/quality-review`), not per-Phase-0-asset.
- **The gap is real, though:** this session needed the user to manually prompt `/quality-review` three times, each finding genuine defects — soft review is under-triggered. The right fix is the _proven ledger pattern_ at the _right granularity + cost_, not a new per-asset mechanism.

**Scope:**

- Extend the `skill-invocation-log` + done-gate mechanism (`stop-quality.ts` / `skill-invocation-log.ts`) to require a logged `/quality-review` stamp at each **phase exit** (define-behavior → scenario-gate → implement → verify), mirroring how `done` already requires `verify ✓` + `audit ✓`.
- Promote the advisory AC↔scenario coverage check (`scenario-coverage.ts`) to a **skippable trial** blocking gate (deny on uncovered ACs / orphan scenarios, with a `skip: <reason>` escape), and measure its alert-to-action ratio before making it permanent.

**Out of scope:**

- The per-asset `context: fork` reviewer (original C) — over-cost (fork per asset/step), gates an LLM verdict, shape-mismatched to where defects actually surfaced. Revisit only if phase-exit stamps prove insufficient.
- Broad per-asset structural gating (original A) — redundant with the existing intake-exit gate.
- Per-TDD-step review stamp — the SHA-or-skip ledger already proves work-per-step; adding a review stamp per step is the same over-cost as C. Phase granularity only.

**Done when:**

- Advancing past a phase boundary is blocked unless a `/quality-review` stamp for that phase exists in the session skill-invocation-log (escape: explicit skip with reason).
- The AC-coverage trial gate blocks uncovered-AC / orphan-scenario test-definitions, with a measured alert-to-action ratio (per the 153 alert-fatigue lesson) and a skip valve.
- Reuses existing ledger machinery — no new per-asset fork mechanism.
- `templates/hooks/` ↔ `.safeword/hooks/` byte-identical; full suite + parity green.

**Note:** Material design pivot from the filed scope — surface to the user before building. Feature → run `/bdd` once the reshape is accepted.

## Work Log

- 2026-06-03T03:45:00.000Z **Reshaped** via revalidate + `/figure-it-out` (grounded in pre-tool-quality.ts + check.ts + scenario-coverage.ts): original per-asset A→C scope rejected — A redundant with the existing intake-exit gate, C over-cost/shape-mismatched. Repointed at extending the existing `skill-invocation-log` to a phase-exit `/quality-review` stamp + promoting the advisory AC-coverage check to a skippable trial gate. Awaiting user acceptance of the pivot before `/bdd`.
- 2026-06-03T03:23:27.177Z Started: Created ticket NMSD94 (follow-up from the CC/Opus/skills research workflow — staged Option A→C recommendation).
