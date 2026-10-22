# Execution Plan: Finish the bounded #5139 planning-review continuation

**Status:** planned
**Prepared on:** 2026-10-21

## Pull-request slicing

**Decision:** one pull request

**Rationale:** This is the remaining PR 5 boundary over merged main, not the old
five-PR stack. Scope/persona judgments, their typed evidence, installed-rule
currency, and reviewer qualification all bound one planning-review authority
decision and must agree in the shipped runtime and generated guidance. Splitting
the prompt/schema/currency carriers would leave that boundary inconsistent.
The complete prior sequence is preserved in
[the historical execution-plan archive](evidence/5139-current-main/execution-plan-historical-sequence.md.gz).

## Current state and evidence limits

Main `9f6ac6fce` already implements the contract, context, disposition, approval,
and authenticated fallback repairs. They remain binding; they are not new work
or an unmerged prerequisite. Candidate source and bounded earlier proofs exist,
but packet diagnostics, the lint refactor, and skipped-only fallback refusal
still need correction. No final-head verification is claimed.

The erroneous R2 Execution inventory was restored to main and reviewed. The
Implementation Plan is approved as a reduced-assurance Claude review; review
approval is not human design approval or feature completion.

The historical missing RED, GREEN/REFACTOR SHA collision, six failures, 585
unfinished checks, and 33 deferred/unverified cases remain unchanged. The
54-scenario ledger remains open; this continuation does not close the parent
feature. Two complete capability collections and one exact-Claude conformance
case are retained. Interrupted conformance runs produced no complete matrix.
See the frozen [qualification record](qualification-5139.md); current delivery
observations belong in verification records and checklist progress cells.

## PR 1 — Keep the remaining planning-review authority bounded

