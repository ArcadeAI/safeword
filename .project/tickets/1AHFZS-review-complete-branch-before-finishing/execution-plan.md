# Execution Plan: Review complete branch changes before builders finish

**Status:** planned
**Prepared on:** 2026-10-23

## Pull-request slicing

**Decision:** one pull request

**Rationale:** Inventory, signed result, and exit validator express one claim: the reviewed branch scope is known and still current. Shipping one without the others leaves an unguarded command or a gate without truthful evidence. Host wrappers and docs expose that same contract.

## PR 1 — Review and validate the complete branch at implementation exit

- **Purpose:** Give a BDD builder a ticket-aware branch review with honest coverage and a current exit decision.
- **Boundary:** Shared CLI Git inventory, bounded coordinator passes, signed result and acknowledgement, phase gate and four local host adapters, docs and generated mirrors. Generic quality review stays compatible; PR readiness and human review stay outside this PR.
- **Prerequisites:** none; the 22 scenarios and renewed Implementation Plan review are fixed inputs.
- **Proof:** Temporary Git remotes and a controlled reviewer subprocess prove inventory, packets, failed passes, signed results, freshness, acknowledgement and phase writes. One registration-to-gate test per local host proves wiring. The independent branch review judges the meaning of reported findings.
- **Completion signal:** All 22 scenarios pass. Every changed path is reviewed or named as omitted. Current complete or acknowledged partial evidence permits exit; a current `none` result needs a new review-ID-bound reasoned skip and exact disclosure. Stale or absent evidence refuses it. Supported local hosts use the same decision.
- **Relies on an unmerged successor:** no.

### Tasks and tests

1. **RED — real branch scope:** The first focused RED is `packages/cli/tests/integration/branch-review-scope.test.ts`: a temporary remote, feature branch, and independent Git path inventory expose the missing `review branch` command. Extend the integration proof with a two-pass case in which the controlled reviewer approves pass one and fails pass two; the result must name pass two's omitted paths. Compare reviewed plus omitted paths to the independent NUL-delimited Git inventory.
2. **GREEN — inventory and packet:** Add the branch-scoped operation to the shared review CLI and job store. Resolve the configured or remote-default integration ref, fetch in this explicit command, compute merge base, include committed and nonignored working-tree changes, partition authored evidence under existing packet bounds, and include ticket goals in each pass. Credit paths only from sealed, approved cross-agent passes; keep reduced and failed passes omitted. Refuse caller-provided base/ref/path selection. Classify deletes, renames, generated files, dirty work, unreadable or sensitive paths, missing base and failed passes; withhold sensitive bytes before reviewer dispatch. Return typed base/head, prioritized findings, reviewed/omitted paths, coverage and freshness. Preserve generic quality-review behavior. Re-run the focused test.
   **RED/GREEN — CLI review matrix:** Add `packages/cli/tests/integration/branch-review.test.ts` with real temporary Git repositories and a controlled reviewer-process boundary. Assert that a rename source and a deleted path are omitted with reason `deleted or renamed source`, while the rename destination is credited only after its current content reaches the reviewer; the branch remains partial. Also assert an ignored path already committed, generated and oversized omissions, nonignored staged/unstaged/untracked paths, missing or already-merged base, unavailable ticket context, and exact path accounting across passes. Use separately named public-command assertions for a later base and selected files; both must refuse a narrowed scope. Name distinct assertions for cross-file attribution, each omitted-path class, dirty coverage, and the builder-facing next action so the proof map cannot pass when one behavior loses its assertion. Put a unique credential sentinel in a sensitive file, inspect the captured reviewer packet, and assert the sentinel never reaches the reviewer while its path and omission reason remain in the result. Assert dirty work is partial and current. The matrix fails if any omitted path is falsely marked reviewed or complete.
