# Test definitions — S2CWBE

## Guarded Codex Desktop session fallback

- [x] RED: the shared run-identity resolver initially left `sessionKey` null
  despite a non-empty `CODEX_THREAD_ID`.
- [x] GREEN: the shared run-identity resolver recognizes a non-empty
  `CODEX_THREAD_ID` as a Codex session only when no input `session_id` is
  available, and never uses `turn_id` as that session.
- [x] REFACTOR: preserve explicit-runtime behavior so Claude and Cursor do not
  adopt the Codex environment variable.

## Proof bridge precedence

- [x] RED: the real installed invocation helper reported `no run identity` when
  its cache was absent even though `CODEX_THREAD_ID` was present; review-stamp
  also incorrectly chose that fallback ahead of a fresh Codex cache identity.
- [x] GREEN: the helper records a proof with `CODEX_THREAD_ID` after cache
  miss, and a fresh Codex cache identity wins when both are available.
- [x] REFACTOR: retain the existing ordered cache queue and its expired,
  out-of-order, foreign-path, and no-identity rejection coverage.

## Stop-state consistency

- [x] RED: a real Codex Stop invocation with no payload `session_id` left its
  thread-bound ticket in progress despite `CODEX_THREAD_ID`.
- [x] GREEN: the same invocation resolves only that thread-bound session and
  preserves existing Stop behavior.
- [x] REFACTOR: template and dogfood surfaces remain byte-aligned.
