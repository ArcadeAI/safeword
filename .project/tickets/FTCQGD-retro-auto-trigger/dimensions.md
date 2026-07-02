# Dimensions: retro auto-trigger (Claude-first)

Derived from the resolved intake questions (Q1 nudge, Q2 substance-gate, Q3
one-mechanism), the ACs in spec.md, and domain knowledge of Stop-hook behavior.

| Dimension                | Partitions / equivalence classes + boundaries                                                   | Proves     |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ---------- |
| Firing decision          | substantial → nudge; trivial → silent; already-nudged-this-session → silent                     | SM1.AC1-3  |
| Substance threshold      | below N; **at exactly N (boundary, inclusive `>=`)**; above N                                    | SM1.AC1-2  |
| Within-session idempotency | first Stop (writes sentinel + nudges); second Stop after nudge (sentinel → silent)            | SM1.AC3    |
| Transcript sourcing      | live `transcript_path` from hook input (read, never guessed/constructed)                        | SM1.AC4    |
| Session-id resolution    | `input.session_id` present; cloud fallback `CLAUDE_CODE_REMOTE_SESSION_ID`; local `CLAUDE_SESSION_ID` | SM1.AC4 |
| Nudge content/phrasing   | fact-phrased (no imperative verb); carries `transcript_path`; references the retro guide          | SM1.AC1, TB1.AC1 |
| Hook safety (fail-open)  | malformed/empty stdin; missing `transcript_path`; unreadable transcript file → empty out, exit 0 | TB1.AC2    |

**Boundary note:** the substance threshold is the one numeric boundary — partition
explicitly into below / at / above with inclusive `>=`. Session-id resolution is a
precedence ladder (input → cloud env → local env), tested at each rung.