3. **RED/GREEN — signed state and gate:** Add `packages/cli/tests/integration/branch-review-gate.test.ts` using the real CLI result and ticket phase-write validator. Exercise fetched upstream merges, topic upstream tracking, local remote-tip movement without hook network access, pre-exit amend/rebase, identical-content later commits, committed/staged/unstaged/untracked edits, and authored or goal changes. A configured integration ref naming the current topic branch or its upstream after a local branch rename must return an action-required configuration error with no saved job or ticket marker; a topic whose upstream is the selected default `origin/main` must review normally. Working directly on the selected integration branch reviews local unpushed commits against its fetched remote tip; an empty exact inventory yields sealed `none` and the existing reasoned-skip route, never complete coverage. A real-Git proof reviews local work on `main`, exits implementation, and pushes to `origin/main`; the unchanged original-base projection permits done. It then adds and pushes a new authored file and proves the old receipt is stale. A later integration-ref configuration change stales a saved result. Project bookkeeping before dirty-path classification: phase, status, last_modified, Work Log, `branch_review_exit_id`, ledger checkbox annotations, Delivery Checklist progress, verify.md, and non-goal-bearing audit/evidence records do not stale review; changed obligations do. Complete current evidence advances; partial needs an atomic sidecar bound to review ID, ticket ID and omission digest plus exact generated Work Log disclosure. All-dirty, all-failed-pass, and all-withheld work has zero reviewed paths and remains `none`; none can advance ordinarily or through partial acknowledgement. Each can use the existing substantive reasoned-skip route only with a current sealed result and disclosure of every omitted path. Prove that a later `none` after requested changes does not silently erase that earlier finding: it needs the explicit skip and cannot claim approval. With an available local base and authored work, `--offline` or a failed fetch seals a baseless `none` result with no credited paths; a fresh review-ID-bound skip and disclosure are required to advance. The explicit review command records a durable ticket result ID. For feature implementation exit, prove this one result satisfies the review gate without a second generic quality-review dispatch; older generic stamps alone do not satisfy it. Test that a pre-upgrade verify ticket without a marker and without a job keeps its prior done path; removing a reviewed ticket's marker through a shell write blocks done because a local job exists. A marked ticket missing its local result blocks done and can recover with a new review in verification. A reasoned skip requires a current sealed `none` and a substantive phase stamp citing that exact review ID; an old stamp, a skip without a result, or a result with unlisted omitted paths is refused. The same trusted checker decides both phase exit and Stop completion and returns exact omitted-path disclosure. A baseless `none` result remains current at done after only routine verification commits, using its sealed HEAD as the content baseline; an authored commit makes it stale. After verification code changes, an available-base or baseless `none` replacement may reach done only with a new review-ID-bound skip and exact disclosure; unacknowledged partial refuses done, while current complete or acknowledged partial may pass. A zero-remote local repository with no usable base may finish only after a fresh sealed baseless `none`, a new substantive reasoned skip, and visible disclosure of the unreviewed work; a same-job requested-changes verdict blocks that skip. If a fresh `none` supersedes an earlier requested-changes job, the disclosure carries the earlier finding. Tampering, no changes, missing base or stale work refuse the ordinary reviewed path. Select only the latest completed job for this ticket; skip damaged other-ticket records, fail closed on same-ticket or unparseable damage, and never treat a damaged job as a legacy ticket. Malformed configuration, invalid configured refs and absent configured refs seal no result or marker; separately prove structurally unavailable remote HEAD may seal baseless `none`. The successful implement-to-verify write is the exit boundary; a single proposed ticket write that also changes goals is refused before the trusted check. Afterward identical content retains currency, changed authored content or goals does not.
4. **RED/GREEN — host wiring:** Extend `packages/cli/tests/integration/branch-review-gate.test.ts`. At both implement-to-verify and verify-to-done, invoke registered Claude Code, Codex, Cursor and OpenCode CLI adapters with the real shared validator, mocking only the host process boundary. RED shows stale work currently passes; GREEN blocks where the host supports blocking and reports advisory behavior otherwise. Prove each supported host refuses removal of an existing ticket result ID. Exercise Claude Code and Codex Stop completion after an authored edit following the phase write; they must refuse the stale result before writing `status: done`. The Claude Stop check must run before settling owed done-gate state or returning a soft block so a failed freshness check remains owed. Report older bundles as uncovered.
5. **RED/GREEN — findings and words:** Extend `packages/cli/tests/integration/branch-review.test.ts` with two small related files and a ticket scenario. A controlled reviewer result must produce typed `affected_behavior`, nonempty `related_paths` credited by the pass, `consequence`, and `priority` ordered high, medium, low from coordinator severity; malformed or unattributed messages must leave that pass uncredited and its paths omitted. Preserve its raw verdict and severity/message finding; if that uncredited pass requested changes, branch-check must refuse exit after partial acknowledgement or a same-job `none` reasoned skip, and display the raw finding. Partial, none and stale reports must name missed paths and a concrete next action. The independent branch review judges the meaning of behavior and consequence; the structural integration test checks shape and attribution.
6. **REFACTOR:** Simplify after each GREEN. Extract helpers only for repeated real call sites. Record RED/GREEN/REFACTOR ledger evidence with commit SHA or an explicit `skip:` reason.
7. **Docs and generation:** Edit source BDD/host templates, README and website workflow prose for automatic exit review, coverage, freshness, acknowledgement and reasoned skip. Run `bun run safeword install` from the root, then `bun run fix:generated-surfaces` from `packages/cli`; inspect any lifecycle result-hash change. Do not hand-edit generated carriers.
8. **Final checks:** From root run `bun run lint`, `bun run build`, then one `bun run test` full suite. From `packages/cli` run `bun run check:generated-surfaces`. Run scenario, verify and audit gates, recording surface limits honestly.

