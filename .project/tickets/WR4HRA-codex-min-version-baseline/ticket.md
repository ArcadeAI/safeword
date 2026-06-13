---
id: WR4HRA
slug: codex-min-version-baseline
type: task
phase: intake
status: in_progress
epic: codex-changelog-alignment
relates_to: QM5G9M
---

# Pin minimum codex CLI version that supports required hooks

**Goal:** Record the minimum `codex` CLI version safeword requires, and warn below it at setup.

**Findings (researched 2026-05-31, github.com/openai/codex/releases):**

- Latest stable **0.135.0 (May 28 2026)**; latest overall 0.136.0-alpha.x (May 31).
- **0.133.0 (May 21 2026)** is the earliest release whose notes explicitly reference the hook surface safeword leans on — "Support compact SessionStart hooks", "Wire MITM hooks into runtime enforcement", plus the lifecycle-observation enrichment (subagent start/stop, tool execution, turn metadata).
- Basic `PreToolUse` may predate 0.133.0; the releases page only enumerated back to ~0.133. **Open:** scan 0.125–0.132 notes to find the true floor for `PreToolUse` deny + `UserPromptSubmit` block (the events the gates actually need).

## Decision (provisional)

Floor = **0.133.0** until proven a lower version has the needed events. Conservative but safe.

## Done when

- Floor confirmed (scan older release notes for `PreToolUse`/`UserPromptSubmit`); recorded as a `codex-version` baseline (folds into monitor snapshot, ticket 99XBFG); setup warns below it.

## Source

github.com/openai/codex/releases (+ releases.atom feed)

## Work Log

- 2026-05-31 Created (changelog gap noted).
- 2026-05-31 Read releases page. Provisional floor 0.133.0; basic-hooks floor still to confirm in 0.125–0.132.
