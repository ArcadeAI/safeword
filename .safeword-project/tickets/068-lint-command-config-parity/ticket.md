---
id: 068
slug: lint-command-config-parity
type: task
status: backlog
phase: research
---

# Task: Document /lint command vs hook config difference

**Type:** Documentation

**Scope:** The hook uses `--config .safeword/ruff.toml` (strict curated rules). The `/lint` command runs bare `ruff check --fix .` (project config). When customer has their own config, curated rules don't apply during `/lint`. This is by design but undocumented.

**Out of Scope:** Changing the behavior — the split is intentional (hook = LLM enforcement, /lint = project rules).

**Done When:**

- [ ] Documented in ARCHITECTURE.md or LANGUAGE_PACK_SPEC.md
- [ ] /lint command has a comment explaining the difference

## Work Log

- 2026-03-28 Created. Discovered during linter config audit.
