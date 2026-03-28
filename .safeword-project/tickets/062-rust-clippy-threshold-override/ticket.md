---
id: 062
slug: rust-clippy-threshold-override
type: task
status: backlog
phase: research
---

# Task: Rust clippy.toml thresholds override customer values

**Type:** Bug (low severity)

**Scope:** The lint hook uses `CLIPPY_CONF_DIR` pointing to `.safeword/`, which means safeword's `cognitive-complexity-threshold = 10` overrides a customer's `cognitive-complexity-threshold = 25`. Same category as the ruff/golangci-lint override issue but lower blast radius — numeric thresholds, not rule selection.

**Out of Scope:** Clippy lint group selection (clippy doesn't have a select-all equivalent). rustfmt config (purely formatting, override is reasonable).

**Context:** Unlike ruff (`extend-select`) and golangci-lint (`enable` arrays), clippy.toml has no inheritance or merge mechanism. Options: (a) merge thresholds where customer wins, (b) use `max()` of customer and safeword thresholds, (c) accept the override since it's stricter.

**Research Needed:**

- Does clippy support config inheritance or extend?
- What's the convention for shared clippy configs in the Rust ecosystem?
- Should stricter thresholds (lower numbers) always win, or should customer choice be preserved?

**Done When:**

- [ ] Customer's clippy thresholds are not silently overridden
- [ ] Safeword only fills gaps (thresholds customer didn't set)

## Work Log

- 2026-03-27 Created during linter config audit. Low priority — thresholds only, not rule selection.
