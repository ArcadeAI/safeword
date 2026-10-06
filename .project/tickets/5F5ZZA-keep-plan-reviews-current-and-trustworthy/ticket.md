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
parent_contract_digest: fc6cd57babcd3fefc8a71c2f100683aa98d4589e1b14abfe46f8b4226e2be25f
---

# Keep plan reviews current and trustworthy

**Goal:** Bind planning approvals to canonical contracts, complete context, honest independence, and semantic changes

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-10-06 Qualification continuation: the explicitly approved runner correction now checks runtime-confirmed provider/model and uses/restores the selected authenticated profile. Its final typecheck/lint and Claude review `c86135f1-94ea-48bd-bccc-57c40622f70c` passed. The complete Codex `gpt-6-astra` matrix finished with 51/63 cases passing and 12 failing (64 Vitest tests including identity precondition: 52 passed, 12 failed); raw log and results remain `/tmp/4200-codex-model-qualified-live.log` and `/tmp/4200-codex-model-qualified-results.json`. No admission was generated. Nine failures exposed incomplete fixture mechanics/context; their approved repairs now specify accepted store ownership, complete prior-response proof, measurement instrumentation/independent coverage census/collection, concrete discovery actions, denial inputs/assertions, and independently supported consumers. Eight repaired cases have focused passing diagnostics; fresh-context denial now receives approval but still fails exact obligation-name scoring on a descriptive suffix. The three prepared scorer corrections remain unapplied pending human approval; they retain verdict, destination, rejection-record and canonical-name checks while accepting correct terminology/descriptive comma-or-colon suffixes. Final fixture unit tests pass 59/59, typecheck and lint pass. A review started before final formatting returned stale (`67df9015-1825-47ad-aa73-3f913103f0a6`); the current-byte review is running. PR4's own live model-confirmation proof passed 2/2 and its 895 schema pre-push checks passed; commit `5696a899f` is pushed to PR #5086. Current-head full CI is not yet claimed. Historical acceptance failures/unfinished scenarios, the RGR ledger, legacy diagnostic gap, and deferred R7 remain unfinished; no merge, promotion, or epic completion is claimed.

- 2026-10-06 Qualification fixture repairs approved and applied: complete-record and five multi-slice/mirror positive fixtures now supply concrete accepted delivery tasks. Missing-field/obligation/checklist rejection fixtures now start from the complete delivery slice. The two separately approved oracle corrections preserve required rejection. Direct source-runtime diagnostics passed 10/10 selected cases with confirmed OpenAI `gpt-6-astra`; these are not full qualification or admission evidence. Static tests passed 59/59 before the final negative-baseline repair; the final rerun is waiting on another checkout's test lock. Final typecheck and lint passed. Claude review `e40e6be5-e01e-4245-ab71-1d798bea73ea` approved with advisories after repairing its earlier blocking baseline finding. The model-provenance/authenticated-Claude-profile runner patch `/tmp/4200-qualification-model-provenance.patch` remains unapplied pending explicit test-edit approval. Historical failures, the earlier purpose-term miss, unfinished acceptance, RGR ledger, and deferred R7 remain visible. No new admission, completion, merge, or promotion is claimed.

- 2026-10-06T06:10Z Live model-confirmation proof: commit `b36df53d1` adds the planned opt-in installed-project/public-coordinator proof. Both real routes passed (2/2): OpenAI `gpt-6-astra` and Anthropic `claude-opus-5` exactly matched their packaged selectors and coordinator-observed confirmations. Typecheck and lint passed; independent Claude review `7345f22c-ebe0-4d8a-b3c8-2ac9323317df` approved the final test. This proves current adapter identity confirmation, not semantic qualification, complete acceptance, or every possible reroute. The unfinished qualification matrix, acceptance scenarios, RGR ledger, and explicitly deferred R7 retrieval-boundary proof remain unfinished; no merge or promotion is authorized.

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

