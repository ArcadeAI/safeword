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

- 2026-10-01T22:19:00Z R10 review-quality repair: Independent Claude review `6ceab607-97fb-44b8-a0dd-ebec372c54a3` found that the Product and Execution downstream-claim fixtures could be rejected for unrelated incompleteness. Replaced their skeletal plans with phase-conforming base plans, added bounded-approval controls sharing those exact bases, and required the rejection finding to name the full unsupported downstream claim. The three isolated downstream-claim scenarios passed; both new controls received three correct judged approvals each; the pinned corpus test passed 2/2. The positive R10 ledger row remains unfinished because none of these passing proofs is behavioral RED.

- 2026-10-01T22:05:00Z R10 own-state scenario is now bound to a pinned judged-eval case. The isolated root Cucumber run passed 1 scenario and all 51 reported steps; its assertion requires at least two of three independent reviewer/judge runs to approve the bounded Implementation Plan claim without scope expansion. The corpus contract test passed 2/2 after updating its digest. This is positive characterization evidence, not behavioral RED: the old undefined-step RED does not authorize GREEN, and the ledger remains unfinished. Do not fabricate a failing verdict or relabel this executable scenario as manual.

- 2026-10-01T17:06:22Z R10 own-state scenario remains RED, not GREEN. Its isolated Cucumber run reports one undefined scenario with the exact three named steps. Independent executable-RED reviews `8ca2072a-e791-4713-9549-9ed14ee41419`, `6432f5ef-7832-4495-9d46-5ba38209f692`, `8e4e397e-03b7-430b-9a49-51063e52218f`, and `cd6aea7e-bb1e-4397-b781-8281d6a8eab3` all requested changes. The first disputed Cucumber's summary count because hidden hooks appear as steps. JSON output resolved that ambiguity and the second review accepted the attested RED execution, but found missing R5/R6 scenario branches. Added exactly those three accepted-plan branches: absent generated rubric, unverified author model, and unavailable/stale/conflicting pair capability. Subsequent reviews rejected the still-undefined R10 steps as insufficient actor-boundary proof, despite the BDD TDD guide explicitly allowing an undefined step as the first executable RED. Do not mark GREEN or fabricate a failing semantic verdict to satisfy this gate. At the new feature head, dry-run selection reports 173 scenarios: 49 skipped by dry-run, 124 undefined; this is not a passing acceptance run. The earlier 170-row split result predates the three new rows.

- 2026-10-01T16:49:35Z Root feature acceptance was rerun in disjoint selections after the 8-failure aggregate run: the 164 non-judged scenarios finished 43 passed, 121 undefined, 0 failed; the three R10 and three R13 judged scenarios had each passed in their targeted runs. Together these selections cover all 170 rows (49 passed, 121 undefined, 0 failed), but they do not replace the failed single-process aggregate result or satisfy unfinished acceptance. PR 5 remains Draft. CI on `f4728222f` also has a Node 22 collector integration test timing out while waiting for readiness and the inherited dependency-audit failure; both remain unresolved.

- 2026-10-01T16:35:42Z PR 5 R10 downstream-claim slice: Independent executable-RED review `6a33e422-37e4-4b0f-bf4a-90bb24f7490f` approved the committed three-row undefined Cucumber proof, and the GREEN gate was healthy before edits. Added Implementation and Execution downstream-claim cases alongside Product; the targeted R10 Cucumber outline passed 3/3 and the refreshed pinned aggregate eval passed 16/16. A later root feature run ended 41 passed, 121 undefined, 8 failed after 63 minutes: three R1 generator subprocesses timed out, four R2 installed-dispatch subprocesses returned empty output, and one R10 live subprocess timed out. The previously passing R1 and R2 groups then passed in isolation (1/1 and 4/4). Treat the aggregate failure as unresolved environmental interference, not a passing acceptance result; do not increase timeouts or close the feature on this evidence.

