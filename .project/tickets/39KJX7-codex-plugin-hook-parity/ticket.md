---
id: 39KJX7
slug: codex-plugin-hook-parity
type: feature
phase: implement
status: in_progress
phase_anchors:
  - 'define-behavior: .project/tickets/39KJX7-codex-plugin-hook-parity/spec.md'
  - 'scenario-gate: packages/cli/features/codex-plugin-hook-parity.feature'
  - 'implement: .project/tickets/39KJX7-codex-plugin-hook-parity/impl-plan.md'
scope:
  - Make `safeword hook codex <event>` preserve the behavior of the legacy repo-local Codex hook adapters for supported Codex events.
  - Keep plugin hook commands package-runner based, with no dependency on customer repo-local `.safeword/hooks/codex/*` implementation files.
  - Prove parity with executable BDD scenarios and focused integration tests before running live smoke.
out_of_scope:
  - Changing Claude Code or Cursor hook behavior except where a shared helper is reused without behavior change.
  - Publishing a remote Codex marketplace entry; this ticket uses the existing isolated local marketplace/live smoke path.
  - Making plugin hooks trusted automatically; Codex hook trust remains a user/Codex policy boundary.
done_when:
  - Legacy Codex adapter behavior is audited event by event against the packaged CLI path.
  - Every must-preserve behavior has a scenario and test-backed implementation, or an explicit defer decision in the ticket artifacts.
  - Default verification, quality review, and opt-in live smoke evidence are recorded before the PR is considered ready.
created: 2026-07-13T04:56:40.447Z
last_modified: 2026-07-13T05:02:00.000Z
---

# Preserve Codex hook behavior through the plugin CLI

**Goal:** Make the Codex plugin CLI path preserve the legacy Codex hook behavior and prove it with executable parity tests plus live smoke evidence.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-13T04:56:40.447Z Started: Created ticket 39KJX7
- 2026-07-13T05:02:00Z Intake: Scoped the follow-up as production parity, not the already-completed Codex plugin migration harness. Legacy adapters include PreToolUse quality gates and proof bridges, PostToolUse quality/skill nudges, Stop architecture/retro/filing behavior, self-report crash capture, and SessionStart auto-upgrade/context behavior.
- 2026-07-13T05:04:00Z Phase: intake -> define-behavior after filling scope, out_of_scope, done_when, and spec.md with resolved/deferred open questions.
- 2026-07-13T05:12:00Z Scenario review: Independent reviewer found 2 must-fix and 3 should-strengthen issues; added missing surface tags, compatibility-alias coverage, UserPromptSubmit empty-queue coverage, PostToolUse no-nudge coverage, and rationale/follow-up requirements for defer decisions.
- 2026-07-13T05:18:00Z Phase: define-behavior -> plan-implementation after Gherkin lint passed, independent scenario review issues were fixed, and impl-plan.md captured proof layers and sequencing.
- 2026-07-13T16:51:00Z Phase: plan-implementation -> implement after impl-plan.md was corrected to include required sections, explicit self-report defer, constrained legacy-adapter cleanup, and concrete proof owners.
