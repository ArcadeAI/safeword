---
id: 5F5ZZA
slug: keep-plan-reviews-current-and-trustworthy
type: feature
phase: implement
status: in_progress
phase_skips:
  - 'intake: originally inherited the 2026-09-08 approval of 82T411; after material parent changes, 82T411 was freshly approved and this child was reconciled before scenario review resumed'
  - "define-behavior: partitioned the accepted 82T411 Rule and scenario packet at Safeword's documented split restart point"
phase_anchors:
  - scenario-gate: features/keep-plan-reviews-current-and-trustworthy.feature
  - plan-implementation: features/keep-plan-reviews-current-and-trustworthy.feature
scope:
  - give both plan reviews a canonical contract, complete resolved context, and content-derived identity
  - bind receipts to the plan and semantically relevant context so meaningful changes invalidate dependent approvals
  - prefer independent review and record exhausted-route fallback honestly
  - preserve evidence, privacy, licensing, attribution, and code-execution trust boundaries
  - give Product, Implementation, and Execution Planning the same explicit contract shape without collapsing their approval meanings
  - keep blocking findings grounded in accepted requirements without turning reviewer suggestions into decisions or scope
  - resolve the accepted boundary from ticket, project, milestone, and parent context and check both omissions and overreach without changing scope
  - make Product Plan review enforce persona-outcome coverage and visibly separate facts, assumptions, and unresolved product decisions
out_of_scope:
  - defining Implementation Plan approach content, defining Execution Plan decomposition content, changing accepted scope, and migration policy
done_when:
  - missing, unreadable, stale, or digest-mismatched required context cannot produce approval
  - semantic context changes invalidate dependent receipts while formatting and unrelated inventory changes do not; exact plan changes invalidate their own review except normalized Execution Plan checklist progress
  - receipts identify the plan, context, reviewer route, and achieved independence without overstating fallback quality
  - each phase contract declares its purpose, entry, required and prohibited content, review question, approval meaning, invalidation, and return path, and no approval claims a downstream state
  - corrected plans require a fresh exact-byte verdict and optional reviewer strengthening cannot fail a gate before user acceptance
  - review and guidance cannot add out-of-scope behavior, design, proof, or work without user authority
  - Product Plan approval cannot pass while an accepted persona outcome is neither inventoried nor explicitly inapplicable, or while facts, assumptions, and unresolved decisions are conflated; scenario review separately proves applicable-outcome coverage
product_plan_contract: v1
parent: 82T411
blocked_on: [82T411]
parent_job: plan-implementability.TBU4
milestone: M2
created: 2026-09-08T17:36:34.390Z
last_modified: 2026-09-26T06:34:59Z
parent_contract_digest: 2afd2f5559eafea9bd752ac826b46fa98e80a30ccdf6bed76a16ff7f30bcec20
---

# Keep plan reviews current and trustworthy

**Goal:** Bind planning approvals to canonical contracts, complete context, honest independence, and semantic changes

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-10-07 Fallback slice main integration: inherited the reviewed semantic
  identity/exclusion union. Typecheck found two continuation callers still using
  the old provenance signature. Routed both through the existing `terminalResult`
  reader, so successful and failed continuations receive the same current
  fingerprint, integrity, and verified-exclusion handling as ordinary status.
  Typecheck now passes. Nine complete targeted files pass **239 tests**, with
  **two existing Linux-only runtime cases skipped on macOS**, 241 total.
  Independent Claude review `8cbda442-3b6f-45f5-95ca-e5718f9b8df4`
  approved the source/test union. Its raw malformed-output warning does not grant
  coverage: the actual receipt reader accepts only `review_excluded_targets`,
  never raw `excluded_targets`. The unsigned tamper case proves integrity;
  the earlier authenticated retrospective case separately proves classifier
  intersection. The conservative under-credit asymmetry is inherited and stays
  fail-closed. Extra packet preparation inside the continuation lock is the
  accepted cost of reusing the existing current-result boundary. No test was
  modified beyond preserving both branches' imports. Frozen installation and
  initial five-surface generation passed; generation is refreshed after the
  continuation correction. Logs: `/tmp/4200-fallback-main-targeted.log`,
  `/tmp/4200-fallback-main-typecheck.log` (initial failure),
  `/tmp/4200-fallback-main-typecheck-retry.log`, and
  `/tmp/4200-fallback-main-quality.json`. Whole-PR review, final CI, and full
  acceptance remain required; no Ready or merge claim is made.

