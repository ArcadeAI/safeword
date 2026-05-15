# Test Definitions — Ticket 143

> 8 rules, 28 scenarios after criteria-restoration patch (was 5/19 pre-patch).
>
> **Test surface:** Most scenarios test `getQualityMessage(phase, tddStep)` — a pure function that returns the prompt string. Unit tests on substring presence/absence. Three scenarios cover the schema-contract integration (already enforced by 144's runParity).
>
> **Post-patch additions (criteria restoration):** 3 new rules — universal critical review applies at every phase, research depth matches claim weight, per-phase criteria fully restored. Restores all checks from legacy phase prompts that were dropped in the initial 143 implementation.

## Rule: Every Stop emits the binary terminal across phases

> Rationale: The whole feature. Universal CONFIDENT/BLOCKED shape replaces the per-phase mix of checklists, rubrics, and free-form introspection. Each phase keeps an evidence sentence; the shared header stays constant. Aligned with calibration research (Kadavath, Lin, Tian) — tokenized verdicts beat free-form uncertainty for calibration.

- [x] `getQualityMessage('intake')` includes the universal header (`CONFIDENT or BLOCKED`, `Tried:`, `Need:`, `No lists`) — unit test
- [x] `getQualityMessage('implement', 'green')` includes the universal header AND a phase-specific evidence template citing test-pass count — unit test
- [x] `getQualityMessage('verify')` includes the universal header AND `getQualityMessage` accepts `'verify'` as a valid `BddPhase` — unit test (compile-time + runtime)
- [x] `getQualityMessage('done')` includes the universal header AND a phase-specific evidence template citing `/audit` and `/verify` — unit test
- [x] No phase emits the legacy free-form list-style review prompt (no occurrences of "State what remains uncertain") — unit test
- [x] Universal header includes the "Think about evidence before declaring" nudge (extended-thinking opportunistic) — unit test
- [x] `getQualityMessage('unknown-phase')` falls back to the default (implement-style) binary form, not an empty string or the legacy prompt — unit test

## Rule: BLOCKED has required structure (Tried + Need; no lists)

> Rationale: Discharge mechanism for intent (2) — agent literally cannot escalate without showing research. `Tried:` requires a concrete verb + object (read, ran, fetched, grepped, tested) so vague "tried thinking about it" is rejected by the prompt's wording.

- [x] Universal header includes the literal token `Tried:` (followed by a "concrete verb + object" instruction) — unit test
- [x] Universal header includes the literal token `Need:` (followed by an unblock description instruction) — unit test
- [x] Universal header includes the literal phrase `No lists` (or equivalent forbidding lists) — unit test

## Rule: Disqualification flags block CONFIDENT explicitly

> Rationale: Prevent rubber-stamp confidence when novel claims are unverified or recent failures suggest the agent is repeating known mistakes. Explicit message ("CONFIDENT requires /quality-review first") is more honest than implicit blocking.

- [x] When `state.novelResearchReminder` is true, the prompt emitted by `getQualityMessage` (or its caller) includes an explicit "CONFIDENT requires /quality-review first" message — unit test on `getDisqualificationMessage`
- [x] When `state.recentFailures` contains a pattern relevant to the current phase, the prompt includes an explicit disqualification message naming the pattern — unit test on `getDisqualificationMessage`
- [x] When neither flag is set, no disqualification message appears in the prompt — unit test on `getDisqualificationMessage`

## Rule: Done-phase artifact gate persists alongside CONFIDENT

> Rationale: CONFIDENT is the agent's claim; the artifact gate is the ground truth. Marker presence in the prompt does NOT bypass the existing `hardBlockDone` check in `stop-quality.ts`. Both must hold for done to land.

- [x] When `phase: done` AND `verify.md` is missing, `stop-quality.ts` hard-blocks regardless of any CONFIDENT claim in the agent's output — verified via existing integration test "Hard blocks done phase without verify.md" still passes after my changes
- [x] When `phase: done` AND `verify.md` exists, the binary-form `getQualityMessage('done')` is allowed to fire (no extra block) — verified via existing integration test "Allows done phase with verify.md present" still passes after my changes

## Rule: Cursor parity preserved via QUALITY_REVIEW_MESSAGE export

> Rationale: Cursor's stop hook imports `QUALITY_REVIEW_MESSAGE` as `followup_message`. The export contract must keep working — Cursor inherits the implement/default binary form. 144's runParity contract enforces this at audit time.

- [x] `QUALITY_REVIEW_MESSAGE` remains exported from `lib/quality.ts`, resolves to the implement-default binary form — unit test
- [x] `SAFEWORD_SCHEMA.contracts['packages/cli/templates/hooks/lib/quality.ts'].requires` includes all four marker strings: `CONFIDENT`, `BLOCKED`, `Tried:`, `Need:` (in addition to existing `QUALITY_REVIEW_MESSAGE`) — schema edit verified by `bun scripts/parity-check.ts`
- [x] `runParity({mode: 'all'})` against the full schema passes after 143 lands (acceptance test for the cross-ticket contract) — `All 88 pairs and 1 contracts in sync.`
