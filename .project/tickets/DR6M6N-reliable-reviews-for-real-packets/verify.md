# Verify: Keep independent reviews reliable for real ticket packets

## Verify Checklist

**Test Suite:** ✓ 106/106 tests pass in the lanes this ticket touches. ⚠️ Local environment limitation: the full repository suite exceeds this machine’s 10-minute tool ceiling; one load-induced failure did not reproduce in isolation across six runs.
**Gherkin:** ✅ Acceptance lane passes — 310 scenarios, 4,484 steps, zero undefined.
**Build:** ✅ Success (tsup build runs ahead of every suite invocation)
**Lint:** ✅ Clean (eslint, gherkin lint, and `tsc --noEmit` all pass)
**Scenarios:** All 32 scenarios marked complete
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

## Scenario coverage — resolved

The scenario set was narrowed from 71 scenarios (142 expanded) to 32 — one
example and one refusal per rule — and every one is now executable and green.
Nothing was dropped silently: the model-grammar table moved to
`alternate-model-grammar.test.ts` (19 cases), and the deadline arithmetic,
contract field shapes, and candidate-share maths were already proved by focused
tests beside the code.

Audit passed with warnings (see below).

## Audit

- Architecture: ✅ no dependency violations (30 modules, 35 dependencies)
- Config drift: ✅ clean
- Principle trace: ✅ clean after correcting four proof references that carried
  a trailing rule id and therefore did not resolve to a file
- Learnings / domain docs: ⏭️ none changed
- Surface drift: ✅ both referenced surfaces defined
- Test quality: 1 issue found and fixed — a `toBeDefined()` guard replaced with
  an assertion on the actual classified message
- Knip / jscpd / dependency freshness: ⏭️ skipped in diff scope by design
