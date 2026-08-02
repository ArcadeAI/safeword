---
name: spike
description: Run a bounded disposable experiment to resolve one build-only
  technical uncertainty before production planning. Use only when explicitly
  invoked.
---

# Spike

Resolve one technical kill-risk with executable evidence. A spike is not a
rough first implementation: its evidence survives, its code does not.

## Eligibility gate

Use a spike only after behavior is validated, when documentation and repository
code cannot settle a kill-risk, failure would change the plan, and a bounded
executable proof can answer it.

Otherwise route the uncertainty before writing experimental code:

- answerable from documentation or code → research it;
- dependent on user-only knowledge → `$safeword:elicit`;
- a choice among researchable alternatives → `$safeword:figure-it-out`;
- known implementation work → continue to `plan-implementation`.

## Charter

Define the experiment before writing code. Record all five fields:

1. **Question** — one precise technical uncertainty.
2. **Hypothesis** — the result expected and why.
3. **Kill criterion** — the observable result that rejects the direction.
4. **Proof** — the exact command or walkthrough and expected signal.
5. **Budget** — one vertical slice with a time or effort ceiling.

If any field is missing, name the missing field and stop. Do not create a
worktree, run a proof command, or spend the spike budget until the charter is
complete.

## Keep it question-sized

- Default to one experiment, one worker, and the smallest kill-risk vertical
  slice.
- Permit parallel worktrees only for independent comparison variants using the
  same charter and proof.
- Reject feature-wide component work as production implementation, not a spike.

## Isolation

Run experimental code on a dedicated branch and worktree, separate from
production implementation.

## Evidence distillation

Classify the result exactly once:

- **VALIDATED** — the hypothesis survived the kill criterion;
- **PARTIAL** — the direction works only under named constraints;
- **INVALIDATED** — the proof hit the wall and the direction is rejected.

Return a concise report:

```markdown
## Spike result: <VALIDATED | PARTIAL | INVALIDATED>

- Question:
- Hypothesis:
- Pre-spike base:
- Proof command or walkthrough:
- Evidence:
- Constraints or wall:
- Useful shortcuts:
- Decision:
- Production consequences:
```

Distill the evidence, shortcuts, decision, and production consequences into the
feature ticket's existing `impl-plan.md`, updating Approach, Decisions, and
Assessment triggers as applicable. Experimental code is disposable.
