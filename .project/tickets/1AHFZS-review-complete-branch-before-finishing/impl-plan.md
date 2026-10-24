# Impl Plan: Review complete branch changes before builders finish

**Status:** planned
**Planned on:** 2026-10-23

## Approach

The shared Safeword CLI owns Git inventory, bounded review dispatch, path accounting, and a signed branch-review result. The existing BDD implementation-exit action invokes that CLI operation with the active ticket; it does not accept a caller-selected file list or base revision. The existing phase-change gate checks the saved result immediately before changing `ticket.md`. The later done check validates reviewable content again. The host integrations call the same CLI decision, with their existing hard versus advisory enforcement limits.

The riskiest assumption is that a bounded multi-pass review can preserve a truthful, complete path inventory even when one pass fails or a file cannot enter a packet. Prove the failed-later-pass scenario first with a real temporary Git branch and a controlled reviewer-process boundary. Independently enumerate expected paths with Git, then compare exact path sets to reviewed plus omitted paths; a generated report cannot be its own completeness oracle.

Proof strategy (the 18 reviewed examples share these behavior groups):

| Behavior and scenarios | Owner and primary proof | Real boundary and confidence limit |
| --- | --- | --- |
| Merge-base inventory, caller cannot shrink it, renamed/deleted/ignored committed paths | CLI inventory integration | Temporary Git repository through real `git`; proves path identity and base selection, not reviewer judgment |
| Ticket-aware, cross-file, prioritized findings | Review coordinator integration plus a reviewer-output eval | Real packet assembly and controlled reviewer process; structural assertions prove context and finding shape, while an eval samples semantic quality |
| Current complete review advances; stale authored work blocks; routine records do not; identical-content commit stays current | Gate integration | Real CLI result and phase-write check with a ticket fixture; proves exit wiring, not every host's native hook registration |
| Each of four local host exits uses the same gate | One wiring proof per Claude Code, Codex, Cursor, OpenCode CLI entry point | Invoke installed host adapters with real shared gate and mock only the native process boundary; cloud/advisory behavior is disclosed separately |
| Partial acknowledgement and missing-acknowledgement refusal; empty inventory needs skip | Gate integration | Receipt-bound acknowledgement, coverage policy, and ticket phase transition; cannot prove human comprehension |
| Generated/oversized/secret-sensitive path, dirty work, failed pass, stale report | CLI review integration | Real inventory and bounded packet assembly, controlled pass failure; exact-set check independently detects omissions; cannot promise full secret detection or semantic review of omitted bytes |
| Plain-language next action | CLI result contract assertion plus a short NTB-facing read-through | Checks visible words and action, not actual user understanding |

Affected surfaces: Safeword CLI gets an end-to-end command proof; Claude Code, OpenAI Codex, Cursor, and OpenCode CLI each get a host entry-point wiring proof. OpenCode Desktop and Codex Cloud remain advisory where the host cannot block. The existing PR conversation is outside this change.

### Persona consequences

- **Technical Builder:** Can see exact Git scope, path accounting, reviewer provenance, and stale reason. The explicit agent acknowledgement permits progress on partial coverage but cannot turn an omitted file into reviewed evidence. Retry regenerates a receipt for current work.
- **Non-Technical Builder:** Sees complete/partial/none separately from current/stale, the missed paths, findings, and one concrete next action. No new user approval is introduced. The message must say when the reviewer lacked evidence; automated wording cannot establish that the user understood it.

### Current and target truth

- **Implemented fact:** `review run quality-review` accepts caller-selected targets and bounded packets; BDD asks the agent to review the whole diff; phase stamps attest to coordinator reviews. The oversized `bun.lock` projection is a narrow existing exception.
- **Available proof:** The 18 reviewed scenario examples and current code inspection establish the gap; no branch-review command or receipt is implemented yet.
- **Known defect:** The existing stamp cannot independently prove complete branch path selection or preserve omissions as a separate coverage claim.
- **Proposed decision:** Add branch-scoped inventory and result, preserve the existing general quality-review contract, and require the result at implementation exit.
- **Pending human authority:** The user approved this behavior scope. Implementation Plan and Execution Plan review/approval gates still apply; no merge or release is authorized by this plan.

