# Scenario Quality Review: Route ready PRs with a safe advisory review

**Findings:** 0 must-fix, 0 should-strengthen, 37 looks-good.

Independent cross-agent review ran seven times through the scenario-gate
coordinator. Each requested change was applied and re-reviewed; the final Claude
pass approved the complete packet rather than relying on an earlier verdict.

## Resolved findings

### safe-advisory-core.TBU1.R2 — Empty and binary-only inputs were not fully distinguished

**Current:** The suite covered a binary-only change but did not separately bind
an empty change set, and the binary-only result did not require explicit skipped
coverage.

**Proposed:** Route `artifacts: []` to `incomplete` / `needs a human` with empty
coverage and missing-evidence lists; require a binary-only input to retain its
`skipped: non-text` coverage entry.

**Resolved:** Both scenarios now prove distinct observable receipt shapes. A
controlled mutation removing the zero-artifact incomplete guard failed the empty
scenario with `complete` instead of `incomplete`. The scenario remains in the
deterministic CI lane as the permanent regression guard.

### safe-advisory-core.TBU1.R3 — State precedence lacked zero-text and three-way bindings

**Current:** The route table inferred zero reviewable text from missing evidence,
and pairwise precedence rows did not prove all three higher-priority conditions
overlapping.

**Proposed:** Add zero reviewable text directly to the route table, add the
non-consequential-plus-stale row, and prove stale wins over simultaneous
incomplete and failed conditions.

**Resolved:** The route table and precedence lattice now cover those states. A
controlled reducer-truncation mutation failed the three-way scenario with
`failed` instead of `stale`. The three-way scenario remains in the deterministic
CI lane as the permanent regression guard.

### safe-advisory-core.TBU1.R1 — Two non-run paths relied on implicit assertions

**Current:** Draft and unconfigured-prerequisite scenarios asserted their receipt
outcomes without explicitly naming the absence of prerequisite sampling and
model review.

**Proposed:** Require both paths to perform neither prerequisite sampling nor
model review.

**Resolved:** Both scenarios now state and test the no-run invariant directly.

### safe-advisory-core.SWM1.R2 — Forbidden publication calls used a weaker list

**Current:** Merge-neutrality omitted `merge` and `content-write` from the audit
negative used by the adjacent authority-boundary rule.

**Proposed:** Use the same no-review, merge, status, check, or content-write audit
contract in both rules.

**Resolved:** Both security rules now share the stronger observable assertion.

## Looks Good

All 37 scenario groups survive the vacuous-pass and constant-implementation
lenses, remain atomic and deterministic, bind every affected surface, and cover
negative, boundary, failure, security, persona, invariant, and real-entry-point
wiring concerns. The selected Flux evaluation remains correctly isolated as
`@live`; deterministic fixtures enforce its route contract in CI.

**Next:** keep the strengthened scenario packet with PR #1917.
