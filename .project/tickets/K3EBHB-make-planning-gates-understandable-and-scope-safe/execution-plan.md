# Execution Plan: Make planning gates understandable and scope-safe

**Status:** planned
**Prepared on:** 2026-11-19

## Approval context

Implementation Plan digest `bb9d412dce262da1afca08ee2861f24c240402f9bfbd8b70647522ffde3a1764` was approved by Codex in a fresh context with reduced independence, receipt `45908c68-ed0d-4349-830b-b07994f4c4fb`. The installed approval command recorded `not-required` with the design approval gate off. Tests of enabled approval use disposable projects. Delivery behavior and proof below are target work. The earlier scenario and design receipts provide planning evidence only.

## Pull-request slicing

**Decision:** one pull request

**Rationale:** Review the producer-to-display contract end to end in one PR. Shipping any of the currency producers, projector copies, or native adapters separately would give builders inconsistent recovery for the same stop. The installed tests isolate currency, handoff and adapter behavior within that PR.

## PR 1 — Explain planning recovery from authoritative outcomes

- **Purpose:** Give the builder one recovery action at every accepted stop or wait.
- **Boundary:** Currency and approval binding through their existing owners, shared projection, supported adapters, proofs and docs. Promotion, scope and dispute authority stay with their producers.
- **Prerequisites:** none. The real producer and human verification inputs below are required before accepting delivery.
- **Proof:** `currency`, `blocks`, `authority`, `local-hosts`, `cloud-hosts`, `walkthrough`, `guidance`.
- **Completion signal:** The same supported stop has the same first action and authority in the CLI and installed adapters. Both skew directions preserve safe outcomes. The matched build has real producer, cloud and walkthrough evidence before YCFFNC activation.
- **Relies on an unmerged successor:** no. Merge the matched CLI and adapters together after the evidence is available. Leave coordinated activation under YCFFNC and hold approval-dependent work if a binding-capable reader is unavailable.

### Tasks and tests

