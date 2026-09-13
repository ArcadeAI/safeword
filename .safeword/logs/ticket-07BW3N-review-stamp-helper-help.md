# Work Log: Show review-stamp help without artifact lookup

**Anchored to:** `.project/tickets/07BW3N-review-stamp-helper-help/ticket.md`

## Session: 2026-09-13

- [21:15] Read issue #4521, the current handbook, debugging/testing/verification
  skills, and planning/testing guides.
- [21:18] Confirmed the parser treats unknown option-shaped tokens as
  positionals and operational identity resolution occurs before parsing.
- [21:19] Hypotheses ruled out: runtime forwarding and active-ticket selection
  affect the observed failure point but do not cause help to become an artifact.
- [21:20] Chose parser-aware help handling; preserve consumed values and return
  before the run-identity bridge can be read.
- [21:22] RED confirmed: the real helper integration suite failed only the two
  help aliases (2 failed, 30 passed); both exited 1 without runtime identity.
- [21:23] Implemented: parse help as a boolean option and return with usage
  before resolving or consuming run identity.
- [21:31] GREEN confirmed after the shared test lock cleared: 32/32 review-stamp
  integration tests pass. Manual no-identity help smoke and TypeScript typecheck
  also pass.
- [21:52] Full verification exposed one in-scope miss: generated Claude plugin
  validation failed because the bundled helper still had the old parser.
- [21:55] Regenerated Claude and Codex distributions with the pinned Bun 1.3.14.
  The CLI contract check now passes all build, runtime, help, fixture,
  documentation, plugin, and release-contract checks.