- 2026-10-01T04:31:55Z Root feature acceptance after the R13 loop: 170 scenarios, 46 passed, 124 undefined, 0 failed. The 3 judged R13 rows passed, while the installed-host R13 sibling and other unfinished rows remain visible. The pinned aggregate eval passed 14/14 fixtures, and the targeted eval-contract test passed 2/2. This is partial acceptance evidence only; PR 5 stays Draft.

- 2026-10-01T04:18:57Z PR 5 R13 GREEN: Independent executable-RED review `a3bae8e8-8580-4cce-9895-af7284aca3b1` approved the exact three-row Cucumber failure on the committed RED snapshot, with the RED ledger annotation already present. The current-branch GREEN gate confirmed that receipt. Commit `481b2cc76` connects the three rows to the pinned live reviewer/judge evaluator and isolates its temporary report. The post-format Cucumber run passed all 3 rows (153 steps including shared hooks). R13's installed-host sibling scenario and the rest of the feature remain unfinished.

- 2026-10-01T04:04:52Z PR 5 R13 executable RED review `098d8ae1-538a-4e54-b255-273afb51b227` independently approved the three undefined root Cucumber rows at the pre-GREEN checkout. Its narrow proof target stayed current when the evaluator script and step definitions were added, and a live Cucumber run passed all three rows. Marking RED in the ledger afterward invalidated that receipt, so a new review at the committed RED snapshot was required before GREEN could be recorded.

- 2026-10-01T03:41:17Z PR 5 R13 coverage: Added the missing conforming-boundary case to the pinned judged corpus after a targeted RED test showed the corpus had only omission and overreach. The selected case passed 3/3 reviewer/judge repetitions, and the refreshed aggregate passed 14/14 fixtures. Independent executable-RED review `d3fa7a55-3a12-4f01-a996-5b1aa66ce916` rejected the root Cucumber undefined-step run as insufficient actor-boundary evidence. The three R13 Cucumber rows remain undefined and their ledger entry remains unchecked; the judged corpus is narrower evidence, not scenario completion.

- 2026-09-30T15:02:21Z User decision for PR 5: defer a host-level test that injects hostile retrieved content at the planning agent's retrieval boundary. Accept the interim risk that current packet tests and judged evaluation do not prove the host agent will never follow retrieved instructions, execute retrieved code, or disclose private context. Keep the accepted R7 scenarios and their unfinished acceptance status visible; do not describe R7 or the epic as fully verified or close them on this evidence. Revisit the missing host-boundary proof before claiming full R7 acceptance. This decision does not authorize merging or promoting a PR.

- 2026-09-26T07:16:52Z Authenticated implementation entry: current scenario review `2b4e9634-7cc9-451e-8b07-f45cacc004c8`, Implementation review `6c2fba8a-2654-45ca-993c-2d49bfc86192`, and Execution review `9c001c0d-8512-44df-a76a-14161a0e9897` approved with no errors and all three phase stamps succeeded. The public coding-authorization check returned authorized with cross-agent assurance and no findings. Advanced to implement only after that check. Refresh at this stable phase before production edits because the current coordinator still hashes phase metadata. All 54 scenario ledger entries remain unfinished.

- 2026-09-26T07:08:00Z Parent-aligned planning exit: Implementation review `577fc6c0-38ee-4da5-9487-8fa5322b5c22` approved without errors and authenticated `approve-plan` advanced with human approval not required. Execution review `608f5be4-4eb2-4820-ad73-1476f71caa5d` rejected the obsolete 44-ledger obligation; corrected it to all 54 accepted ledgers. Fresh review `4efd1e88-399c-4039-91fe-1c329ee8940e` approved without errors and its authenticated phase stamp succeeded. Nonblocking warnings remain visible. Implementation entry is held until the public coding-authorization check succeeds. A premature phase edit was reverted before any TDD or production edits; all 54 scenario ledger entries remain unfinished. Current coordinator hashes phase metadata, so refresh both reviews after this stable work-log correction before checking authorization.

