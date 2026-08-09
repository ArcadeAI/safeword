# Work Log: Keep CLI status reliable for large Claude plugin inventories

**Anchored to:** `.project/tickets/6GMJAV-reliable-large-claude-plugin-inventories/ticket.md`

---

## Session: 2026-08-08

- [16:52] Full verification for PR #2290 failed two bare-status assertions with exit code 1 instead of 2.
- [16:54] Confirmed the failures reproduce in isolation, excluding full-suite ordering pollution.
- [16:55] Confirmed Claude emits 65,700 bytes of valid JSON while Safeword receives a response truncated at 65,536 bytes.
- [16:56] Created GitHub issue #2291 before adopting it as local ticket 6GMJAV.
- [17:00] Test plan: use the real `claude` subprocess boundary with a fake executable returning a valid inventory above 64 KiB; assert observation remains current. Then rerun the two user-facing status tests to prove the original failure is gone.
- [17:01] RED: the >64 KiB public-observer test returned `errored` when its fake host reproduced Claude pipe truncation.
- [17:02] GREEN: redirecting stdout to a temporary regular file returned the complete inventory; output above 10 MiB is rejected before parsing.
- [17:03] Found: status tests also inherited real Claude/Codex profile state. Replaced that dependency with supported fake host executables at the process boundary.
- [17:05] Focused verification passed: 23 tests across profile observation and both CLI status suites; targeted lint, format, typecheck, and whitespace gates also passed.
- [17:13] Quality review found operational version-probe failures were mislabeled unsupported. Added error-code-specific mapping and coverage for oversized stdout and stderr.
- [17:20] Quality re-review found inconsistent default user-scope handling. Centralized scope normalization across matching, public observation, and install verification; added omitted-scope coverage.
- [17:25] Final degraded review raised a pre-existing payload trust-root concern without authoritative provenance. Filed GitHub #2293 for separate threat-model investigation; no trust-model changes were folded into #2291.
- [17:50] Full verification passed: CLI 7,109 tests passed/5 skipped; relay 167 passed/1 skipped; repository lint, format, typecheck, dependency audit, and whitespace gates are green.
