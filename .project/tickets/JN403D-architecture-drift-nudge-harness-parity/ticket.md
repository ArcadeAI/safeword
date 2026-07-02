---
id: JN403D
slug: architecture-drift-nudge-harness-parity
type: task
phase: done
status: done
created: 2026-07-02T00:03:33.109Z
last_modified: 2026-07-02T15:33:30Z
external_issue: https://github.com/ArcadeAI/safeword/issues/598
relates_to:
  - AXRC4D
  - HPP49X
  - VAX3Z2
scope:
  - Route the existing `ARCHITECTURE.md` drift nudge through Cursor's local/project `stop` hook without changing Cursor's hard done-gate placement.
  - Add Codex Stop-hook delivery for the same nudge using Codex continuation semantics (`decision: "block"` on `Stop`), not hard-block semantics.
  - Ship the Codex Stop hook in fresh installs and retrofit it into existing safeword-owned Codex configs without duplicating user-authored hooks.
  - Keep the existing fingerprint detector as the source of truth; add only delivery/wiring code and focused tests.
  - Repair public/project documentation drift for Codex Stop delivery and make audit classify changed-code documentation drift as an error.
out_of_scope:
  - Building a new architecture drift detector or recomputing architecture shape from source.
  - Porting Claude's full `stop-quality.ts` gate into Cursor or Codex.
  - Claiming Cursor cloud-agent Stop support; current Cursor docs say cloud agents do not run `stop`.
  - Changing done-gate hard enforcement policy for Cursor or Codex.
done_when:
  - Cursor Stop emits the architecture drift advisory as a `followup_message` when a done-phase ticket has moved the generated architecture fingerprint.
  - Cursor Stop remains silent for the architecture advisory when the active ticket is not in done phase or the architecture fingerprint did not move.
  - Codex Stop emits the same advisory as a continuation nudge (`decision: "block"`, `reason`) when a done-phase ticket has moved the generated architecture fingerprint.
  - Codex Stop remains silent when the advisory does not apply, and it does not loop when `stop_hook_active` is true.
  - Fresh and upgraded Codex configs include exactly one safeword Stop hook block, and uninstall strips safeword's Codex Stop hook while preserving user config.
  - README, website docs, and ARCHITECTURE.md document Codex Stop continuation nudges separately from Codex PreToolUse edit gates.
  - Audit guidance reports changed-code documentation drift and documentation gaps as errors, with tests covering all installed/template audit surfaces.
  - Focused Cursor/Codex hook tests, Codex config reconciliation tests, typecheck, lint, and relevant parity checks pass.
---

# Nudge architecture drift in Cursor and Codex Stop hooks

**Goal:** Make the existing `ARCHITECTURE.md` drift advisory reach Cursor and Codex Stop hooks with the same non-blocking nudge semantics as Claude.

**Why:** Issue #598 found that the architecture-document nudge added by AXRC4D is Claude-only even though Cursor and Codex both have local Stop-hook surfaces that can deliver the advisory.

## Decision

Reuse `architectureDocumentNudgeForProject` as the only drift detector. Cursor and Codex should add thin Stop-hook delivery around it, scoped to done-phase work, because the completed lifecycle tickets already establish that Cursor/Codex Stop hooks nudge but do not hard-enforce done gates.

## Work Log

- 2026-07-02T15:33:30Z VERIFY: Repaired the Codex Stop documentation drift found during PR review and tightened `/audit` so documentation drift/gaps are errors, not warnings. Focused audit documentation surface test passes 29/29.
- 2026-07-02T04:48:42Z DONE: Verified PR #605 after CI surfaced the ticket-status annotation. Rebasing removed unrelated `.project/surfaces.md` scope drift; GitHub CI lint/test pass, local lint/typecheck/Gherkin pass, scenarios are 22/22 complete, and `verify.md` records done-gate evidence.
- 2026-07-02T02:33:03Z REFACTOR: Extracted `readSessionActiveTicket` into the shared quality-state library and used it from Cursor/Codex Stop adapters. Focused Stop/quality-state tests pass 15/15; typecheck, ESLint, and diff hygiene pass.
- 2026-07-02T00:34:30Z VERIFY: Focused verification passes: Cursor/Codex Stop integration, setup/upgrade/reconcile/schema suites (150 tests), targeted Cursor rerun (6 tests), `tsc --noEmit`, `git diff --check`, and Bun `--check` on template/dogfood Stop hooks.
- 2026-07-02T00:33:30Z GREEN: Added explicit Cursor implement-phase architecture-drift regression; focused Cursor Stop test file passes 6/6.
- 2026-07-02T00:31:20Z GREEN: Schema drift check updated for Codex-only Stop adapter; focused verification set passes 6 files / 150 tests.
- 2026-07-02T00:30:30Z REFACTOR: Synced dogfood `.codex/config.toml` and `.safeword/hooks/codex/stop.ts` narrowly, then removed unrelated language-pack churn from the interrupted upgrade.
- 2026-07-02T00:25:30Z GREEN: Codex Stop silence/re-entry tests pass 4/4; upgrade retrofit test passes 18/18; uninstall/reconcile test passes 77/77.
- 2026-07-02T00:17:47Z RED: Added fresh setup assertions for Codex Stop asset/config. Focused setup-reconcile test failed because `.safeword/hooks/codex/stop.ts` and `[[hooks.Stop]]` are not installed.
- 2026-07-02T00:16:46Z GREEN: Added `packages/cli/templates/hooks/codex/stop.ts`; focused Codex Stop test passes 1/1 and emits the nudge as Codex continuation JSON.
- 2026-07-02T00:15:21Z RED: Added Codex Stop integration coverage for done-phase architecture drift. Focused test failed with hook process status 1 because the Codex Stop adapter does not exist.
- 2026-07-02T00:13:35Z GREEN: Cursor Stop delivery implemented in the template and synced to dogfood; focused `cursor-stop-review.test.ts` passes 5/5 with lock wait disabled because another worktree held the package-test lock.
- 2026-07-02T00:10:45Z RED: Added Cursor Stop integration coverage for a done-phase ticket with a moved architecture fingerprint. Focused test failed because `followup_message` contained only the generic quality review prompt, not `ARCHITECTURE_DOCUMENT_NUDGE`.
- 2026-07-02T00:03:39Z Phase: advanced to implement after creating `test-definitions.md`; scenario set is bounded to Cursor Stop output, Codex Stop output, and Codex config install/upgrade/uninstall behavior.
- 2026-07-02T00:03:39Z Phase: advanced to define-behavior after frontmatter scope/out_of_scope/done_when were recorded.
- 2026-07-02T00:03:39Z Scoped: Revalidated #598, existing AXRC4D/HPP49X/VAX3Z2/JENFZX context, and current Cursor/Codex Stop semantics. Implementation path is thin delivery adapters, not a full Stop-gate port.
- 2026-07-02T00:03:33.109Z Started: Created ticket JN403D
