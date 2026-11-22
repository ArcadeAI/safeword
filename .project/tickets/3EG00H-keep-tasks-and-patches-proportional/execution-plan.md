# Execution Plan: Keep tasks and patches proportional

**Status:** planned
**Prepared on:** 2026-11-21

## First implementation proof

Start with R13 using a disposable enrolled project with a CLI command whose
existing public JSON response is consumed by a checked-in caller. Give the
installed workflow a complete task record that omits an unresolved compatibility
choice visible in the caller and response contract. Assert that installed structural validation reports the exact task record valid before semantic evaluation. Attempt to edit the command
through installed production admission. Assert the edit stops, reevaluation
records feature routing, and the ticket requires both feature plans before a
write. The control changes a private helper under the same declared task shape.
It stays a task and proceeds with its appropriate proof. In a separate fixture,
corrupt the configured breadth threshold. The classifier returns typed
`failed` with exit 1 and the gate denies production. Use the `routing` command
below. The integration fixture supplies current v1 facts derived from the checked-in caller after the simulated discovery event. This isolates policy and admission. The separate live interpretation trial gives the installed host only the plain prompt, inline task and project sources and checks whether it surfaces the omitted choice itself. The first RED is a wrong route or an allowed write, with the fixture and
installed dispatch otherwise working.

## Task proof admission

Next exercise R8 at the installed Safeword CLI boundary. Add an integration test at
`packages/cli/tests/integration/small-work-red-admission.test.ts`. Use a disposable
enrolled project and a small operation whose established entry point makes one
attempt after a timeout. The task's accepted behavior is two attempts. Run with
one working agent and no reviewer route. Drive the installed CLI through its
normal proof and production-edit admission paths. Avoid fabricated run records.

1. Before a test run, attempt the production edit and assert a named block for missing proof.
2. Run a different test that fails with the same text. Verify the real run
   cannot authorize the edit even if a positive finding from a different run is
   submitted. Declare the target test and assertion before execution. Also exercise a test that fails through an entry
   point added in the test change instead of calling the baseline operation.
3. Run the target test through the baseline operation. Its assertion should
   observe one attempt and expect two. Record the result through the installed
   proof path. The working agent compares the pre-test caller and test diff with the
   named test and assertion in the output and submits its relevance finding for
   that observation. Assert that changing only the observation reference or
   the bound test identity denies the edit. A finding tied to the actual
   target observation permits it. For the invented boundary, verify the agent
   locates the symbol only in the new diff and records a negative finding.
   The `hosts` and `cloud` proofs exercise this judgment with no supplied verdict.
4. Run fixtures that print the assertion text during setup and exit nonzero, skip the target test, receive a signal, or time out before reaching the assertion. The production edit remains blocked in each fixture.
5. Make the minimal fixture fix and rerun the same test to observe GREEN.
   Change a bound proof input in a separate fixture and verify that the old run
   no longer authorizes an edit.

Use `scripts/dev bun run test packages/cli/tests/integration/small-work-red-admission.test.ts`
after adding the test. The first RED signal is a mismatch in the installed
admission outcome. A runner or fixture setup error does not count.


## Pull-request slicing

**Decision:** One pull request with ordered, independently testable commits.

**Rationale:** Routing creates the inline state that admission reads. Promotion
and handoff consume that same state. Ship the matched CLI and adapters together
so a contributor cannot enter a route whose proof or handoff is unavailable.

## PR 1 — Carry small work from routing through contributor handoff

- **Purpose:** Let contributors complete a task or patch with inline proof and route consequential decisions into feature planning.
- **Boundary:** R1–R14 on the installed CLI, Claude Code, Claude Code Cloud, Codex, Cursor, and Cursor Cloud Agents. Include docs, compatibility and rollback proof. OpenCode delivery and broad activation are outside this PR.
- **Prerequisites:** none. Begin after coding authorization verifies both approved plans.
- **Proof:** The proof specifications below cover the installed paths, host interpretation, and recovery.
- **Completion signal:** A matched bundle passes all named proofs, including fresh cloud runs, and is ready for the rollout owner.
- **Relies on an unmerged successor:** no. Broad activation remains owned by YCFFNC.