1. **RED before production edits.** Add `K3EBHB R8 currency` to `packages/cli/tests/integration/execution-upstream-planning-context.test.ts`. Extend the existing installed CLI fixture with authenticated reviews of both plans and enabled approval recorded through the real terminal approval fixture in `plan-design-approval.test.ts`. Clone the accepted fixture per case. On the control, invoke installed review status for each review and the approval owner's currency check with identical inputs. Require both statuses approved and approval current. In the first negative, reorder two independent work items while preserving their stable IDs, dependency edges, approach bytes and existing approval. Invoke the same checks and require execution review stale, approach review current, approval current, and one action to review the revised Execution Plan with ordering as the cause. In the paired negative, change the canonical approach review contract and reconcile the installed copy to it. Require both reviews stale and approval renewal as a consequence after the sole action to review the approach under the changed rules. Run `currency`. Record the passing control and failures of the new cause/action assertions, with the actual stale checks reached. A setup, parser or fixture failure does not count.
2. **GREEN currency.** In `planning-context-identity.ts` and the authenticated review job path, compare bound behavior, approach and canonical rule facts at the currency owner. Persist the ordered stable work-item IDs and dependency edges in the existing job. In the approval owner, use the serialized append for versioned plan/review identity and authenticated job reference, with no legacy mirror. Add `currency` cases for behavior with identical approach bytes, changed approach bytes, proof-only execution edits, combined behavior and reconciled canonical changes, and legacy incomplete jobs. Assert exact affected layers, precedence and approval consequences. A proof-only edit cannot claim reordered work. Exercise an installed edited copy against a reconciled canonical change. The former leads with reconciliation, and changed behavior on a reconciled build leads with revising the approach. Use the approval suite to show that fresh review alone does not renew approval and that legacy readers skip the new approval event even with matching plan bytes. Re-run `currency` and `authority` after projection is wired.
3. **RED/GREEN block projection.** Add `packages/cli/tests/integration/planning-recovery-blocks.test.ts` using the installed-copy admission and execution-journey fixtures. Delete the contract, corrupt a copy with the canonical digest unchanged, make required guidance unreadable to the command actor, omit the Execution Plan and exercise unresolvable CLI and unavailable owner-check paths separately. Run `blocks` before wiring. Expect failures for missing or duplicate primary actions while the existing code and deny outcome remain visible. Implement the dependency-free v1 projector and adapt existing CLI and hook presentation. Assert problem, consequence, one named recovery, preserved code/exit/deny and continuation. With authorized mismatch diagnostics require digest and review ID after the primary action under Technical details. Include a shareable-output case with private details withheld, sanitized display labels, and unknown facts falling back to the nearest verified artifact or owner.
4. **RED/GREEN handoff.** Add `K3EBHB authority` cases in `plan-design-approval.test.ts` using the real CLI command, PTY and headless fixture. Run `authority` with enabled fixture approval pending, named and unspecified approvers, a retry, and capable/legacy reader-writer pairs. Require one request to send the named reviewed approach to the approver, or to identify the approver when unknown. Require prompt return and retained pending state in headless output, with no new decision appended on retry. Wire promotion from 3EG00H's committed facts for behavior, shared authorization and proof-boundary choices. Preserve investigation and historical failing/passing proof, expose the correct decision and resume place, and keep historical proof's earlier authority. Exercise the actual 5F5ZZA pending scope and declined-disposition paths and 26FK42 pending dispute through their owners. Render the exact requested human decision without recording one. At the coordinator exercise admitted #6786 fallback through an authenticated result, showing actual reviewer and reduced independence with inspection of result and limits as the only action. Place fixture-backed development checks under a separate test name that does not match the `K3EBHB authority` delivery selector. Require the delivery cases to call each actual producer and fail with the missing producer named if any is unavailable or replaced by a fixture, leaving both checklist items open.
5. **RED/GREEN installation and parity.** Add `packages/cli/tests/integration/planning-recovery-native.test.ts` using existing host profile isolation and dispatch setup. With the same typed results, first expose CLI/adapter mismatch, duplicate CLI-projected text or absent local fallback. Register the generated standalone hook template in schema, generate it byte-identically from the CLI projector, sync dogfood through CLI reconciliation, check mirrors, then run `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts --fix` for Cursor wrappers, historical catalogue before both plugin bundles, and lifecycle fixtures last. Inspect any changed lifecycle result digest before proceeding. Run `local-hosts` on the bundled CLI, installed Claude lifecycle hook, profile-scoped Codex plugin and Cursor project hook. Drive every recovery category through the real adapters and compare action, target, authority and native envelope. At each dispatch, drive real absent-plan and pending-approval checks. Exercise old hook/new CLI and new hook/old CLI, unknown fact versions, and hook-owned stops with no CLI text. Require one local recovery where facts support it and the existing outcome in all cases. Retain the narrower confidence limit for adapter parity.
6. **REFACTOR and docs.** Remove duplicate presentation branches after the behavioral proofs are green. Keep owner facts and machine continuations intact. Update website planning, troubleshooting and host guidance and the README workflow section. Document missing steps, one-action handoffs, clearly labeled fallback and diagnostic placement, supported versus advisory hosts and ownership of human decisions. Add `packages/cli/tests/integration/planning-recovery-documentation.test.ts` to follow the documented commands in disposable installed projects and assert the instructions match the resulting actions and outcomes. Run `guidance` against the website source content and the recovery outputs before the PR is ready.
7. **Real delivery verification.** Run `cloud-hosts` in fresh Claude Code Cloud and Cursor Cloud Agents environments with the matched build, installed project hooks and separate absent-plan and pending-approval projects. Capture exact build/revision, dispatched event, result envelope, single named recovery, retained approver and approach in reviewable output, and returned control. Run `walkthrough` once actual installed producers are available. An actual Non-Technical Builder sees only the primary message for each of the seven R10 categories and identifies the problem, one action and its named artifact or actor, and any unresolved authority. Include jargon-only and two-action rejections as controls. Record the participant's responses without private reviewer material. Missing producer cases, unavailable real hosts or incomplete walkthrough keep verification open.
8. **Release and recovery.** Run the targeted commands below, `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts`, then `scripts/dev bun run test` sequentially. Any wrong owner, lost stop, competing action or failed walkthrough pauses YCFFNC expansion. Retain receipts and decisions on recovery. Reconcile to a matched known-good bundle only when approval-dependent work retains a binding-capable reader and pending disputes retain a capable reader. Otherwise pause affected work and recover forward. Verify both reader/writer skew directions with the approval owner before enabling versioned writes in the matched release.

## Obligation ownership

| Accepted obligation | Owning PRs |
| --- | --- |
| R7 block, installed reconciliation, unreadable guidance, missing execution steps, authorized diagnostic detail and safe fallback | PR 1 |
| R8 behavior, approach, execution and canonical review changes, precedence, proof-only and legacy cases | PR 1 |
| R9 real promotion with decision and resume phase, preserving investigation and historical evidence | PR 1 |
| R10 real approval, scope, dispute, fallback and comprehension, including local and fresh cloud surfaces and rejection controls | PR 1 |
| Existing authority, serialized versioned binding, payload compatibility, diagnostics access and safe retry | PR 1 |
| Canonical projector, generated template and installed adapter wiring and skew | PR 1 |
| Website and README guidance, rollout signals, matched activation and safe recovery | PR 1 |

