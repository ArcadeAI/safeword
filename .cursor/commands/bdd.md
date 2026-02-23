---
description: Orchestrate BDD flow for this task (define behaviors before implementation)
---

# Orchestrate BDD

Override detection and use BDD workflow for this task.

## When to Use

- Agent detected `task` but you know it's actually a feature
- You want discovery/scenarios before implementation
- Task will require multiple E2E tests

## Behavior

1. Run through BDD phases: context check, discovery, scenarios, validation, decomposition
2. Continue with inline TDD (Phase 6: RED → GREEN → REFACTOR)

## Example

```
User: Change the auth flow to use OAuth
Agent: Task. Writing tests first. `/bdd` to override.
User: /bdd
Agent: Feature. Defining behaviors first...
       What's the goal? What should users be able to do?
```
