# Dimensions: retro auto-trigger — Cursor

The reused behaviors (substance gate, sentinel idempotency, fail-open) are proven
in FTCQGD/53DQJZ. The NEW Cursor-specific dimensions are the session-id source
(`conversation_id`), the `followup_message` output channel, the `status`-gating,
and coexistence with the existing quality-review followup.

| Dimension                       | Partitions / equivalence classes + boundaries                                                          | Proves      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------- |
| Counter reuse (Claude-shaped)   | a Cursor transcript with N `message.content[].tool_use` blocks counts N (existing countToolUses applies) | SM1.AC1     |
| Substance boundary              | one below the threshold; **exactly at (inclusive)**; above                                             | SM1.AC1     |
| Output channel (Cursor)         | substantial → `followup_message` with transcript_path + guide; trivial → no retro followup              | SM1.AC1     |
| Session-id source (Cursor)      | `conversation_id` (session-stable); absent → no fire                                                    | SM1.AC2     |
| Within-session idempotency      | first stop fires + sets sentinel; second stop (sentinel set) → no retro followup; different id → fires   | SM1.AC2     |
| Status gating                   | `status: completed` → eligible; non-completed (aborted/error) → no retro followup, sentinel unset        | TB1.AC1     |
| Coexistence w/ quality-review   | quality-review followup firing this stop → retro yields, sentinel NOT consumed (fires on a later stop)   | SM1.AC3     |
| Fail-open                       | malformed stdin; missing transcript_path; unreadable transcript → no retro followup, sentinel unset      | TB1.AC1     |

**Boundary note:** substance threshold reuses `SUBSTANCE_THRESHOLD` with the
Claude counter (Cursor transcript is Claude-shaped). The coexistence dimension is
the load-bearing new behavior — prove retro never clobbers the quality-review
followup and the sentinel is only consumed when retro actually emits.
