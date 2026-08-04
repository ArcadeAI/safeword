# Figure It Out — PR #1652 Feedback

All five findings were investigated on 2026-07-29 before changing code. Primary-source lifecycle evidence: [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) documents that `UserPromptSubmit` runs before model processing, `Stop` runs once per turn, and `stop_hook_active` only guards an existing Stop continuation.

## 1. Keep generic suppression from hiding independent gates

- [x] Phase 1: Decide where the marker may suppress a Stop response without hiding typecheck, phase, or done gates.
- [x] Phase 2: Options were an early global exit, a generic-branch-only condition, or a shared all-gate dedup layer.
- [x] Phase 3a: Research domains — Claude lifecycle, Stop gate ordering, and regression-test boundaries.
- [x] Phase 3b: Verified lifecycle semantics from the Claude reference and traced the live typecheck/phase branches.
- [x] Phase 4: Chose the generic-branch-only condition.

> Recommend **the `currentPhase === undefined` branch condition** because it is the only location that represents the review being deduped. A global early exit is smaller but incorrectly suppresses independent gates; a shared gate layer adds unnecessary abstraction. Cite: [Claude hooks reference](https://code.claude.com/docs/en/hooks).

**Premortem:** A future generic path could be added elsewhere; keep its marker decision next to that path and cover the new branch with an installed-hook test.

**Next:** Keep the marker check and write in `packages/cli/templates/hooks/stop-quality.ts` beside the generic-review decision.

## 2. Persist a marker for a fresh or resumed session

- [x] Phase 1: Decide whether generic review suppression must create a missing state file.
- [x] Phase 2: Options were to no-op, rely on PostToolUse to create state, or initialize state during the generic review.
- [x] Phase 3a: Research domains — state namespace resolution, session replay, and Bun/Node directory I/O.
- [x] Phase 3b: Traced `getStateFilePath` and confirmed Bun supports the Node directory APIs used here.
- [x] Phase 4: Chose best-effort initialization.

> Recommend **creating the state directory and file on the first generic review** because replayed/resumed sessions are the target failure mode. Relying on PostToolUse leaves that mode open; a hard write failure would make Stop unavailable. Cite: [Bun file I/O](https://bun.com/docs/runtime/file-io).

**Premortem:** Filesystem permissions could still reject the write; retain best-effort handling so this causes at most a duplicate review, never a broken Stop hook.

**Next:** Cover an unseeded session in `stop-hook-idle-review.test.ts`.

## 3. Revalidate the failed Node 24 job

- [x] Phase 1: Decide whether the Node 24 failure is a code regression or a timeout-shaped runner failure.
- [x] Phase 2: Options were to assume a flake, rerun the failed job, or change unrelated Codex/Rust code.
- [x] Phase 3a: Research domains — failed-job evidence, CI reproducibility, and GitHub Actions rerun semantics.
- [x] Phase 3b: Inspected the failed job: 373 suites passed while Rust and Codex subprocess tests timed out; Node 22 passed. GitHub documents rerunning failed jobs on the same ref.
- [x] Phase 4: Chose a fresh CI run from the corrective commit; the attempted old-head rerun was canceled when the branch advanced.

> Recommend **requiring the fresh branch CI to pass** because timeout shape alone is not proof of a flake. An old-head rerun was attempted but canceled when the corrective commit superseded it; changing unrelated adapters would be speculative. Cite: [GitHub Actions rerun reference](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).

**Premortem:** The failure reproduces under Node 24; inspect the timed-out Codex/Rust process paths separately rather than attributing it to #1492.

**Next:** Check the rerun and fresh PR checks before marking YBBGKB verified.

## 4. Collapse prompt-hook state writes

- [x] Phase 1: Decide whether the marker clear should add another full-file write.
- [x] Phase 2: Options were retaining three writes, batching prompt-local mutations, or extracting a cross-hook mutation helper.
- [x] Phase 3a: Research domains — file-write failure windows, hook-local state ownership, and concurrent hook behavior.
- [x] Phase 3b: Verified all mutations use the same in-memory object and write APIs; traced the separate hook processes.
- [x] Phase 4: Chose a prompt-local dirty flag and one final write.

> Recommend **one prompt-local final write** because it reduces write windows without disguising cross-process read-modify-write behavior. A shared helper was close but loses on ownership clarity.

**Premortem:** A future early return could bypass the final write; keep mutations and the write in the same state-processing block.

**Next:** Keep `stateDirty` local to `prompt-questions.ts`.

## 5. Put marker-lifecycle tests in their own suite

- [x] Phase 1: Decide whether to retain marker tests in the frozen transcript-format suite.
- [x] Phase 2: Options were leaving them in place, renaming a mixed describe block, or a focused integration file.
- [x] Phase 3a: Research domains — test discoverability, collaborator fidelity, and fixture duplication.
- [x] Phase 3b: Checked the frozen-fixture file header and preserved real-hook-process coverage in a small dedicated fixture.
- [x] Phase 4: Chose a focused `stop-hook-idle-review.test.ts` file.

> Recommend **the dedicated integration file** because it makes #1492’s lifecycle regression discoverable without coupling it to transcript-format compatibility. A renamed mixed describe is smaller but still leaves the test in the wrong maintenance boundary.

**Premortem:** The helper can drift from the production namespace; keep a single `stateFilePath` helper used for both setup and assertion.

**Next:** Run the dedicated suite with the Stop typecheck and phase-backstop suites.

## Pass 2 — rebased-head review feedback

### A. Keep ticket evidence reachable after a rebase

- [x] Phase 1: Decide whether to retain pre-rebase GREEN SHAs, rely on patch-ID recovery, or cite their reachable rebased equivalents.
- [x] Phase 2: The options were stale SHAs with fallback, reachable replacement SHAs, or removing the TDD evidence.
- [x] Phase 3a: Research domains — Git object reachability, fresh-clone behavior, and ledger validation.
- [x] Phase 3b: Traced `createLedgerShaResolver`; it cannot recover an object absent from a shallow/fresh checkout. Confirmed `f22ead54b` and `fb5904c4b` are ancestors of the rebased head. Git documents patch IDs as duplicate-detection aids, not durable commit references.
- [x] Phase 4: Chose reachable replacement SHAs.

> Recommend **reachable rebased SHAs** because a ticket ledger must validate on every checkout. Patch-ID recovery is useful for a locally retained orphan but loses when the original object was never fetched. Cite: [Git patch-id documentation](https://git-scm.com/docs/git-patch-id).

**Premortem:** Another rebase rewrites these commits; amend the ledger in the same rebase before moving the ticket to done.

**Next:** Cite `f22ead54b` and `fb5904c4b` in the TDD ledger.

### B. Persist the clear after an optional reminder fails

- [x] Phase 1: Decide whether a state mutation made before optional reminder work must survive a later exception.
- [x] Phase 2: The options were writing inside the main `try`, adding a separate eager marker write, or retaining one final best-effort write in `finally`.
- [x] Phase 3a: Research domains — prompt-boundary semantics, error recovery, and synchronous file I/O.
- [x] Phase 3b: Reproduced a valid JSON state with malformed cached failures that throws after the marker clear; the pre-change write was skipped. Node documents synchronous file writes and recursive directory creation; the hook must preserve its tolerant failure behavior.
- [x] Phase 4: Chose a guarded best-effort write in `finally`.

> Recommend **one guarded final write in `finally`** because the user-prompt boundary has happened even if optional guidance fails. An eager second write restores correctness but reintroduces the duplicate write window; keeping the write in `try` fails toward unnoticed silence. Cite: [Node file-system documentation](https://nodejs.org/api/fs.html).

**Premortem:** The write itself fails; swallow that failure so the prompt hook still emits core guidance, accepting at most one duplicate generic review.

**Next:** Keep the real installed-hook regression in `hooks.test.ts`.

### C. Keep the verification matrix navigable

- [x] Phase 1: Decide whether the fail-closed matrix row should retain its old test-file pointer.
- [x] Phase 2: Options were keeping the old pointer, pointing at the dedicated idle-review suite, or duplicating the control test.
- [x] Phase 3a: Research domains — regression discoverability, test ownership, and documentation drift.
- [x] Phase 3b: Traced the control to the first Stop in `stop-hook-idle-review.test.ts`.
- [x] Phase 4: Chose the dedicated suite pointer.

> Recommend **the current dedicated test path** because the matrix is an index to the real regression, not a history of where it used to live. Duplicating the test adds maintenance cost.

**Premortem:** A future move drifts again; update the matrix in the same commit as any test relocation.

**Next:** Point the fail-closed row at `stop-hook-idle-review.test.ts`.

### D. Simplify state initialization and document its writer role

- [x] Phase 1: Decide whether to retain a second existence check around recursive directory creation.
- [x] Phase 2: Options were preserving both checks, creating before reading, or extracting a new state helper.
- [x] Phase 3a: Research domains — Node directory semantics, state ownership, and cleanup lifecycle.
- [x] Phase 3b: Node documents recursive `mkdirSync` as safe when the directory exists; existing cleanup already owns the namespace teardown.
- [x] Phase 4: Chose create-before-read without a new abstraction.

> Recommend **unconditional recursive directory creation followed by one file check** because it is shorter and preserves the existing best-effort state convention. A helper is unnecessary for a two-line sequence. Cite: [Node file-system documentation](https://nodejs.org/api/fs.html).

**Premortem:** The new writer surprises cleanup code; record the writer in Known deviations and retain the existing cleanup owner.

**Next:** Keep creation in `recordStopReviewState` and document it in `impl-plan.md`.

### E. Make the two state patches mutually exclusive

- [x] Phase 1: Decide how to express the generic-marker versus phase-marker state update.
- [x] Phase 2: Options were mixed truthiness checks, two strict checks, or a single conditional patch.
- [x] Phase 3a: Research domains — state invariants, type evolution, and readability.
- [x] Phase 3b: Confirmed the branches are mutually exclusive after `fireReview` and the done path exits earlier.
- [x] Phase 4: Chose a single conditional patch.

> Recommend **one conditional patch** because it makes “one marker or the other” obvious and remains correct if phase typing later expands. The current mixed checks work today but obscure the invariant.

**Premortem:** A third review kind needs its own state; add a named state model then rather than extending this conditional indefinitely.

**Next:** Pass the conditional patch directly to `recordStopReviewState`.

## Pass 3 — current-head review feedback

### A. Keep the prompt-recovery regression non-vacuous

- [x] Phase 1: Decide whether the recovery test must prove reminder derivation actually aborts.
- [x] Phase 2: Options were retaining the indirect state assertion, exposing a production-only fault seam, or pinning an existing downstream observable.
- [x] Phase 3a: Research domains — integration-test durability, prompt-reminder control flow, and failure recovery.
- [x] Phase 3b: Traced `getFailureInjection` as the throw site and `learningsNudgesPending` as the next observable work. The existing assertions pass both on an error and on a no-error path, while the downstream nudge is emitted only on the no-error path.
- [x] Phase 4: Chose the downstream-observable assertion.

> Recommend **seed a pending learning nudge and assert that its line is absent** because it proves the test's malformed cached failure still reaches the recovery path without adding a production fault-injection API. A synthetic seam adds scope; retaining only the marker assertion loses if parsing is later made tolerant.

**Premortem:** The nudge wording could change; assert its stable `Novel claim detected` prefix, not the full message.

**Next:** Keep the negative assertion beside the malformed-state fixture.

### B. Express the parsed state contract honestly

- [x] Phase 1: Decide whether the `JSON.parse` state variable should retain an obfuscated inferred `any` type.
- [x] Phase 2: Options were `Record<string, unknown>` plus per-access casts, an explicit untyped escape hatch, or the existing `QualityState` persistence contract.
- [x] Phase 3a: Research domains — persisted hook-state ownership, TypeScript narrowing, and malformed-file tolerance.
- [x] Phase 3b: Confirmed `QualityState` is the shared on-disk contract used by the quality hooks and that the surrounding `try`/`catch` is still required for malformed runtime content.
- [x] Phase 4: Chose `QualityState` with an explicit parse assertion and explanatory runtime-boundary comment.

> Recommend **`QualityState` plus the existing tolerant runtime boundary** because it tells readers which contract normal hook writers maintain while preserving best-effort behavior for stale/corrupt state files. `Record<string, unknown>` would add casts at every normal access; plain `any` hides the contract.

**Premortem:** A future state migration could make the assertion stale; update the shared `QualityState` contract and this reader together.

**Next:** Keep malformed-state integration coverage so runtime tolerance remains tested independently of static typing.

## Pass 4 — current delivery-status wording

### A. Keep the PR validation status truthful after CI completes

- [x] Phase 1: Decide whether the PR should retain a completed run as “in progress,” replace it with the observed result, or request another run.
- [x] Phase 2: Options were leaving the conservative-but-stale wording, updating it to the completed result, or rerunning CI solely to refresh the sentence.
- [x] Phase 3a: Research domains — CI evidence provenance, review handoff accuracy, and delivery-state drift.
- [x] Phase 3b: Queried the GitHub workflow data for head `cee346589`; run `30504407023` is `completed` with conclusion `success`. The PR is still a draft and has no unresolved review threads.
- [x] Phase 4: Chose the completed-result wording.

> Recommend **replace “in progress” with the green completed result** because the workflow result is first-party evidence for this exact head. Leaving the old wording undermines the review handoff; rerunning CI provides no new signal. Cite: [CI run 30504407023](https://github.com/ArcadeAI/safeword/actions/runs/30504407023).

**Premortem:** A later push can stale this status again; refresh the Validation section only after fetching the exact current-head run.

**Next:** Update PR #1652’s Validation line to record the green completed run.

## Pass 6 — rebase-head feedback

### A. Remove the redundant parsed-state assertion

- [x] Phase 1: Decide whether the Stop writer needs both a `Partial<QualityState>` variable annotation and an identical JSON assertion.
- [x] Phase 2: Options were retaining both, keeping only the annotation, or treating JSON as `unknown` and validating every field.
- [x] Phase 3a: Research domains — TypeScript inference and assertions, shared on-disk state evolution, and malformed-file recovery.
- [x] Phase 3b: Verified `JSON.parse` is `any`, so the declared `Partial<QualityState>` accepts it without the duplicate assertion; the surrounding runtime `try`/`catch` remains the malformed-file boundary.
- [x] Phase 4: Chose the annotation alone.

> Recommend **remove the duplicate assertion** because the declared `Partial<QualityState>` already records the intended contract, while the runtime boundary still owns tolerance of stale files. Keeping both is noisier; full validation would add behavior and scope. Cite: [TypeScript Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html).

**Premortem:** A future parser migration could make the annotation misleading; update the shared state contract and add validation only when the format becomes versioned.

**Next:** Simplify `stop-quality.ts` in the template and dogfood copies.

### B. Correct the phase predicate consistently

- [x] Phase 1: Decide whether to fix the three sibling comments that describe `undefined` phase as only “no active ticket.”
- [x] Phase 2: Options were leave them for follow-up, correct all three now, or rename the runtime predicate.
- [x] Phase 3a: Research domains — local `resolveStopPhase` semantics, user-facing readiness behavior, and template/dogfood parity.
- [x] Phase 3b: Traced the three no-phase outcomes: a missing `phase:`, a status escape hatch, and eligible done-status tickets. The comments are documentation-only and all use the same phase parameter.
- [x] Phase 4: Chose the consistent wording correction.

> Recommend **correct all three comments now** because they state one shared local invariant and need no runtime change. A follow-up would preserve known misleading guidance; renaming code would be bloat. Cite: `packages/cli/templates/hooks/lib/active-ticket.ts` (`resolveStopPhase`).

**Premortem:** A new undefined-phase meaning is added later; update the predicate’s contract comment and its callers together.

**Next:** Use “no resolvable ticket phase” in the typecheck, readiness, and prompt comments and keep their dogfood twins identical.

### C. Make PR validation durable between pushes

- [x] Phase 1: Decide how the PR body should describe validation without stale statuses or unanchored snapshot counts.
- [x] Phase 2: Options were retain counts, anchor counts to a commit, or list reproducible checks and link GitHub’s live Checks tab.
- [x] Phase 3a: Research domains — GitHub check lifecycle, reviewer handoff, and validation provenance.
- [x] Phase 3b: GitHub documents the Checks tab as the place for per-commit check output and current state; every push can supersede a static PR-body observation.
- [x] Phase 4: Chose reproducible check descriptions plus the live tab.

> Recommend **replace snapshot numbers with named validation scopes and the live Checks tab** because it remains true after the next push. Commit-anchored counts are more accurate but still duplicate a volatile status surface. Cite: [GitHub status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks).

**Premortem:** A reviewer needs exact local counts; consult the linked CI run or ticket evidence rather than trusting PR prose.

**Next:** Update PR #1652’s Validation bullets before pushing the rebased branch.

### D. Keep TDD evidence reachable after the current rebase

- [x] Phase 1: Decide whether rebased ticket evidence should retain original SHAs, rely on local orphan recovery, or cite their new reachable counterparts.
- [x] Phase 2: Options were old SHAs with patch-ID fallback, deleting the evidence, or mapping the unchanged patches to rebased SHAs.
- [x] Phase 3a: Research domains — Git commit reachability, fresh-clone ledger validation, and patch-series comparison.
- [x] Phase 3b: `git range-diff 02cfbea89...origin/agent/quiet-idle-stop-reviews af3eab8b2...HEAD` matched every relevant patch: `f22ead54b` → `f76e91bc9`, `fb5904c4b` → `c3f3666ac`, `69ce94f19` → `bb6540dfb`, and `d00fbf733` → `4f4a949f6`. Each replacement is an ancestor of the rebased head.
- [x] Phase 4: Chose reachable replacement SHAs.

> Recommend **retarget the ledger to the rebased SHAs** because ledger evidence must work in a fresh checkout. Keeping orphan IDs depends on locally retained objects; deleting evidence loses the RED/GREEN trail. Cite: [Git range-diff documentation](https://git-scm.com/docs/git-range-diff).

**Premortem:** Another rebase rewrites the series; run `range-diff` and replace every ledger SHA before attempting the done gate.

**Next:** Update the YBBGKB GREEN/REFACTOR annotations, then run the ledger validator against the new head.

## Pass 7 — latest PR #1652 comments

### A. Make the sibling-comment corrections part of the stated scope

- [x] Phase 1: Decide whether the two review-driven sibling-hook comment corrections should be reverted, documented in scope, or left to explain later.
- [x] Phase 2: Options were (1) add one narrow scope bullet, (2) revert the correct comments and create follow-up work, or (3) leave the ticket unchanged and explain the mismatch only in `verify.md`.
- [x] Phase 3a: Research domains — done-gate scope provenance, undefined-phase vocabulary consistency, and change-scope minimization.
- [x] Phase 3b: `checkVerifyArtifact` requires an honest `**PR Scope:**` record before done; both comments only state the existing phase contract and have matching dogfood copies.
- [x] Phase 4: Chose one explicit documentation-only scope bullet.

> Recommend **add the narrow scope bullet** because ticket scope must truthfully cover review-driven work before verification can attest that the PR stayed in scope. Reverting preserves known-correct documentation; deferring records an avoidable mismatch. Cite: `packages/cli/templates/hooks/lib/done-gate.ts` (`checkVerifyArtifact`).

**Premortem:** The clarification could become a blanket allowance for unrelated hook edits; constrain it to sibling comments sharing the undefined-phase vocabulary and state that behavior does not change.

**Next:** Update `ticket.md` Scope without changing hook logic.

### B. Refresh the active-ticket timestamp with this review pass

- [x] Phase 1: Decide whether to retain the pre-pass `last_modified`, refresh it now, or build automation for the field.
- [x] Phase 2: Options were (1) leave it for the next substantive edit, (2) use the current UTC time for this ticket touch, or (3) add timestamp automation.
- [x] Phase 3a: Research domains — active-ticket selection, replan staleness windows, and timestamp provenance.
- [x] Phase 3b: `getActiveTicket` orders in-progress tickets by `last_modified`, while `evaluateReplan` reads it as the staleness baseline; the current clock supplies an auditable value.
- [x] Phase 4: Chose a current-UTC timestamp, not new automation.

> Recommend **refresh `last_modified` now** because it is a live workflow input, not a decorative audit field. Leaving it stale widens replan analysis and can select the wrong active ticket; automation is unnecessary scope growth. Cite: `packages/cli/templates/hooks/lib/active-ticket.ts` and `replan.ts`.

**Premortem:** A future-dated value could hide newer work; obtain the value from the current UTC clock at edit time.

**Next:** Set `ticket.md` `last_modified` to the current UTC timestamp.

### C. Reflow the phase JSDoc in both managed copies

- [x] Phase 1: Decide whether to leave, reflow manually, or apply a formatter to the typecheck phase JSDoc.
- [x] Phase 2: Options were (1) leave the ragged comment, (2) manually reflow the three documentation lines in template and dogfood, or (3) add a formatter rule.
- [x] Phase 3a: Research domains — TypeScript contract readability, managed-template parity, and formatter responsibility.
- [x] Phase 3b: The comment documents an existing `string | undefined` phase contract; the repository's mirror is byte-identical, and code formatters do not make editorial wrapping decisions for prose.
- [x] Phase 4: Chose the mirrored manual reflow.

> Recommend **reflow the JSDoc in both copies** because it improves the local contract without changing behavior or adding tooling. Leaving it is harmless but needlessly less readable; a formatter rule is bloat. Cite: `packages/cli/templates/hooks/lib/typecheck-gate.ts` (`TypecheckGateInput`).

**Premortem:** A future template change could desynchronize the copy; run the repository parity check after the edit.

**Next:** Reflow the three JSDoc lines in `packages/cli/templates` and `.safeword`, then run parity and focused tests.

## Pass 8 — latest PR #1652 refactor findings

### A. Share duplicated Stop-hook test mechanics without weakening frozen-format coverage

- [x] Phase 1: Decide whether to retain duplicated test helpers, share only their mechanics, or merge the two integration suites.
- [x] Phase 2: Options were (1) leave the copies, (2) add one test-only helper for simple transcript/process/ticket/state mechanics, or (3) merge the suites into one large file.
- [x] Phase 3a: Research domains — frozen-fixture ownership, integration-test isolation, process invocation, and duplicate-drift risk.
- [x] Phase 3b: The two suites used equivalent simple edit transcripts and Stop invocations; the real-format fixture and all scenario assertions remain suite-specific. The shared helper continues to spawn the real installed hooks and uses the same bounded `spawnSync` process boundary.
- [x] Phase 4: Chose the narrow test-only helper.

> Recommend **share only the duplicated mechanics** because one simple edit-transcript definition keeps the frozen-format guard meaningful without merging unrelated scenarios. Leaving copies risks drift; merging suites harms ownership and readability. Cite: [Node child-process documentation](https://nodejs.org/api/child_process.html) and `stop-hook-transcript-format.test.ts`.

**Premortem:** The helper could grow into an opaque test framework; keep its exports limited to file/process mechanics and retain all fixtures and assertions in the calling suites.

**Next:** Add `tests/helpers/stop-hook.ts` and run the four real-hook suites.

### B. Derive the Stop writer patch from the shared state contract

- [x] Phase 1: Decide whether to retain the handwritten two-field patch type, use `Pick<QualityState, ...>`, or accept all `Partial<QualityState>` fields.
- [x] Phase 2: Options were (1) keep the handwritten object, (2) select precisely the two schema fields with `Pick`, or (3) widen the parameter to every partial state field.
- [x] Phase 3a: Research domains — TypeScript utility-type semantics, shared state-schema evolution, and call-site containment.
- [x] Phase 3b: TypeScript documents `Pick` as selecting named properties from a type; both existing call sites supply exactly these optional fields, while `Partial<QualityState>` would permit unrelated writes.
- [x] Phase 4: Chose the precise `Pick`.

> Recommend **use `Pick<QualityState, 'lastReviewedPhase' | 'stopQualityReviewAwaitingUserPrompt'>`** because it binds the parameter to the schema without widening its authority. The handwritten type can drift; `Partial` loses the function's narrow contract. Cite: [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys).

**Premortem:** A future marker field may need to be written here and be omitted from the pick; make that field addition an explicit contract change alongside its call site and test.

**Next:** Replace the parameter type in both template and dogfood hooks, then typecheck.

### C. Move the touched test fixtures to the preferred namespace root

- [x] Phase 1: Decide whether the four touched suites should retain legacy `.safeword-project` fixtures, use canonical `.project`, or test both roots in every suite.
- [x] Phase 2: Options were (1) retain legacy fixtures, (2) migrate these fixtures to `.project`, or (3) duplicate every scenario across both roots.
- [x] Phase 3a: Research domains — namespace-root precedence, migration compatibility, fixture isolation, and regression ownership.
- [x] Phase 3b: `resolveNamespaceRoot` chooses configured roots, then `.project`, then the legacy root. Dedicated namespace-resolution coverage owns fallback behavior; the touched Stop-hook scenarios should exercise the preferred customer path once, not duplicate every case.
- [x] Phase 4: Chose canonical `.project` fixtures.

> Recommend **migrate the four touched fixture suites to `.project`** because it tests the default resolution path consistently while preserving legacy-fallback coverage in the namespace resolver's own tests. Keeping legacy fixtures validates a fallback as the default; duplicating all scenarios is bloat. Cite: `packages/cli/templates/hooks/lib/namespace-root.ts` (`resolveNamespaceRoot`).

**Premortem:** A test might accidentally create both roots and mask precedence; each fixture creates only `.project`, so a resolution mistake still fails its real-hook assertion.

**Next:** Replace the legacy fixture paths in the four touched suites and rerun their real-hook tests.

## Pass 11 — latest PR #1652 helper comments

### A. Keep or reshape `runStopHook` optional arguments

- [x] Phase 1: Decide whether to keep the two optional trailing positional arguments, migrate every call to an options object, or add an overload/convenience wrapper.
- [x] Phase 2: Options were (1) retain `sessionId?` plus the default assistant message, (2) replace the trailing values with an options object, or (3) add another wrapper/overload for custom assistant messages.
- [x] Phase 3a: Research domains — TypeScript optional/default semantics, real call-site ergonomics, and test-helper API growth.
- [x] Phase 3b: TypeScript confirms an explicit `undefined` is the normal way to skip an optional value before a defaulted parameter. The helper has 18 real calls (13 frozen-transcript, 5 idle-review), while only two intentionally skip `sessionId` to set a custom message.
- [x] Phase 4: Chose the existing signature.

> Recommend **keep the current positional signature** because an 18-site, behavior-neutral migration removes only two readable placeholders. An options object was close on future extensibility but loses on churn and the current common call shape. Cite: [TypeScript optional parameters](https://www.typescriptlang.org/docs/handbook/2/functions.html#optional-parameters).

**Premortem:** A third independent optional value could make positional calls genuinely ambiguous; reconsider an options object before adding that parameter.

**Next:** Reply that ledger entry 19 records the corrected call-site count and resolve both signature mentions without a code change.

### B. Widen this PR or hand off the four remaining spawners

- [x] Phase 1: Decide whether to convert the four remaining hand-rolled Bun spawners now, convert only the Stop sibling, or leave the bounded follow-up in #1708.
- [x] Phase 2: Options were (1) widen this PR to all four, (2) add only `stop-done-dependencies-gate.test.ts`, or (3) retain #1708 for independent, piecemeal conversion.
- [x] Phase 3a: Research domains — Node subprocess configuration, test-scope containment, custom environment preservation, and narrowed return contracts.
- [x] Phase 3b: Node documents `input`, `cwd`, `env`, `encoding`, and `timeout` as `spawnSync` behavior. The four candidates are outside this PR and some deliberately add custom environment values; #1708 inventories them and requires checking that consumers only need `{ status, stdout, stderr }` before each conversion.
- [x] Phase 4: Chose the existing follow-up issue.

> Recommend **keep the remaining spawners in [#1708](https://github.com/ArcadeAI/safeword/issues/1708)** because the current PR's helper is proven, but the four untouched callers have independent return-shape and environment contracts. Folding them in now turns a focused review resolution into scope creep. Cite: [Node `spawnSync` options](https://nodejs.org/api/child_process.html#child_processspawnsynccommand-args-options).

**Premortem:** The follow-up could languish and leave the copies drifting; #1708 names every site and its conversion caveat, so schedule it when any affected hook test next changes.

**Next:** Reply that #1708 owns the untouched runners and resolve the thread without widening PR #1652.
