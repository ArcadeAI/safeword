---
id: "1511"
slug: keep-lint-hook-off-network
title: Keep lint-hook edits free of Safeword upgrades
type: task
subtype: bug
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/1511
scope:
  - Remove the lint hook's language-pack self-repair path.
  - Keep fallback linting active when a Safeword lint config is absent.
  - Prevent lint-hook upgrade, staging, and commit side effects.
out_of_scope:
  - Session-start auto-upgrade behavior.
  - Generic linter tool resolution.
  - Language-pack detection or installation.
done_when:
  - A supported edit with a missing pack config never invokes a Safeword upgrade.
  - The lint hook does not stage or commit repository changes.
  - Fallback linting still runs without the missing Safeword config.
created: 2026-07-26
last_modified: 2026-07-26
---

# Task: Keep lint-hook edits free of Safeword upgrades

**Type:** Bug

**Scope:** Remove the lint hook's language-pack self-repair path. When a
Safeword lint config is absent, the hook continues with the linter's defaults
without running `safeword upgrade`, staging files, or creating a commit.

**Out of Scope:** Session-start auto-upgrade behavior, generic linter tool
resolution, and changes to language-pack detection or installation.

**Done When:**

- [x] Editing a supported file with a missing pack config never invokes a
      Safeword upgrade from the lint hook.
- [x] The lint hook does not stage or commit repository changes.
- [x] Fallback linting still runs without the missing Safeword config.

**Tests:**

- [x] Integration: missing-config edits exercise TypeScript, Python, Go, Rust,
      and SQL fallbacks without invoking Safeword or git.
- [x] Integration: configured edits still pass the generated config to ESLint,
      Ruff, golangci-lint, rustfmt, and SQLFluff.
- [x] Integration: the shipped template and dogfood hook have the same
      side-effect-free behavior across the full matrix.

**Source:** [GitHub issue #1511](https://github.com/ArcadeAI/safeword/issues/1511)

## Work Log

- Removed the lint hook's duplicate language-pack repair path; session start
  remains the sole owner of Safeword upgrades.
- Preserved each linter's existing fallback behavior and generated-config
  arguments when the config is present.
- Added real subprocess coverage for both hook copies across missing and
  configured TypeScript, Python, Go, Rust, and SQL cases.
- Updated the public configuration reference with the fallback and side-effect
  contract.
- Ran the full refactor, quality-review, verify, and audit workflows; applied
  every issue-scoped finding.
