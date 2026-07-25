# User stories — S2CWBE

## Keep Codex Desktop proof attached to the current thread

As a Safeword maintainer working in Codex Desktop code-mode, I want quality
skills to record proof against my current Desktop thread when hook delivery does
not create a bridge receipt, so that a completed feature is not blocked by a
false missing-proof error.

### Acceptance criteria

- Given no explicit identity, no Claude identity, and no fresh Codex or Cursor
  bridge entry, when the helper runs with a non-empty `CODEX_THREAD_ID`, then it
  records proof under that thread id as a Codex session.
- Given a fresh Codex bridge entry and `CODEX_THREAD_ID`, when the helper runs,
  then it records proof under the bridge entry, not the environment fallback.
- Given a Codex Stop payload without `session_id` and the same
  `CODEX_THREAD_ID`, when Stop checks the active ticket, then it uses the
  session binding for that thread only.
- Given no usable identity, then no proof record is written and no unknown or
  turn-derived session is invented.
