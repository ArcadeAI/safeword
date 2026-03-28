---
id: 067
slug: hook-feedback-latency
type: task
status: backlog
phase: research
---

# Task: Measure and optimize hook feedback latency

**Type:** Investigation

**Scope:** The lint hook now runs every linter twice per edit (fix + check). Ruff is ~50ms. golangci-lint could be 2-5s per file. Measure real-world impact and consider making the check pass async or skippable for slow linters.

**Out of Scope:** Changing what errors are surfaced, adding new linters.

**Research Needed:**

- Actual latency of check pass per language (ruff, eslint, golangci-lint, clippy)
- Whether golangci-lint check pass blocks Claude noticeably
- Whether check pass can run in background and surface results on next turn

**Done When:**

- [ ] Latency measured for each language
- [ ] If problematic: optimized or made configurable
- [ ] If acceptable: documented and closed

## Work Log

- 2026-03-28 Created. Check pass added in commit 2eab003 for additionalContext feedback.
