---
name: bdd
description: Behavior-first feature development — use when building new
  capabilities, continuing feature work, or when work introduces new state
  or multiple user flows. Discovers desired behavior through examples and
  scenarios before implementation. Do NOT use for bug fixes, typos, or small
  isolated changes.
allowed-tools: '*'
---

# BDD Orchestrator

Behavior-first development for features. Discovery → Scenarios → Implementation.

Define the behavior before implementing it. When unsure whether work is a feature, default to a task (TDD directly) — the user can `/bdd` to override.

## Phase Tracking

Features progress through phases. Track in ticket frontmatter:

```yaml
---
type: feature
phase: implement # intake | define-behavior | scenario-gate | plan-implementation | implement | verify | done
---
```

**Phase meanings:**

| Phase                 | What happens                    | Details                |
| --------------------- | ------------------------------- | ---------------------- |
| `intake`              | Context check, discovery        | DISCOVERY.md           |
| `define-behavior`     | Writing Given/When/Then         | SCENARIOS.md           |
| `scenario-gate`       | Validating scenarios            | SCENARIOS.md           |
| `plan-implementation` | Implementation design record    | PLAN_IMPLEMENTATION.md |
| `implement`           | Outside-in TDD                  | TDD.md                 |
| `verify`              | Evidence gate: /verify + /audit | VERIFY.md              |
| `done`                | Close ticket                    | DONE.md                |

**Update phase when:**

- Completing a BDD phase → set next phase
- Scenario-gate complete → set `plan-implementation` (impl-plan authoring, proof plan + sequencing live there)
- Plan reviewed (impl-plan.md valid, status planned) → set `implement`
- All scenarios pass → set `verify`
- /verify + /audit complete (verify.md exists) → set `done`

### Phase-exit review (Tier 2)

The **scenario-gate exit requires** an independent review of the scenarios — not
your own pass. (Your own inline pass is Tier 1: `/self-review`, per asset, as you
author.) Run it as a _fresh reviewer with no conversation history_ so the author
can't grade their own work: a forked subagent — a skill with `context: fork`, or
an explicit subagent — handed only the phase's artifacts and the ticket's scope,
applying the `/review-spec` procedure; **its** verdict decides. When
`crossModelReview` is on, that reviewer must be a **different model than the
author** — a same-model reviewer shares the author's blind spots. Prefer one of
comparable-or-better capability; never weaker. If you can't run a different
model, log a deliberate skip (`--skip "<reason>"`) rather than stamping a
same-model review. On a pass, record the stamp:

```bash
bun .safeword/hooks/write-review-stamp.ts --phase <phase you are leaving>
```

If the reviewer finds blocking issues, fix them and re-review — don't stamp.

The plan-implementation exit applies the same discipline to the implementation plan (see PLAN_IMPLEMENTATION.md's exit). Other phase exits don't need an independent review by default — they carry their
own guards (intake's user sub-phase gates, implement's tests, the done-gate's
evidence checks). When the **review gate** is enabled (`reviewGate` in
`.safeword/config.json` — e.g. autonomous runs where user gates auto-confirm,
ticket 2VCSZY), every phase advance requires a stamp, or a logged skip reason
(`… --phase <phase> --skip "<why no independent review is needed>"`).

---

## Resume Logic

**Resuming** means reconstruct where the ticket left off and continue. The ticket's `phase:` and the first unchecked ledger item tell you _where_; the last work-log entry tells you _what_. Announce where you're resuming, then continue.

**Resume by phase:**

| Phase                 | Resume action                                             |
| --------------------- | --------------------------------------------------------- |
| `intake`              | Start understanding (propose-and-converge)                |
| `define-behavior`     | Continue drafting scenarios                               |
| `scenario-gate`       | Continue validating scenarios                             |
| `plan-implementation` | Continue the implementation plan (PLAN_IMPLEMENTATION.md) |
| `implement`           | Find first unchecked scenario, run TDD                    |
| `verify`              | Run /verify and /audit, write verify.md                   |
| `done`                | Close ticket (verify.md must exist)                       |

---

## Current Behavior

Understand first and size internally (see SAFEWORD.md "Understanding" and "Sizing") — state the scope read inside your proposal, not as a separate announcement. If the user references an iteration/story/phase from a spec, resume its child ticket at the current phase, or create one and run full BDD if none exists; if a ticket already exists, read its phase and resume there.

**Artifact-first:** before doing a phase's work, create or verify its artifact — intake → `<namespace-root>/tickets/{ID}-{slug}/ticket.md`; define-behavior → the feature source at `features/<slug>.feature` (or the configured `paths.features` directory) plus the R/G/R ledger at `<namespace-root>/tickets/{ID}-{slug}/test-definitions.md`. Then execute the phase using its phase file, and update `phase:` on transition.

---

## Phase Files

Load the appropriate file based on current phase:

| Phase                 | File                   |
| --------------------- | ---------------------- |
| `intake`              | DISCOVERY.md           |
| `define-behavior`     | SCENARIOS.md           |
| `scenario-gate`       | SCENARIOS.md           |
| `plan-implementation` | PLAN_IMPLEMENTATION.md |
| `implement`           | TDD.md                 |
| `verify`              | VERIFY.md              |
| `done`                | DONE.md                |

For splitting large features, see SPLITTING.md.
