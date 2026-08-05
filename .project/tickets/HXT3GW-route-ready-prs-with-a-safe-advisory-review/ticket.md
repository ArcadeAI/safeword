---
id: HXT3GW
slug: route-ready-prs-with-a-safe-advisory-review
type: feature
phase: implement
status: in_progress
parent: P0D6S2
epic: trustworthy-advisory-pr-review
phase_skips:
  - "intake: inherited the accepted P0D6S2 intake when the user approved the plan-implementation split"
  - "define-behavior: extracted from the P0D6S2 behavior packet at the documented split restart point"
  - "scenario-gate: inherited the independently approved P0D6S2 scenario gate before narrowing to this child"
scope:
  - Automatically review each ready pull request at its exact current head after required prerequisites settle.
  - Include every changed text artifact in a technology-neutral integrity review, including unfamiliar file types.
  - Publish one ordinary pull-request conversation receipt with an evidence-bounded route, actionable path-and-line findings, run state, unknowns, and available usage/noise evidence.
  - Treat fork changes only as data, separate model inspection from GitHub write authority, and never execute customer code.
  - Fully re-review every new head SHA and prevent an obsolete run from publishing a current conclusion.
out_of_scope:
  - Inline GitHub review comments, cross-revision finding deduplication, resolved-finding lifecycle, inert exclusions, and immaterial-update reuse; Z7M7Y3 owns these.
  - Any customer-code execution or positive verified-remedy claim; 436EQW owns these.
  - Approval, merge, status/check conclusions, or customer-code modification.
done_when:
  - A ready PR receives one exact-head review and one current ordinary-comment receipt after prerequisites settle.
  - Recognized and unfamiliar changed text reaches the same integrity reviewer, and the preserved Flux regression routes to a human in the selected live evaluation.
  - Complete clean evidence may report looks ready; consequential, unknown, incomplete, failed, or stale evidence cannot.
  - Every new SHA requires a fresh review, and a head change during review makes the old attempt stale.
  - Receipt findings name path, location, evidence, consequence, and one next action without claiming approval or verified remedies.
  - No job with model access can write to GitHub, no publication job receives executable PR artifacts, and no customer code runs.
  - The receipt cannot affect GitHub merge eligibility.
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/1917
phase_anchors:
  - "define-behavior: .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/spec.md"
  - "scenario-gate: features/route-ready-prs-with-a-safe-advisory-review.feature"
  - "plan-implementation: .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/impl-plan.md"
  - "implement: .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/impl-plan.md"
created: 2026-08-05T14:38:52.499Z
last_modified: 2026-08-05T17:32:25Z
---

# Route ready PRs with a safe advisory review

**Goal:** Give every ready PR one exact-head advisory route without executing untrusted code or affecting merge eligibility.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-05T17:32:25Z Advanced to implementation after independently approved scenario and plan gates. A five-minute coordinator timeout let Claude complete reviews that routinely exceeded the old 120-second limit; one intermittent Claude process failure recovered through the normal coordinator, with Codex available as fallback. Review-driven changes pinned reusable-worker concurrency, scheduled prerequisite re-evaluation, pending/draft/closed behavior, exact GitHub environment syntax, release-gated runtime smoke, idempotent receipt reconciliation, strict handoff/secret boundaries, and text/binary/budget routing semantics. First RED must remove `@wip`; no application code has changed yet.
- 2026-08-05T15:07:58Z Blocked at the mandatory plan-implementation review gate after repeated route exhaustion. A full packet retry and a canonical 46 KB packet retry both timed out on preferred Claude and fallback routes; removing the 127 KB architecture record did not change the outcome. No review stamp, phase advance, `@wip` removal, or application-code change. Recovery: `bun packages/cli/src/cli.ts review run plan-implementation .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/impl-plan.md .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/spec.md .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/ticket.md features/route-ready-prs-with-a-safe-advisory-review.feature PRINCIPLES.md .project/personas.md .project/surfaces.md --no-input --json`.
- 2026-08-05T14:53:40Z Authored the bounded MVP design and six-slice implementation plan. Local Markdown, Gherkin, lineage, and surface checks pass. The mandatory independent plan review did not run successfully: preferred Claude timed out and the fallback returned invalid output (`REVIEW_ROUTES_EXHAUSTED`). Remain at plan-implementation; retry the coordinator command recorded in the work log before implementation.
- 2026-08-05T14:38:52Z Restarted at plan-implementation from the accepted P0D6S2 split. Inherits the parent intake and scenario evidence, narrowed to the independently valuable advisory-only core.
- 2026-08-05T14:38:52.499Z Started: Created ticket HXT3GW
