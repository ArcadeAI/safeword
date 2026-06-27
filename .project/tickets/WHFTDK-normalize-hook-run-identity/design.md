# Design: Normalize hook run identity

## Problem

Hook code currently assumes Claude's `session_id` is the universal run id. Codex and Cursor expose related concepts with different names and scopes, and some proof writers fall back to `unknown-session` when the Claude env var is unavailable.

## Proposed Shape

Add one hook library helper that resolves a `RunIdentity`:

```ts
type AgentRuntime = "claude" | "codex" | "cursor" | "unknown";

interface RunIdentity {
  runtime: AgentRuntime;
  sessionKey: string | null;
  turnKey: string | null;
  source: string;
}
```

Resolution rules:

- Claude uses `session_id`, then `CLAUDE_SESSION_ID`, then `CLAUDE_CODE_SESSION_ID`.
- Codex uses hook `session_id`, then `CODEX_THREAD_ID`; hook `turn_id` is optional turn metadata.
- Cursor uses `conversation_id`; `generation_id` is optional turn metadata.
- Missing ids produce `runtime: "unknown"` and `sessionKey: null`.
- Storage keys include the runtime prefix so identical raw ids from different hosts cannot collide.

## Integration Points

- `hooks/lib/quality-state.ts` accepts either a raw Claude session string or a `RunIdentity`.
- New quality-state writes use runtime-scoped storage keys.
- Claude legacy reads check `quality-state-<session>.json` for compatibility when the runtime-scoped file is absent.
- Codex hook adapters set `SAFEWORD_AGENT_RUNTIME=codex` when delegating to Claude-shaped hooks.
- Cursor hooks use the same helper for marker keys instead of ad hoc `conversation_id ?? "default"`.
- Proof writers use normalized identity and never write `unknown-session`.

## Compatibility

Existing Claude state files are read but not rewritten. New writes use runtime-scoped filenames, which may create a new state file alongside the legacy file.

## Test Strategy

Use focused Vitest coverage for:

- Identity normalization by runtime.
- Runtime storage-key collision prevention.
- Legacy Claude quality-state read fallback.
- Codex quality-state write isolation.
- Proof writer behavior when no identity exists.

## Rollout

Register the new helper in `packages/cli/src/schema.ts`, update templates, and mirror dogfood `.safeword/` copies so this repo uses the same behavior it ships.
