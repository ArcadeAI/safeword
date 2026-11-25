---
name: explain
description: Use when you need safeword's dense artifacts or current state
  translated into plain English — what this is, why it matters, what to do next,
  with the internal jargon stripped. Targets a safeword ticket, a blocked gate, or
  a verdict; with no target it recaps where you are in the current safeword work.
  Read-only. Do NOT use to explain code diffs or PRs (base Claude handles those),
  for general status questions unrelated to safeword artifacts, or to make any
  change.
allowed-tools: Read, Grep, Glob, Bash
disallowed-tools: Edit, Write
disable-model-invocation: true
---

# Explain

Explain plainly and concretely in under 200 words. Read any relevant tickets, artifacts, or current state before answering.
Shorter is better.
Cover what matters to the user and the next action, if there is one.
Avoid Safeword jargon; define any terms you need to use.
