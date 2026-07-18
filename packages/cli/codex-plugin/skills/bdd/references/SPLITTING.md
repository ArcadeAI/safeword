# Decomposition Checkpoints & Splitting

Splitting is **suggested, not mandatory** — user decides.

## When to Split

| Checkpoint              | Trigger                               | Action                     |
| ----------------------- | ------------------------------------- | -------------------------- |
| **Entry**               | 2+ user stories OR vague scope        | Split into epic + features |
| **define-behavior**     | >15 scenarios OR 3+ distinct clusters | Split by user journey      |
| **plan-implementation** | >20 tasks OR 5+ major components      | Split by component/layer   |
| **implement**           | >10 tests per slice                   | Break into smaller slices  |
| **TDD Loop**            | >5 unit tests for single E2E          | Break E2E into steps       |

## Entry Checkpoint Reasoning

```text
STEP 1: Count distinct user stories
- 1 story → feature
- 2 parallel stories → suggest 2 features
- 2 coupled stories (shared state) → 1 feature with 2 journeys
- 3+ stories OR can't enumerate → epic

STEP 2: Assess depth
- 6+ sequential steps, state machines → likely epic
```

## Split Protocol

**New ticket:** create an epic with a `children:` array and child tickets that link back via `parent:`, then commit the split with a conventional-commit message.

**Existing ticket (promote):** change `type: feature` → `type: epic`, add the `children:` array, and create the child tickets with `parent:` links.

## Restart Points After Split

| Split At             | Child Restarts From                                     |
| -------------------- | ------------------------------------------------------- |
| Entry                | `intake`                                                |
| define-behavior      | `scenario-gate`                                         |
| plan-implementation+ | `plan-implementation` — each child authors its own plan |

## User Override

The user can decline a split and proceed anyway — note the declined suggestion in the work log, continue at the current phase, and don't re-suggest at the same checkpoint this session.

**Avoid bloat.**
