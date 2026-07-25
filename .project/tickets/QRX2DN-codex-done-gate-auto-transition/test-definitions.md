# Test definitions: Close Codex tickets when evidence passes

The Stop adapter is user-visible workflow wiring, so these are real-adapter
integration tests. Each invokes the dogfood Codex hook against an isolated
filesystem fixture; the only process boundary is the hook subprocess.

## Scenario ledger

- [x] `codex-done-gate.TBU1.R1` closes only a valid session-bound ticket.
- [ ] `codex-done-gate.TBU1.R1` lets a Codex Desktop PostToolUse payload without `session_id` bind the ticket that the same thread's Stop evaluates.
- [x] `codex-done-gate.TBU1.R1` never selects a fallback for unbound, non-done, or already-done state.
- [x] `codex-done-gate.TBU1.R2` returns exact remediation and preserves state for no verify artifact.
- [x] `codex-done-gate.TBU1.R2` returns exact remediation and preserves state for failed PR scope.
- [x] `codex-done-gate.TBU1.R2` returns exact remediation and preserves state for incomplete feature scenarios.
- [x] `codex-done-gate.TBU1.R2` returns exact remediation and preserves state for missing or stale dependencies.
- [x] `codex-done-gate.TBU1.R2` returns exact remediation and preserves state for failed test execution.
- [x] `codex-done-gate.SWM1.R1` gives evidence failure precedence over retro filing and architecture advisory.
- [x] `codex-done-gate.SWM1.R1` returns pending retro filing after a successful transition without an advisory.
- [x] `codex-done-gate.SWM1.R1` captures a qualifying architecture advisory before transition and returns it before filing.
- [x] `codex-done-gate.SWM1.R1` preserves advisory-only global fallback with no session-bound mutation.
- [x] `codex-done-gate.SWM1.R2` changes only ticket lifecycle fields and leaves Git ownership state untouched.

## Definition of done

All entries are checked only after their focused integration test has passed
and the full package verification suite confirms the template and dogfood hook
copies remain in parity.
