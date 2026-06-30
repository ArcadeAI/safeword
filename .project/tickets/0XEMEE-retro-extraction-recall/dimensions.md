# Dimensions: Retro re-arm timing (0XEMEE — Phase 0)

Derived from spec.md (TB1/TB2/TB3/NTB1 ACs, done_when) + domain knowledge (the
existing `decideRetroRun` gate, the once-per-session sentinel → growth-gated
count state, transcript tool-use counting, the occurrence ledger, recursion via
re-entrant hooks, fail-open Stop hooks).

| Dimension                     | Partitions                                                                                                       | AC        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | --------- |
| First-fire gate               | tool-uses ≥ substance threshold + not yet fired → run + record count; below threshold → no run, no count          | TB1.AC1   |
| Re-fire growth gate           | grown by ≥ re-arm threshold since last fire → re-run + update count; grown by < threshold → no run, count unchanged | TB2.AC1   |
| Transcript handed to extract  | re-fire → the CURRENT transcript (incl. end-of-session content); never the stale first-fire transcript            | TB2.AC2   |
| Late-finding surfacing        | friction present only after the first fire → reaches the raw findings on the re-fire                              | TB2.AC3   |
| Cross-fire dedupe             | same manifestation as an earlier filed finding → no duplicate; different manifestation → filed                    | TB3.AC1   |
| Recursion guard ordering      | `SAFEWORD_RETRO_CHILD=1` → no run, evaluated BEFORE the session-id / transcript / count gates                     | NTB1.AC1  |
| Fail-open on state write      | recording the last-fired count throws → fire still proceeds; never throws out of the decision                    | NTB1.AC1  |
| Re-arm state keying           | session id resolved by precedence (cloud id before local) → count stored under that id                            | NTB1.AC2  |

**Test layers:**

- **Unit (pure functions, no model calls):** the re-arm decision (first-fire +
  growth gate + recursion-guard ordering + fail-open) and the count-state helpers
  (read last-fired count / record count, keyed by session id) — injected-deps
  style matching `retro-trigger.ts`'s existing tests.
- **Integration (boundaries mocked):** a re-fire hands the fuller transcript to an
  injected extractor and a back-half finding reaches the egress pipeline; and the
  occurrence-ledger dedupe drops an already-filed manifestation while filing a new
  one — the `claude -p` spawn and the GitHub transport mocked, as in 7D8PJP.