## Obligation ownership

| Accepted obligation | Owning PRs |
| --- | --- |
| Merge-base scope without caller narrowing; committed, dirty, deleted, renamed, generated and unavailable path accounting | PR 1 |
| Bounded ticket-aware review, cross-file findings, failed-pass omissions and plain-language result | PR 1 |
| Signed complete/partial/none result, latest-job selection, exact omission acknowledgement and disclosure | PR 1 |
| Full exit snapshot and later authored-content/goal freshness without bookkeeping loops | PR 1 |
| Four local host exits, advisory limits, older-bundle status and existing-job compatibility | PR 1 |
| Source docs, generated/dogfood parity, safe rollback to old instruction | PR 1 |
| Representative real-boundary outcome and reviewer-output sample; no quantitative metric | PR 1 |

## Deferred scope ownership

- PR readiness and GitHub human review remain with existing workflows.
- Per-edit and RED/GREEN review events are excluded from this ticket.

## Decision accounting

- Branch inventory and coverage authority: unchanged.
- Bounded review: unchanged.
- Delete and rename sources: unchanged.
- Freshness: unchanged.
- Exit enforcement: unchanged.
- Network boundary: unchanged.
- Exit marker protection: unchanged.
- Reasoned skip: unchanged.

## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
| branch-git | command | integration | Real Git remote, shared CLI packet, reviewer subprocess, path accounting and signed result | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/branch-review-scope.test.ts"]} |
| branch-cli-matrix | command | integration | Real Git path variants and dirty work; captured reviewer packet proves sensitive bytes are absent while path and omission remain; caller narrowing is refused | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/branch-review.test.ts"]} |
| branch-gate | command | integration | Real receipt and ticket phase-write validator, acknowledgement and later freshness | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/branch-review-gate.test.ts"]} |
| branch-hosts | command | integration | Four registered local host adapters calling the shared phase gate | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/branch-review-gate.test.ts"]} |
| docs-review | review_receipt | eval | Source workflow instructions and builder-facing language | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":["README.md","packages/website/src/content/docs/getting-started/workflow.mdx"]} |
| full-suite | command | integration | Current package behavior and regressions | real_boundary | current_required | {"type":"command","cwd":".","argv":["bun","run","test"]} |

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| outcome-scope | outcome and scope | Account for every changed path against ticket behavior | contributor | branch-git | open | missing | | |
| resolved-decisions | resolved decisions | Preserve eight recorded decisions in result and gate | contributor | branch-gate | open | missing | | |
| pr-decomposition | dependency and pull-request decomposition | One coherent PR leaves a supported state | contributor | full-suite | open | missing | | |
| testing | testing | Prove Git, gate, host and finding boundaries | contributor | branch-hosts | open | missing | | |
| data-compatibility | data and compatibility | Older jobs cannot claim coverage; current jobs retain integrity | contributor | branch-gate | open | missing | | |
| monitoring | monitoring and failure signals | Partial, none, stale and failed passes give next actions | contributor | branch-cli-matrix | open | missing | | |
| security-privacy | security and privacy | Sensitive bytes stay outside packets while paths remain counted | contributor | branch-cli-matrix | open | missing | | |
| rollout-rollback | rollout and rollback | In-flight implementation uses the new gate; existing verify tickets retain prior done behavior, and rollback retains the public command | contributor | branch-gate | open | missing | | |
| documentation | documentation | Docs and host guidance explain new review and limits | contributor | docs-review | open | missing | | |
| ownership-dependencies | ownership and human dependencies | Shared CLI owns claim; local hosts call it; no new human approval | contributor | branch-hosts | open | missing | | |
| completion-evidence | completion evidence | Current suite and generated surfaces pass with ledger complete | contributor | full-suite | open | missing | | |
