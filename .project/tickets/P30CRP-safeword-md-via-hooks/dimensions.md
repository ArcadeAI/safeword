# Dimensions: Load SAFEWORD.md through safeword-owned hooks

| Dimension            | Equivalence classes / boundary values                                                                                                                     | ACs                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Context-file state   | no root context file; customer-authored AGENTS.md; customer-authored CLAUDE.md; prior safeword-managed AGENTS block; prior safeword-managed CLAUDE import | DEV1.AC1, DEV1.AC2 |
| Agent surface        | Claude Code; Cursor; Codex                                                                                                                                | DEV1.AC3           |
| Session moment       | startup/resume session start; Claude compact session start                                                                                                | DEV1.AC3, DEV1.AC4 |
| Hook output contract | Claude/Codex JSON `hookSpecificOutput.additionalContext`; Cursor JSON `additional_context`; plain stdout fallback avoided for deterministic tests         | DEV1.AC3, DEV1.AC4 |
| Migration safety     | managed block only; managed block plus customer content; no managed block                                                                                 | DEV1.AC2           |
