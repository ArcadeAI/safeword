# Impl Plan: Whole-ticket quality review + refactor before verify

**Status:** implemented

## Approach

Bottom-up: the pure ledger rule first (most scenarios land here as fast unit
tests), then the two fence removals at the hook, then the docs.

1. **Loop-count trigger in `ledger-validation.ts`** (unit). Change the
   cross-scenario requirement from "required iff `hasAnyAnnotation` OR row
   exists" to **"required iff (`scenarios.length >= 2` AND `hasAnyAnnotation`)
   OR `crossScenario` row exists"**. `validateLedger` is pure over content +
   reachability oracle, so 8 of the 14 scenarios are unit tests here: single
   annotated loop exempt, zero scenarios exempt, exactly-two require, two+SHA
   pass, legacy-unannotated exempt, single-loop present-empty-skip blocked,
   two-loop empty-skip blocked, two-loop real-skip pass. Highest layer that
   covers them cheaply → unit.

2. **Drop the ledger `isFeature` fence in `stop-quality.ts`** (integration).
   Move the ledger/cross-scenario validation block (currently `:539` inside
   `if (isFeature)`) so any build ticket WITH a `test-definitions.md` reaches
   it. Covers "two-loop task blocked by same validator" and "single-loop task
   proceeds" — hook-level integration test (the validator itself is already
   unit-proven in step 1).

3. **Loop-count-aware `/quality-review` requirement** (unit + integration).
   New pure helper `countRgrLoops(content)` (reuse `parseLedger`'s scenario
   split → `scenarios.length`). At the skill-invocation gate call site, when
   loops ≥2 add `quality-review` to the required set; drop the `isFeature`
   fence on that block (`:523`) so multi-loop tasks are checked too. Covers
   the four review-log scenarios. Unit-test the loop-count→required-skills
   resolver; integration-test the hook block.

4. **Add the invocation-log line to `/quality-review`** (doc). Mirror the
   `record-skill-invocation.ts` line `/verify` already carries, so an
   invocation writes a session-scoped log entry.

5. **Move the step text** (doc). `bdd/TDD.md` implement-exit owns the
   `/quality-review` whole-diff → `/refactor` findings → record-the-row
   sequence; `bdd/VERIFY.md` references it instead of re-specifying.

6. **Sync + full suite.** All three skill mirrors (`.claude`, `.agents`,
   `templates`) and both hook copies (`.safeword/hooks`, `templates/hooks`);
   `safeword parity-check`; full vitest + lint.

## Decisions

| Decision                      | Choice                                                                   | Alternatives considered                                   | Rejected because                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Trigger signal                | `scenarios.length >= 2` from the parsed ledger                           | Count GREEN commits / parse commit messages               | Fragile (squash/rebase/message format), redundant with the already-parsed ledger                       |
| `/quality-review` requirement | Computed loop-count-aware at the call site                               | Add `quality-review` as a static `PHASE_GATES.done` entry | Static entry blocks _every_ done, including single-loop tickets — violates DEV2 (silent gate)          |
| Enforcement point             | The existing done gate (row authored in implement, validated at done)    | Enforce at the implement→verify transition                | Reuses existing machinery; no new gate; matches how the cross-scenario row works today                 |
| Fence removal scope           | Drop `isFeature` on BOTH the ledger block and the skill-invocation block | Drop it only on the ledger block                          | Task would get refactor-row enforcement but skip the review check — splits the pass (reviewer's catch) |
| Legacy exemption              | Keep `hasAnyAnnotation` as an AND-term in the trigger                    | Pure `scenarios.length >= 2`                              | Pure count would newly gate legacy unannotated multi-scenario tickets — regression                     |

## Arch alignment

- Honors the **done-gate / stop-hook** structure (ARCHITECTURE.md): pure
  functions live in `.safeword/hooks/lib/`, the hook composes them — the new
  `countRgrLoops` resolver and the ledger rule stay pure and unit-tested; only
  composition changes in `stop-quality.ts`.
- Honors the **skill-invocation gate** (ticket 147): completion proof is a
  session-scoped log entry written by the skill, validated at the done gate —
  `/quality-review` joins `/verify` and `/audit` on the same mechanism.

## Known deviations

- The skill-invocation-log header documents the extension pattern as "add a
  phase → required-skills entry to `PHASE_GATES`" — a _static_ per-phase list.
  This feature needs a **conditional** requirement (loop count ≥2), which the
  static map cannot express, so the `/quality-review` requirement is resolved
  at the call site instead of via a `PHASE_GATES` row. Acceptable: it's the
  minimal honest representation of a conditional gate. Uplevel follow-up:
  generalize `PHASE_GATES` to allow predicate-valued entries so conditional
  gates fit the documented pattern — file as a separate ticket, don't widen
  this one.

## Reconciliation (implement-exit)

Plan held as written — all five Decisions shipped as chosen, no mid-implementation reversals. The done-gate restructure landed exactly as planned (fence dropped on both the ledger and skill blocks; `requiredSkillsForDone` computed at the call site). One small artifact: `getRequiredSkillsForPhase` was left dead by `stop-quality.ts` switching to `requiredSkillsForDone` — removed in the post-close refactor pass (with its tests; `PHASE_GATES.done` is still covered directly). Whole-ticket `/quality-review` found no structural duplication in the feature code; the cross-scenario commit (82a326d) applied review hardening only (doc-drift fix + two positive-path tests + test-helper dedup).

**Post-close fix — unified trigger (S1).** A session-wide `/quality-review` after the first close caught a real inconsistency: the cross-scenario **row** gated on `scenarios.length >= 2 && hasAnyAnnotation`, but the **/quality-review requirement** gated on `loopCount >= 2` alone — so a legacy unannotated multi-scenario ticket, exempt from the row, was newly forced to log `/quality-review` at done (a new gate for legacy tasks; a new requirement for legacy features), violating the feature's own legacy-exemption guarantee. Fix: extracted one predicate `wholeTicketPassApplies(content)` and drove BOTH halves from it (the row in `validateLedger`, the review in `requiredSkillsForDone(isFeature, wholeTicketPass)`); retired `countRgrLoops` (the raw count was the wrong signal). This is the literal realization of SM1.AC1 — "one derived trigger" — now enforced in code, not just intended. Regression guards added at unit and integration; two integration tests (`w2`/`w3`) that had _encoded_ the bug were corrected to use annotated loops.

## Assessment triggers

- A third work type beyond task/feature needing the pass → revisit the
  type-agnostic "any ticket with a test-definitions.md" assumption.
- A second conditional skill gate appearing → promote the call-site condition
  into the generalized `PHASE_GATES` predicate (the uplevel above).
- Loop count proving an unreliable proxy (e.g., agents cramming multiple RGR
  cycles into one `## Scenario:` block) → reconsider the trigger source.
