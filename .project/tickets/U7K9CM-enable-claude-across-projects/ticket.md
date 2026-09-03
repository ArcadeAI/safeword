---
id: U7K9CM
title: Enable Claude across projects by default
type: task
status: in_progress
scope: Default Claude activation to user scope, retain explicit project scope, and align planning and documentation.
out_of_scope: Migrating existing installations, publishing a release, changing Codex activation.
done_when: Default Claude installs and plans select user scope; explicit project scope and non-Claude installs remain supported.
---

## Tests

- CLI catalog advertises user scope by default.
- An install plan without scope selects the user installation.
- Explicit project-scope installation retains existing coverage.
- Non-Claude installs without scope remain valid; explicit user scope without Claude remains invalid.

## Follow-up verification

User requested BDD impact and a real Claude install in a disposable Tart VM. Initial Cucumber run: 99 passed, 3 failed; all three failures assert the retired project default. Update those expectations, rerun both Claude features, and verify real host installation and cross-project scope in Tart.

Outcome: all 102 affected Claude acceptance scenarios pass; three real installation cases and both generated consumer BDD starters pass in Tart. Authenticated BDD activation, intake, cross-project availability, and readiness-gate enforcement subsequently passed after the user logged into the VM. The full feature lifecycle remains outside this smoke test. See tart-verification.md.

2026-09-03 UTC: Authenticated follow-up completed; see tart-verification.md. VM stopped; host Claude profile untouched.

2026-09-03T01:47Z: User requested proceeding through the full VM feature lifecycle, resolving blockers through figure-it-out. Reopened verification to cover scenarios, TDD, independent review, and local closeout.

2026-09-03 UTC: Full lifecycle attempt blocked at independent reviewer execution. Trusted binary relocation fixed the initial trust failure; Claude then rejected `--strict-mcp-config` because the guest has enterprise MCP configuration. Scenario authoring and implementation planning completed, but independent review, TDD, and closeout remain unverified. See reviewer-investigation.md. Session interrupted, evidence saved, test VM stopped.

2026-09-03 UTC: Prepared cross-computer continuation. The isolated Codex reviewer profile in the retained VM is not authenticated, so no further lifecycle claim was made. Added HANDOFF.md with repository state, verified evidence, exact remaining work, constraints, commands, and a self-contained continuation prompt.
