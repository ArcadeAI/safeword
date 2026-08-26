---
name: bdd
description: Behavior-first feature development — use when building new
  capabilities, continuing feature work, or when work introduces new state or
  multiple user flows. Discovers desired behavior through examples and scenarios
  before implementation. Do NOT use for bug fixes, typos, or small isolated
  changes.
---

# BDD Orchestrator

Behavior-first development for features. Discovery → Scenarios → Implementation.

Define the behavior before implementing it. When unsure whether work is a feature, default to a task (TDD directly) — the user can `$safeword:bdd` to override.

## Phase Tracking

Features progress through phases. Track in ticket frontmatter:

```yaml
---
type: feature
phase: implement # intake | define-behavior | scenario-gate | plan-implementation | implement | verify | done
---
```

**Phase meanings:**

| Phase                 | What happens                                      | Details                           |
| --------------------- | ------------------------------------------------- | --------------------------------- |
| `intake`              | Context check, discovery                          | references/DISCOVERY.md           |
| `define-behavior`     | Writing Given/When/Then                           | references/SCENARIOS.md           |
| `scenario-gate`       | Validating scenarios                              | references/SCENARIOS.md           |
| `plan-implementation` | Implementation design record                      | references/PLAN_IMPLEMENTATION.md |
| `implement`           | Outside-in TDD                                    | references/TDD.md                 |
| `verify`              | Evidence gate: $safeword:verify + $safeword:audit | references/VERIFY.md              |
| `done`                | Close ticket                                      | references/DONE.md                |

**Update phase when:**

- Completing a BDD phase → set next phase
- Scenario-gate complete → offer the optional `$safeword:spike` checkpoint only for an eligible build-only kill-risk, then set `plan-implementation` (impl-plan authoring, proof plan + sequencing live there)
- Plan reviewed (impl-plan.md valid, status planned) → set `implement`
- All scenarios pass → set `verify`
- $safeword:verify + $safeword:audit complete (verify.md exists) → set `done`

### Phase-exit review (Tier 2)

The **scenario-gate exit requires** an independent review of the scenarios — not
your own pass. (Your own inline pass is Tier 1: `$safeword:self-review`, per asset, as you
author.) Invoke the shared host-owned coordinator with only the phase artifacts
and ticket scope; its typed verdict decides. Resolve a review-capable Safeword
CLI first; source checkouts do not guarantee a bare `safeword` on `PATH`:

```bash
SAFEWORD_REVIEW_PROGRESS=1 bunx --bun safeword@0.79.4 review run scenario-gate feature-file ticket-spec [legacy-test-definitions] --agent-handoff --json
```

The coordinator prefers the opposite headless agent and labels a permitted
same-agent fallback as degraded. Only when its typed result is
`REVIEW_ROUTES_EXHAUSTED`, invoke `$safeword:finish-review` immediately with the original
result and the same accepted targets. For every other result, return it
unchanged; do not bypass it with another private subagent. On a result that
satisfies the configured policy, record the returned provenance in the stamp
(substitute the four values from `data` in the coordinator result):

```bash
bun .safeword/hooks/write-review-stamp.ts --author-agent "author-agent" --reviewer-agent "actual-reviewer" --independence "independence" --phase phase-name
```

If the reviewer finds blocking issues, fix them and re-review — don't stamp.

All BDD review exits share one lifecycle rule: `REVIEW_PENDING` is a live
review, not a verdict. Keep its `review_id`, collect it through the returned
typed `nextActions` until terminal, and never start a replacement review or
advance/stamp while it is pending. `REVIEW_STALE` means rerun against the
current artifacts. Only a terminal verdict may advance the phase.

The plan-implementation exit applies the same discipline to the implementation plan (see references/PLAN_IMPLEMENTATION.md's exit). Other phase exits don't need an independent review by default — they carry their
own guards (intake's user sub-phase gates, implement's tests, the done-gate's
evidence checks). When the **review gate** is enabled (`reviewGate` in
`.safeword/config.json` — e.g. autonomous runs where user gates auto-confirm,
ticket 2VCSZY), every phase advance requires a stamp, or a logged skip reason
(`… --phase <phase> --skip "<why no independent review is needed>"`).

---

## Resume Logic

**Resuming** means reconstruct where the ticket left off and continue. The ticket's `phase:` and the first unchecked ledger item tell you _where_; the last work-log entry tells you _what_. Announce where you're resuming, then continue.

**Resume by phase:**

| Phase                 | Resume action                                                        |
| --------------------- | -------------------------------------------------------------------- |
| `intake`              | Start understanding (propose-and-converge)                           |
| `define-behavior`     | Continue drafting scenarios                                          |
| `scenario-gate`       | Continue validating scenarios                                        |
| `plan-implementation` | Continue the implementation plan (references/PLAN_IMPLEMENTATION.md) |
| `implement`           | Find first unchecked scenario, run TDD                               |
| `verify`              | Run $safeword:verify and $safeword:audit, write verify.md            |
| `done`                | Close ticket (verify.md must exist)                                  |

---

## Current Behavior

Understand first and size internally (see SAFEWORD.md "Understanding" and "Sizing") — state the scope read inside your proposal, not as a separate announcement. If the user references an iteration/story/phase from a spec, resume its child ticket at the current phase, or create one and run full BDD if none exists; if a ticket already exists, read its phase and resume there.

**Artifact-first:** before doing a phase's work, create or verify its artifact — intake → `<namespace-root>/tickets/{ID}-{slug}/ticket.md`; define-behavior → the feature source at `features/<slug>.feature` (or the configured `paths.features` directory) plus the R/G/R ledger at `<namespace-root>/tickets/{ID}-{slug}/test-definitions.md`. Then execute the phase using its phase file, and update `phase:` on transition.

---

## Phase Files

Load the appropriate file based on current phase:

| Phase                 | File                              |
| --------------------- | --------------------------------- |
| `intake`              | references/DISCOVERY.md           |
| `define-behavior`     | references/SCENARIOS.md           |
| `scenario-gate`       | references/SCENARIOS.md           |
| `plan-implementation` | references/PLAN_IMPLEMENTATION.md |
| `implement`           | references/TDD.md                 |
| `verify`              | references/VERIFY.md              |
| `done`                | references/DONE.md                |

For splitting large features, see references/SPLITTING.md.