### Tasks and tests

1. RED: Add the R13 cases above using `routing`. GREEN: Reuse explicit ticket creation, add the common classifier and present the accepted scope and caller evidence to the workflow at production admission. REFACTOR: Keep routing precedence in one place.
2. RED: Add the R8 cases using `red`. For R7, omit only the named actor or proof boundary from an enrolled inline task, retaining the proof method and other fields and assert admission denies with action_required and exit 2 while the existing source remains readable for investigation. For R9, change a private normalization helper. The existing public-output test protects the output only if it detects a deliberate wrong result in the disposable control. Record that adequate existing test as protection and assert no new RED or characterization is created. In a separate disposable fixture, deliberately regress the protected result and observe that an import-only test still passes. Reject that test as protection. Require a passing characterization case before the edit. In a third fixture with no existing coverage, create a characterization test and observe it passing before the edit. For a typo patch, record a targeted help-text assertion before the edit and require a passing result at handoff, with no RED. GREEN: Reuse trusted runner execution and bind observations and findings at the production gate. REFACTOR: Keep feature RED review separate.
3. RED: In `routing-policy`, use a table of complete v1 facts with one changed field per row. Multiple flows, new persistent state, unresolved promised behavior, shared contract, durable architecture, data ownership, retention, migration, compatibility and required proof boundary each return feature. Typo plus public contract and mechanical update plus new state also return feature. An eligible patch with residual characteristics returns patch. An unfamiliar settled job that needs new regression proof returns task. All settled route decisions exit 0. Add `routing` cases for a settled one-line public response change, an unresolved retention choice without ownership change, and an unresolved compatibility choice without migration. Each returns feature with exit 0 and requires both plans. A broad mechanical move returns bounded tasks with exit 0. A typo returns patch with exit 0. Inconsistent accepted-source facts stop with action_required and exit 2. GREEN: Materialize each route through the existing ticket creator.
4. RED: In `routing`, commit two private edits and restart the installed session. A third proposed edit blocks and requires reevaluation. A one-file edit affecting two recorded surfaces also blocks for reevaluation. Pair an edit adding a new user flow with an equally small private change. The former routes to feature and the latter stays task. Assert quiet continuation below the threshold and after an unchanged already-evaluated crossing. After a successful evaluation, separately mutate the discovery, accepted scope, thresholds, ticket bytes and policy identity. In each fixture attempt a production write using the prior evaluation. Assert denial until reevaluation on current inputs. At the surface crossing, equivalent private adapter updates retain task while a divergent user flow routes to feature. GREEN: Bind the footprint to the ticket base and enforce current evaluation.
5. RED: In `promotion`, begin with an inline retry task and a bound proof. Changing a private helper sequence stays inline, and private REFACTOR preserves passing linked proof without restarting classification. An irrelevant out-of-scope idea is dropped and the same task continues. Discovering new customer-visible behavior pauses delivery and returns the same ticket to define-behavior. Discovering shared-contract design preserves the ticket and proof and enters Implementation Planning only with current approved applicable behavior. Otherwise restart with the saved destination and advance only after the scenario gate. Exercise pre-RED promotion without proof, post-proof promotion retaining the exact run, plan-execution repair with current design, and an out-of-scope choice that leaves the route task and returns action_required and exit 2 in headless mode. A stale competing write fails without losing prior proof. GREEN: Implement the approved conditional writer and reuse feature phase gates.
6. RED: In `handoff`, deliver the retry task and typo patch. Inspect both inline checklists at entry before the first edit. Blank skips and stale runs keep contributor readiness open. Concrete reasons and current proof resolve contributor-owned items. A named release-owner approval remains pending without blocking contributor handoff. A merge-authority claim is rejected. Assert both file trees lack feature plans and both records preserve their proof. GREEN: Reuse checklist semantics and emit the inline record and headless handoff.
7. Run installed local and fresh cloud proof with the matched bundle. On each supported host exercise actual lifecycle dispatch for route, reevaluation, proof admission and promotion. On all six hosts open the ticket produced by task routing and assert the inline specification names the agreed behavior and existing actor boundary. Inspect the produced patch and task checklists before the first edit. Run the three fresh plain-prompt classification trials per conversational host. Run cloud human-handoff cases through the real hosted runners. Record the exact revision, argv, runner, output and disposition. Pause readiness if a runner or required authority is unavailable.
   For each installed boundary, use the feature file’s R1, R2, R6, R7, R8, R11 and R12
   outline rows as the case matrix. On CLI, Claude Code, Codex and Cursor,
   run both design-only promotion variants. Include the R11 row where current
   behavior approval allows Implementation Planning on the same ticket
   with linked proof retained, and the R12 product-discovery row that
   returns the same ticket to behavior definition. Put both in the
   fixture manifest for each tagged installed host. Complete inline behavior notes
   prepare the scenario review without asking the user to reconfirm. Partial
   notes yield one question about the unresolved behavior and hold scenario
   review. On both real cloud hosts submit the partial-notes fixture and
   assert the invocation returns within the normal hook budget, retaining
   both the pending decision and the pending Implementation Planning
   destination. Verify these local cases with `hosts` and hosted cases with
   `cloud`.

