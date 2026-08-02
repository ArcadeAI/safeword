---
name: spike
description: Run a bounded disposable experiment to resolve one build-only
  technical uncertainty before production planning. Use only when explicitly
  invoked.
---

# Spike

Resolve one technical kill-risk with executable evidence. A spike is not a
rough first implementation: its evidence survives, its code does not.

## Charter

Define the experiment before writing code.

## Isolation

Run experimental code on a dedicated branch and worktree, separate from
production implementation.

## Evidence distillation

Feed the result into the feature ticket's existing `impl-plan.md`. Experimental
code is disposable.
