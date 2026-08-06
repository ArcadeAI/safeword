---
id: 2CQCAK
slug: keep-agent-created-prs-draft
type: task
phase: done
status: done
created: 2026-08-06T21:05:20.272Z
last_modified: 2026-08-06T23:23:35Z
---

# Keep agent-created pull requests in draft until approved

**Goal:** Make every agent-created pull request start as a draft unless the user explicitly asks for a ready pull request.

**Why:** Draft-first delivery prevents agents from signaling review readiness before the user has approved it.

**Scope:** Add an always-on, cross-host instruction that agent-created pull requests start as drafts and become ready only after an explicit user request. Keep the canonical template and dogfood copy identical.

**Out of Scope:** Blocking hooks, provider-specific PR creation automation, and changes to the merge-time `/closeout` checks.

**Done When:**

- [x] Installed Safe Word context tells every supported agent to create draft pull requests by default.
- [x] The instruction preserves an explicit user override to create or mark a pull request ready.
- [x] Canonical and dogfood copies remain in parity.

**Tests:**

- [x] A focused Vitest test asserts the default, the explicit override, and `gh pr create --draft` guidance in both context copies.

## Work Log

- 2026-08-06T21:05:20.272Z Started: Created ticket 2CQCAK
- 2026-08-06T21:05:53Z Planned: Put the policy in always-loaded SAFEWORD.md rather than `/closeout` or a hard hook; use a parity test to cover both shipped and dogfood contexts.
- 2026-08-06T21:07:25Z GREEN: focused draft-default checks passed for both the canonical and dogfood SAFEWORD contexts (2/2).
- 2026-08-06T21:08:05Z Parity: release-only dogfood parity contract passed (1/1).
- 2026-08-06T21:24:40Z Verified: 6,953 tests, 1,077 acceptance scenarios, build, lint, formatting, and typecheck passed. Dependency audit reported six pre-existing website/tooling advisories outside ticket scope.
- 2026-08-06T21:57:34Z Isolated: moved the uncommitted feature from an unrelated detached branch onto `codex/keep-agent-created-prs-draft` from current `origin/main`; the feature diff now contains only its five scoped files.
- 2026-08-06T22:12:05Z Verified: on the clean branch, 6,936 tests, 1,077 acceptance scenarios, build, lint, formatting, typecheck, and the diff-scoped audit passed. The dependency audit still reports the same six pre-existing advisories outside ticket scope.
- 2026-08-06T23:23:35Z Done: User confirmed completion after the full Safe Word process; closed with verify and audit evidence recorded.