## Deferred scope ownership

- 3EG00H owns promotion and task classification. 5F5ZZA owns scope authority and declined disposition. 26FK42 owns dispute routing and disposition. G1C9PP owns human approval authority. YCFFNC owns coordinated activation. Their outputs remain verification inputs where required. PR 1 owns exercising and presenting those outcomes.
- OpenCode CLI, TUI and Desktop delivery and proof belong to #7491. Codex Cloud stays advisory. Guide migration, execution decomposition, plan contract identity changes and mixed-version dispute protection remain outside local scope.

## Decision accounting

- Present one recovery from typed owner facts: unchanged.
- Explain review currency from the existing comparisons: unchanged.
- Render handoffs from established authority and retained evidence: unchanged.

Each command is planned at repository root. Create the named test files and smoke harnesses in the steps above. In step 7, create `packages/cli/scripts/verify-planning-recovery-cloud.ts` to dispatch the prepared fixtures on both fresh hosts through their configured launch paths and collect revision-bound native results. Create `packages/cli/scripts/verify-planning-recovery-walkthrough.ts` to present the outputs obtained from actual installed producers to the participant and record their responses against the current revision. Both commands fail if a required host, producer, observation or participant response is missing. A fixture-only or capture-only substitute cannot close those items.

## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
| currency | command | integration | Installed review currency and approval owner over reviewed disposable projects | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/integration/execution-upstream-planning-context.test.ts","-t","K3EBHB R8 currency"]} |
| authority | command | integration | Installed CLI and PTY or headless approval authority plus real promotion, scope, dispute and fallback producers | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/integration/plan-design-approval.test.ts","-t","K3EBHB authority"]} |
| blocks | command | integration | Installed CLI stops, owner availability and authorized diagnostics | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/integration/planning-recovery-blocks.test.ts"]} |
| local-hosts | command | E2E | Matched installed CLI, Claude, Codex and Cursor dispatch, and mixed-build recovery | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/integration/planning-recovery-native.test.ts"]} |
| cloud-hosts | command | E2E | Native dispatch of missing-plan and pending-approval stops on both fresh cloud hosts | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/verify-planning-recovery-cloud.ts"]} |
| walkthrough | command | E2E | Actual Non-Technical Builder interpreting all required primary messages from installed producers | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/verify-planning-recovery-walkthrough.ts"]} |
| guidance | command | integration | Delivered website and README instructions compared with the installed recovery flow | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test","tests/integration/planning-recovery-documentation.test.ts"]} |
| generated | command | integration | Generated bundle and template freshness | partial_or_structural | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-generated-surfaces.ts"]} |

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| outcome-scope | outcome and scope | All R10 messages give the builder one understandable action at the actual stop or wait | contributor | walkthrough | open | missing | | |
| resolved-decisions | resolved decisions | Preserve the review set and human renewal consequence for each supported invalidation | contributor | currency | open | missing | | |
| pr-decomposition | dependency and pull-request decomposition | Ship one matched CLI and local adapter slice with native dispatch passing | contributor | local-hosts | open | missing | | |
| testing | testing | Demonstrate the order-only and canonical-rule cases against the unchanged passing control | contributor | currency | open | missing | | |
| data-compatibility | data and compatibility | Preserve earlier decisions, verify versioned approval binding and both reader/writer skew directions | contributor | authority | open | missing | | |
| monitoring | monitoring and failure signals | Preserve real stop and stable structured signal when facts are unknown or checks are unavailable | contributor | blocks | open | missing | | |
| security-privacy | security and privacy | Keep private diagnostics out of shareable output and separate authorized details from the primary action | contributor | blocks | open | missing | | |
| rollout-rollback | rollout and rollback | Prove matched and skewed native dispatch before YCFFNC activation and preserve capable readers for pending work | contributor | local-hosts | open | missing | | |
| documentation | documentation | Ship recovery, host limits and human authority guidance matching the installed outputs | contributor | guidance | open | missing | | |
| ownership-dependencies | ownership and human dependencies | Verify handoffs against the actual promotion, approval, scope, dispute and fallback owners | contributor | authority | open | missing | | |
| walkthrough-participation | ownership and human dependencies | Participate in the seven-case comprehension walkthrough | human | | pending_human | missing | | Non-Technical Builder participant needed |
| completion-evidence | completion evidence | Capture current-revision fresh-cloud dispatch and recorded pending handoff on both supported cloud hosts | contributor | cloud-hosts | open | missing | | |