8. Update workflow and ticket guidance, regenerate managed surfaces with `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts --fix`, rerun the checker without `--fix`, and verify mixed-version refusal and rollback with retained evidence. Run the targeted proof commands and full suite sequentially.

### Host fixture setup

Create `packages/cli/tests/fixtures/small-work-hosts` with a checked-in
fixture builder, a scenario-to-fixture manifest and one plain prompt per
installed outline row. The builder creates fresh enrolled Git projects
with the baseline command, caller, ticket, and pre-edit proofs appropriate
to each row. The R12 partial-notes row contains a design discovery and
exactly one unsettled behavior, with no approval. Reuse the same fixture
manifest locally and in both hosted jobs.

Build the candidate CLI with `scripts/dev bun run build` from
`packages/cli` through the root launcher and use that CLI’s install
command in each fixture. Install Claude’s candidate native plugin from
the checkout marketplace in an isolated profile. For Codex use an isolated
profile with `codex plugin marketplace add <candidate-checkout>` and
`codex plugin add safeword@safeword`. For Cursor use the candidate install's
project hooks. Launch in the fixture directory with `claude -p <prompt>`,
`codex exec --json <prompt>`, and
`cursor-agent --print --output-format stream-json <prompt>`. The validated
local host baseline is Claude Code 2.1.326, Codex 0.171.0 and Cursor
2026.11.13-eacade1. Record the effective version for every run and use
local profiles already authorized with each provider. Missing executables,
auth or installed hook approval leave the host proof open and fail the
required verification. Run the standalone CLI through its installed
entry point. Correlate the native tool event and outcome with the
installed hook’s event, runtime identity and fixture ticket mutation.
Synthetic event JSON and a standalone hook process cannot satisfy this
correlation check.

For each cloud job, clone the candidate Safeword checkout at the exact
commit in the provider runner and build the same CLI with the pinned
toolchain. Run the fixture builder from that checkout and install the
candidate CLI and project hooks into its disposable enrolled projects.
Start each manifest prompt inside its fixture through the provider’s
actual agent session. Retain host version, effective Safeword version,
installed runtime digest and job revision. Capture event name and tool
exit status from the provider's native tool trace and correlate them
with the installed hook's result and ticket state. A missing trace,
runtime identity or fixture outcome fails the hosted proof.

