# Spec: Load SAFEWORD.md through safeword-owned hooks

## Intent

Safeword should deliver its standing agent instructions through files and hooks it owns, not by modifying customer-owned `CLAUDE.md` or `AGENTS.md`. A developer should be able to delete or rewrite those files without silently disabling safeword's core workflow guidance.

## References

- P30CRP ticket: [ticket.md](./ticket.md)
- Parent epic: [VKNF1T](../VKNF1T-platform-uplift-epic/ticket.md)
- Claude Code hooks docs: `SessionStart` and compact matcher add context.
- Cursor hooks docs and RBZR3F: `sessionStart` can inject `additional_context`.
- Codex hooks docs: `SessionStart` supports `hookSpecificOutput.additionalContext`.

## Personas

- Technical Builder (TB)
- Safeword Maintainer (SM)

## Jobs To Be Done

### safeword-md-via-hooks.DEV1 - Keep safeword active without owning my context files

**Persona:** Technical Builder (TB)

> When I install safeword in a project with my own agent instructions, I want safeword to load its required workflow context without editing my `CLAUDE.md` or `AGENTS.md`, so I can customize those files without accidentally disabling safeword.

#### safeword-md-via-hooks.DEV1.AC1 - Setup preserves customer context files

Fresh setup does not create or modify `CLAUDE.md` or `AGENTS.md` only to point at safeword.

#### safeword-md-via-hooks.DEV1.AC2 - Prior safeword context-file patches are removed safely

Upgrade/reset can remove safeword-managed `CLAUDE.md` and `AGENTS.md` blocks while leaving customer-authored content intact.

#### safeword-md-via-hooks.DEV1.AC3 - Safeword still loads at session start

Claude Code, Cursor, and Codex all receive the SAFEWORD.md standing context from safeword-owned hook/config surfaces.

#### safeword-md-via-hooks.DEV1.AC4 - Claude compaction restores the standing context

Claude Code re-injects SAFEWORD.md after compaction so removing the `@import` does not regress compaction resilience.

## Outcomes

- New installs leave customer-owned root context files alone.
- Upgrades clean up old safeword-managed context-file edits.
- Every supported agent surface has a safeword-owned startup path for SAFEWORD.md.
- Claude compaction still restores the same standing instructions.

## Open Questions

All intake questions resolved by the 2026-06-14 figure-it-out pass recorded in `ticket.md`.
