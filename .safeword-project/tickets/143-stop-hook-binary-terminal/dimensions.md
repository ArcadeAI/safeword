# Dimensions — Ticket 143

Derived from intake: scope (binary terminal across all phases), done_when (per-phase coverage, BLOCKED structure, disqualification flags, artifact gate, Cursor parity, schema-contract expansion), resolved open questions (Tried strict, disqualification explicit, RED accept).

## Behavioral dimensions

| Dimension                             | Partitions                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Phase passed to `getQualityMessage()` | intake, define-behavior, scenario-gate, decomposition, implement (RED/GREEN/REFACTOR), verify, done |
| Verdict shape required by prompt      | CONFIDENT, BLOCKED                                                                                  |
| Output forbidden form                 | lists (rejected by prompt)                                                                          |
| BLOCKED.Tried                         | concrete verb + object (required), missing/vague (rejected)                                         |
| BLOCKED.Need                          | present (required), missing (rejected)                                                              |
| Disqualification flags                | `novelResearchReminder` true/false, `recentFailures` relevant/empty                                 |
| Cursor inheritance                    | `QUALITY_REVIEW_MESSAGE` export present (required)                                                  |
| Done-phase artifact gate              | `verify.md` present/absent (separate from CONFIDENT claim)                                          |
| BddPhase enum coverage                | includes/missing 'verify'                                                                           |

## Boundary cases

- Intake-phase CONFIDENT must cite scope/out_of_scope/done_when fields (most concrete evidence)
- Implement-GREEN CONFIDENT must cite test-pass count
- Done-phase CONFIDENT must cite `/audit: passed. /verify: passed.` AND verify.md must exist (artifact gate is independent)
- BLOCKED with vague "Tried: thinking" should fail Tried-strict scenario
- novelResearchReminder set + CONFIDENT attempted → disqualification message
- Cursor's `QUALITY_REVIEW_MESSAGE` export must produce the binary form (default = implement message)

## Rule mapping

- Phase × Verdict × Forbidden-form → **Rule: Every Stop emits the binary terminal across phases**
- BLOCKED.Tried × BLOCKED.Need × forbidden lists → **Rule: BLOCKED has required structure**
- Disqualification flags × CONFIDENT → **Rule: Disqualification flags block CONFIDENT explicitly**
- Done-phase artifact × CONFIDENT → **Rule: Done-phase artifact gate persists alongside CONFIDENT**
- Cursor inheritance × schema contract → **Rule: Cursor parity preserved via QUALITY_REVIEW_MESSAGE export**

## Out-of-scope dimensions (documented for future)

- Per-phase phrasing variants beyond evidence template — phase phrasing can evolve; only the shared header is the invariant.
- Numeric confidence (0-100) — rejected at intake; tokenized binary preferred per Lin et al. + Tian et al.
- Triadic verdict (CONFIDENT/BLOCKED/TENTATIVE) — rejected at intake; middle states become escape hatches.
- Tool-mediated structured output — bloat for Stop hook context; binary text + system reminder is sufficient.
- Self-consistency (N samples) — out of cost budget for routine Stop.
- Forcing extended thinking — hooks can't toggle thinking mode; "think before declaring" sentence is opportunistic only.

## Card-ratio self-check

- **Rules:** 5. Each has 3-4 scenarios. None empty, none oversized.
- **Total scenarios target:** ~17.
- **Open questions remaining at this phase:** 0 (three deferred questions resolved at intake-final).
