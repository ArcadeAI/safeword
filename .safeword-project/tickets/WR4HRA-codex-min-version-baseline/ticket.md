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

**Goal:** Determine and record the minimum `codex` CLI version that supports the hook events safeword depends on.

**Why:** Public changelog mirrors didn't expose pre-~Apr-24 (v0.125) entries, so the version that first shipped hooks isn't pinned — they were established by v0.129.0 (May 9, 2026). Setup should refuse/ warn below the floor.

## Done when

- Min version confirmed against `github.com/openai/codex` releases; recorded as a `codex-version` baseline (mirror ticket 116); setup warns below it.

## Source

github.com/openai/codex releases; developers.openai.com/codex/changelog

## Work Log

- 2026-05-31 Created from Codex research (changelog gap noted).
