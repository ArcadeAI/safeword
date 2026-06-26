# Impl Plan: Auto-upgrade under Cursor

**Status:** implemented

## Approach

Riskiest assumption: Cursor can run auto-upgrade as a second, silent
`sessionStart` hook without harming existing SAFEWORD.md context injection.
The cheapest proof is setup + hook integration coverage: generated
`.cursor/hooks.json` must keep the context hook first, add the auto-upgrade hook
second, keep both fail-open, and the installed auto-upgrade hook must exit
successfully with no output when no upgrade should apply.

| Behavior | Layer | Implementation path |
| --- | --- | --- |
| Cursor setup wires auto-upgrade at session start | Integration | Extend `setup-cursor.test.ts` to assert `.cursor/hooks.json` includes `session-safeword-context.ts --agent=cursor` first and `session-cursor-auto-upgrade.ts` second. |
| Cursor session start never uses blocking/error notification paths | Integration | Assert the new Cursor hook has no `failClosed` and the wrapper exits `0` with empty stdout/stderr when auto-upgrade is disabled. |
| Cursor reuses the shared cross-agent apply core | Schema/package guards | Register `session-cursor-auto-upgrade.ts` in `SAFEWORD_SCHEMA`, package inventory, hook coverage, and Claude hook-wiring exclusions. |
| Claude and Codex behavior stay unchanged | Focused regression | Keep existing auto-upgrade core and setup tests in the focused run; the Cursor wrapper calls `runAutoUpgrade()` but does not alter shared outcome mapping. |

Build order: add the failing setup expectation for the new Cursor hook, add the
silent wrapper, register it in schema/package inventories, add the installed
hook integration test, then run the focused setup/schema/hook suite.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Cursor hook shape | Separate silent `sessionStart` hook after the context hook | Combined Cursor dispatcher | Cursor `sessionStart` context injection already exists; combining it with upgrade work risks delaying or weakening context delivery. |
| Cursor output contract | Exit `0`, write no stdout/stderr | Exit `2`, `user_message`, `continue:false`, `failClosed` | Current Cursor docs say `sessionStart` is fire-and-forget, `continue:false` is not enforced, and exit `2` is a blocking/error path. |
| Upgrade implementation | Call PR #433's shared `runAutoUpgrade()` core | Cursor-only copy of upgrade logic | Duplicating apply logic would violate the parent epic's shared-core decision. |
| Failure behavior | Catch wrapper-level errors and stay silent | Surface hook errors to Cursor | Cursor has no reliable session-start notification channel; failing open preserves startup and retries next session. |

## Arch alignment

- Honors "Schema as Single Source of Truth" by registering the new hook in
  `packages/cli/src/schema.ts` and relying on generated setup output rather than
  hand-editing installed configs.
- Honors "Reconciliation Over Copy" by adding the hook through templates and
  schema-owned files so setup/upgrade/reset can reconcile it.
- Honors "IDE Parity" by using the same auto-upgrade core across Claude Code,
  Codex, and Cursor while keeping each agent's hook output contract separate.

## Known deviations

- Cursor major-version and repeated-failure notices remain silent in this slice.
  This is deliberate because Cursor `sessionStart` does not provide a reliable
  user-visible message path; richer notification UX stays deferred.
- Cursor runs context injection and auto-upgrade as two `sessionStart` hooks
  instead of one dispatcher. This preserves the existing context path and accepts
  the small chance that one session sees pre-upgrade context.

## Assessment triggers

- Revisit the separate-hook design if Cursor documents ordered `sessionStart`
  execution or a reliable startup message channel.
- Revisit silent outcomes if users miss major-version availability or repeated
  failure-cap notices in practice.
- Revisit wrapper error handling if Cursor begins enforcing `sessionStart`
  responses or changes exit-code behavior.
- Revisit the implementation if the shared auto-upgrade core moves to
  `safeword hook <name>` CLI dispatch.
