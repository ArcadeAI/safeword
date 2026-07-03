# Test definitions (R/G/R ledger) - JN403D

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were filled in after the fact: the file entered git history already
> ticked, with no per-step commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

Test type: integration because the behavior is the real hook/config output observed by Cursor, Codex, and safeword install/upgrade.

## Rule: Architecture drift advisories reach every local Stop-hook harness

### Scenario: Cursor Stop emits the architecture drift advisory during done-phase work

- [x] RED - `cursor-stop-review.test.ts` expected `ARCHITECTURE_DOCUMENT_NUDGE`; hook only emitted the generic quality follow-up.
- [x] GREEN - Cursor Stop now includes the advisory; focused test file passes 5/5, then 6/6 after the explicit implement-phase drift regression was added.
- [x] REFACTOR - Kept the delivery as a thin done-phase helper around the shared `architectureDocumentNudgeForProject` detector.

### Scenario: Cursor Stop does not emit the architecture drift advisory outside done-phase drift

- [x] RED - Covered by the Cursor delivery RED: without a done-phase guard, the new advisory path would have leaked into implement-phase Stop output.
- [x] GREEN - Added explicit implement-phase architecture-drift regression; focused Cursor Stop test file passes 6/6.
- [x] REFACTOR - Silence behavior remains tied to the existing active-ticket phase/session-state checks.

### Scenario: Codex Stop emits the architecture drift advisory as a continuation nudge

- [x] RED - `codex-stop-nudge.test.ts` failed with exit status 1 because `templates/hooks/codex/stop.ts` does not exist yet.
- [x] GREEN - Codex Stop adapter emits `decision: "block"` with `ARCHITECTURE_DOCUMENT_NUDGE`; focused test passes 1/1, then 4/4 after silence/re-entry coverage.
- [x] REFACTOR - Adapter delegates detection to the shared architecture nudge library and keeps Codex Stop as a continuation-only surface.

### Scenario: Codex Stop stays silent when the advisory does not apply or a Stop continuation is already active

- [x] RED - Covered by the Codex adapter RED: before the adapter existed, no silence/re-entry behavior existed to exercise.
- [x] GREEN - Added non-done, no-drift, and `stop_hook_active` regressions; focused Codex Stop test file passes 4/4.
- [x] REFACTOR - Early exits are ordered before any detector work to avoid loop/re-entry output.

## Rule: Codex config delivery is installed, upgraded, and removable

### Scenario: Fresh Codex config wires the safeword Stop nudge exactly once

- [x] RED - `setup-reconcile.test.ts` failed because install omitted `.safeword/hooks/codex/stop.ts` and `[[hooks.Stop]]`.
- [x] GREEN - Schema registers the hook file and fresh config template includes exactly one `[[hooks.Stop]]`; focused setup test passes 15/15.
- [x] REFACTOR - Schema drift test now treats Codex `stop.ts` as a Codex-only adapter, not a Claude `SETTINGS_HOOKS` entry.

### Scenario: Upgrade retrofits the safeword Stop nudge without duplicating user config

- [x] RED - Covered by the same missing schema/config path as the fresh setup RED; old safeword configs lacked the Stop patch marker.
- [x] GREEN - Upgrade retrofit appends `.safeword/hooks/codex/stop.ts` once and stays idempotent; focused upgrade test passes 18/18.
- [x] REFACTOR - Retrofit uses the hook path as marker so user-authored Stop hooks are preserved.

### Scenario: Uninstall strips the safeword Codex Stop nudge while preserving user config

- [x] RED - Added uninstall assertion for the new Stop block alongside existing Codex hook unpatch coverage.
- [x] GREEN - Uninstall strips safeword's Stop hook while preserving user config; focused reconcile test passes 77/77.
- [x] REFACTOR - Each Codex config append patch removes its own block; the primary patch still owns safeword-only file removal.

---

## Feature-level cross-scenario refactor

- [x] cross-scenario - Focused verification passes across Cursor/Codex Stop hooks, setup, upgrade, uninstall/reconcile, schema drift, typecheck, diff hygiene, and Bun hook parse checks.

## Rule: Audit treats changed-code documentation drift as a hard finding

### Scenario: Audit surfaces classify documentation drift and gaps as errors

- [x] RED - Added assertions that would fail against the previous `Gap (warn)` / `[W004] Gap` wording and missing documentation-drift error codes.
- [x] GREEN - All five audit surfaces now require `Gap (error)`, `[E004] Documentation drift`, and `[E005] Dependency gap`; focused audit documentation source test passes 29/29.
- [x] REFACTOR - Kept template, `.agents`, `.claude`, and `.cursor` audit copies synchronized byte-for-byte.

### Scenario: Project docs describe Codex Stop delivery separately from PreToolUse edit gates

- [x] RED - PR review found docs still described Codex hook coverage as PreToolUse-only after `codex/stop.ts` was added.
- [x] GREEN - README, quick-start, hook reference, and ARCHITECTURE.md now document Codex Stop continuation nudges and the non-hard-enforcement boundary.
- [x] REFACTOR - Kept the wording scoped to Codex Stop delivery and avoided expanding the hard done-gate claim to Cursor/Codex.