## Decisions

### Implementation Inspiration

| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://git-scm.com/docs/git-merge-base | 2026-10-23 | Current online Git manual | Git 2.54.0 Apple Git | Defines best common ancestor | Compute scope from configured integration ref, never a caller-supplied later base | Documentation only; no source code reuse |
| https://git-scm.com/docs/git-diff | 2026-10-23 | Current online Git manual | Git 2.54.0 Apple Git | Defines name-status and NUL-delimited diff output | Preserve deleted and rename identities in committed inventory | Documentation only; no source code reuse |
| https://git-scm.com/docs/git-status | 2026-10-23 | Current online Git manual | Git 2.54.0 Apple Git | Defines porcelain status and untracked reporting | Inventory nonignored staged, unstaged, and untracked work separately | Documentation only; no source code reuse |

**Decision impact:** changed: Git's distinct committed-diff and working-tree semantics require an inventory that records both, with the merge base computed by the CLI.
**Decision informed:** Branch inventory and coverage authority

#### PlanEvidenceRecordV1

```json
{"schema_version":1,"source_identity":"https://git-scm.com/docs/git-merge-base","checked_version":"2026-10-23 current online manual","source_version":"current online Git manual","target_version":"Git 2.54.0 Apple Git","supported_claim":"merge-base finds a best common ancestor for two commits","license_identifier":"none_declared","attribution_notice":"none_declared","redistribution_limit":"none_declared","security_limit":"none_declared","privacy_limit":"none_declared","reuse_limit":"documentation consulted; no code copied"}
```

#### PlanEvidenceRecordV1

```json
{"schema_version":1,"source_identity":"https://git-scm.com/docs/git-diff","checked_version":"2026-10-23 current online manual","source_version":"current online Git manual","target_version":"Git 2.54.0 Apple Git","supported_claim":"name-status and NUL-delimited output support lossless changed-path inventory","license_identifier":"none_declared","attribution_notice":"none_declared","redistribution_limit":"none_declared","security_limit":"none_declared","privacy_limit":"none_declared","reuse_limit":"documentation consulted; no code copied"}
```

#### PlanEvidenceRecordV1

```json
{"schema_version":1,"source_identity":"https://git-scm.com/docs/git-status","checked_version":"2026-10-23 current online manual","source_version":"current online Git manual","target_version":"Git 2.54.0 Apple Git","supported_claim":"porcelain status distinguishes tracked working-tree and nonignored untracked changes","license_identifier":"none_declared","attribution_notice":"none_declared","redistribution_limit":"none_declared","security_limit":"none_declared","privacy_limit":"none_declared","reuse_limit":"documentation consulted; no code copied"}
```

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Branch inventory and coverage authority | CLI computes a complete merge-base inventory and binds reviewed, omitted, and dirty paths to one signed result | Skill instruction alone; caller-selected files; full-repo scan | Instructions and caller input can silently narrow scope; full-repo scan reviews unrelated history |
| Bounded review | Partition eligible authored paths into bounded coordinator passes; failed or unrepresentable paths stay omitted | Raise global packet limits; silently skip; one huge review | Larger packets increase cost and still have limits; hidden skips create false completeness |
| Freshness | Check the full snapshot at implementation exit, then compare authored content and ticket goals for later completion | Recheck all ticket bytes forever; head SHA alone | Routine verification records create loops; an identical-content commit need not invalidate review |
| Exit enforcement | Add a branch-specific receipt check to the existing implementation exit, alongside existing phase stamp | New review phase; overload generic quality-review stamp | Separate phase adds ceremony; generic stamp does not attest branch path accounting |
| Network boundary | Fetch only in the explicit branch-review command; the phase-write gate checks the local remote-tracking ref and reports when it was last fetched | Fetch again in the hook; ignore the local ref | Hook network work can stall or fail offline; ignoring the ref hides local integration changes |
| Exit marker protection | The shared pre-tool phase gate refuses marker removal and permits replacement only with a newly sealed signed result for the same ticket | Trust marker presence without checking edits; infer prior review only from the local job store | A dropped marker could make reviewed work look like a pre-upgrade ticket; the local store may disappear |
| Reasoned skip | Accept it only with the current sealed `none` result for this ticket; missing, stale, complete, or partial results cannot use that route | Accept a skip note alone | A note alone could bypass branch review for authored work |

