---
id: Q7Q7H8
slug: install-codex-plugin-for-new-users
type: feature
phase: done
status: done
phase_anchors:
  - define-behavior: .project/tickets/Q7Q7H8-install-codex-plugin-for-new-users/spec.md
  - scenario-gate: packages/cli/features/install-codex-plugin-for-new-users.feature
  - plan-implementation: packages/cli/features/install-codex-plugin-for-new-users.feature
  - implement: .project/tickets/Q7Q7H8-install-codex-plugin-for-new-users/impl-plan.md
  - verify: .project/tickets/Q7Q7H8-install-codex-plugin-for-new-users/test-definitions.md
  - done: .project/tickets/Q7Q7H8-install-codex-plugin-for-new-users/verify.md
scope: Add a profile-scoped `safeword codex install` command; make setup, upgrade, and public documentation direct new Codex users to it; expose explicit legacy-hook cleanup as `safeword codex migrate --remove-legacy-hooks`; preserve the existing `safeword migrate codex-plugin` command as a compatible legacy alias.
out_of_scope: Automatically installing or trusting a profile plugin during setup or upgrade; changing Codex's profile-vs-project scope; removing legacy hooks without an explicit cleanup request; removing the existing migration command.
done_when: A new user can run setup followed by `safeword codex install` and get a verified profile plugin with no project Codex files, while a legacy user can explicitly clean Safe Word hook registrations without reinstalling the plugin or changing custom configuration.
created: 2026-07-22T06:29:59.354Z
last_modified: 2026-07-22T06:29:59.354Z
---

# Let new Codex users install Safe Word without a migration

**Goal:** Give new Codex users an explicit installation command while keeping legacy hook cleanup separate.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-22T06:29:59.354Z Started: Created ticket Q7Q7H8
- 2026-07-22T06:30:00Z Intake: Classified as a feature because the public CLI, profile lifecycle, setup/upgrade guidance, and legacy compatibility path must change together.
- 2026-07-22T06:31:00Z Define behavior: Saved six Codex CLI scenarios and ran the feature lane. The new scenarios are red because their steps and command behavior do not yet exist.
- 2026-07-22T06:32:00Z Plan: Separated profile installation, explicit legacy cleanup, and legacy-command compatibility into independently verifiable paths.
- 2026-07-22T06:40:00Z Implement: Added `codex install` and explicit `codex migrate --remove-legacy-hooks`, retained the legacy route, and updated setup, upgrade, README, and website guidance.
- 2026-07-22T06:48:00Z Refactor: Reused the existing upgrade acceptance action and confirmed no remaining cross-scenario duplication needs extraction.
- 2026-07-22T06:55:00Z Quality review: Confirmed the documented Codex plugin commands and JSON verification fields against current official OpenAI documentation. Added the required instruction to start a new Codex session after installation.
- 2026-07-22T07:00:00Z Verify: Focused command regression passed 49/49, the new BDD feature passed 6/6 scenarios and 73/73 steps, the full BDD lane passed 490 scenarios with 3 intentional skips, CLI and website builds passed, and lint/type/format/config checks passed. Fixed the legacy missing-Bun BDD fixture so it actually clears the PATH when its runtime is absent. Verify, audit, and quality-review invocation records were written with the current Codex thread identity. The broad Vitest suite stalled without output after eleven minutes and was stopped; direct BDD and focused integration evidence remain green.
- 2026-07-23T14:40:00Z Verify: Added three rejection scenarios required by the BDD completeness check: fresh setup does not recommend legacy migration, failed profile installation leaves no project configuration, and the legacy compatibility path fails without project mutation. Targeted BDD passed 3/3 scenarios and 37/37 steps.
- 2026-07-23T16:41:00Z Done: Full Vitest passed 353 files / 5225 tests with 5 intentional skips. Final BDD passed 92/92 scenarios and 1096/1096 steps. Focused Codex command regression passed 49/49; lint and TypeScript checks passed. No separate issue is needed: the only closeout gaps were resolved within this ticket.
- 2026-07-23T16:45:00Z Plan implementation: Recorded the reviewed implementation plan as the basis for the implementation phase.
- 2026-07-23T16:46:00Z Implement: Recorded the completed behavior and command changes against the reviewed test-definition ledger.
- 2026-07-23T16:47:00Z Verify: Recorded the passing full-suite, BDD, focused regression, lint, and typecheck evidence in verify.md.
