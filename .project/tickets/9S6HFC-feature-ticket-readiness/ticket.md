---
id: 9S6HFC
slug: feature-ticket-readiness
type: feature
phase: implement
status: in_progress
created: 2026-06-24T22:24:57.191Z
last_modified: 2026-06-24T23:30:26.000Z
external_issue: https://github.com/ArcadeAI/safeword/issues/404
scope:
  - Add a shared feature-ticket readiness check for the intake artifacts required before define-behavior work can begin.
  - Block feature ticket phase edits that enter `define-behavior` while readiness is missing.
  - Surface a clear readiness message on resume for legacy in-progress feature tickets already in `define-behavior`.
  - Keep the readiness rule aligned with the existing late `test-definitions.md` prerequisite gate: ticket frontmatter, `spec.md` JTBD/AC framing, and `dimensions.md` or valid `skip:` reason.
  - Sync dogfood hooks and CLI templates; prove behavior with focused hook tests.
out_of_scope:
  - Auto-scaffolding missing files or mutating ticket status to `blocked`.
  - Changing task or patch workflow readiness requirements.
  - Replacing the existing `test-definitions.md` prerequisite gate.
  - Changing BDD scenario authoring rules beyond the pre-entry readiness check.
done_when:
  - A feature ticket cannot newly advance into `define-behavior` until required readiness artifacts pass validation.
  - A legacy in-progress feature ticket already in `define-behavior` receives an upfront readiness message with missing artifacts and remediation before scenario-writing guidance.
  - Ready feature tickets keep the normal define-behavior prompt and phase advancement path.
  - The same readiness helper powers both entry and resume checks so the rule cannot drift.
  - Targeted hook tests, relevant smoke tests, lint, and typecheck pass.
---

# Validate feature ticket readiness before define-behavior

**Goal:** Prevent agents from starting define-behavior work on feature tickets whose intake artifacts are incomplete.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-24T23:19:51.000Z Complete: implement - Added shared feature readiness helper; PreToolUse now blocks new feature phase edits into define-behavior when readiness artifacts are missing; UserPromptSubmit now surfaces readiness for legacy define-behavior resumes before scenario guidance. Synced dogfood and template hooks; added helper, phase-entry, prompt, blocked_on, and phase-review fixture coverage.
- 2026-06-24T23:19:51.000Z Validation: Post-rebase `bun run lint` passed; `bun run test:smoke:fast` passed (48 files, 647 tests); touched suite passed (`feature-ticket-readiness`, `phase-derivation`, `blocked-on-gate`, `phase-review-gate`: 4 files, 54 tests). Full `bun run test` was attempted twice: first found fixture fallout in blocked_on/phase-review, fixed and reran those files green; second was terminated with exit 143 in slow integration coverage after those fixes, with no new assertion failure reported before termination.
- 2026-06-24T23:30:26.000Z Validation: Full `bun run test` rerun was blocked by local temp-volume exhaustion (`ENOSPC: no space left on device` while Vitest/Git fixtures wrote under `/var/folders/.../T`). No `b3e7/safeword` test process remained afterward. Treating full-suite status as environment-blocked; prior lint, smoke, and touched-suite validation remain green.
- 2026-06-24T22:28:00.000Z Complete: scenario-gate - Local review-spec pass found 0 must-fix issues. Independent fresh-context review skipped: subagent tool is available but this environment only permits spawning when the user explicitly asks for delegation. impl-plan.md written with helper-first build order.
- 2026-06-24T22:27:00.000Z Complete: define-behavior - 7 scenarios defined across 3 rules; dimensions.md authored; feature source saved at features/feature-ticket-readiness.feature.
- 2026-06-24T22:26:28.000Z Complete: intake - Issue #404 revalidated; scope set to shared readiness helper plus phase-entry block and legacy resume prompt. Out of scope: auto-scaffolding or changing task/patch workflow.
- 2026-06-24T22:24:57.191Z Started: Created ticket 9S6HFC