- Semantic integration follow-up: the first commit check correctly rejected
  a shadowed `reviewIdentity` helper name. Renamed only the merge adapter to
  `reviewFingerprintIdentity`; all **79 job tests pass** again. A subsequent
  commit check rejected the stale generated bundles after this source rename.
  Regenerating the five surfaces preserves those failures as evidence rather
  than bypassing either gate. Logs: `/tmp/4200-semantic-main-job-retry.log`,
  `/tmp/4200-semantic-main-commit.log`, and
  `/tmp/4200-semantic-main-commit-retry.log`. The preceding Claude review covers
  the source union before this naming-only change, not an exact final-byte
  whole-PR review.

- 2026-10-07 Semantic slice main integration: combined the existing typed
  planning identity and per-scenario ledger fingerprint with main's freshly
  authenticated generated-target exclusions. Both planning identity and verified
  exclusions remain in receipt provenance. Frozen installation, typecheck, and
  all five generated surfaces pass; **169 tests pass in seven actual files**.
  An additional guessed `hooks/read-receipt.test.ts` selector does not exist and
  selected no tests; it is not counted as evidence. Independent Claude review
  `45050865-774f-492c-8c36-c2b6b82424aa` approved this source/test union.
  Its conservative under-credit warnings are inherited from main: recorded
  versus verified exclusions can drop coverage, exact path matching can drop
  exclusions if upstream stops normalizing, and malformed-output status does
  not waive exclusions. Generated content remains outside approval by design.
  No optional hardening was added. Logs: `/tmp/4200-semantic-main-targeted.log`,
  `/tmp/4200-semantic-main-quality.json`, and
  `/tmp/4200-semantic-main-generated.log`. Full acceptance and whole-PR review
  remain unfinished; no Ready or merge claim is made.

- 2026-09-26T07:16:52Z Authenticated implementation entry: current scenario review `2b4e9634-7cc9-451e-8b07-f45cacc004c8`, Implementation review `6c2fba8a-2654-45ca-993c-2d49bfc86192`, and Execution review `9c001c0d-8512-44df-a76a-14161a0e9897` approved with no errors and all three phase stamps succeeded. The public coding-authorization check returned authorized with cross-agent assurance and no findings. Advanced to implement only after that check. Refresh at this stable phase before production edits because the current coordinator still hashes phase metadata. All 54 scenario ledger entries remain unfinished.

- 2026-09-26T07:08:00Z Parent-aligned planning exit: Implementation review `577fc6c0-38ee-4da5-9487-8fa5322b5c22` approved without errors and authenticated `approve-plan` advanced with human approval not required. Execution review `608f5be4-4eb2-4820-ad73-1476f71caa5d` rejected the obsolete 44-ledger obligation; corrected it to all 54 accepted ledgers. Fresh review `4efd1e88-399c-4039-91fe-1c329ee8940e` approved without errors and its authenticated phase stamp succeeded. Nonblocking warnings remain visible. Implementation entry is held until the public coding-authorization check succeeds. A premature phase edit was reverted before any TDD or production edits; all 54 scenario ledger entries remain unfinished. Current coordinator hashes phase metadata, so refresh both reviews after this stable work-log correction before checking authorization.

- 2026-09-26T06:34:59Z Corrected scenario gate: cross-agent review `e08a16e3-977c-42d0-9bdb-b1c2adae3ed3` approved the parent-aligned 54-scenario packet with no errors, and its authenticated phase stamp succeeded. Optional strengthening remains optional. Parser-backed Gherkin lint is clean. Advanced to Implementation Planning for a new exact-packet review.

- 2026-09-26T06:27:50Z Parent-contract correction: restored TBU4.R3/R4 current dimensions, architecture records, and triggered data guidance as direct Execution review context; removed an unsupported claim of user acceptance of a narrower boundary. Current context constrains rather than replaces the accepted Implementation Plan. Returned to scenario-gate for exact-byte review of the corrected required-input row; 54 ledger entries remain unfinished. Prior approved plan reviews are preserved as historical evidence and will be refreshed.

