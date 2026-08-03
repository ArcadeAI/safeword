---
name: spike
description: Run a bounded disposable experiment to resolve one build-only technical uncertainty before production planning. Use only when explicitly invoked.
disable-model-invocation: true
---

# Spike

Resolve one technical kill-risk with executable evidence. A spike is not a
rough first implementation: its evidence survives, its code does not.

Run this workflow only after an explicit user request for `/spike`. A BDD
checkpoint offer is not invocation; wait for the user to choose it.

## Eligibility gate

Use a spike only after behavior is validated, when documentation and repository
code cannot settle a kill-risk, failure would change the plan, and a bounded
executable proof can answer it.

Otherwise route the uncertainty before writing experimental code:

- answerable from documentation or code → research it;
- dependent on user-only knowledge → `/elicit`;
- a choice among researchable alternatives → `/figure-it-out`;
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

Inspect the repository root, current worktrees, branch, and status. Validated
scenario and ticket-state changes must be included in one commit. If there are
uncommitted validated scenarios or ticket state, name the affected files and
stop: do not record `PRE_SPIKE_BASE`, and do not create a spike branch or
worktree.

Once that state is committed, record the current production commit as
`PRE_SPIKE_BASE`. Create a uniquely named `spike/<question-slug>` branch and
sibling worktree from that exact commit; never reuse an existing path or branch.
Before running the proof, verify the spike worktree is at `PRE_SPIKE_BASE` and
contains the exact validated scenario and ticket-state files from that commit.

Keep every experimental commit in the spike worktree. After classifying the
result, create the fresh production worktree from `PRE_SPIKE_BASE`. Run
`plan-implementation` there: create `impl-plan.md`, map the structured handoff,
commit the plan and ticket state, and review the plan. Only then begin production
implementation in that same worktree.

Do not merge, rebase, cherry-pick, or copy spike commits or files into the
production worktree. The spike branch remains unmerged while production work
begins.

Keep the spike worktree until its evidence is distilled and the implementation
plan is reviewed, then remove it through the repository's normal recoverable
cleanup process.

## Run the proof

Build only enough to execute the charter's proof. If the first attempt exposes
a setup defect rather than answering the question, spend at most one bounded
fix round. Stop when the proof answers the question or the budget expires.

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

Return this structured handoff to the BDD orchestrator. Do not assume
`impl-plan.md` exists yet: `plan-implementation` creates it, maps every handoff
value to its documented destination, and never reuses experimental code.

Stop and report instead of widening scope when the budget expires, user-only
knowledge or external authority is required, the experiment grows beyond one
kill-risk slice, or the result changes validated behavior. Route those cases to
`/elicit` or back to BDD scenario validation as appropriate.
