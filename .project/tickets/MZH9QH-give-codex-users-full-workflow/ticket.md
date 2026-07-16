---
id: MZH9QH
slug: give-codex-users-full-workflow
type: feature
phase: verify
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/MZH9QH-give-codex-users-full-workflow/spec.md'
  - 'scenario-gate: packages/cli/features/give-codex-users-full-workflow.feature'
  - 'plan-implementation: packages/cli/features/give-codex-users-full-workflow.feature'
  - 'implement: .project/tickets/MZH9QH-give-codex-users-full-workflow/impl-plan.md'
  - 'verify: .project/tickets/MZH9QH-give-codex-users-full-workflow/test-definitions.md'
scope:
  - Generate the Codex plugin skill catalogue from every workflow under `packages/cli/templates/skills/`, including supporting phase documents as plugin references.
  - Define and test the small, explicit transformation allowlist required for Codex-compatible skill metadata, scoped skill invocation, and packaged reference paths.
  - Replace Codex parity checks that expect retired repository-local workflow assets with package, cache, and installed-plugin proofs.
  - Make Codex migration a safe two-step handoff: install and enable the profile plugin without removing legacy hooks, then retire only Safe Word-owned hooks through an explicit post-trust cleanup action.
  - Make missing or stale plugin-hook trust visible and blocking: Codex must skip the affected hook and direct the user to review it, while Safe Word preserves legacy hooks and never bypasses or edits Codex trust state.
  - Extend release, integration, live-smoke, and documentation coverage for the generated profile plugin while retaining Bunx-only hook commands.
out_of_scope:
  - Rewriting Safe Word workflow policy or changing the canonical template content except for unavoidable Codex path and invocation adaptation.
  - Changing Claude Code or Cursor workflow delivery, schema ownership, or behavior.
  - Automatically installing a Codex profile plugin during `safeword setup` or `safeword upgrade`.
  - Bypassing or mutating Codex's undocumented plugin-hook trust state.
  - Supporting Codex Cloud, an npx path, or a Node-only fallback for the Bun-required Codex integration.
done_when:
  - The packed Codex plugin contains every canonical Safe Word skill and each supporting reference asset required by that skill's workflow, with no unexpected content difference outside the allowlist.
  - Source, packed-package, and isolated installed-plugin tests detect missing skills, missing BDD phase references, and stale platform paths; generated skill metadata stays within Codex's documented 8,000-character fallback discovery budget, while explicit scoped invocation remains available when Codex shortens or omits an initial listing.
  - Fresh setup, initial migration, and an isolated installed-plugin session leave no Safe Word-owned workflow tree under the target project's `.agents`, `.codex`, or `.safeword` directories.
  - Initial migration preserves legacy Safe Word hooks and gives the builder the trust handoff; an explicit completion action removes only Safe Word-owned legacy hooks while preserving user-authored configuration.
  - A fresh or changed Safe Word plugin hook that has not been trusted is skipped with Codex's review-required warning, and Safe Word leaves legacy hooks in place until the user completes the handoff.
  - Codex persona-lineage coverage reads the packaged plugin model rather than retired repository-local BDD files, and Claude Code and Cursor regression checks remain unchanged.
  - The published documentation explains complete scoped skill availability, the two-step migration, and Bunx-only hooks.
created: 2026-07-15T18:26:26.899Z
last_modified: 2026-07-16T15:45:00.000Z
---

# Give Codex users the full Safe Word workflow

**Goal:** Provide Codex users the complete Safe Word workflow from the profile plugin without installing workflow files into their repositories.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-15T18:26:26.899Z Started: Created ticket MZH9QH
- 2026-07-16T15:08:00.000Z RED: `bun run --cwd packages/cli test:bdd -- --tags '@codex-workflow.TBU1.R1'` reported two undefined scenarios and nine undefined steps for the first plugin-catalogue acceptance contract.
- 2026-07-16T15:15:00.000Z RED: `bun run --cwd packages/cli test tests/commands/migrate-codex-plugin.test.ts` proved initial migration deletes legacy hooks and rejects the explicit `--remove-legacy-hooks` handoff command.
- 2026-07-16T15:40:03.000Z GREEN: `6e5492f3` removed the empty project-local Codex scaffold, centralized Bunx hook policy, and aligned migration and published documentation with the explicit trust handoff.
- 2026-07-16T15:41:42.000Z GREEN: `47f89f44` bound every deterministic scenario to real generator, package, cache, setup, and hook-policy contracts; `bun run --cwd packages/cli test:bdd` passed 83 scenarios and 986 steps.
- 2026-07-16T15:44:26.000Z Phase transition: all executable scenarios are green; manual Codex trust evidence is recorded in `packages/cli/tests/smoke/codex-plugin-manual-acceptance.md`. Moving to verification.
- 2026-07-16T15:45:00.000Z Process correction: normalized the R/G/R ledger to the ticket validator's one-distinct-SHA-per-RED/GREEN contract; explanatory provenance remains in the ticket work log.
