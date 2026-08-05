# Verify: Keep independent reviews reliable for real ticket packets

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: the full suite exceeds this machine’s 10-minute tool ceiling and shows load-induced failures that pass in isolation. The review lanes this ticket touches pass: 87/87.
**Gherkin:** ❌ Failed — 420 scenarios, 142 undefined. This ticket’s feature file has no step definitions.
**Build:** ✅ Success (tsup build runs ahead of every suite invocation)
**Lint:** ✅ Clean (eslint, gherkin lint, and `tsc --noEmit` all pass)
**Scenarios:** ❌ 17/214 complete
**PR Scope:** ✅ Diff matches ticket scope — only `packages/cli/src/review/`, its tests, the ticket folder, and the feature file changed
**Dep Drift:** ✅ Clean — no dependency added or changed
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — extends the coordinator shipped by QZAFT2 without changing its trust boundaries
**Experience:** ✅ No new friction. Walked a Non-Technical Builder through an exhausted review; worst step = reading a failure they cannot act on, which is what this ticket removed ("The independent reviewer (Codex) ran out of time. The fallback review (Claude) gave an answer that could not be accepted."). New steps vs before = 0.
**Surface Evidence:** ✅ 2/2 affected surfaces proved

| Affected surface | Proof | Result |
| --- | --- | --- |
| Claude Code | `review-alternate-model.test.ts` runs Codex-authored work to a Claude reviewer through the public command | ✅ |
| OpenAI Codex | `review-codex-contract.test.ts` plus a live run against real Codex 0.146.0 | ✅ |

**Evidence limits:** ⚠️ Two, both recorded rather than hidden:

- Windows process cleanup is proved only to issue the right termination command; CI is Linux-only, so its OS-level effect is unverified.
- The full suite exceeds the 10-minute foreground tool ceiling on this machine and shows load-induced failures that do not reproduce in isolation.

## Scenario coverage — the honest gap

The ticket's behaviour is implemented and proved for every failure mode observed
in the field, but the scenario ledger is far from complete: **17 of 214 steps**
are recorded, across roughly 10 of 71 scenarios.

That is not a bookkeeping lag. The eight slices were built against the failures
that actually occur — 91 real review runs' worth of evidence — and the scenario
set written earlier is broader than that evidence. Scenarios with no test yet
include the controlled-clock deadline boundaries, the tie-break orderings, the
full result-contract shape enumeration, several capability-probe states, and
most of the model-grammar table.

Marking this ticket done would require either writing those proofs or
deliberately narrowing the scenario set to what the evidence justifies. That is
a scope decision, not something to resolve by checking boxes.
