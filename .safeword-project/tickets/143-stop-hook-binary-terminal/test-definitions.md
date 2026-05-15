# Test Definitions — Ticket 143

> 5 rules, 19 scenarios. AODI validated. Covers happy path + failure modes + boundaries.
>
> **Test surface:** Most scenarios test `getQualityMessage(phase, tddStep)` — a pure function that returns the prompt string. Easy unit tests on substring presence/absence. Two scenarios cover the schema-contract integration (already enforced by 144's runParity).

## Rule: Every Stop emits the binary terminal across phases

> Rationale: The whole feature. Universal CONFIDENT/BLOCKED shape replaces the per-phase mix of checklists, rubrics, and free-form introspection. Each phase keeps an evidence sentence; the shared header stays constant. Aligned with calibration research (Kadavath, Lin, Tian) — tokenized verdicts beat free-form uncertainty for calibration.

- [ ] `getQualityMessage('intake')` includes the universal header (`CONFIDENT or BLOCKED`, `Tried:`, `Need:`, `No lists`)
- [ ] `getQualityMessage('implement', 'green')` includes the universal header AND a phase-specific evidence template citing test-pass count
- [ ] `getQualityMessage('verify')` includes the universal header AND `getQualityMessage` accepts `'verify'` as a valid `BddPhase`
- [ ] `getQualityMessage('done')` includes the universal header AND a phase-specific evidence template citing `/audit` and `/verify`
- [ ] No phase emits the legacy free-form list-style review prompt (no occurrences of "State what remains uncertain")
- [ ] Universal header includes the "Think about evidence before declaring" nudge (extended-thinking opportunistic)
- [ ] `getQualityMessage('unknown-phase')` falls back to the default (implement-style) binary form, not an empty string or the legacy prompt

## Rule: BLOCKED has required structure (Tried + Need; no lists)

> Rationale: Discharge mechanism for intent (2) — agent literally cannot escalate without showing research. `Tried:` requires a concrete verb + object (read, ran, fetched, grepped, tested) so vague "tried thinking about it" is rejected by the prompt's wording.

- [ ] Universal header includes the literal token `Tried:` (followed by a "concrete verb + object" instruction)
- [ ] Universal header includes the literal token `Need:` (followed by an unblock description instruction)
- [ ] Universal header includes the literal phrase `No lists` (or equivalent forbidding lists)

## Rule: Disqualification flags block CONFIDENT explicitly

> Rationale: Prevent rubber-stamp confidence when novel claims are unverified or recent failures suggest the agent is repeating known mistakes. Explicit message ("CONFIDENT requires /quality-review first") is more honest than implicit blocking.

- [ ] When `state.novelResearchReminder` is true, the prompt emitted by `getQualityMessage` (or its caller) includes an explicit "CONFIDENT requires /quality-review first" message
- [ ] When `state.recentFailures` contains a pattern relevant to the current phase, the prompt includes an explicit disqualification message naming the pattern
- [ ] When neither flag is set, no disqualification message appears in the prompt

## Rule: Done-phase artifact gate persists alongside CONFIDENT

> Rationale: CONFIDENT is the agent's claim; the artifact gate is the ground truth. Marker presence in the prompt does NOT bypass the existing `hardBlockDone` check in `stop-quality.ts`. Both must hold for done to land.

- [ ] When `phase: done` AND `verify.md` is missing, `stop-quality.ts` hard-blocks regardless of any CONFIDENT claim in the agent's output
- [ ] When `phase: done` AND `verify.md` exists, the binary-form `getQualityMessage('done')` is allowed to fire (no extra block)

## Rule: Cursor parity preserved via QUALITY_REVIEW_MESSAGE export

> Rationale: Cursor's stop hook imports `QUALITY_REVIEW_MESSAGE` as `followup_message`. The export contract must keep working — Cursor inherits the implement/default binary form. 144's runParity contract enforces this at audit time.

- [ ] `QUALITY_REVIEW_MESSAGE` remains exported from `lib/quality.ts`, resolves to the implement-default binary form
- [ ] `SAFEWORD_SCHEMA.contracts['packages/cli/templates/hooks/lib/quality.ts'].requires` includes all four marker strings: `CONFIDENT`, `BLOCKED`, `Tried:`, `Need:` (in addition to existing `QUALITY_REVIEW_MESSAGE`)
- [ ] `runParity({mode: 'all'})` against the full schema passes after 143 lands (acceptance test for the cross-ticket contract)
