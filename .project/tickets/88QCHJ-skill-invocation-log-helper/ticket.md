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
  - Verify which surfaces can execute the helper before replacing snippets: Claude skills, Cursor commands, and Codex skills may not share the same shell-injection semantics.
  - Replace repeated verify/audit shell injection snippets with helper calls.
  - Preserve done-gate log format and failure behavior.
out_of_scope:
  - Assuming Claude-style dynamic shell injection works in Cursor or Codex without proof.
  - Inferring skill invocation from hand-written artifacts.
  - Changing which skills are required by the done gate.
done_when:
  - `verify` and `audit` surfaces call the same helper.
  - Each updated surface has a recorded invocation mechanism or an explicit no-change rationale.
  - Existing `skill-invocations.log` parsing still passes.
created: 2026-06-14T01:39:25.845Z
last_modified: 2026-06-15T13:18:49Z
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

## Figure-it-out follow-up

**Frame:** Decide how to satisfy the cross-client proof gap without reintroducing duplicated log-writing code.

**Research domains:** Claude inline shell execution; Codex skill execution model; Cursor command/skill execution model; session-scoped done-gate evidence; Bun security/audit support.

**Options considered:** Keep all surfaces as-is and document the prior contract; roll non-Claude surfaces back to inline snippets; keep the helper and add explicit fallback instructions when `!` lines are not auto-expanded.

**Recommend:** Keep the helper and add the fallback. Claude Code documents inline `!` execution, while Codex and Cursor docs support skills/commands but do not prove the same Markdown shell-expansion behavior. The fallback keeps one writer implementation while making the non-Claude path explicit and fail-closed.

**Next:** Require `CLAUDE_SESSION_ID` in the helper, add fallback text to verify/audit surfaces, and revalidate.

## Notes

- Keep the log format `<timestamp> <session-id> <skill-name>` compatible with `hooks/lib/skill-invocation-log.ts`.
- Preserve fail-closed behavior: if logging fails, the user should still see that done-gate evidence may be missing.
- Quality-review guardrail: Claude Code documents dynamic context injection for skills; Codex and Cursor helper invocation must be verified against their own current behavior before changing those files.

## Work Log

- 2026-06-15T13:18:49Z Validated: Added fallback invocation wording, made `record-skill-invocation.ts` fail closed when `CLAUDE_SESSION_ID` is absent, upgraded local/project Bun to 1.3.14, and ran `bun audit` successfully with no vulnerabilities. Passing checks: focused invocation-log tests, `bun run test:smoke:fast`, `bun run lint`, release dogfood parity, changed-file Prettier check, `bun install --frozen-lockfile`, and `git diff --check`. Limitation: unconstrained `bun run test` was interrupted after the Vitest worker sat idle without output; smoke/focused suites cover this change path.
- 2026-06-15T13:07:23Z Follow-up: Quality review found the helper change still implied Claude-style inline shell execution worked everywhere. Chose a portable fallback wording instead of splitting templates or reverting non-Claude surfaces.
- 2026-06-15T04:26:37Z Implemented: Added installed namespace/logging helpers, registered both in schema, and updated verify/audit logging plus explain namespace lookups across templates and dogfood mirrors. Claude/Codex/Cursor surfaces keep the same Markdown shell-injection contract they already used, but now call the shared helper; release parity and invocation-log tests guard the shipped content.
- 2026-06-14T02:05:00Z Reviewed: Added per-surface helper-invocation proof requirement.
- 2026-06-14T01:46:00Z Scoped: Figure-it-out selected an explicit writer helper.
- 2026-06-14T01:39:25.845Z Started: Created ticket 88QCHJ.
