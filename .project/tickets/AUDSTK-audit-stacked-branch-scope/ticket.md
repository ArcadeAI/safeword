---
id: AUDSTK
slug: audit-stacked-branch-scope
title: "Keep audits focused on stacked branch work"
type: task
phase: done
status: done
scope:
  - Allow an explicit Git base ref for diff-scoped audits.
  - Fail closed when that explicit ref is invalid.
  - Keep Python dead-code analysis out of dependency and virtual-environment trees.
out_of_scope:
  - Automatic GitHub PR base discovery.
  - Repository-level audit configuration.
  - Changing the default origin/main behavior.
done_when:
  - A stacked branch audit can inspect only changes above its chosen base.
  - A mistyped base cannot silently widen the audit.
  - Python dead-code analysis skips the same dependency trees as manifest discovery.
created: 2026-08-27T07:10:00.000Z
last_modified: 2026-08-27T08:20:00.000Z
---

# Keep audits focused on stacked branch work

## Work Log

- 2026-08-27T00:55:00Z DISCOVERY: A long-lived integration branch caused `/audit` to scan the full stack from `origin/main`; `deadcode .` then entered nested `.venv` trees despite Safeword excluding them during manifest discovery.
- 2026-08-27T08:00:00Z RED: The focused audit suite failed three new tests: explicit stacked bases were ignored, invalid bases silently fell back to `origin/main`, and Python dead-code analysis received no dependency exclusions.
- 2026-08-27T08:05:00Z GREEN: `SAFEWORD_AUDIT_BASE_REF` now chooses an explicit diff base, invalid refs stop every audit block, and `deadcode` excludes dependency and virtual-environment trees. The focused suite passed 34/34 tests.
- 2026-08-27T08:20:00Z VERIFY: All shipped and dogfood surfaces were regenerated and synchronized. Lint, typecheck, shell syntax, parity, plugin release checks, and the full 8,505-test suite passed.