- 2026-09-26T05:34:37Z Scenario gate refreshed: Claude review `63717665-c053-4a8e-9553-76d3d4171bbb` approved the current 54-scenario packet with cross-agent independence; authenticated phase stamp succeeded. R3 distinguishes stale cosmetic lineage and R4 quantifies every listed semantic dependency. All 54 ledger entries remain unfinished. Parser-backed Gherkin lint is clean; source doctor reports no lineage/coverage defect for this ticket, while unrelated tooling and sibling-anchor advisories remain visible. No build-only kill-risk requires a spike. Advanced to Implementation Planning for fresh current-context plan review.
- 2026-10-07 Contract slice main integration: inherited main `485d8ac` through
  approval branch `dc9692ef9`. No production-source conflict required manual
  resolution. Dependency/generated conflicts use the updated base followed by
  all five generators; an identical duplicate root override was removed.
  Frozen installation, typecheck, and generated checks pass. Six complete
  targeted files pass **189/189 tests**, including canonical generation,
  installed-copy admission, native-copy dispatch, reconciliation, contract
  identity, and review wiring. Logs: `/tmp/4200-contract-main-targeted.log`,
  `/tmp/4200-contract-main-typecheck.log`, and
  `/tmp/4200-contract-main-generated.log`. This integration does not refresh
  whole-PR review or claim full acceptance, legacy migration, Ready, or merge.

- 2026-10-07 Main-integration suite result: CLI 660 files passed, one failed; 10929 tests passed, one failed, 14 skipped, exit 1, 657.80s. Retro relay passed 198 tests with one skip; retro collector passed 153 tests. The sole CLI failure occurred at `git add -A` before the assertion: Git could not create a temporary object (`Invalid argument`) while indexing the installed interface-contract guide. The exact original boundary test file then passed unchanged, all 12 tests, in 9.10s (`/tmp/4200-guide-main-boundary-isolated.log`). This identifies fixture staging rather than phase-skip validation as the failing boundary; the underlying intermittent filesystem cause is not established. Disk capacity is ample. No test, retry policy, tool pin or production workaround was changed. The full run remains a failed run, not reclassified as green; a later final integrated-head full check remains required. Frozen install and all 275 template pairs/11 contracts pass. This is an integration checkpoint, not epic completion or PR readiness.

- 2026-10-07 Main-integration full-suite investigation: the active run reports one failure in `does not flag born-past-intake when phase_skips justify the birth (negative)`. No test or production fix applied. Competing causes: phase-skip validation regression, generated CLI mismatch, or a suite/environment interaction. Direct current-source `evaluateTicketWrite` accepts the exact skip list (`/tmp/4200-boundary-birth-pure.log`); a fresh installed Cursor project through the built CLI returns exit 0 with only the unrelated missing-ledger warning and no birth finding (`/tmp/4200-boundary-birth-repro.log`). These checks rule out a simple validator failure and consistent built-CLI mismatch. The exact full-suite assertion output and isolated original test rerun remain required before assigning a root cause. Full-suite evidence is retained in `/tmp/4200-guide-main-full.log`.

- 2026-10-06 Main integration: merged `485d8ac773af44e73dbcd8c2ea64f08e5fee5154` into the guide base. Preserved per-scenario ledger fingerprints together with main's current generated-target classification and authenticated exclusion revalidation. Typecheck and 173 targeted review/receipt/ledger tests pass. Independent Claude review `507706f1-41b3-4216-9e98-cdd079e9f6b6` approves the source/test union; inherited fail-safe under-credit warnings remain, without expanding this integration. Frozen install passes using the pinned launcher from the PR5 checkout because this lower branch predates the toolchain slice. The initial local-launcher attempt failed because that file is absent here; no shell profile or repository pin changed.

- 2026-10-06 Generated integration evidence: first generation stopped on a Cursor install result-hash change against the temporary main fixture used for conflict resolution. Investigated all 12 regenerated lifecycle results: each matches the original guide-branch HEAD, including Cursor install `1f3c3174135d276fe41de6b44e23ff96f100c35f8d97264f483a1fd663a9ccb8`. Thus the warning reflects the different main placeholder rather than a new feature behavior. Reran all five generators in safe order and verified them successfully. Logs: `/tmp/4200-guide-main-generated.log`, `/tmp/4200-guide-main-generated-verified.log`, `/tmp/4200-guide-main-targeted.log`, `/tmp/4200-guide-main-typecheck.log`. Full repository tests are still running; no full-suite success or whole-PR readiness is claimed.
- 2026-09-10T03:36:35.000Z Scenario gate approved: Independent Claude Opus review `907bfbe5-0e30-437f-9bd8-492366879e33` approved the final 44-scenario review-trust contract with cross-agent independence. Advanced to Implementation Plan drafting; no plan anchor exists yet.

