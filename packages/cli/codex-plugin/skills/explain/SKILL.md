---
name: explain
description: Use when you need safeword's dense artifacts or current state
  translated into plain English — what this is, why it matters, what to do next,
  with the internal jargon stripped. Targets a safeword ticket, a blocked gate,
  or a verdict; with no target it recaps where you are in the current safeword
  work. Read-only. Do NOT use to explain code diffs or PRs (base Claude handles
  those), for general status questions unrelated to safeword artifacts, or to
  make any change.
disable-model-invocation: true
---

## Packaged runtime

Resolve [the bundled Safeword runtime](../../runtime/cli.js) relative to this containing asset, not the project working directory.
Before each shell block, assign SAFEWORD_PLUGIN_RUNTIME to that resolved absolute file path in a separate shell statement ending with a semicolon, then invoke the helper in that same shell call.
Do not use `SAFEWORD_PLUGIN_RUNTIME=... bun "$SAFEWORD_PLUGIN_RUNTIME" ...`: the shell expands the argument before applying that environment assignment.
Keep PROJECT_DIR bound to the actual project. Never substitute a project helper or another agent cache.

# Explain

Explain plainly and concretely in under 200 words. Read any relevant tickets, artifacts, or current state before answering.
Shorter is better.
Cover what matters to the user and the next action, if there is one.
Avoid Safeword jargon; define any terms you need to use.
