---
id: 2HXHSV
slug: codex-plugin-reload-watch
type: task
phase: verify
status: in_progress
external_issue: https://github.com/openai/codex/issues/17636
created: 2026-08-16T19:18:20.658Z
last_modified: 2026-08-16T20:16:25Z
---

# Track Codex plugin reload fixes for Safeword users

**Goal:** Alert maintainers when the upstream Codex plugin-reload issues close so Safeword can reassess its restart guidance.

**Why:** A restart-sensitive runtime behavior can make Safeword protections appear stale or inactive after plugin changes.

## Work Log

- 2026-08-16T20:16:25Z Started delivery: Created branch `codex/track-codex-plugin-reload-fixes` for review and merge.
- 2026-08-16T19:25:12Z Complete: Closure-triggered triage issues now carry Safeword’s existing `impact:high` GitHub label on both creation and update, with client-boundary coverage proving it reaches GitHub.
- 2026-08-16T19:21:27Z Complete: Added state-only monitors for Codex #17636 and #38339. Their scheduled check now files a contextual Safeword triage issue and exits non-zero when either changes; focused monitor tests and TypeScript verification passed.
- 2026-08-16T19:18:20Z Found: Codex issues #17636 and #38339 are open; ordinary CI will validate their committed open-state snapshots, while the weekly monitor alone reads GitHub and fails after filing contextual triage if either state changes.
- 2026-08-16T19:18:20.658Z Started: Created ticket 2HXHSV
