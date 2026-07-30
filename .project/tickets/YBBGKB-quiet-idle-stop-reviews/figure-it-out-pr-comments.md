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
