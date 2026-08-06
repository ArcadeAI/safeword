---
id: HXT3GW
slug: route-ready-prs-with-a-safe-advisory-review
type: feature
phase: verify
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
  - "verify: .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/verify.md"
created: 2026-08-05T14:38:52.499Z
last_modified: 2026-08-06T03:46:00Z
---

# Route ready PRs with a safe advisory review

**Goal:** Give every ready PR one exact-head advisory route without executing untrusted code or affecting merge eligibility.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-06T13:20:00Z Re-ran the selected live Flux scenario with two
  1Password-injected OpenAI credentials. Both credentials authenticated against
  `/v1/models`, while Responses returned HTTP 429 for `gpt-5.2`; the primary
  credential returned the same result with `gpt-5-mini`. A sanitized diagnostic
  identified `insufficient_quota` / `credit_balance_exhausted`, narrowing the
  live evidence block to exhausted API credits rather than a missing or invalid
  secret. The root live BDD script also omitted the TypeScript loader;
  applying the deterministic lane's existing `NODE_OPTIONS='--import tsx'`
  reached the production provider successfully.
- 2026-08-06T03:46:00Z Advanced implement → verify after the final independent
  Claude quality review approved the authored source, tests, workflows, docs,
  and evidence packet. The generated runtime bundle exceeded the reviewer's
  per-file size limit and was excluded from the packet; source-to-bundle parity
  passed independently. HXT3GW remains in progress because this environment has
  no `OPENAI_API_KEY` for the selected Flux evaluation and no disposable GitHub
  fixture for the release smoke. Deferral of disable-time workflow removal and
  reusable-workflow environment-secret proof to YC6JCC is intentional.
- 2026-08-06T03:16:33Z Implemented the advisory-only MVP. The default-off
  GitHub workflow now routes ready exact-head PRs through read-only model
  inspection and a strict serialized handoff to ordinary-comment publication,
  with no checkout, customer-code execution, approval, or check/status write.
  All 60 feature scenarios (2,336 steps) pass; focused CLI, provider, publisher,
  workflow, schema, and route tests pass; TypeScript, ESLint, and Prettier are
  clean. Independent Claude quality review approved the implementation with no
  errors. Runtime environment-secret/concurrency proof and the selected live Flux
  evaluation remain explicit release-gated evidence; YC6JCC owns the disposable
  GitHub compatibility smoke.
- 2026-08-05T17:32:25Z Advanced to implementation after independently approved scenario and plan gates. A five-minute coordinator timeout let Claude complete reviews that routinely exceeded the old 120-second limit; one intermittent Claude process failure recovered through the normal coordinator, with Codex available as fallback. Review-driven changes pinned reusable-worker concurrency, scheduled prerequisite re-evaluation, pending/draft/closed behavior, exact GitHub environment syntax, release-gated runtime smoke, idempotent receipt reconciliation, strict handoff/secret boundaries, and text/binary/budget routing semantics. First RED must remove `@wip`; no application code has changed yet.
- 2026-08-05T15:07:58Z Blocked at the mandatory plan-implementation review gate after repeated route exhaustion. A full packet retry and a canonical 46 KB packet retry both timed out on preferred Claude and fallback routes; removing the 127 KB architecture record did not change the outcome. No review stamp, phase advance, `@wip` removal, or application-code change. Recovery: `bun packages/cli/src/cli.ts review run plan-implementation .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/impl-plan.md .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/spec.md .project/tickets/HXT3GW-route-ready-prs-with-a-safe-advisory-review/ticket.md features/route-ready-prs-with-a-safe-advisory-review.feature PRINCIPLES.md .project/personas.md .project/surfaces.md --no-input --json`.
- 2026-08-05T14:53:40Z Authored the bounded MVP design and six-slice implementation plan. Local Markdown, Gherkin, lineage, and surface checks pass. The mandatory independent plan review did not run successfully: preferred Claude timed out and the fallback returned invalid output (`REVIEW_ROUTES_EXHAUSTED`). Remain at plan-implementation; retry the coordinator command recorded in the work log before implementation.
- 2026-08-05T14:38:52Z Restarted at plan-implementation from the accepted P0D6S2 split. Inherits the parent intake and scenario evidence, narrowed to the independently valuable advisory-only core.
- 2026-08-05T14:38:52.499Z Started: Created ticket HXT3GW