- 2026-09-09T23:10:11.000Z Parent reconciliation: `--accept` refreshed this child against the approved Product Plan after the 23:04 changes; the current digest is recorded in frontmatter and passes `ticket reconcile-parent`.

- 2026-09-09T23:04:09.000Z Contract and scenario impact: Clarified that this child defines shared contract shape and Product Plan outcome inventory, while G1C9PP and 7CAMAD own their plan content and scenario review separately proves outcome coverage. R11–R16 require new scenario coverage before fresh review.

- 2026-09-09T22:44:47.000Z Contract-ownership correction: Assigned the Product Plan's persona-outcome coverage and epistemic-status requirements to this child alongside the shared phase-contract shape.

- 2026-09-09T22:28:06.000Z Ownership correction: Absorbed accepted-boundary resolution, omission and overreach review, and reviewer non-authority from K3EBHB so the TBU4 child owns and digests those TBU4 Rules.

- 2026-09-09T22:19:12.000Z Review gate correction: Recorded the stale parent approval as an explicit blocker; existing scenario work is preserved, but this child cannot earn another approval or enter implementation until 82T411 is freshly approved.

- 2026-09-08T17:36:34.390Z Started: Created ticket 5F5ZZA

- 2026-09-08T18:05:00.000Z Define behavior: Bounded this child to review integrity and nine inherited obligations.

- 2026-09-08T18:20:00.000Z Scenario gate: Partitioned 9 inherited Rules into child-owned scenarios and R/G/R ledger entries; independent scenario review remains pending.

- 2026-09-08T18:37:46.090Z Scenario gate: All independent routes were exhausted. Main-thread supplemental review strengthened required-context and semantic-invalidation partitions; no independent stamp was written.

- 2026-09-08T22:38:00.000Z Scenario gate: Claude Opus independently approved the 25-scenario packet with cross-agent provenance (review `77068d2f-e8ff-493a-ad23-d49ca5164b2f`); recorded the scenario-gate stamp and advanced to Implementation Planning. Non-blocking review warnings remain planning inputs.

- 2026-09-09T16:45:00.000Z Returned to scenario gate: Added the shared planning-contract shape and bounded approval meanings learned from the emergency-control plan. Product approval establishes the right behavior, Implementation approval the accepted design, and Execution approval startable delivery; none may claim a downstream state.

- 2026-09-09T21:49:00.000Z Scenario impact: Added the reviewed finding-quality boundary: blockers cite accepted requirements, reviewers expose rather than decide unresolved choices, optional strengthening remains nonblocking, and corrected plan bytes require a fresh verdict.

## Root Cause (PR 4 Claude Product review identity)

Product Plan reviews use `quality-review`, but the Claude adapter selected streamed model metadata only by review kind, so Product reviews returned a verdict without confirmable model identity. After requesting streamed output for the Product phase, a live probe still lacked confirmation: Claude keyed `modelUsage` as `claude-opus-5[1m]` while its assistant event and `canonicalModel` said `claude-opus-5`. Matching the canonical field resolves the current protocol shape. A live Product review then confirmed `claude-opus-5` and returned its actual rejection findings. The competing hypothesis that no assistant model event was emitted was ruled out by the observed event stream.

## Root Cause (PR 4 Codex Execution review timeouts)

The Execution Plan output schema contained `oneOf` for proof invocations. The Codex app-server accepted the turn request, but its model endpoint rejected the nested schema with `invalid_json_schema` because `oneOf` is unsupported. The adapter ignored the resulting `turn/completed` event with `status: failed`, turning a roughly four-second schema rejection into a worker timeout. An event trace captured both the rejection and failed completion; replacing `oneOf` with equivalent `anyOf` yielded a completed live Execution review. The competing hypotheses of a slow model and an unsupported pinned Codex model were ruled out: the rejection occurred before generation, while the same pinned model completed after the schema change.
