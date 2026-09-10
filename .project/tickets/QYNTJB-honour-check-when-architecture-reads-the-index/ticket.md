---
id: QYNTJB
slug: honour-check-when-architecture-reads-the-index
type: patch
phase: todo
status: todo
scope: |
  Make `safeword project architecture --check` report drift without writing,
  in every option combination. Today `--check` is silently ignored whenever
  `--from-index` (or a legacy `--stage` / `--staged` alias) is also supplied.

  WHERE: architectureHandler, packages/cli/src/cli-protocol/public-handlers.ts.
  The dispatch order is:

    if (mode.fromIndex) {
      const result = await runArchitectureStagedTreeMode(
        invocation, mode.stageOutput ? 'stage' : 'staged');
      return withArchitectureOptionCompatibility(result, mode.legacy);
    }
    ...
    if (invocation.options.check === true) { /* read-only drift report */ }

  The `fromIndex` branch returns before the `check` branch is ever reached, so
  `--check` cannot take effect on that path. `runArchitectureStagedTreeMode`
  calls `architectureStage` / `architectureStaged`, which regenerate the
  architecture documents; with `--stage-output` it also stages them into the
  Git index.

  Nothing rejects the combination either: `architectureOptionsConflict` only
  guards legacy-vs-canonical option mixing, and the `--stage-output requires
  --from-index` guard does not consider `--check`.

  IMPACT: `--check` is documented as "Report drift without writing". A caller
  that trusts that — a pre-commit hook, a CI drift gate, a human inspecting
  before deciding — gets its working tree mutated instead, and with
  `--stage-output` gets files added to the index. A read-only flag that writes
  is worse than no flag, because the caller has explicitly asked not to write.

  FIX (either is acceptable; prefer the second if index-mode drift reporting
  is wanted):
  1. Reject `--check` combined with `--from-index` / `--stage-output` before
     dispatch, with CLI_ARGUMENT_INVALID, so the flag can never be silently
     dropped.
  2. Implement a genuine read-only index check: compute the staged-tree drift
     and return architectureCheckResult without invoking the writing path.

  PROVENANCE: found by an independent cross-agent Codex review
  (`safeword review run quality-review packages/cli/src/cli-protocol/public-handlers.ts`)
  on 2026-09-05, verdict request_changes. Pre-existing, not introduced by the
  handler-split refactor in the same branch — the dispatch lines were last
  touched by 7873ac1da "feat: clarify architecture input and staging".
out_of_scope:
  - The public-handlers.ts domain split (separate refactor work).
  - The duplicated --stage/--staged legacy mapping across architecture.ts, public-handlers.ts and catalog.ts (separate ledger item).
  - Changing what --from-index or --stage-output do when --check is absent.
done_when:
  - `project architecture --check --from-index` never regenerates or stages a document.
  - `project architecture --check --from-index --stage-output` never writes to the Git index.
  - The behaviour is pinned by a test that fails against today's dispatch order.
  - Legacy `--stage` / `--staged` aliases behave identically to their canonical equivalents under `--check`.
---

## Why now

`--check` is the flag callers reach for precisely when they do not want a
mutation — drift gates, pre-commit checks, inspection before committing. The
one combination where it is ignored is also the one most likely to appear in
automation, since `--from-index` is what a hook uses to inspect staged content.

## Evidence

Read from the dispatch order rather than executed, deliberately: reproducing it
in this repository would regenerate `packages/cli/architecture.generated.md`
and, with `--stage-output`, stage it. Any reproduction should run in a scratch
clone.
