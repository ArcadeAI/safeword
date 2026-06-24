# Impl Plan: Eng review on green PRs with verifiable provenance

**Status:** planned

## Approach

One pure decision module, `packages/cli/templates/hooks/lib/pr-review.ts` (synced to
`.safeword/hooks/lib/` via the parity manifest in `schema.ts`), mirroring
`review-ledger.ts`: manual type guards, no schema library, no I/O. The skill and a
thin gate adapter wire it to the real review ledger later; the module only decides.

**Test layer: unit (vitest) for every scenario.** All 25 behaviors are pure functions
over in-memory inputs, so unit is the highest layer that covers them with fast
feedback — no integration/E2E needed. Tests live in `packages/cli/tests/hooks/pr-review.test.ts`,
each `it()` named with its scenario id, importing from `../../templates/hooks/lib/pr-review.js`.
This lands them in `test:done` (the stop-gate), matching the `review-ledger` precedent.
The `.feature` file remains the behavioral source of truth; the unit tests realize it.

**Build order** (each builds on green):

1. **Result contract** (A-rule, 7 scenarios) — `validateReviewResult` + `parseReviewResult`. Foundation; everything carries findings. **DONE — green at dbb98f1.**
2. **Provenance + merge gate** (B + skip + C rules, 10 scenarios) — `prReviewScope`, `recordApproval`/`recordSkip`, `hasFreshApproval`, `evaluateMergeGate`. Freshness via head-sha match; skip is break-glass (permits, distinct disposition); blocker-only gating.
3. **Cross-model + effective-FP + depth** (D + E + F rules, 8 scenarios) — `acceptReview` (reuses `modelsMatch`), `effectiveFalsePositiveRate`, `selectReviewDepth`.
4. **Config flag** — `isPrReviewGateEnabled` next to the sibling flag readers in `review-ledger.ts`.
5. **Skill + wiring** — `eng-review` skill markdown (the review procedure + verdict schema) and the cheap LLM-free receipt-verification adapter. Deferred to last; the decision core is the risk.

Deferred (recorded, not built here): golden-set eval for judgment quality (TB1.AC1, NTB1.AC1); Phase B (CI runs the review itself).

## Decisions

| Decision                | Choice                                                               | Alternatives considered               | Rejected because                                                                    |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| Skip-vs-gate semantics  | Skip permits merge but records a distinct, attributed audited bypass | Skip ≠ approval (stays blocked)       | A gate people can't bypass openly gets bypassed secretly (break-glass evidence)     |
| Result validation       | Manual type guards, no schema lib                                    | zod / ajv                             | No schema dep in the repo; `review-ledger.ts` sets the manual-guard precedent       |
| Test layer              | Unit (vitest), scenario-named                                        | Cucumber step-defs against `.feature` | Sibling `review-ledger` is vitest-only and that's what the stop-gate runs           |
| Receipt scope key       | `<pr-number>@<head-sha>`                                             | Reuse `<ticket>:<artifact>@<hash>`    | PR identity is the merge unit, not a ticket artifact; head-sha gives auto-staleness |
| Malformed review output | Reject as malformed (fail closed)                                    | Treat absent/garbled as neutral pass  | A gate must degrade safe, never open                                                |
| Module placement        | `templates/hooks/lib/` (source) + parity-synced dogfood copy         | `packages/cli/src/`                   | It's hook-runtime lib; siblings live there and parity manifest governs it           |

## Arch alignment

- **Two-tier review enforcement (NMSD94)** — reuses the ledger stamp model, content/sha binding, and skip-with-reason semantics rather than inventing a parallel store.
- **Cross-model review (MR5M3A)** — reuses `modelsMatch()` and the `SAFEWORD_AUTHOR_MODEL` capture, applied to PR reviewer-vs-author instead of architecture review.
- **Default-off rollout flags** — `prReviewGate` follows the same `configFlagIsTrue`, fail-safe-to-off posture as `reviewGate`/`architectureReviewGate`/`crossModelReview`.

`paths.architecture` resolves to `ARCHITECTURE.md`; no formal ADR records the review-gate design beyond the ticket trail, so alignment is to the established hook-lib patterns above.

## Known deviations

skip: no deviations planned — the design extends existing review-ledger/cross-model patterns to PR scope without departing from them. Time-boxed skip expiry (a break-glass hardening the waiver research recommends) is intentionally out of Phase A, recorded as a Phase-B follow-up, not a deviation.

## Assessment triggers

- **Phase B kickoff** (CI runs the review headless) — revisit whether the receipt model needs signing/integrity beyond the Tier-1 honor-system stamp, since a CI-trusted gate raises the spoofing stakes.
- **Skip rate climbs** — if the effective-FP/skip ledger shows skips becoming the default, add time-boxed expiry + periodic review (the deferred break-glass hardening).
- **Verdict schema grows** (e.g. per-finding suggested patches, categories) — revisit manual type guards vs adopting a schema lib if the shape outgrows hand-written guards.
- **A second consumer** of the decision core (beyond the skill + gate) — revisit whether it should move from `hooks/lib` into a shared `src/` module.
