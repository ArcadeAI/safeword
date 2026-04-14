# Skill Description Design

Covers: How to write Claude Code skill descriptions for reliable auto-triggering. Discovered during ideation skill design (April 2026).

## Core Principle: Semantic Intent, Not Keyword Lists

Claude Code matches skills to tasks **semantically**, not by keyword grep. The description field should describe the situation where the skill applies, not enumerate words the user might say.

**Source:** Claude Code docs ("Claude matches your task against skill descriptions to decide which are relevant"); validated during dogfooding — keyword-based descriptions caused false positives ("add a comment" triggering BDD's "add" keyword).

## The Pattern

Lead with **what the skill does**, then describe **when it applies** using natural action phrases. Follow the bundled skill example from docs:

```
"Explains code with visual diagrams and analogies. Use when explaining how
code works, teaching about a codebase, or when the user asks 'how does this work?'"
```

| Don't                                                      | Do                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `Use when user says 'refactor', 'clean up', 'restructure'` | `Use when refactoring, restructuring, or simplifying code`          |
| `Use when user says 'add', 'implement', 'build'`           | `Use when building new features or implementing multi-file changes` |
| Quoted keyword lists                                       | Natural phrases that describe the situation                         |

## Key Constraints

- **Combined description + when_to_use capped at 1,536 chars** — front-load the key use case
- **Name field also matched** — if the skill is named `refactor`, Claude matches on that too
- **No priority order** between skills and CLAUDE.md — when instructions conflict, Claude picks arbitrarily. Avoid contradictions rather than relying on override.
- **Negative constraints help** — "Do NOT use for bug fixes" prevents mis-triggering on overlapping intent

## Anti-Patterns

| Anti-pattern                | Why it fails                                        | Example                                |
| --------------------------- | --------------------------------------------------- | -------------------------------------- |
| Quoted keyword lists        | Brittle — "add a comment" triggers BDD's "add"      | `'add', 'implement', 'build'`          |
| Pure abstract intent        | Loses discoverability — no action phrases to match  | `"Improve code structure"` (too vague) |
| Overlapping triggers        | Claude picks arbitrarily between conflicting skills | BDD "resume" + ticket-system "resume"  |
| `USE WHEN` / `TRIGGER WHEN` | Shouting doesn't improve matching — clarity does    | `USE WHEN user says...`                |

## The Sweet Spot

Semantic intent first → natural action phrases → negative constraints.

```yaml
# Good: intent + natural phrases + negative constraint
description: Improve code structure without changing behavior. Use when
  refactoring, restructuring, simplifying, or extracting code. NOT for
  style/formatting, features, or bug fixes.
```