Latest continuation: the user explicitly authorized the repository coordinator
with “use it”. Fresh source scenario review
`0e39c39d-5062-4520-a437-cca4d1ad9a0e`, Implementation review
`79321e32-0731-4057-a457-4e9d5a4fe76d`, and Execution review
`1463a44e-55a7-42bb-832b-7ae5dd811bcd` passed and were stamped through the
native-installed isolated development verifier. Their achieved planning
independence was `reduced` (author capability unknown), not cross-model proof.
The normal source coding-authorization command returned authorized before
production edits. Plan repairs clarify existing upstream data applicability,
existing PID/inode lock recovery, historical versus corrective tasks, and
disposition proof ownership; they add no new lock protocol or product authority.

Committed RED evidence is `5b965631f`; the R9 production correction is
`bf758b53f52d40f3d7288f285937dcb717554a26`. It rejects own-review-only declarations
and deletes snapshot-only upstream currency. Both real reconciliation scenarios
passed 106/106 steps; 30 relevant lower-level tests passed while the separate
R4 corrective test remained RED. Current R4 and R8 production corrections are
uncommitted: identity now binds the exact bounded reviewer-contract SHA, and the
handbook/BDD entry points explicitly distinguish supported from advisory
surfaces. All four generated surfaces are current. The copied-runtime R4 proof
no longer edits the unused, tree-shaken typed-contract table; baseline approval,
semantic/cosmetic mutations, and stale-status assertions remain exercised.

Current combined verification: 60/60 targeted tests pass; 19 real CLI/installed
scenarios pass all 990 steps. The entire root feature reports 173 scenarios:
57 passed, 116 undefined; 8998 steps: 8650 passed, 7 skipped, 341 undefined;
no scenario failed. This is still incomplete acceptance. Full-repository
acceptance was not rerun: its last recorded census remains 2378 scenarios,
1833 passed, 3 skipped, 541 undefined, and one unrelated failure. The original
six-failure/585-unfinished history and deferred R7 obligation remain preserved.
Source quality review `abad7409-798a-4748-8222-bc2d74d2bb24` approved the ten
scoped source/test targets with cross-agent provenance and no blocking findings.

The installed personal runtime rejects the same executable RED receipt that
the source verifier accepts (current R9 receipt
`718d5877-ba9f-4d4e-afd5-76fc1a4933ef`). Automatic approval review rejected the
GREEN checkbox edit; the checkbox remains unchecked. The normal source
`codex migrate` command was healthy/no-op and did not align the verifier.
Dogfood source installation copied the two guidance mirrors but stopped on an
existing Claude marketplace source conflict. Incidental version/gitignore
changes were restored; no personal marketplace settings were changed.
A decision is pending on installing this branch's generated development plugin
into the shared Codex profile and restarting. That affects other chats and
removes the installed MCP review bridge; only the repository coordinator is
authorized for this epic. Do not bypass the hook or reinterpret its rejection.

Remote snapshot: all 14 PRs remain open Draft; published heads do not include
these local changes. Their checks reported no pending/failing entries, while
PR #5170 now reports a merge conflict. No merge or promotion occurred. After
the verifier is aligned, refresh proof receipts against their actual current
inputs, complete honest ledger tracking, place fixes in their owning slices,
resolve #5170's conflict, run required acceptance/evals/live/release checks,
and obtain current exact-head review/CI. Neither the 116 undefined feature
scenarios nor the user-owned R7 deferral may be hidden or called complete.

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

## Main integration checkpoint (2026-10-05)

Main through `e7a8c12c0a523091c4629419ce5877c7a08bb6da` is integrated
locally across the planning and Execution stacks and Product branch. The
executable-RED helper also passed generated verification and now includes that
main snapshot in committed local merges. No PR has been pushed, promoted, or
merged on GitHub in this pass.

Cross-agent Claude quality review `518f8165-14ed-4cc6-bb73-e224e46d98bb`
found inconsistent duplicate-target admission: packet deduplication could omit
the planning phase and role context. Three new regressions failed on the old
code, then passed after normalizing public target paths before admission and
passing unique packet targets to the planning-contract resolver. Broader
validation passed (197 tests, typecheck). Fresh cross-agent Claude review
`f8d97eb9-e959-4fbe-95f6-e05360e2e3b1` approved the source with three
nonblocking cleanup/error-reporting warnings. The correction has also been
copied to its owning PR3 slice; that slice passed 194 tests and typecheck.
Slice generation/commit and descendant integration remain pending.

