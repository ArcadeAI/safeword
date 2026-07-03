---
id: 7PG694
slug: refactor-verify-audit-skills
type: task
phase: implement
status: in_progress
created: 2026-07-03T20:51:51.391Z
last_modified: 2026-07-03T20:55:00Z
---

# Refactor the verify and audit skills

**Goal:** Restructure the /verify and /audit skill documents (all three synced copies each) per a fresh quality-review's refactor plan — cut bloat and duplication, harden the embedded scripts — while keeping every pinned contract green (verify-skill.test.ts, done-gate.ts verify.md parsing, invocation-log tests, 3-copy sync).

**Why:** Both skills got cherry-picked rather than executed verbatim in real sessions (their length/branching invites paraphrasing); they duplicate invocation-log boilerplate and solve stack detection two divergent ways; audit's jscpd/knip steps produce baseline noise every run.

Behavior-preserving: prose refactor only; the contract test suites define "behavior" here. Existing tests are the protection net (no new scenarios).

## Work Log

- 2026-07-03T20:51:51.391Z Started: Created ticket 7PG694
- 2026-07-03T20:55Z Branch claude/refactor-verify-audit-skills off origin/main. /quality-review invoked; fresh reviewer producing contract inventory + ranked refactor plan for both skills.
- 2026-07-03T21:07Z Implemented (9ed50dca): reviewer found 4 criticals + 7 APPLY + 4 LIST. All criticals + APPLYs applied to templates, commands/verify.md twin hand-synced, parity-check --fix propagated all copies. Contracts green: 813 vitest (8 suites) + 181 cucumber scenarios; post-commit re-run 142/142. LIST follow-ups (owner sign-off needed): collapse commands/verify.md to a thin pointer (rewrites pinned contracts); extract verify script to installed helper; audit-plan product work (5FF0ZD direction); trim audit research-links.
