---
id: 3ZRP8G
slug: monitor-source-adapters
type: task
phase: intake
status: in_progress
epic: upstream-changelog-monitor
relates_to: TT1MQW
---

# Add Cursor + Codex source adapters (HTML hash + releases.atom)

**Goal:** Generalize the skeleton to all three sources via a small per-source adapter list.

**Why:** Each source has a different best artifact; the loop is identical once fetch+normalize is per-source.

## Adapters

- **Codex CLI** — `github.com/openai/codex/releases.atom` (clean feed; latest stable 0.135.0 / May 28 2026). Optionally also `developers.openai.com/codex/changelog`.
- **Cursor** — `cursor.com/changelog` (HTML; no confirmed RSS). Normalize rendered text → hash; tolerate markup noise. **Open task:** probe for a feed (e.g. `/changelog/rss`) before committing to HTML hashing.
- Shared: `fetch → normalize to text → hash → diff vs snapshot` so adapters differ only in fetch+normalize.

## Done when

- All three sources monitored; a change in any opens/updates its issue; snapshots committed per source.
- Cursor HTML normalization is stable across cosmetic markup changes (no false positives on unchanged content).

## Source

github.com/openai/codex/releases.atom; cursor.com/changelog

## Work Log

- 2026-05-31 Created from monitor epic.