- **Purpose:** Make the accepted remaining judgment boundary usable and testable without overstating its evidence or fallback authority.
- **Boundary:** Accepted-scope/persona judgment instructions, typed plan/verdict evidence, bounded trusted-package currency, and stricter explicit-selector qualification. Preserve main context, disposition, approval and fallback behavior. Exclude #5486 implementation, #5857 recovery, historical ledger repair, merge and Ready promotion.
- **Prerequisites:** Merged main `9f6ac6fce`, the restored scenario review, and the current approved Implementation Plan; no unmerged predecessor.
- **Proof:** Packet/provider/installed-runtime integrations, current sealed capability verification, current-input Execution conformance observations, normal and release regression checks, and separate source/test review with actual assurance disclosed.
- **Completion signal:** Push a Draft PR containing the bounded implementation and truthful verification evidence. Report any unresolved failure or missing qualification as a Draft blocker. This does not establish complete-feature acceptance.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. Preserve the current official shared plugin and the approved plan inputs. Do not activate this candidate profile-wide. The supported project-only baseline reconciliation keeps development gates consistent; final mirrors are regenerated separately.
2. RED: Replace the vacuous evidence packet fixture with an owned ticket and a successful complete-record control. Remove only `security_limit` and require the named PlanEvidenceRecordV1 diagnostic. Run `scripts/dev bun run test tests/integration/planning-evidence-boundary.test.ts`; retain the intended diagnostic failure.
3. RED: Strengthen route-order cases so every unknown/weak explicit selector refused before launch leaves zero actual independent attempts blocked, with neither candidate nor fallback inference. Retain a paired case where an actual failed independent attempt and stronger-route exhaustion permit ordered fallback. Run `scripts/dev bun run test tests/integration/planning-review-route-order.test.ts tests/review/job.test.ts`; preserve actual failure output.
4. GREEN: Use a typed packet error for invalid plan evidence and preserve actionable missing-field diagnostics. Keep preflight refusals as typed skipped evidence, but require an actual attempted independent route failure for fallback and continuation admission. Add no new recovery mechanism.
5. REFACTOR: Extract packet evidence validation to satisfy the existing complexity limit; keep behavior unchanged. Commit RED, GREEN and any refactor distinctly where possible, recording these new observations without filling historical ledger gaps.
6. Resolve the existing test-review findings: remove duplicate keys in fake provider scripts, use the frozen historical weaker catalogue only as a negative control, retain current sealed reconstruction, pin unknown classifications, and assert the positive repeated Execution dispatch. Run the boundary and core proof commands below.
7. RED/GREEN: Add `tests/integration/execution-plan-checkpoint.test.ts` with a Bun child that writes case checkpoints through `tests/fixtures/execution-plan-live-checkpoint.ts`, then exits by SIGKILL before file teardown; the parent must still read the exact completed results and raw outputs. Wire the atomic writer after every live case, writing raw output before the result commit marker. Also observe a readable partial matrix while the live file is still running. Set/restore profile once per file, use each case's local assertion context, and retain contract/corpus/requested/confirmed model provenance without changing the verdict oracle or corpus. Run checkpoint-proof before paid collection. The initial collection exposed a harness timing error: full approval records exceeded its two-minute foreground limit. For direct live probes use the existing bounded background-review budget through `reviewTimeoutMilliseconds({ SAFEWORD_REVIEW_WORKER: '1' })` and set that worker timing context once per file; do not change production ceilings. Record the new attempt budget. Add a free replay mode (`SAFEWORD_EXECUTION_PLAN_REPLAY_PATH`) that loads archived raw responses and runs the current assertions, with no reviewer call or profile activation.
8. Use one Vitest process at a time, with at most three concurrent case calls. Reuse both complete capability collections after seal verification. Verify that the preserved first Claude case has unchanged inputs and passes free replay under the current oracle. The stopped two-minute attempt retains 18 completed observations: 14 passing and four timeouts, with the incomplete remainder unproven. Keep that entire attempt immutable. The test-only `SAFEWORD_EXECUTION_PLAN_RETAINED_RESULTS_PATH` may seed only its passing observations after checking contract/corpus digests, requested and confirmed model identity, unique known case IDs, and current-oracle free replay. Before any paid dispatch, reject a mismatched retained input; prove this with checkpoint-proof's metadata-mismatch case. Keep retained-source hashes and their earlier timing limit distinct from new collection timing. Collect only cases without a verified pass plus the complete Codex matrix; no failed or absent observation becomes a pass. Do not repeat unchanged retained observations.
9. Implement the execution-only verifier `.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/verify-conformance-evidence.ts` and run admission-proof below. Verify the retained gzip/manifest SHA, the first result's single passing `one-coherent-change` identity and selector, and unchanged prompt/schema/corpus/delivery inputs against immutable checkpoint `f821a6689` using `git diff --exit-code` on those inputs. Preserve the first observation's original provenance limit; do not manufacture a retrospective confirmation. Check both new matrices' metadata digests against `executionPlanConformanceDigests()`, selectors/confirmation, complete unique case IDs and pass results. Decompress the verified first result into `.project/tmp/5139-first-case-verified.json`, then invoke `scripts/dev bun packages/cli/scripts/generate-execution-plan-admission.ts --results .project/tmp/5139-first-case-verified.json --results .project/tmp/5139-claude-remaining.json --results .project/tmp/5139-codex.json`. Expect two complete 63-case identities and the current contract/corpus digests, followed by the generator's complete-passing-matrices success. Any mismatch exits nonzero before generation; missing or failed observations never become passes.

   The immutable input comparison names `packages/cli/src/review/runtime.ts`, `contract.ts`, `evidence-record.ts`, `review-rubric.ts`, `quality-rubric.generated.ts`, `execution-plan-rubric.generated.ts`, `execution-plan-conformance.ts`, and `packages/cli/src/execution-plan/delivery-checklist.ts`; review-directory shorthand names resolve under `packages/cli/src/review/`. The verifier also compares the `packetFor` constructor with the retained checkpoint. A mismatch blocks first-case reuse; it does not rewrite the original observation. Check the first-case manifest entries against the same entries committed at `f821a6689`, rather than treating a neighboring manifest as independent authentication. Decompress the checksum-checked raw first response, invoke this same live test file in replay mode with only `one-coherent-change` selected, and require the replay result to pass the current oracle before admission. Replay the 14 retained passing responses likewise before seeding new collection. These are free assertion runs, not fresh model confirmation or semantic observations.
