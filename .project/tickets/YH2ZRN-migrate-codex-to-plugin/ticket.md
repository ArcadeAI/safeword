---
id: YH2ZRN
slug: migrate-codex-to-plugin
type: feature
phase: done
status: done
phase_anchors:
  - 'define-behavior: .project/tickets/YH2ZRN-migrate-codex-to-plugin/spec.md'
  - 'scenario-gate: packages/cli/features/migrate-codex-to-plugin.feature'
  - 'plan-implementation: .project/tickets/YH2ZRN-migrate-codex-to-plugin/impl-plan.md'
  - 'implement: .project/tickets/YH2ZRN-migrate-codex-to-plugin/impl-plan.md'
  - 'verify: .project/tickets/YH2ZRN-migrate-codex-to-plugin/test-definitions.md'
  - 'done: .project/tickets/YH2ZRN-migrate-codex-to-plugin/verify.md'
scope:
  - Add an explicit `safeword migrate codex-plugin` command that installs Safe Word's Codex plugin into the active Codex profile and verifies it is enabled before changing the project.
  - Retire Safe Word-owned project-local Codex hook stanzas after verified migration, while preserving user-authored Codex configuration and hooks.
  - Stop new Safe Word setup from creating project-local Codex hooks; the Codex integration is plugin-only and its hook commands use Bunx.
  - Prove migration with deterministic command tests, packed-artifact checks, and an opt-in live Codex profile smoke.
out_of_scope:
  - Automatically installing a profile-scoped plugin during `safeword setup` or `safeword upgrade`.
  - Changing Claude Code or Cursor installation behavior.
  - Providing an npx/Node fallback for Codex plugin hooks; Bun is a requirement for this Codex path.
done_when:
  - A normal upgrade retains legacy Codex hooks until the user explicitly runs the migration.
  - A successful initial migration adds and enables the Safe Word plugin in the active Codex profile while preserving legacy hooks; the explicit post-trust cleanup action removes only Safe Word-owned legacy hook stanzas.
  - A failed or unverified plugin installation leaves the project configuration unchanged and gives a clear remediation message.
  - Fresh setup produces no Safe Word project-local Codex hooks, and no Codex integration path in the shipped package invokes npx.
  - Tests prove source and packed-artifact contracts, command ordering, preservation behavior, and a real isolated-profile plugin run.
created: 2026-07-14T13:38:08.497Z
last_modified: 2026-07-17T15:58:30Z
---

# Move Codex users to the Safe Word plugin

**Goal:** Let existing Safe Word Codex projects move to the profile-scoped plugin without duplicate hooks or lost enforcement.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-14T13:38:08.497Z Started: Created ticket YH2ZRN
- 2026-07-14T13:39:21Z Intake: Confirmed Codex plugin commands install into the active profile and `plugin list --json` exposes `installed` and `enabled`; migration will verify that response before removing project hooks.
- 2026-07-14T13:45:44Z Phase: intake -> define-behavior after resolving marketplace, profile verification, preservation, and Bun runtime questions.
- 2026-07-14T13:47:42Z Scenario gate: Gherkin lint and diff check passed. Added disabled-plugin and missing-Bun rejection scenarios. Independent fresh-context review attempted with `codex exec --sandbox read-only` but blocked because local Codex v0.141.0 cannot run the configured `gpt-5.6-terra` model; defer independent re-review to verification after the CLI is updated.
- 2026-07-14T13:47:42Z Phase: define-behavior -> plan-implementation.
- 2026-07-14T13:49:00Z Plan: wrote a parse-valid planned impl-plan.md with migration ordering, test layers, documentation work, and a Bunx-only release contract. Independent plan review is pending for the same environment reason as the scenario review: local Codex v0.141.0 cannot start the configured model. Re-run it during verification with a compatible Codex CLI.
- 2026-07-14T13:49:00Z Phase: plan-implementation -> implement.
- 2026-07-17T15:58:30Z Complete: MZH9QH superseded this ticket's earlier one-step cleanup acceptance with the safer install-review-explicit-cleanup handoff. The implemented migration, release, packed-artifact, and isolated profile proofs passed the full current regression suite; closing this historical migration slice with the combined delivery.
