---
id: Z18F7C
slug: approve-plan-presented-bytes
type: patch
phase: intake
status: in_progress
created: 2026-11-13T23:26:42.371Z
last_modified: 2026-11-13T23:26:42.371Z
---

# Refuse a plan approval when the plan changes while the prompt is open

**Goal:** safeword ticket approve-plan records a human decision only for the exact plan bytes and current review the approver was shown

**Why:** The interactive prompt was a time-of-check/time-of-use window: an edit during the prompt let a yes approve bytes the human never saw (found by the Codex review of ArcadeAI/safeword#7200)

**Scope:** After the interactive approve-plan prompt returns, reread `impl-plan.md`, recompute its digest and recheck Implementation Plan review currency through the same admission path; refuse with a recovery message and record nothing if either changed. Covers `packages/cli/src/commands/plan-approval.ts`, its PTY integration tests, the approval feature scenario and BDD proof manifest, one docs sentence, and regenerated plugin bundles.

**Out of scope:** Non-interactive approval paths; other approval or review commands.

**Done when:** A yes answered after the plan or a reviewed dependency changed is refused with no ledger entry and no phase change, an unchanged plan still approves, and PR ArcadeAI/safeword#7215 CI is green.

## Work Log

- 2026-11-13T23:26:42.371Z Started: Created ticket Z18F7C
- 2026-11-13T23:30:00Z Found: Fix, tests, scenario outline and docs landed on branch `claude/kind-meninsky-46dfc8` (commit 5792d3656) before this ticket existed; ticket created to carry the readiness evidence for PR ArcadeAI/safeword#7215.
- 2026-11-13T23:30:00Z Complete: Verify and audit recorded in verify.md; CI 15 pass / 9 skipped.