- 2026-09-26T06:34:59Z Corrected scenario gate: cross-agent review `e08a16e3-977c-42d0-9bdb-b1c2adae3ed3` approved the parent-aligned 54-scenario packet with no errors, and its authenticated phase stamp succeeded. Optional strengthening remains optional. Parser-backed Gherkin lint is clean. Advanced to Implementation Planning for a new exact-packet review.

- 2026-09-26T06:27:50Z Parent-contract correction: restored TBU4.R3/R4 current dimensions, architecture records, and triggered data guidance as direct Execution review context; removed an unsupported claim of user acceptance of a narrower boundary. Current context constrains rather than replaces the accepted Implementation Plan. Returned to scenario-gate for exact-byte review of the corrected required-input row; 54 ledger entries remain unfinished. Prior approved plan reviews are preserved as historical evidence and will be refreshed.

- 2026-09-26T05:34:37Z Scenario gate refreshed: Claude review `63717665-c053-4a8e-9553-76d3d4171bbb` approved the current 54-scenario packet with cross-agent independence; authenticated phase stamp succeeded. R3 distinguishes stale cosmetic lineage and R4 quantifies every listed semantic dependency. All 54 ledger entries remain unfinished. Parser-backed Gherkin lint is clean; source doctor reports no lineage/coverage defect for this ticket, while unrelated tooling and sibling-anchor advisories remain visible. No build-only kill-risk requires a spike. Advanced to Implementation Planning for fresh current-context plan review.

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

### Resume checkpoint — 2026-10-05 UTC

Current continuation checkpoint: R9's authorized correction now has real RED
proof: the targeted three-file run reported 52 passing and two failing tests
(unsupported own-review-only reconciliation and retained upstream identity).
Executable-RED review `30603a6f-aea5-4849-b782-b5b7d8bf78d7` approved the real
reconciliation failure. No production correction or corrective checkbox is
claimed complete. The separate Execution data-guidance characterization passed:
the current resolver reads the accepted Implementation Plan's trigger and
includes current guidance without a duplicate Execution declaration. The plan
now states that existing behavior explicitly. Current R8 primary proof reports
four failed scenarios, 204 passed steps and four failed steps; guidance remains
unimplemented. The repaired Execution checklist parses with 15 items.

Installed MCP scenario review `7267f08c-0996-4978-9605-89246c3fa687` approved;
Implementation review `a1860825-3ed6-497c-a91f-ef7aaf9b1aca` requested the
data-trigger clarification, now repaired. Those installed receipts lack this
branch's planning review identity, and the current source reader reported the
scenario receipt stale before subsequent documentation edits. The installed
runtime SHA is `32c23e84488322e5aee9caa32a216b6ac4dcc9df8e847cfb42b7d06a13e49c0a`,
while this branch's generated runtime is
`1beaa407adc228af27592a161f15f1618219d45078c889eed02b13962576c29e`.
This branch does not package the installed MCP bridge. Do not replace the
personal plugin with a build that removes that bridge, reinterpret the old
receipts as current, or weaken authentication. A narrow request is pending to
use the repository's existing shared coordinator for this epic instead of the
installed skill's MCP route. Fresh scenario/Implementation/Execution reviews
and normal phase admission are still required. Source Execution review
`04a4859e-db15-43dc-b7fc-392779ed5ec9` identified current-vs-historical task
labels; those labels and startable corrective commands are now repaired.
No new review tool, product authority, or dependency policy is introduced.

Latest follow-up: the user delegated the invalidation-policy choice with
“your call”. Align with parent TBU2.R11/TBU4.R9: semantic Implementation Plan
changes stale both approvals; own-review-only becomes unsupported and must be
rejected before reconciliation changes installed bytes. Test corrections are
authorized. The source CLI now reports the personal native 1.0.0-rc.5 plugin
protected with current proof for all five lifecycle events. The requested
latest-package installer retry reported a version mismatch; it did not replace
that verified protection state. Earlier pending-approval and protection notes
below are historical.