The shared constraint is recorded in [Safeword Architecture](../../../ARCHITECTURE.md#branch-scoped-implementation-exit-review). A new CLI operation is valid only for an active BDD ticket. It accepts the active ticket identity, never arbitrary target paths, a base, or a per-run integration ref. The project-owned integration-ref configuration is resolved as described below. It returns a typed result with base, head, actual reviewer, prioritized findings, reviewed and omitted paths/reasons, `freshness: current|stale`, and `coverage: complete|partial|none`. Invalid ticket/ref, unavailable Git, and lost review passes are distinct failures or omissions; none may produce complete coverage. It is idempotent for the same content and ticket goals. Concurrent review runs are separate signed jobs; only a current result can satisfy exit. A partial result requires an acknowledgement bound to its receipt identity and exact omitted set, recorded by the agent and disclosed to the user. An empty or missing-base result may use the existing reasoned skip path only with a current sealed `none` result for this ticket; a skip note without that result cannot satisfy exit. Gate proof refuses a skip with authored work and no qualifying result. Existing callers of generic `review run quality-review` remain compatible.

### Branch result contract

**Bookkeeping-only dirty paths.** Project each path before classifying dirty work or comparing the exit path set. If an uncommitted change alters only excluded bookkeeping, such as `branch_review_exit_id`, a Work Log disclosure, ledger checkboxes, or Delivery Checklist progress, that path is absent from the reviewable dirty set and cannot make coverage partial or the saved review stale. If the same file also changes a goal-bearing field, retain it as dirty. A gate proof seals a review, writes the marker and disclosure without a commit, and confirms implementation exit stays current.

**Scope source.** Only project configuration may name an integration ref; a run cannot override it. The configured value must be a named `refs/remotes/<remote>/<branch>` ref, not a SHA, relative revision, local topic branch, or `HEAD` expression. Without one, choose `origin` when present, otherwise the sole remote; multiple non-origin remotes are ambiguous and yield coverage `none`. The explicit review command asks that remote for its symbolic HEAD to identify the remote default branch; never use the topic branch's upstream tracking branch. If remote HEAD is absent or ambiguous, coverage is `none` rather than a guessed main/master. The explicit review command fetches that exact remote branch before inventory and records the fetch time. A missing ref, ambiguous remote, or failed fetch yields coverage `none` at review time. The phase-write gate does not fetch: it checks the saved ref name and local remote-tracking ref, recomputes `git merge-base` with current HEAD, and compares the base with the signed result. A missing local ref blocks exit; a newer locally observed remote tip with the same merge base does not stale the review. The gate reports the saved fetch time so the builder can see the currency limit while offline. This excludes commits already merged into the fetched integration branch from the ticket-work claim; a temporary Git-remote proof merges an upstream commit, fetches, and shows it absent from the inventory. A second proof makes the topic track `origin/topic` and confirms the default is still `origin/main`. Work merged earlier cannot be retroactively claimed as reviewed. The existing oversized-lockfile baseline fallback remains confined to that representation and cannot choose this branch-review scope.

**Reviewable identity.** At exit, require the current HEAD revision to equal the signed reviewed head exactly. Also compare integration-ref name, computed merge base, exact committed path set and statuses, staged/unstaged/untracked nonignored path set and reviewable content, and ticket-goal projection. A newer integration tip with the same merge base is harmless. A content-identical amend or rebase before exit is stale and requires another review; a real Git proof covers that case. The goal projection includes `ticket.md` `scope`, `out_of_scope`, `done_when`, Product Plan jobs and Rules in `spec.md`, all scenario `.feature` files declared by the ticket, and the headings and behavioral obligations in `test-definitions.md`. Project or ticket files not expressly classified as routine bookkeeping are reviewable by default. At exit as well as afterward, compare ticket file content through a projection that excludes only `phase`, `status`, `last_modified`, Work Log entries, review acknowledgement, a `branch_review_exit_id` marker, `verify.md`, and audit/evidence records that do not alter goals. In `test-definitions.md`, checkbox state and commit/skip annotations are progress, while a changed scenario or obligation is reviewable. In `execution-plan.md`, Delivery Checklist progress cells (Disposition, Evidence class, Revision, and evidence text) and proof-receipt-only commits are progress; changed tasks, proof requirements, and accepted obligations remain reviewable. The gate proof changes these progress fields after review and confirms currency, then changes a goal-bearing field and confirms staleness. The full exit snapshot means all reviewable authored bytes and path identities, not a raw byte hash of self-generated bookkeeping. An edit to an excluded file that changes a goal-bearing field is reviewable. A proof writes the partial acknowledgement and generated Work Log disclosure after review and then advances without a false stale result. After exit, re-evaluate authored-content and goal projections; phase bookkeeping is never a reason to loop. A new commit whose content projection is identical retains current freshness, while a changed merge base or authored bytes makes the result stale. The report retains its original coverage and omissions when stale.

**Acknowledgement and result selection.** The agent records a partial-coverage decision through a typed local CLI operation that writes an authenticated sidecar in the existing review-job store, keyed by review ID, ticket ID, exact omitted-path digest, and decision text. The coordinator's signed review job remains immutable. The sidecar is written atomically with the store's existing integrity mechanism; hand-edited ticket notes do not satisfy the gate. It is outside the reviewable snapshot and cannot stale its own review. The exit validator reads and verifies both records, matches the omission digest, and requires disclosure of the same omissions in the implementation-exit summary. `none` cannot be acknowledged into partial or complete. If a process dies before the review result is sealed, there is no qualifying result; if it dies before acknowledgement is sealed, partial coverage remains unacknowledged. Retries create independent review jobs. Select the latest completed review job for this ticket by the coordinator's durable completion order, then validate it; do not fall back to an older result when the latest is stale, partial, or failed. An acknowledgement is idempotent only for its exact review ID and omission digest. Same-user local job-store modification remains within the existing trusted boundary, not a claimed hostile-user protection.

**Disclosure surface.** The typed acknowledgement operation generates a fixed plain-language disclosure from the signed omitted-path set and writes it to the ticket Work Log, as well as printing it in the CLI result. The agent supplies only the reason to continue, not the omission text. The phase-write validator requires the authenticated sidecar and the exact generated Work Log disclosure before advancing; it then returns the same disclosure in its gate result for the host to surface. A crash between the sidecar and Work Log writes leaves the gate unsatisfied; repeating the operation repairs the missing copy without changing the review. Chat may repeat the message but is not the evidence. An integration proof removes one omission from the Work Log disclosure and must observe exit refusal.

**Host and rollout limits.** Local Claude Code, Codex, Cursor, and OpenCode CLI phase-write adapters call the same validator; each must have one real registration-to-gate proof in addition to focused adapter tests. The later freshness check runs at the `verify` to `done` ticket phase write through the same shared pre-tool phase gate, in all four local host adapters; each gets a real registration-to-gate stale-review proof. A Stop hook also reports stale review when it observes a done ticket, but is not the authority for the phase write. Where a host can block the ticket edit, stale review prevents `done`; a host whose edit or Stop surface is advisory reports the stale result and cannot claim enforced completion. Older installed bundles do not gain or forge coverage retroactively; mixed-version hosts may still advance without the new gate and must be reported by status/doctor rather than shown as covered. An in-flight implementation ticket runs this review at its next implementation exit after upgrade. The explicit branch-review command writes a goal-neutral `branch_review_exit_id` to the ticket when it seals a result; the implement-to-verify gate requires that marker to match its signed result. On later ticket edits, the shared pre-tool gate refuses marker removal and permits replacement only with a newly sealed signed result for that ticket; this lets a fresh review in verification repair missing or stale evidence. The done gate also refuses a marker that does not match its signed result. A ticket already in verification at upgrade has no marker: its verify-to-done gate retains the prior behavior and status/doctor discloses that branch coverage was not established. A marked ticket whose local result is missing blocks done and must run a fresh review in verification; retention may remove old records, but cannot silently turn a marked ticket into a legacy one. Gate proofs remove the marker through each supported host edit, remove a marked ticket's local result, and exercise the no-marker upgrade case. The cross-file finding example uses two small related files that fit one bounded pass; broader cross-pass semantic completeness is not claimed.

### Data applicability

Data applicability: The review result is a new local, ticket-scoped evidence record, not a remote store.

- **Purpose:** Preserve exactly what a branch review covered so a later gate can validate a claim.
- **Store and model:** Reuse the coordinator's signed job/receipt store; add a versioned branch-coverage payload rather than a second database. Older jobs remain valid for their original review meaning but cannot claim branch coverage.
- **Schema and relationships:** Bind ticket identity, integration ref/base, reviewed content identity, goals identity, reviewer provenance, path inventory, omissions, findings, and acknowledgement to the result ID. A goal-neutral ticket marker records the result used at implementation exit. Reject duplicate or missing path classifications.
- **Source of truth:** Git supplies branch and working-tree paths; current ticket/scenario files supply goals; coordinator-signed result supplies reviewer evidence. The report is derived, never the path oracle for its own completeness.
- **Ownership and access:** Local same-user CLI writes; hook reads through CLI verification. No new public permission or remote read route. Existing reviewer dispatch may receive bounded nonsecret repository evidence.
- **Identity and integrity:** Recompute base and exact path set at exit; bind content/goal digests and omission set to the signed job. Stale is independent of coverage.
- **Cross-system flow:** CLI to reviewer via existing neutral packet; CLI to host hooks via typed local result. No customer data or credentials are sent as review context.
- **Lifecycle and retention:** Reuse current review-job retention and validation; new review supersedes an older result for exit without erasing its historical omissions. Deletion follows existing local job cleanup.
- **Migration and backfill:** No backfill. Existing review stamps do not turn into branch-coverage receipts; the new implementation-exit gate applies after installation. Tickets already in verification have no exit marker and retain their previous done path. A marked ticket needs its signed result or a fresh review before done.
- **Compliance:** No new privacy, residency, or audit obligation identified beyond existing local review packet policy; excluded sensitive paths remain named without content.
- **Rollback:** If the new exit gate causes trouble after release, disable that enforcement in a follow-up patch while retaining the catalogued branch-review command and typed result fields. The command may return a typed unavailable result until repaired; do not remove a public command or silently reinterpret `complete`, `partial`, and `none`. Existing result payloads remain readable and need no destructive cleanup.

### Measurement applicability

Measurement applicability: skip: The Product Plan promises a representative observable branch-review outcome, not a numeric production metric. Exact path-set equality in tests is proof of coverage mechanics, not a usage KPI.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Plain coverage/freshness and next action plus detailed path/reviewer data | packages/cli/features/review-complete-branch-before-finishing.feature |  |
| 1. Structure enforces; instructions suggest | CLI inventory and phase gate, not a skill-only assertion | packages/cli/features/review-complete-branch-before-finishing.feature |  |
| 2. Fire at boundaries, not every turn | Run at existing implementation exit and check later completion | packages/cli/features/review-complete-branch-before-finishing.feature |  |

Architecture applicability: extends the existing host-owned cross-agent review coordinator and the typed CLI/phase-gate shared contract. The lasting branch-coverage rule is in [Safeword Architecture](../../../ARCHITECTURE.md#branch-scoped-implementation-exit-review); existing [host-owned review coordinator](../../../ARCHITECTURE.md#host-owned-cross-agent-adversarial-review-coordinator) remains the dispatch authority.

## Known deviations

The new branch-specific evidence check is separate from the generic phase stamp because that stamp witnesses a reviewer verdict, not a complete Git inventory. This adds one gate call site to the existing phase-transition check; it avoids changing the semantics of stamps used by other phases. Premortem: if the two receipts drift, implementation could advance with a valid generic review but stale branch coverage; a single shared branch-result validator at write and read time prevents that. Revisit if all review kinds later adopt path accounting.

## Doc impact

README and website Safeword workflow docs must describe the automatic implementation-exit branch review, complete/partial/none and current/stale meanings, partial acknowledgement, and the no-review reasoned skip. The BDD skill text and host mirrors must invoke the shared command; generated surfaces follow template regeneration.

## Assessment triggers

Reassess if host lifecycle APIs change their ability to block, Git diff/status formats change, bounded packets routinely omit authored work, review jobs require cross-device portability, or users mistake partial coverage for approval.
