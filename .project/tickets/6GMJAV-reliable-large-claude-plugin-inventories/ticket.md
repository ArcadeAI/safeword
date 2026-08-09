---
id: 6GMJAV
slug: reliable-large-claude-plugin-inventories
type: patch
phase: intake
status: in_progress
created: 2026-08-09T02:54:59.550Z
last_modified: 2026-08-09T02:54:59.550Z
external_issue: https://github.com/ArcadeAI/safeword/issues/2291
---

# Keep CLI status reliable for large Claude plugin inventories

**Goal:** Capture and parse valid large Claude plugin inventories without turning status into a failure.

**Why:** Claude plugin output can exceed the host call buffer and be truncated into invalid JSON.

## Work Log

- 2026-08-09T02:54:59.550Z Started: Created ticket 6GMJAV
- 2026-08-09T03:00:00.000Z Found: A valid 65,700-byte `claude plugin list --json` response is truncated at 65,536 bytes by `runClaude`, causing status to fail with `CLAUDE_PROFILE_OUTPUT_INVALID`.
- 2026-08-09T03:00:00.000Z Planned: Prove the public Claude observation boundary with a large valid inventory, then add a documented bounded capture size and isolate CLI status tests from the developer profile.
- 2026-08-09T03:05:00.000Z Implemented: Claude stdout is captured through a temporary regular file, bounded at 10 MiB before parsing, and always cleaned up.
- 2026-08-09T03:05:00.000Z Verified: Large and oversized host-output cases plus both formerly host-dependent status suites pass (23 tests); targeted ESLint, Prettier, TypeScript, and whitespace checks pass.
- 2026-08-09T03:25:00.000Z Review: Corrected operational-error classification, normalized omitted user scope across observation and verification, added a 30-second host timeout, and expanded focused coverage to 26 passing tests.
- 2026-08-09T03:25:00.000Z Scoped: Filed follow-up #2293 for the reviewer-raised installed-payload trust-root question; it predates and is independent of this host-output patch.
- 2026-08-09T03:50:00.000Z Verified: Full repository tests pass (CLI 7,109 passed/5 skipped; relay 167 passed/1 skipped), full lint/format/typecheck pass, dependency audit reports no vulnerabilities, and whitespace is clean.