10. Carry forward current main's `a3c216940` Claude skill-normalization repair before final generation, preserving the `f821a6689` evidence ancestry rather than rewriting it. Main's planning prompt/corpus inputs are unchanged by that repair. Regenerate all five surfaces with `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts --fix`, inspecting any lifecycle behavior change. Preview dogfood using `scripts/dev bun packages/cli/src/cli.ts plan install --agents cursor,codex --no-modify --json --no-input`; require project-local file effects only, with no profile/configuration/package/network/destructive changes. Apply the matching `install --agents cursor,codex --no-modify --json --no-input` invocation only under that boundary, restoring derived mirrors without activating this candidate profile-wide.
11. Update only the affected planning sections of `README.md`, `packages/website/src/content/docs/getting-started/workflow.mdx`, and `packages/website/src/content/docs/reference/configuration.mdx`: declared evidence limits and their authority, bounded currency versus whole-copy use, explicit-selector refusal/recovery, all-skipped blocking, retained runtime-default behavior, phase-owned approval meanings and the unchanged advisory host boundary. Keep main's existing flow and exclusions; do not introduce broader recovery work.
12. Run docs-proof against those three delivered files and the coordinator's refusal behavior. Require consistency with the implementation and accepted approval/host boundaries. Keep K3EBHB's NTB comprehension proof deferred rather than claiming it from a text review.
13. Run generated-surface verification, typecheck, lint, the normal full suite and release checks. Record real commands, source revisions and failures. New source changes require the relevant checks again; ordinary evidence progress does not authorize unrelated work.
14. Review the final source/test delta separately, using retained qualification evidence and scope limits. Address material findings. Supply complete sealed review material in bounded read chunks before judgment; a truncated transport is a failed review, never approval. Read the complete final diff, push the branch and create/attach a Draft PR with current-head evidence. Do not merge or mark Ready.

## Obligation ownership

| Accepted obligation | Owning PRs |
| --- | --- |
| Scope/persona judgments, typed evidence, trusted-package currency and explicit-selector refusal | PR 1 |
| Preserve main R1–R6/R9–R11 contract, context, receipt, approval and fallback behavior; do not reimplement merged slices | PR 1 |
| Preserve R7 and R12–R16 authority and reuse limits while recording the bounded semantic proof and its confidence limit | PR 1 |
| Exact defaults, generated carriers, rollback compatibility, documentation, failed evidence retention and Draft handoff | PR 1 |

## Deferred scope ownership

- #5486 owns durable concurrent-worktree candidate activation. Its investigation was recorded separately; no isolation product change enters this PR.
- #5857 recovery implementation is excluded.
- YCFFNC owns native OpenCode qualification and coordinated activation; R6/R8/R9 native-host claims remain unproven here.
- K3EBHB owns final Non-Technical Builder wording/comprehension proof; G1C9PP owns the parent focused-reviewability measurement.
- 7CAMAD owns Execution decomposition and coding authorization. This continuation consumes its merged contract.
- Historical full-feature proof gaps remain in their original ledger; this plan neither repairs nor marks them complete.

## Decision accounting

- Proposed: judge persona outcomes and accepted scope in the existing phase verdicts.: unchanged.
- Proposed: keep typed plan evidence separate from verdict evidence.: unchanged.
- Proposed: read bounded installed canonical rules for currency and keep exact whole-copy integrity for use.: unchanged.
- Proposed: refuse unqualified explicit selectors before launch on the supported verified-author path.: unchanged.
- Bind each verdict to its phase's target-plan identity plus exact canonical-contract bytes and semantic context projections, while gating generated copies by exact bytes separately.: unchanged.
- Extend the existing coordinator and review ledger instead of creating a second planning-review subsystem.: unchanged.
- Author shared planning clauses once and generate exact marked copies while keeping phase-only judgment separate.: unchanged.
- Treat semantic projection as a closed domain model, not generic Markdown normalization.: unchanged.
- Record a user-declined optional strengthening in ticket context.: unchanged.
- Classify reviewer capability from sealed empirical pair comparisons and fail closed when comparison is unavailable.: unchanged.
- Admit authenticated reduced-independence receipts without discarding stronger completed evidence.: unchanged.

