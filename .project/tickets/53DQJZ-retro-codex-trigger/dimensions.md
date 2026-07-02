# Dimensions: retro auto-trigger — Codex

Derived from the figure-it-out resolution + the ACs in spec.md. The reused
behaviors (sentinel idempotency, fail-open orchestration, fires-once) are already
proven for Claude in FTCQGD; here the NEW dimensions are the Codex tool-event
counter, the per-agent counter seam, and the Codex `{decision:block}` output.

| Dimension                     | Partitions / equivalence classes + boundaries                                                                 | Proves      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| Codex tool-event counting     | `function_call` counts; `exec_command_begin` counts; `mcp_tool_call_begin` counts; `agent_reasoning`/`event_msg`/`token_count` do NOT; malformed line skipped | SM1.AC1     |
| Codex substance boundary      | below threshold; **exactly at (inclusive)**; above                                                            | SM1.AC1-2   |
| Per-agent counter seam        | core uses the injected Codex counter on a Codex rollout (and a Claude rollout via Claude counter is unchanged) | SM1.AC1, TB1.AC2 |
| Output shape (Codex)          | substantial → `{decision:"block", reason}` with transcript_path + guide; trivial → valid JSON, no decision     | SM1.AC2, TB1.AC1 |
| Within-session idempotency    | first Stop sets sentinel + fires; second Stop (sentinel set) → silent; different session id → fires            | SM1.AC3     |
| Session-id resolution (Codex) | `turn_id`; `CODEX_THREAD_ID`; `session_id` (the run-identity Codex ladder)                                     | SM1.AC3     |
| Transcript sourcing           | reads the supplied `transcript_path`; constructs none                                                          | SM1.AC3     |
| Fail-open (Codex JSON)        | malformed stdin; missing transcript_path; unreadable file → valid JSON, no decision, exit 0, sentinel unset    | TB1.AC1     |

**Boundary note:** the Codex substance threshold reuses `SUBSTANCE_THRESHOLD`
(same constant) but counts Codex tool events; partition below/at/above. The
counter seam is the load-bearing new abstraction — prove it counts the Codex
shape AND leaves Claude unchanged.