Verify documentation with `guidance` by checking delivered README, website,
handbook and supported host text for route, threshold, proof, promotion,
checklist and human authority terms against the installed examples. In
`compat`, install the matched bundle, attempt the same production write with a
missing or incompatible classifier, and assert refusal on capable adapters.
Roll back with an incomplete promotion and verify retained ticket and proof
history without granting new admission. Resume a legacy task within recorded, already-admitted scope, then trigger a consequential reevaluation and assert the new contract applies.

For `interpretation`, record three fresh sessions per conversational host
(Claude Code, Claude Code Cloud, Codex, Cursor and Cursor Cloud Agents) for the ambiguous omitted-trigger task, tiny public contract edit and
broad mechanical move. Capture prompt, supplied facts and actual route at the
installed workflow boundary. Add
`packages/cli/scripts/verify-small-work-interpretation.ts` and record the runs
in `small-work-interpretation.json` in the external evidence directory named
below. Store host, case, native session ID, commit SHA, prompt, supplied facts,
route, disposition and a native transcript or provider-job reference.
Open each local host’s actual session transcript and each cloud provider’s
job record to verify provenance before recording it. Require three distinct
fresh session IDs for every host and case, matching commit and expected
route. The script exits 0 only when all cases and provenance records are
present and the outcomes match. Missing or reused sessions, fixture
transcripts, mismatched revisions, missed triggers and unjustified blocks
exit 1 and block readiness. For cloud, the runner operator starts fresh Claude Code
Cloud and Cursor Cloud Agents jobs from the candidate commit through their
respective hosted launch interfaces. The contributor acts as the runner operator and owns launch and evidence
collection. Use the provider’s existing authenticated interface to launch and
inspect each completed job. Record only sanitized run metadata and native
invocation results in `small-work-cloud.json` in
`../3EG00H-proof-evidence` beside the checkout. Keep collected evidence
outside the checkout so the proof runs against a clean candidate HEAD.
Archive it as delivery evidence after proof and record the candidate commit and each evidence file’s SHA-256 in the checklist evidence. The scripts receive HEAD and
the external evidence file as explicit arguments. Each entry
contains `provider`, `job_id`, `job_url`, `commit_sha`, `completed_at`, `host_version`, `safeword_version`, `runtime_digest`, and per
case `scenario`, `dispatch_event`, `exit_status`, and `observed_outcome`. The
contributor captures these directly from the hosted job and verifies the
provider job page shows the same job ID, candidate commit and lifecycle log.
Record that verification with the provider link. A standalone local export
cannot establish provenance.

Add `packages/cli/scripts/verify-small-work-cloud.ts` for the `cloud` proof.
Give it the candidate revision and evidence path through the proof invocation.
It requires one distinct hosted job per provider, matched candidate commit,
provider job references, verified provider provenance and all expected
outcomes. Missing jobs, absent provider verification, mismatched commits,
fixture-only evidence or missing outcomes fail. For each provider require
every matching cloud-tagged outline row in the accepted feature file for
R1, R2, R6, R7, R8, R11 and R12 plus the R14 contributor handoff, including
R12’s product promotion and partial-notes return. Compare by provider and
scenario row, and fail on missing or duplicate entries. The contributor reviews the
provider records as part of this proof because the local checker alone
validates the record and outcomes, not who produced them.

## Obligation ownership

| Accepted obligation | Owning PRs |
| --- | --- |
| R1–R5 and R13 semantic routing, proportional artifacts and interpretation limits | PR 1 |
| R6 reevaluation through commits, restarts, and surface changes | PR 1 |
| R7–R9 inline task contract, failing proof, preservation, and patch checks | PR 1 |
| R10–R12 inline sequencing, in-place promotion, retry, and human scope decisions | PR 1 |
| R14 inline checklist and local/cloud contributor handoff | PR 1 |
| Supported surface parity, migration, rollback, documentation, and activation evidence | PR 1 |

## Deferred scope ownership