The live proofs run only for missing current-input observations. Reuse requires
matching digests and selectors; an interrupted run is not proof. Model
qualification is a bounded corpus judgment, not full persona/privacy/native-host
acceptance. Exact confirmation is retained where the adapter provides it; the
preserved first case keeps its original evidence and limitations.

## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
| boundary-proof | command | integration | Packet admission, provider-output parsing, installed-copy currency and use refusal, and no-launch qualification with preserved fallback | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/integration/planning-evidence-boundary.test.ts","tests/integration/planning-scope-review.test.ts","tests/integration/installed-planning-copy-admission.test.ts","tests/integration/planning-review-route-order.test.ts","tests/review/job.test.ts","tests/review/policy.test.ts"]} |
| core-proof | command | integration | Regression through existing context, contract, approval and fallback boundaries | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/review/","tests/integration/planning-review-fallback.test.ts","tests/integration/planning-review-host-gates.test.ts","tests/integration/planning-review-identity.test.ts","tests/integration/plan-design-approval.test.ts"]} |
| capability-proof | command | eval | Verify retained exact-model capability observations and their declared comparison contract without paid recollection | real_boundary | compatible_earlier_allowed | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/reviewer-capability-eval.ts","verify"]} |
| claude-conformance | command | eval | Current requested exact Claude selector against every missing conformance case; combine the preserved first case only after input-digest verification | real_boundary | compatible_earlier_allowed | {"type":"command","cwd":".","argv":["scripts/dev","env","SAFEWORD_RUN_EXECUTION_PLAN_LIVE=1","SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER=claude","SAFEWORD_EXECUTION_PLAN_LIVE_MODEL=claude-opus-5","SAFEWORD_EXECUTION_PLAN_RETAINED_RESULTS_PATH=../../.project/tmp/5139-claude-attempt-1.json","SAFEWORD_EXECUTION_PLAN_RESULTS_PATH=../../.project/tmp/5139-claude-remaining.json","bun","run","--cwd","packages/cli","test","--config","vitest.live.config.ts","tests/smoke/execution-plan.live.test.ts","--sequence.concurrent","--maxConcurrency=3","--reporter=verbose","-t","^(?!.*one-coherent-change)"]} |
| codex-conformance | command | eval | Current exact Codex selector against the complete unchanged conformance corpus | real_boundary | compatible_earlier_allowed | {"type":"command","cwd":".","argv":["scripts/dev","env","SAFEWORD_RUN_EXECUTION_PLAN_LIVE=1","SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER=codex","SAFEWORD_EXECUTION_PLAN_LIVE_MODEL=gpt-6-astra","SAFEWORD_EXECUTION_PLAN_RESULTS_PATH=../../.project/tmp/5139-codex.json","bun","run","--cwd","packages/cli","test","--config","vitest.live.config.ts","tests/smoke/execution-plan.live.test.ts","--sequence.concurrent","--maxConcurrency=3","--reporter=verbose"]} |
| full-proof | command | integration | Complete normal CLI test suite at the final source revision | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test"]} |
| release-proof | command | E2E | Current generated distribution, sealed capability catalogue, exact defaults and native plugin release contracts | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","--cwd","packages/cli","test:release"]} |
| plan-proof | review_receipt | integration | Reviewed current slice and preserved accepted approach | real_boundary | current_required | {"type":"review_receipt","kind":"plan-execution","targets":[".project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/execution-plan.md"]} |
| review-proof | review_receipt | integration | Fresh review of remaining source boundaries, regression oracles, qualification provenance and disclosed limits | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":["packages/cli/src/review/packet.ts","packages/cli/src/review/coordinator.ts","packages/cli/src/review/job.ts","packages/cli/tests/integration/planning-evidence-boundary.test.ts","packages/cli/tests/integration/planning-review-route-order.test.ts","packages/cli/tests/review/packaged-capability.release.test.ts","packages/cli/tests/smoke/execution-plan.live.test.ts","packages/cli/tests/fixtures/execution-plan-live-checkpoint.ts","packages/cli/tests/integration/execution-plan-checkpoint.test.ts",".project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/verify-conformance-evidence.ts"]} |
| checkpoint-proof | command | integration | Completed raw observations remain readable after a live-worker-style Bun process is killed before teardown | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/integration/execution-plan-checkpoint.test.ts"]} |
| admission-proof | command | eval | Verify preserved first-case input/provenance limits, both current matrices and complete combined admission before generation | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun",".project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/verify-conformance-evidence.ts","--first",".project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/evidence/5139-current-main/execution-first-case.json.gz","--claude",".project/tmp/5139-claude-remaining.json","--codex",".project/tmp/5139-codex.json"]} |
| docs-proof | review_receipt | integration | Review delivered README/workflow/configuration prose against actual typed refusal, evidence and authority boundaries; no NTB comprehension claim | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":["README.md","packages/website/src/content/docs/getting-started/workflow.mdx","packages/website/src/content/docs/reference/configuration.mdx","packages/cli/src/review/coordinator.ts"]} |

