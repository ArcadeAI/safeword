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
- [x] Phase 4: Chose an explicit failed-job rerun plus a fresh CI run from the corrective commit.

> Recommend **rerunning the failed Node 24 job and requiring the fresh branch CI to pass** because timeout shape alone is not proof of a flake. Changing unrelated adapters would be speculative. Cite: [GitHub Actions rerun reference](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).

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
