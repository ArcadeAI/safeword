# Cursor reviewer continuation handoff

Date: 2026-09-03.

## Recover this state

Fetch `origin/codex/opencode-independent-review-fallback` and create a local branch
or worktree from its tip. Read `AGENTS.md`, the packaged Safeword handbook, and the
applicable planning, testing, architecture, and LLM-integration guides before edits.
Safeword protection was reported unverified in the originating Codex task; verify
the installed hooks after restarting rather than assuming they are current.

## Delivered and preserved

PR #3617 was admin squash-merged after green CI. Its merged remote head was
`5e3a5659859e9b6dbfbe08648fd54c320b5e5567`; merge commit was
`258b1055e4be7a3ef71b60c16fd59aef6a210e49`.

Eight later characterization-test commits strengthen public CLI and BDD proof for
OpenCode, ranked routes, scoped routes, model dispatch, and status history. They
were intentionally not part of PR #3617 and should remain a distinct delivery.
Prior evidence recorded 145 root wiring/BDD-gate tests passing, 71 other tests
passing in the preceding expanded run, and passing typecheck/precommit lint. Run
fresh full verification before the next PR; do not treat those historical counts
as current-head verification.

The review documents in this directory capture the approved small adapter design,
its independent quality review, official sources, and the Cursor feasibility proof.
The design uses trusted bundled adapters plus a shared runner and validator, not
arbitrary executable configuration or a general dynamic plugin system.

## Cursor feasibility result

The installed Cursor CLI version `2026.08.25-3e8eec8` successfully performed a
synthetic review using exact advertised model ID `composer-2.5` under a disposable
macOS sandbox. Existing authentication was handed to the isolated child in memory.
Actual edit and shell tool calls were denied, and neither marker file was created.

This is positive feasibility evidence, not release conformance. Remaining gates
include portable confinement, ambient system/managed hooks and plugins, network,
read, MCP, credential persistence, complete result validation, and timeout/cleanup
coverage. The temporary probe under `/tmp` is machine-local evidence and is not
production code; its conclusions are preserved in `cursor-feasibility.md`.

## Important unresolved behavior

Do not silently alter the scenario named `A terminal preferred-reviewer failure
skips retries`. Its old expectation says fallback, while the runtime's terminal
flag means an uncontained process and therefore halts the chain. Resolve the
scenario wording/intent explicitly before changing either the scenario or runtime.

## Recommended continuation

1. Re-observe the fetched branch, current upstream, and repository state.
2. Inspect the eight characterization commits and run full verification, audit,
   refactor review, and quality review; make justified edits and prepare their own PR.
3. Create or resume the feature ticket for the reviewer-adapter/Cursor work. Capture
   the approved proposal as behavior and an implementation plan before production
   edits; preserve current Claude, Codex, and OpenCode behavior as characterization.
4. Implement the smallest registry-backed adapter contract, shared runner/validator,
   Cursor adapter, explicit author ranking/model configuration, and a synthetic
   test-only adapter proving extensibility. Keep default routing policy separate.
5. Satisfy the remaining Cursor conformance gates, then run full verification,
   dependency audit, refactor review, independent quality review, and PR readiness.

Do not combine the characterization-test delivery and new adapter implementation
without first checking scope and history; separate PRs will be easier to review.
