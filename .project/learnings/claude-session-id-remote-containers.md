# CLAUDE_SESSION_ID empty in remote container sessions

Covers: session identity, remote containers, skill-invocation-log, record-skill-invocation

In Claude Code **local** sessions `CLAUDE_SESSION_ID` is set and non-empty.
In Claude Code **remote container** sessions (web UI, GitHub Actions) `CLAUDE_CODE_SESSION_ID` carries the real UUID while `CLAUDE_SESSION_ID` is set to `""` (empty string, not undefined).

## The trap

`??` (nullish coalescing) only falls through on `null`/`undefined`. An empty string `""` is falsy but not nullish, so `process.env.CLAUDE_SESSION_ID ?? fallback` silently returns `""` — the empty string wins. Use `||` instead.

## Correct pattern

```ts
const sessionId = process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID;
```

## Applies to

Any hook or script that needs a session identifier across all Claude Code environments (local, web, GitHub Actions). Fixed in `record-skill-invocation.ts` and `write-review-stamp.ts` (PR #241, 2026-06-16).
