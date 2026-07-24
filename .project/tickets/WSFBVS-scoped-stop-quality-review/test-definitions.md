# Test Definitions: Keep stop-quality prompts scoped to edited-work turns

Source: [user-stories.md](./user-stories.md)

| Scenario | Given | When | Then |
| --- | --- | --- | --- |
| Conversational follow-up | An earlier assistant edit and its tool result | A later user text prompt requests an explanation | The stop hook emits no review continuation |
| Edited-work completion | A user prompt, assistant edit, and tool result | The assistant finishes the same turn with an incomplete brief | The hook retains its quality-review continuation |
| Malformed boundary fallback | A transcript with assistant edit activity but no user prompt boundary | The hook stops | The bounded legacy edit scan retains review behavior |
| Done precedence | A done-phase ticket and no current-turn edits | The hook stops | The done gate still blocks before the review path |

The integration harness runs the installed `stop-quality` hook with JSONL
transcripts and asserts observable hook output.