Restart follow-up: the personal profile still reports a version mismatch; do
not claim active hook protection. Receipt verification is separately resolved
for development: native `codex plugin marketplace add` and `codex plugin add`
installed the current generated bundle into the isolated profile named in
`/tmp/4200-review-profile-path`. Its cached runtime is a regular installed copy,
not a repository symlink; SHA-256
`1beaa407adc228af27592a161f15f1618219d45078c889eed02b13962576c29e`
matches the generated distribution and remains unchanged. That installed
verifier authenticated current R8 RED review
`20743afe-5875-49bc-98ee-0ded14788876` and correctly reported an older scenario
receipt stale. The installed-cache compatibility root is the verifier route;
the editable repository plugin is not.

Fresh scenario review `a3143e8d-4361-4f47-b042-be0a39084e88` found that the
alternate own-review-only Execution invalidation policy contradicts parent
TBU2.R11/TBU4.R9. Requested user approval to correct the conflicting scenario
contract to the parent's both-review policy; do not change that test contract
while the answer is pending. Execution proof mappings, startable commands,
live-confirmation/release ownership, and current-state labels are repaired in
the uncommitted plans; they require fresh review after the boundary is settled.

The existing semantic ticket projection already retains `done_when` and `type`;
added two characterization cases and clarified that fact in the plan. Their
targeted run started no tests: the package test lock is held by PID 77155 in
the principles worktree. Do not bypass that lock, kill the other run, or claim
these cases passed. R14's plan now distinguishes human-directed recorded scope
changes from identity-authenticated filesystem edits; it adds no new acceptance
command or false claim that terminal confirmation identifies a human.

PR 5 commit `39bd3bdeb` adds the real missing-reviewer-rubric recovery proof;
its CI is green. Uncommitted corrective R4 proof now reports exactly six
scenarios, five passing and one failing: cosmetic changes inside the bounded
canonical contract incorrectly retain approval. External executable-RED review
`dd2b0f9a-90f9-46a3-a12b-9a6a2b09f013` approved that failure. The new R8
installed-guidance cases also remain RED. No corrective production fix is made.

Current scenario and Implementation reviews approved; the latest Execution
review requests changes to proof/checklist mappings, rollback RED, reviewer
transport decision accounting, and startable RED commands. These remain open.
The user-deferred R7 host retrieval proof remains unfinished, as does full epic
acceptance. The last full acceptance census retains one failure and 541
undefined scenarios; no narrower green result replaces it.

Receipt verification must use distribution-owned code. Stamps produced during
this investigation with `CLAUDE_PLUGIN_ROOT` pointing at the editable repository
plugin are not accepted authorization evidence; preserve history and obtain
fresh admission through the supported installed verifier. The supported profile
repair reports `CODEX_PLUGIN_INSTALLED_RESTART_REQUIRED`: inspect Settings >
Hooks, fully restart Codex, then verify protection and current receipt admission.
Do not implement through a substituted local verifier. All PRs stay Draft;
neither merge nor promotion is authorized.

Product Plan reviews use `quality-review`, but the Claude adapter selected streamed model metadata only by review kind, so Product reviews returned a verdict without confirmable model identity. After requesting streamed output for the Product phase, a live probe still lacked confirmation: Claude keyed `modelUsage` as `claude-opus-5[1m]` while its assistant event and `canonicalModel` said `claude-opus-5`. Matching the canonical field resolves the current protocol shape. A live Product review then confirmed `claude-opus-5` and returned its actual rejection findings. The competing hypothesis that no assistant model event was emitted was ruled out by the observed event stream.

## Root Cause (PR 4 Codex Execution review timeouts)

The Execution Plan output schema contained `oneOf` for proof invocations. The Codex app-server accepted the turn request, but its model endpoint rejected the nested schema with `invalid_json_schema` because `oneOf` is unsupported. The adapter ignored the resulting `turn/completed` event with `status: failed`, turning a roughly four-second schema rejection into a worker timeout. An event trace captured both the rejection and failed completion; replacing `oneOf` with equivalent `anyOf` yielded a completed live Execution review. The competing hypotheses of a slow model and an unsupported pinned Codex model were ruled out: the rejection occurred before generation, while the same pinned model completed after the schema change.
