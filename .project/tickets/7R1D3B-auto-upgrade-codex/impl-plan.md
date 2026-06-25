# Impl Plan: Auto-Upgrade under Codex

**Status:** implemented

## Approach

Extract the current Claude auto-upgrade logic into a typed shared core, then make Claude and Codex wrappers map that outcome to their own hook contracts.

| Scenario | Layer | Implementation path |
| --- | --- | --- |
| `auto-upgrade-codex.TB1.AC1.fresh_setup_wires_one_codex_sessionstart_dispatcher` | Integration | Extend setup reconcile coverage to assert `.codex/config.toml` contains exactly one `[[hooks.SessionStart]]` block, points to `session-codex-start.ts`, and no longer points directly at `session-safeword-context.ts`. |
| `auto-upgrade-codex.TB1.AC2.codex_dispatcher_emits_safeword_context_after_upgrade_check` | Integration | Spawn the installed dispatcher in a setup fixture with upgrade checks disabled/no-op and assert Codex JSON contains SessionStart `additionalContext`. |
| `auto-upgrade-codex.SM1.AC1.claude_wrapper_preserves_async_rewake_notices` | Unit | Test the Claude outcome mapper so a `notify` result still becomes stderr plus exit code 2. |
| `auto-upgrade-codex.TB1.AC3.codex_dispatcher_never_uses_exit_two_for_notices` | Unit/Integration | Test the Codex mapper/dispatcher so notice outcomes return status 0 and appear in Codex JSON output. |
| `auto-upgrade-codex.SM1.AC2.failed_apply_rolls_back_safeword_managed_files` | Unit | Test rollback helper/core with injected git command behavior for tracked and untracked safeword-managed files. |

Build order: write failing tests for Codex config and rollback, extract the shared core, add the Codex dispatcher, update schema/template registration, then run targeted tests.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Codex SessionStart shape | One dispatcher hook | Add a second auto-upgrade SessionStart hook | Codex runs matching hooks concurrently, so context could read `.safeword/` while upgrade writes it. |
| Core contract | Typed outcomes | Keep process exits inside shared code | Claude exit-2 rewake is not Codex's contract and would turn notices into hook failures. |
| Failure handling | Roll back safeword-managed apply residue before recording strike | Only record strike | A failed synchronous hook should not leave the user's tree dirty or block future auto-upgrade attempts. |

## Arch alignment

- Honors "Schema as Single Source of Truth" by registering new hook templates and Codex config wiring in `packages/cli/src/schema.ts`.
- Honors "Reconciliation Over Copy" by updating templates and schema patches rather than editing installed configs directly.
- Keeps Claude Code behavior intact by preserving the existing wrapper-facing asyncRewake signal.

## Known deviations

- This ticket does not implement full `safeword hook <name>` CLI migration from D6GTXY.
- Real-world timeout tuning remains a follow-up if `bunx safeword@version upgrade` proves too slow inside Codex `SessionStart`.

## Assessment triggers

- Revisit dispatcher composition if Codex adds ordered hook execution or native background hooks.
- Revisit rollback scope if safeword-managed files move outside the owned-path filter.
- Revisit output mapping if Codex changes its SessionStart JSON schema.

## Reconciliation

- Decisions updated: 1 (single Codex dispatcher from quality-review).
- Deviations recorded: 1 (the local dogfood `.codex/config.toml` had no managed SessionStart block to rewrite, so it was updated directly to match the template dispatcher block).
- Implementation matched the shared-core, per-agent-wrapper, and rollback plan.