The focused root check initially reported 28 scenarios: six passed, 15 failed,
seven undefined. All 15 failures were installer fixtures inheriting the personal
Claude marketplace version. Isolating their Claude profiles retained the real
installer and assertions: nine installed-contract scenarios/468 steps and six
cosmetic-context scenarios/312 steps now pass. The seven undefined scenarios
remain unfinished; these narrower results do not replace full acceptance.
Two gated guidance scenarios/104 steps also pass with an isolated profile.

Dependencies were refreshed using the repository-pinned toolchain. Corrective
R4/R8 edits and their changed fixtures remain uncommitted; their previous RED
receipts must be refreshed before marking corrective GREEN evidence. Personal
plugin activation, exact-head reviews and CI, PR ownership of corrections,
deferred R7 proof, and full acceptance remain outstanding. The last pre-main
full census still had one failure and 541 undefined scenarios; no new full
census has been run since integration.

Root generation verified all five surfaces; installed mirrors passed parity.
The native marketplace installed the current local generated 1.0.0 plugin.
Its copied runtime and the generated runtime both hash to
`c4a013a6fd6f0f60dfdda8df0f98bec4bd4a5e9f3d4ee6c182c7046a8d760a07`.
Source status reports protected using the 18:18 lifecycle proof, which predates
this replacement. That does not establish activation of the new bytes. The
project plugin-setup skill requires a full Codex restart before resuming and
checking real lifecycle protection. Do not synthesize a new proof or treat
same-version proof reuse as fresh activation.

Post-restart check at 2026-10-05 19:27 UTC reports native 1.0.0 protection
with fresh lifecycle evidence recorded at 19:27:45 UTC. The activation blocker
is resolved. The active edit gate correctly requires fresh phase admission.
Scenario review `dd1c3ce9-1d88-48f0-a2ff-24574088048a` approved with warnings;
its confirmed reviewer was Claude `claude-opus-5-5`, with reduced independence
because author capability was unknown. Recording only the review ID was
insufficient: admission also compares the stamp's author, reviewer, and achieved
independence against the authenticated receipt. Recording those actual fields
made scenario admission pass. Implementation and Execution approval remain
stale and are being refreshed through the installed coordinator.

Owning PR3 quality review `f4a6620c-b0de-44bd-a717-770d88502df2` approved the
duplicate-target correction without errors. Its optional positive CLI case and
spelling/help suggestions remain nonblocking. The commit hook rejected the
temporary iterator spread under `unicorn/prefer-iterator-to-array`; use
`Array.from` to retain supported runtime compatibility. The attempted edit was
blocked before application by stale phase admission. No hooks were bypassed.

Current blocker after restart: scenario review
`9916ac23-6d0d-4050-85a3-034097efcf28` requests the inherited R9 downstream
canonical-contract invalidation proof. Neither the proposed two outline rows
nor the return to `scenario-gate` was applied: the implementation-exit gate
requires coverage of every branch change. Scoped cross-agent quality review
`c92994f8-4a03-41b3-9f07-00bc08ec7796` approved, but its phase stamp was
rejected for incomplete coverage. A supported coordinator attempt with all
621 current work files returned `REVIEW_PACKET_TOO_LARGE` (64-file limit).
The parent reconciliation was completed only after inspecting the main diff:
the parent adds an explanatory persona-inventory label, with no changed Rules
or outcomes. No guard was weakened. A checked, unapplied temporary config patch
at `/tmp/4200-one-time-scenario-return.patch` excludes only the `implement`
exit from reviewGate. User approval is requested solely to apply it, return
to scenario repair, and immediately restore the original config before other
edits. Earlier approving phase receipts are historical evidence, not current
coding authorization; ticket progress notes and parent reconciliation changed
their bound ticket identity. PR3's four-file correction remains staged and
uncommitted after the lint rejection; the root corrections remain uncommitted.

