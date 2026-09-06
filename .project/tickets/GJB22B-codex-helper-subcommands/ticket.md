---
id: GJB22B
slug: codex-helper-subcommands
type: task
phase: done
status: done
parent: 2C1E82
created: 2026-08-19T04:59:19.066Z
last_modified: 2026-08-30T08:00:00.000Z
---

# Add public CLI subcommands for Codex's remaining resolver and audit-trace scripts

**Goal:** Build public subcommands for resolve-project-knowledge.ts, resolve-namespace-root.ts, resolve-verify-ticket.ts, audit-principle-trace.ts, and drain-retro-spool.ts, then rewrite their invocations in explain/verify/audit/retro-filer skills to a pinned bunx call, following the run-review.ts precedent in catalogue.ts

**Why:** Each script is invoked directly by a Codex skill (explain, verify, audit, retro-filer) but has no public CLI entry point today; unlike run-review.ts none of these have an existing public subcommand to redirect to, so this is new surface, not just a text rewrite - group them since they share the same shape of fix and are individually small (10-271 lines)

## Work Log

- 2026-08-19T04:59:19.066Z Started: Created ticket GJB22B
- 2026-08-19T05:00:00.000Z Added drain-retro-spool.ts (retro-filer skill) to scope - it's `bun`-executed like the other four, not sourced, so it fits the same pattern.
- 2026-08-19T16:35:00.000Z Landed the first two subcommands: `project namespace-root` (replacing resolve-namespace-root.ts, 5 call sites across explain/audit) and `project review-knowledge` (replacing resolve-project-knowledge.ts in self-review). Both are pure resolvers reusing `src/utils/configured-paths.ts`, so each rewrite is a faithful swap. Remaining: resolve-verify-ticket.ts (271 lines, its own `--ticket` flag plus a git-diff fallback — the one real design surface left), audit-principle-trace.ts, drain-retro-spool.ts.
- 2026-08-19T05:30:00.000Z First of five done: `safeword project namespace-root [--key <key>]` shipped and wired into the Codex catalogue, replacing all 5 `resolve-namespace-root.ts` call sites in the explain and audit skills. A `/figure-it-out` settled the shape: one subcommand with an optional flag rather than two subcommands, matching the `project codify`/`project architecture` precedent of gating behavior through flags. Verified every existing call site passes a default basename of `<key>.md` — already the subcommand's own default — so `--key` alone covers real usage and no `--default` flag is needed; a non-default basename is deliberately left un-rewritten rather than silently resolving a different file. Machine envelope carries a project-relative path (the CLI machine-contract test requires byte-identical stdout across checkouts); raw stdout stays absolute for the skills' `$( )` captures. Independent Codex review raised nothing against the new code. Committed 1cd1f6b1c, in PR #3205.
- 2026-08-19T05:45:00.000Z Second of five done: `safeword project review-knowledge` replaces `resolve-project-knowledge.ts` across 4 call sites (self-review, review-spec, quality-review, bdd/PLAN_IMPLEMENTATION). Same keys/flags/content as the hook; path is project-relative for machine-contract determinism.
- 2026-08-19T05:45:00.000Z **CI caught a real miss on the first PR push.** Adding the `version` parameter to `assertCodexPluginCatalogue` left three call sites outside `packages/cli/{src,tests}` still calling it without a version, so they regenerated an un-rewritten catalogue and compared it against the rewritten checked-in one: `packages/retro-relay/tests/cli-wiring.integration.test.ts` (9 failing tests on both Node versions) and two in `packages/cli/features/steps/give-codex-users-full-workflow.steps.ts`. Root cause was scoping the original grep to `packages/cli` instead of the repo — exactly the failure mode `feedback_exhaustive_grep_on_token_removal` warns about. Local `test:release` did not catch it because retro-relay is a separate package with its own suite. Fixed all three; `bun run test` (the CI command, both packages) is now the verification bar for this ticket, not `test:release` alone.
- Remaining in this ticket: resolve-verify-ticket.ts, audit-principle-trace.ts, drain-retro-spool.ts. Note `resolve-verify-ticket.ts` (271 lines, spawns git, reads session state, has its own `--ticket` flag) is materially larger than the other two and may warrant its own scoping pass.
- 2026-08-30T08:00:00.000Z Completed by epic 2C1E82: the remaining resolver, audit-trace, and retro helpers are exposed through packaged project commands/runtime entry points.
