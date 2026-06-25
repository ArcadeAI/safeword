# Dimensions: Auto-Upgrade under Codex

| Dimension | Partitions | Boundary / Notes |
| --- | --- | --- |
| SessionStart wiring | Fresh scaffold, retrofit onto existing safeword Codex config, reset/unpatch | Codex must have one safeword SessionStart hook because matching hooks run concurrently. |
| Agent outcome contract | Claude asyncRewake, Codex synchronous JSON context | Shared core returns typed outcomes; wrappers map outcomes to each agent contract. |
| Apply result | no-op, patch/minor applied, major notify, blocked/skipped, repeated failure cap | Codex never uses exit 2 for normal notices. Claude preserves existing exit-2 reminder behavior. |
| Failure cleanup | failed upgrade before edits, failed upgrade after safeword-managed edits, failed commit after staging | Safeword-managed changes are rolled back before recording a strike. User changes are never reverted. |
| Git safety | clean branch, dirty tree, detached HEAD, merge in progress, dogfood repo | Existing safety gates stay intact; Codex shares them. |

## Decisions Baked In

- Use a single Codex `SessionStart` dispatcher that runs auto-upgrade first, then emits SAFEWORD.md context.
- Extract a shared auto-upgrade core with typed outcomes instead of preserving Claude-specific `process.exit(2)` behavior in the core.
- Include rollback hardening in this slice because a synchronous Codex hook must leave the working tree clean if apply or commit fails.
