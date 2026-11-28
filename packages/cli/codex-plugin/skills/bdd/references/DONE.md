---
description: |-
  USE WHEN in BDD done phase (verify.md exists). Close the ticket — verification already happened in verify.
---

## Packaged runtime

Resolve [the bundled Safeword runtime](../../../runtime/cli.js) relative to this containing asset, not the project working directory.
Before each shell block, assign SAFEWORD_PLUGIN_RUNTIME to that resolved absolute file path in a separate shell statement ending with a semicolon, then invoke the helper in that same shell call.
Do not use `SAFEWORD_PLUGIN_RUNTIME=... bun "$SAFEWORD_PLUGIN_RUNTIME" ...`: the shell expands the argument before applying that environment assignment.
Keep PROJECT_DIR bound to the actual project. Never substitute a project helper or another agent cache.

# Done: Close Ticket

**Entry:** verify.md exists in ticket folder (written by $safeword:verify in the verify phase).

Done means the ticket is closed. All verification happened in the verify phase.

## Close

1. Update parent epic if applicable (add completion entry to parent's work log; if all children done → update parent `status: done`)
2. Update ticket: `phase: done`, `status: done`
3. Commit the close with a conventional-commit message summarizing the change

The stop hook hard-blocks if verify.md is missing or empty — you cannot reach done without completing the verify phase first.

**Avoid bloat.**
