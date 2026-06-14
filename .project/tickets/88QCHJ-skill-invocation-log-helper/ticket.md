---
id: 88QCHJ
slug: skill-invocation-log-helper
type: task
phase: intake
status: in_progress
parent: S3T6JA
epic: agent-surface-refactor
scope:
  - Add one installed helper for writing required skill invocation log entries.
  - Replace repeated verify/audit shell injection snippets with helper calls.
  - Preserve done-gate log format and failure behavior.
out_of_scope:
  - Inferring skill invocation from hand-written artifacts.
  - Changing which skills are required by the done gate.
done_when:
  - `verify` and `audit` surfaces call the same helper.
  - Existing `skill-invocations.log` parsing still passes.
created: 2026-06-14T01:39:25.845Z
last_modified: 2026-06-14T01:46:00Z
---

# Make required skill logging reusable

**Goal:** Replace duplicated done-gate logging shell with one helper command.

**Why:** `verify` and `audit` repeat a long namespace-root lookup and log append snippet across Claude, Codex, Cursor, and templates. The parser is centralized, but the writer is not.

## Figure-it-out pass

**Frame:** Decide whether repeated `verify`/`audit` log injections should stay inline, move to a helper script, or be handled by hook-side inference.

**Research domains:** Claude dynamic shell injection; hook done-gate evidence; namespace root resolution; failure visibility.

**Options considered:** Keep inline shell; call one installed helper; infer invocation from generated artifacts.

**Recommend:** Call one installed helper. The done gate needs proof that the skill was invoked, and helper output can preserve the same visible success/failure line while removing duplicated shell.

**Next:** Add a helper under `.safeword/hooks` templates, register it in schema, and update verify/audit templates plus installed mirrors.

## Notes

- Keep the log format `<timestamp> <session-id> <skill-name>` compatible with `hooks/lib/skill-invocation-log.ts`.
- Preserve fail-closed behavior: if logging fails, the user should still see that done-gate evidence may be missing.

## Work Log

- 2026-06-14T01:46:00Z Scoped: Figure-it-out selected an explicit writer helper.
- 2026-06-14T01:39:25.845Z Started: Created ticket 88QCHJ.
