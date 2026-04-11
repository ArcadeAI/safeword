---
id: 112a
slug: learning-extraction-trim
status: backlog
type: task
created: 2026-04-11
parent: '112'
---

# Trim learning-extraction.md from 526 to ~150 lines

**Goal:** Cut the guide to its core value — triggers, locations, decision tree, templates, anti-patterns — by removing the ~400 lines of repetition and self-evident instruction.

## Problem

The guide says the same thing four times: decision tree (150-170), examples (271-319), workflow integration (382-396), summary (485-517), key takeaways (520-526). That's context pollution, not agent ergonomics.

## What to keep (~120-150 lines)

| Section                      | Lines              | Why it earns its place          |
| ---------------------------- | ------------------ | ------------------------------- |
| Recognition triggers         | 9-27 (18 lines)    | Core: when to extract           |
| File locations + precedence  | 30-49 (20 lines)   | Core: where to put it           |
| Decision tree                | 150-170 (20 lines) | Core routing logic              |
| Forward-looking template     | 176-207 (30 lines) | Agent needs the structure       |
| Debugging narrative template | 209-238 (30 lines) | Agent needs the structure       |
| Anti-patterns                | 400-438 (38 lines) | Compress to a table (~15 lines) |

## What to cut (~400 lines)

| Section                      | Lines              | Why it's bloat                                                                                                  |
| ---------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| "Using Existing Learnings"   | 52-147 (95 lines)  | Teaches the agent to run `ls` with three full scenario walkthroughs. Agent knows how to check if a file exists. |
| "Benefits of Checking"       | 141-147            | Bullet list explaining why checking for duplicates is good. Self-evident.                                       |
| "Examples: What Goes Where"  | 271-319 (50 lines) | Repeats decision tree with full markdown code blocks                                                            |
| "When Claude Should Suggest" | 322-340            | Restates recognition triggers in different words                                                                |
| "Iteration & Refinement"     | 344-378 (35 lines) | Monthly/quarterly review cadence, feedback loops, acceptance rate monitoring. No agent acts on this.            |
| "Workflow Integration"       | 382-396            | Restates decision tree as numbered steps                                                                        |
| "Quick Reference" table      | 441-449            | Repeats decision tree as a table                                                                                |
| "Directory Structure"        | 452-481            | Shows same paths from lines 32-48 again                                                                         |
| "Summary"                    | 485-517 (33 lines) | Restates everything above                                                                                       |
| "Key Takeaways"              | 520-526            | Restates the summary                                                                                            |

## Anti-patterns compression

Current: 38 lines with emoji headers and explanations. Compress to:

```markdown
## Don't Extract

| Signal                          | Example                           |
| ------------------------------- | --------------------------------- |
| In official docs                | "React useState is async"         |
| One-line fix, no principle      | Changed `==` to `===`             |
| Implementation without insight  | "File X uses pattern Y"           |
| Opinion without justification   | "Prefer tabs over spaces"         |
| Steps without lesson            | "Tried 5 things, #4 worked"       |
| Mid-debugging (unconfirmed fix) | Wait until fix is verified        |
| Obsolete technology             | Webpack 4 gotchas when using Vite |
```

## LLM writing guide compliance

The trimmed guide should follow llm-writing-guide.md principles:

- One decision tree, not four restatements
- Concrete templates over abstract process descriptions
- No "benefits" sections explaining why good things are good

## Work Log

- 2026-04-11T23:23 Created ticket from audit of learning-extraction.md in parent #112.