- YCFFNC owns broad activation and coordination of in-flight migration. PR 1 supplies readiness, compatibility and rollback proof.
- OpenCode delivery and the feature-side 7CAMAD demo are outside this ticket.

## Decision accounting

- Semantic classifier and reevaluation: unchanged.
- Inline proof and in-place promotion: unchanged.
- Inline contributor checklist: unchanged.

Existing ticket creation accepts explicit types. Reuse the existing execution observer, feature phase gates and checklist semantics described in the Implementation Plan. Small-work binding, classifier, promotion and checklist admission are target work. Commands for new tests are prospective. The local host integration test launches installed adapters in the live lane. The default suite runs credential-free tests only. Missing hosts or credentials fail the live proof. The separate cloud proof checks the actual hosted job evidence. A simulated runner supplies structural evidence only.

## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
| red | command | integration | Installed CLI production edit admission and real proof execution | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","packages/cli/tests/integration/small-work-red-admission.test.ts"]} |
| routing | command | integration | Installed ticket routing and reevaluation on production edits | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","packages/cli/tests/integration/small-work-routing.test.ts"]} |
| routing-policy | command | unit | Shared classifier decision table | partial_or_structural | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","packages/cli/tests/commands/small-work-classification.test.ts"]} |
| promotion | command | integration | Installed conditional write and feature phase entry | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","packages/cli/tests/integration/small-work-promotion.test.ts"]} |
| handoff | command | integration | Installed contributor readiness and inline checklist | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","packages/cli/tests/integration/small-work-handoff.test.ts"]} |
| hosts | command | integration | Installed CLI and local lifecycle dispatch | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test:smoke:live","packages/cli/tests/integration/small-work-installed-hosts.live.test.ts"]} |
| cloud | command | E2E | Actual hosted lifecycle records and provider provenance for both cloud surfaces | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/verify-small-work-cloud.ts","--revision","HEAD","--evidence","../3EG00H-proof-evidence/small-work-cloud.json"]} |
| compat | command | integration | Installed matched, mixed, and rolled-back bundles | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","packages/cli/tests/integration/small-work-compatibility.test.ts"]} |
| interpretation | command | E2E | Fresh plain-prompt trials on installed conversational hosts | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/verify-small-work-interpretation.ts","--revision","HEAD","--evidence","../3EG00H-proof-evidence/small-work-interpretation.json"]} |
| guidance | command | integration | Delivered documentation and installed examples | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","packages/cli/tests/integration/small-work-documentation.test.ts"]} |
| regression | command | integration | Repository regression suite | partial_or_structural | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test"]} |

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| outcome-scope | outcome and scope | Demonstrate proportional task and patch delivery | contributor | handoff | open | missing | | |
| resolved-decisions | resolved decisions | Check host interpretation against accepted routes | contributor | interpretation | open | missing | | |
| pr-decomposition | dependency and pull-request decomposition | Prove the matched PR can reach contributor handoff | contributor | handoff | open | missing | | |
| testing | testing | Prove solo RED admission and rejection at the real boundary | contributor | red | open | missing | | |
| data-compatibility | data and compatibility | Preserve ticket evidence across retry and rollback | contributor | compat | open | missing | | |
| monitoring | monitoring and failure signals | Observe typed refusal and recovery on installed hosts | contributor | hosts | open | missing | | |
| security-privacy | security and privacy | Reject stale and unrelated proof at admission | contributor | red | open | missing | | |
| rollout-rollback | rollout and rollback | Verify matched installation and safe rollback | contributor | compat | open | missing | | |
| documentation | documentation | Check delivered routing and proof guidance against installed examples | contributor | guidance | open | missing | | |
| completion-evidence | completion evidence | Verify completed Claude Code Cloud and Cursor Cloud Agents jobs at the candidate revision | contributor | cloud | open | missing | | |
| ownership-dependencies | ownership and human dependencies | Coordinate default activation | human | | pending_human | missing | | YCFFNC rollout owner authorizes exposure after reviewing host evidence. |
