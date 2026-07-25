# Work Log: Keep Codex Desktop proof session-bound

**Anchored to:** `.project/tickets/S2CWBE-codex-desktop-session-proof-fallback/ticket.md`

## Session: 2026-07-24

- [23:01] Revalidated the live failure: this Desktop code-mode process has a
  stable `CODEX_THREAD_ID`, but no Codex identity cache is written before
  `/quality-review`, `/verify`, or `/audit` invokes the proof helper.
- [23:02] Ruled out the configured matcher: the project matches `Bash`, which
  is the documented mapping for shell execution. Existing bridge tests cover a
  simulated hook payload; they do not prove this Desktop wrapper delivers one.
- [23:02] Decision: preserve the cache as authoritative, then use only
  `CODEX_THREAD_ID` as a guarded Codex fallback. Keep `turn_id` excluded.
- [23:07] RED: the resolver returns `sessionKey: null`; the real helper reports
  `no run identity`; the real review stamp exits with missing identity; and
  Codex Stop leaves the matching desktop-thread ticket in progress.
- [23:20] Quality review found that review-stamp read CODEX_THREAD_ID before a
  fresh bridge cache. Added a regression, watched it fail, then made fresh
  bridge identity win while Claude's directly exposed identity remains first.
- [23:25] Focused resolver, invocation-helper, review-stamp, and Stop tests
  pass. Parity, ESLint, Gherkin lint, TypeScript typecheck, package build, and
  diff checks pass. Fresh quality review approved the corrected precedence.
- [00:12] Confirmed the existing cache hardening remains intact: the complete
  invocation-helper (28) and review-stamp bridge (34) suites pass, including
  expired, out-of-order, foreign-path, and no-identity cases.
