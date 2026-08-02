---
name: spike
description: Run a bounded disposable experiment to resolve one build-only technical uncertainty before production planning. Use only when explicitly invoked.
disable-model-invocation: true
allowed-tools: '*'
---

# Spike

Resolve one technical kill-risk with executable evidence. A spike is not a
rough first implementation: its evidence survives, its code does not.

## Charter

Define the experiment before writing code. Record all five fields:

1. **Question** — one precise technical uncertainty.
2. **Hypothesis** — the result expected and why.
3. **Kill criterion** — the observable result that rejects the direction.
4. **Proof** — the exact command or walkthrough and expected signal.
5. **Budget** — one vertical slice with a time or effort ceiling.

## Isolation

Run experimental code on a dedicated branch and worktree, separate from
production implementation.

## Evidence distillation

Feed the result into the feature ticket's existing `impl-plan.md`. Experimental
code is disposable.