### 2026-10-05 — approved assertion and context-proof corrections

The user explicitly approved exact-code test updates and stronger context-delivery
checks. PR2's three inherited prefix assertions now require the current typed
refusal, phase, and contract path; all 17 targeted tests and type checking pass.
Fresh external Claude review `2d36d7bf-7d18-42ec-9b6a-baa11f4fbdb2` approved.
The correction is pushed to PR2 and carried into PR3, PR4, and PR5.

Positive R2 checks now verify each required role's actual current source content
in the reviewer packet. All nine in-process scenarios pass. Fresh external Claude
review `cdb430be-63d7-4b6a-ac10-c938b33c6c9d` approved the step corrections.
Installed fixtures isolate the Claude profile, invoke the copied native Claude
plugin, and retain valid principles lineage in negative cases.

The installed Execution Plan positive case remains failing: its Codex model is
not admitted by the checked-in conformance matrix, which admits only Claude
`opus`. A live Codex conformance probe failed before returning review output;
no admission evidence was fabricated. The current feature-wide result remains
55 passed, two failed, and 118 undefined before these focused corrections;
no full acceptance rerun or stack-readiness claim is made. The confirmed inherited
approval-reuse failure and deferred R7 proof remain open.

### Qualification scoring and input integrity — 2026-10-06

Applied the human-approved three scoring corrections from
`/tmp/4200-qualification-three-scorer-corrections.patch`. The targeted static
suite passes 59/59 (`/tmp/4200-approved-scorer-static.log`). Required verdicts,
destinations, obligation names, and null rejection records remain checked.

Current-byte Claude review `d6bd14e8-df5c-4cad-b73d-67ec5f2d023c`
requested changes: qualification scenario inputs expose the private expected
verdict/finding labels. The previous 51/63 live result and focused probes cannot
support model admission. Prepared, but did not apply,
`/tmp/4200-neutral-qualification-scenarios.patch`; explicit approval is pending
for neutral accepted-behavior inputs in both review paths, bound into the corpus
digest. Fresh complete qualification is required after that correction. No
model admission, epic completion, PR promotion, or merge is claimed.

### Approved neutral qualification inputs — 2026-10-06

Human approval applied the neutral-scenario patch. Both direct and installed-CLI
paths now send `accepted_scenario`, not private case verdict/finding labels.
All 63 cases have one Feature header; cases sharing accepted implementation
context share the same scenario input. The neutral corpus is digest-bound.
Targeted static checks pass 59/59, typecheck and lint pass, and Claude current-byte
review `b0c222b9-62db-4185-b622-1a0eebc2cdd2` approved with advisories.

The complete fresh Codex run uses the neutral corpus digest
`8a85a5e43cf211a8232ec0ce36a7784a120990ac4ba41306c8ffb8a12114dab3`.
Its first three positive failures identified the same incomplete response-proof
mechanism: selected-field comparisons allow corruption of the supplied summary
or evidence. Within the approved task/detail repair scope, commit `d47d165bf`
adds distinguishing values and whole-judgment equality at both accepted response
boundaries to the shared approval and rejection tasks. Claude review
`10c7a3f1-db6e-4c92-9473-86f530bcf8bd` approved the repaired current files with
nonblocking advisories. The already-running matrix retains its loaded earlier
inputs and is diagnostic only; it will not be rebound to the repaired corpus.
Fresh complete runs remain required. PR4 current-head full CI was explicitly
dispatched as run `37484286149`; completion is not yet claimed.

### Current qualification and stack evidence — 2026-10-06

PR4 full CI run `37484286149` succeeded at `5696a899fb`. PR4989's
four targeted root features passed all 145 scenarios and 6,769 steps;
bounded current review `4100530c-909e-436f-aa96-8c3ed60a23fe` approved.
Its local evidence commit `82480bf55` remains unpushed.

