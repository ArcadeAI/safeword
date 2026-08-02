# Dimensions: Prevent stale Safe Word guidance from blocking Codex users

| Dimension | Partitions | Boundary |
| --- | --- | --- |
| Profile guidance state | absent, current/user-authored, exact legacy, legacy markers with edits | exact registered revision versus any content difference |
| Command surface | Codex session start, `codex status`, `doctor`, explicit cleanup | read-only commands never mutate |
| Project enrollment | Safe Word project present, unrelated repository | profile warning is relevant only when Safe Word is active or Codex status is requested |
| Cleanup outcome | exact legacy backed up and removed, modified content preserved | backup already exists or source changes after preview |

Three rules, four state partitions, and one destructive-boundary condition. No open questions.
