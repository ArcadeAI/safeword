# Dimensions: Auto-upgrade under Cursor

| Dimension | Partitions | Notes |
| --- | --- | --- |
| Hook surface | `sessionStart` context, `sessionStart` auto-upgrade | Cursor keeps context injection first and runs auto-upgrade as a separate silent hook. |
| Outcome channel | silent success, silent skip, git commit record | Cursor does not use exit 2, `continue:false`, or `user_message` for session-start notification. |
| Shared core | Claude wrapper, Cursor wrapper, Codex dispatcher | Agent-specific wrappers share the auto-upgrade apply core. |
| Repository safety | no upgrade running, upgrade lock active | Cursor write and shell gates wait while silent auto-upgrade owns repository state. |
