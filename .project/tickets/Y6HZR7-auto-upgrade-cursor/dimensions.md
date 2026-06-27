# Dimensions: Auto-upgrade under Cursor

| Dimension | Partitions | Notes |
| --- | --- | --- |
| Cursor session-start behavior | context hook; auto-upgrade hook; no upgrade due | The context hook must remain first, and the auto-upgrade hook must be silent and fail-open. |
| Auto-upgrade implementation path | shared core; Cursor wrapper | Cursor must call the BJX7WR shared apply core instead of copying apply logic. |
| Cursor hooks reconciliation | safeword hooks; user-authored hooks; reset/unmerge | Safeword may replace its own hook entries but must preserve user-authored entries on the same event. |
| Concurrent writes during upgrade | write tool; shell command; no active lock | Cursor write and shell gates deny only while the auto-upgrade lock is active. |
| Cross-agent regression risk | Claude Code; Codex; Cursor | Cursor wiring must not change Claude Code's asyncRewake behavior or Codex's dispatcher behavior. |
