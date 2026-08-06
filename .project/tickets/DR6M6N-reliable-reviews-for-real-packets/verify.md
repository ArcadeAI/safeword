# Verify: Keep independent reviews reliable for real ticket packets

## Verify Checklist

**Test Suite:** ✅ Full repository suite passes — 439 files, 6,597 tests passed, 5 intentionally skipped.
**Gherkin:** ✅ Full acceptance lane passes — 945 scenarios (942 passed, 3 skipped), 36,602 steps (36,598 passed, 4 skipped), zero undefined.
**Build:** ✅ Success (tsup build runs ahead of every suite invocation)
**Lint:** ✅ Clean (eslint, gherkin lint, and `tsc --noEmit` all pass)
**Scenarios:** All 32 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope — review routing, its public-contract tests, generated plugin runtime, ticket evidence, feature coverage, and reviewer documentation
**Dep Drift:** ✅ Clean — no dependency added or changed
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — extends the coordinator shipped by QZAFT2 without changing its trust boundaries
**Experience:** ✅ No new friction. A Non-Technical Builder gets an actionable exhausted-route explanation instead of reviewer diagnostics ("The independent reviewer (Codex) ran out of time. The fallback review (Claude) gave an answer that could not be accepted."). A Technical But Unfamiliar contributor can trace the bounded route order, each route's cause, and the configured alternate model from the public result without reading process internals. Worst step = interpreting two named route failures; new steps vs before = 0.
**Surface Evidence:** ✅ 2/2 affected surfaces proved

| Affected surface | Proof | Result |
| --- | --- | --- |
| Claude Code | `review-alternate-model.test.ts` runs Codex-authored work to a Claude reviewer through the public command | ✅ |
| OpenAI Codex | `review-codex-contract.test.ts` plus a live run against real Codex 0.146.0 | ✅ |

**Evidence limits:** ⚠️ One, recorded rather than hidden:

- Collaborator-process fixtures use POSIX shell scripts. Windows command construction and bounded `taskkill` cleanup are covered, but their OS-level effect is not exercised by this Linux/macOS test lane.

## Scenario coverage — resolved

The scenario set was narrowed from 71 scenarios (142 expanded) to 32 — one
example and one refusal per rule — and every one is now executable and green.
Nothing was dropped silently: the model-grammar table moved to
`alternate-model-grammar.test.ts` (19 cases), and the deadline arithmetic,
contract field shapes, and candidate-share maths were already proved by focused
tests beside the code.

Audit passed; the remaining platform coverage limit is disclosed above.

## Quality review and refactor

Final independent review verdict: **approve**, with zero remaining findings. The
review ran in degraded provenance because Claude exhausted its route and Codex
completed the fallback review; this is recorded rather than presented as a full
cross-agent result.

Findings discovered and resolved during the review loop:

- bounded capability probes inside each candidate's time share and confined
  probes to a disposable snapshot working directory
- retried remaining bounded routes when preferred output had invalid provenance
- awaited process-tree cleanup before a fallback route could start
- spawned the canonical executable path to close the discovery-to-launch symlink race
- bounded Windows `taskkill` cleanup and retained direct-kill fallback
- replaced arbitrary cleanup sleeps with direct process-group liveness assertions
- raised only the stress-test harness budget needed for loaded full-suite runs
- removed a raw NUL fixture byte, centralized duplicate coordinator results, and
  documented route grammar, overrides, and the five-/nine-minute bounds
- raised the sealed-review helper's subprocess buffer so artifacts over 1 MB are
  hashed from their sealed commit instead of silently falling back to the working tree

## Audit

- Architecture: ✅ no dependency violations (30 modules, 35 dependencies)
- Config drift: ✅ clean
- Principle trace: ✅ clean after correcting four proof references that carried
  a trailing rule id and therefore did not resolve to a file
- Learnings / domain docs: ⏭️ none changed
- Surface drift: ✅ both referenced surfaces defined
- Test quality: ✅ arbitrary cleanup sleep removed; process termination is now
  asserted directly. Large sealed artifacts now have a regression-backed hash check.
- Knip / jscpd / dependency freshness: ⏭️ skipped in diff scope by design
