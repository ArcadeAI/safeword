# Test Definitions: Keep stop-quality prompts scoped to edited-work turns

Source: [user-stories.md](./user-stories.md)

| Scenario | Ordered JSONL fixture | Observable result |
| --- | --- | --- |
| Conversational follow-up | User prompt A → assistant `Edit` → user `tool_result` → assistant completion A → user prompt B requesting an explanation → assistant text-only completion B → stop | Exit 0; stdout is empty; stderr has no quality-review continuation. The edit from turn A is not inherited by turn B. |
| Reminder-prefixed follow-up | User prompt A → assistant `Edit` → user `tool_result` → assistant completion A → user record containing a complete `<system-reminder>…</system-reminder>` followed by prompt B → assistant text-only completion B → stop | Exit 0; stdout is empty. Removing the complete reminder leaves prompt B, so it starts a new turn. |
| Notification-prefixed follow-up | User prompt A → assistant `Edit` → user `tool_result` → assistant completion A → user record containing a complete `<task-notification>…</task-notification>` followed by prompt B → assistant text-only completion B → stop | Exit 0; stdout is empty. Notification classification uses raw text, while human-boundary classification removes the complete block and sees prompt B. |
| String-form follow-up | User prompt A → assistant `Edit` → user `tool_result` → assistant completion A → real-envelope user record whose `message.content` is the string prompt B → assistant text-only completion B → stop | Exit 0; stdout is empty. String-form and array-form prompts establish the same boundary. |
| Injected metadata stays inside a turn | User prompt A → assistant `Edit` → user `tool_result` → `isMeta: true` user record → assistant incomplete text-only completion A → stop | Exit 0; stdout parses as JSON with `decision: "block"`, and `reason` contains the implement-phase quality-review/decision-brief continuation. Metadata is not a new turn. |
| Reminder-only record stays inside a turn | User prompt A → assistant `Edit` → user `tool_result` → user record containing only a complete `<system-reminder>` block → assistant incomplete text-only completion A → stop | Exit 0; stdout parses as JSON with `decision: "block"`, and `reason` contains the implement-phase quality-review/decision-brief continuation. |
| Notification-only record stays inside a turn | User prompt A → assistant `Edit` → user `tool_result` → user record containing only a complete `<task-notification>` block → assistant incomplete text-only completion A → stop | Exit 0; stdout parses as JSON with `decision: "block"`, and `reason` contains the implement-phase quality-review/decision-brief continuation. The injected notification does not independently establish a human boundary. |
| Edited-work completion | User prompt A → assistant `Edit` → user `tool_result` → assistant incomplete text-only completion A → stop | Exit 0; stdout parses as JSON with `decision: "block"`, and `reason` contains the implement-phase quality-review/decision-brief continuation. |
| Legacy fallback includes the fifth assistant message | Transcript has no genuine user boundary; an assistant `Edit` is the fifth most-recent assistant message, followed by four text-only assistant messages and user-role tool results → stop | Exit 0; stdout parses as JSON with `decision: "block"`; the five-assistant-message fallback includes its boundary element. |
| Legacy fallback excludes the sixth assistant message | Same malformed transcript, but the only assistant `Edit` is the sixth most-recent assistant message → stop | Exit 0; stdout is empty; the fallback does not scan unbounded history. |
| Done precedence | Active ticket is `phase: done` with missing `verify.md`; transcript contains a current-turn assistant `Edit` that would independently trigger quality review → stop | Exit 0; stdout parses as JSON with `decision: "block"`; `reason` identifies the missing done-phase verification evidence and does not contain the implement-phase decision-brief continuation. |

Boundary normalization also uses table-driven cases for array content containing
empty/whitespace text, reminder-only text, multiple complete reminder blocks,
reminder-plus-prompt text, an incomplete leading system tag, and a tool-result
item with misleading text. Only non-empty human text remaining after complete
harness blocks are removed establishes a genuine human-prompt boundary;
tool-result items and `isMeta` records never do.

The integration harness runs the installed `stop-quality` hook with the ordered
JSONL transcripts above. Every case asserts process status, stdout (empty or a
parsed block decision and discriminating reason), and the absence of an
unrelated continuation; stderr is asserted when the case depends on it.
