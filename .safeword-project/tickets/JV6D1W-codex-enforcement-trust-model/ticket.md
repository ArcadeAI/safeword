---
id: JV6D1W
slug: codex-enforcement-trust-model
type: task
phase: intake
status: in_progress
epic: codex-changelog-alignment
relates_to: QM5G9M
---

# Codex enforcement strength: user-trusted hooks vs managed requirements.toml

**Goal:** Decide whether safeword's Codex gates rely on user-trusted hooks (defeatable) or ship a managed-hook path for hard enforcement.

**Why:** Non-managed Codex hooks require the user to review + trust the exact definition via `/hooks` before they run — a user can decline, defeating the gates. Managed hooks (`requirements.toml` / MDM / cloud) are trusted by policy and can't be disabled.

## Questions

- Is user-trusted enforcement acceptable for the default install (consumer CLI), with managed as an enterprise opt-in?
- What does the setup flow tell the user so they actually trust safeword's hooks (UX friction)?

## Done when

- Recorded stance: default = user-trusted (+ setup guidance to trust), enterprise = managed `requirements.toml` path documented (or a different call, with rationale).

## Source

developers.openai.com/codex/hooks (trust model, managed hooks)

## Work Log

- 2026-05-31 Created from Codex research.