The obsolete neutral Codex matrix stopped with 12 passes, 12 failures, and
39 unrun cases. Sleep disrupted the next focused run (two passes, three
failures). The awake focused run had two passes and two failures: the
missing-completion case was incorrectly approved, and the accepted-data case
was correctly approved but rejected by an exact-name oracle missing periods.
Human approval corrected those decision names in `09d0ec3de`; static tests
passed 59/59 and current review `d9da3e29-0461-4757-853c-6aaa3da56dab`
approved. Independent review `8d84c5a7-7f47-43ad-8bf9-0bd67a034bbf`
confirmed that the missing-completion case remains a valid rejection.
Codex is not qualified; none of these partial runs supports admission.

Fresh Claude qualification rejected the first positive case because its
documentation task omitted accepted denial, activation, and rollback content
and asserted only exit zero. The failure is retained in
`/tmp/4200-neutral-claude-live.log`. The obsolete-input run was interrupted
(exit 130), and the shared documentation tasks were repaired within the
approved fixture-detail scope. Expected verdicts and findings are unchanged.
Fresh complete qualification remains required. The last epic acceptance result
remains 56 passed, one failed, and 118 undefined; the 148 RGR records,
legacy approval-reuse gap, deferred R7 proof, and final stack evidence remain
unfinished. No completion, promotion, or merge is claimed.

Current independent review `869e9fe5-3cb0-421b-af50-d5a59d298062`
requested changes because the two CLI-placeholder negatives had unrelated
obligation/proof scope gaps. Human approval applied
`/tmp/4200-isolate-cli-proof-negatives.patch`: both now inherit the valid
edited-plan baseline and its matching accepted scope, changing only their
named placeholder detail. Required verdicts and finding terms are preserved.
Static verification is queued behind another checkout's live package lock;
fresh independent review and complete live qualification remain pending.

Fixture repairs committed as `804922166`. Typecheck passes; the targeted
conformance suite passes 59/59 after the shared test lock released.
Committed-source review `4a7a38cd-a2af-491a-829c-5a932723cfce` approved
with nonblocking negative-fixture ambiguity and stale-admission advisories.
The focused Claude sentinel checks the repaired coherent-change positive,
missing completion, and both CLI placeholder negatives. It is diagnostic;
all 63 current cases are still required for admission.

The focused Claude sentinel passed all four selected cases (60 filtered,
not completion evidence). The next full run completed seven cases: five
passed and two timed out at the 120-second attempt limit; 56 remain unfinished
in that interrupted diagnostic (exit 130). The original log and
`/tmp/4200-claude-120s-interrupted-summary.json` retain both failures.
No partial results are used for admission. Runtime inspection confirmed
headless isolation and the existing configurable foreground attempt ceiling
of 210 seconds. A single fresh full matrix now uses that supported limit,
with unchanged semantic scoring, source corpus, model, and authentication.
This is run configuration only; no production deadline change was made.

Correction: the live harness calls `reviewTimeoutMilliseconds({})`, ignoring
the supplied timeout environment. The purported 210-second run actually
retained the 120-second limit. It completed seven cases (six passed, one
timeout), with 56 unfinished when interrupted (exit 130); its original log
and `/tmp/4200-ignored-timeout-diagnostic-summary.json` retain that failure.
The prepared one-line `/tmp/4200-live-timeout-configuration.patch` makes
the harness honor the existing runtime configuration without changing any
semantic assertion or production behavior. Explicit test-change approval is
pending; no qualification or model admission is claimed.

Human approval applied the timeout runner correction in `677042d97`.
Typecheck and all 59 conformance tests pass. Independent review
`94de4d37-63b1-4749-a70b-d9397397f591` approved with nonblocking advisories.
The runtime reports 210,000 ms under the configured environment. A fresh
complete qualification matrix is running with unchanged corpus digest
`3da40ba3ac1d8ecf492a5b43571fa317a973549febb31e1ff040a76c4e2d995a`.
Its first case passed after 120.3 seconds, beyond the old cutoff. This single
pass is not admission evidence. PR4989 evidence commit `82480bf55` is pushed;
its pre-push suite passed 895/895.