Additional required checks: `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts`,
`scripts/dev bun run typecheck`, and `scripts/dev bun run lint`.

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| outcome-scope | outcome and scope | Deliver only the four #5139 continuation additions and retain main repairs | contributor | boundary-proof | open | missing | | |
| resolved-decisions | resolved decisions | Implement the approved four additions and retain all inherited main decisions | contributor | boundary-proof | open | missing | | |
| pr-decomposition | dependency and pull-request decomposition | One current-main Draft PR with historical slices separated and no unmerged successor | contributor | plan-proof | open | missing | | |
| testing | testing | Current boundary and regression tests plus honestly bounded semantic qualification | contributor | full-proof | open | missing | | |
| data-compatibility | data and compatibility | Versioned evidence remains in existing plan/job ownership; unsupported readers refuse authority | contributor | boundary-proof | open | missing | | |
| monitoring | monitoring and failure signals | Typed refusal names missing limits or qualified-selector recovery without fictitious review attempts | contributor | boundary-proof | open | missing | | |
| security-privacy | security and privacy | Preserve evidence-as-data boundaries and deny packets to known explicit-selector refusals | contributor | boundary-proof | open | missing | | |
| rollout-rollback | rollout and rollback | Regenerate coherent carriers; rollback preserves main repairs and durable history | contributor | release-proof | open | missing | | |
| documentation | documentation | Keep generated guidance, durable continuation decisions and evidence limits consistent | contributor | docs-proof | open | missing | | |
| ownership-dependencies | ownership and human dependencies | Retain named sibling ownership and historical proof gaps without claiming their completion | contributor | plan-proof | open | missing | | |
| completion-evidence | completion evidence | Publish truthful current-head evidence and separate review in Draft; no merge or Ready | contributor | review-proof | open | missing | | |
| claude-qualification | testing | Current-input remaining Claude cases plus the preserved first observation | contributor | admission-proof | open | missing | | |
| codex-qualification | testing | Current-input complete exact Codex conformance matrix | contributor | admission-proof | open | missing | | |
| catalogue-qualification | testing | Verify retained sealed capability collections without recollection | contributor | capability-proof | open | missing | | |
| regression | testing | Preserve current main boundaries through core regression | contributor | core-proof | open | missing | | |
| release | testing | Current release and generated distribution checks | contributor | release-proof | open | missing | | |
| design-approval | ownership and human dependencies | Obtain configured human design approval | human | | not_applicable | missing | | The supported approve-plan command reports not required under current configuration; no human approval is invented. |

Checklist progress records observed delivery only. Full-feature acceptance,
human authority, merge and Ready promotion are separate and remain unclaimed.
