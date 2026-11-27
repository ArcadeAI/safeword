---
name: bdd
description: "Invoke this skill before editing production code whenever the request adds a user-facing capability with new state or multiple user actions, even if it fits in one function. Write concrete scenarios first, including a failure case. Skip this skill for typos and fixes to existing behavior."
allowed-tools: '*'
---

# BDD Orchestrator

Behavior-first development for features. Discovery → Scenarios → Implementation Planning →
Execution Planning → Implementation.

## Start here

Loading this skill starts the feature workflow. The next step is to open the active
feature ticket and resume its phase, or to start intake if no ticket exists.

For a fresh feature, open [DISCOVERY.md](DISCOVERY.md) and create its ticket using
the runtime bundled beside this skill. Run this from the project root, substituting
the loaded plugin directory and the feature's slug, title, and goal:

```sh
bun "<plugin-directory>/runtime/cli.js" ticket new <slug> --type=feature --title="<title>" --goal="<goal>"
```

Continue intake in the scaffolded ticket and spec. Use the phase guides below to
write concrete Given/When/Then scenarios and finish the planning steps before the
first production edit. Approve or resolve an open scope decision through intake.

Safeword planning review and approval are enforced on local Claude Code, local
Codex, local Cursor, OpenCode CLI and TUI, Claude Code Cloud, and Cursor Cloud
Agents. Codex Cloud and OpenCode Desktop execution is advisory. Do not claim
authoritative planning review or approval there; move authoritative planning to
a supported gated surface.

## Phase Tracking

Features progress through phases. Track in ticket frontmatter:

```yaml
---
type: feature
phase: intake # define-behavior | scenario-gate | plan-implementation | plan-execution | implement | verify | done
---
```

**Phase meanings:**

| Phase                 | What happens                    | Details                                          |
| --------------------- | ------------------------------- | ------------------------------------------------ |
| `intake`              | Context check, discovery        | [DISCOVERY.md](DISCOVERY.md)                     |
| `define-behavior`     | Writing Given/When/Then         | [SCENARIOS.md](SCENARIOS.md)                     |
| `scenario-gate`       | Validating scenarios            | [SCENARIOS.md](SCENARIOS.md)                     |
| `plan-implementation` | Implementation design record    | [PLAN_IMPLEMENTATION.md](PLAN_IMPLEMENTATION.md) |
| `plan-execution`      | Startable work and proof order  | [PLAN_EXECUTION.md](PLAN_EXECUTION.md)           |
| `implement`           | Outside-in TDD                  | [TDD.md](TDD.md)                                 |
| `verify`              | Evidence gate: /verify + /audit | [VERIFY.md](VERIFY.md)                           |
| `done`                | Close ticket                    | [DONE.md](DONE.md)                               |

**Update phase when:**

- Completing a BDD phase → set next phase
- Scenario-gate complete → offer the optional `/spike` checkpoint only for an eligible build-only kill-risk, then set `plan-implementation`
- Implementation Plan reviewed and approved → set `plan-execution`
- Execution Plan reviewed and current → set `implement`
- All scenarios pass → set `verify`
- /verify + /audit complete (verify.md exists) → set `done`

### Phase-exit review (Tier 2)

The **scenario-gate exit requires** `review-spec` in Review mode. That skill owns
the scenario targets, project context, coordinator protocol, verdict, and review
stamp. This orchestrator owns only routing and the phase transition; do not
restate or independently invoke the scenario-review protocol here.

All BDD review exits share one lifecycle rule: `REVIEW_PENDING` is a live
review, not a verdict. Keep its `review_id`, collect it through the returned
typed `nextActions` until terminal, and never start a replacement review or
advance/stamp while it is pending. `REVIEW_STALE` means rerun against the
current artifacts. Only a terminal verdict may advance the phase.

The plan-implementation and plan-execution exits apply the same discipline to their respective
plans (see [PLAN_IMPLEMENTATION.md](PLAN_IMPLEMENTATION.md) and
[PLAN_EXECUTION.md](PLAN_EXECUTION.md)). Other phase exits don't need an independent review by default — they carry their
own guards (intake's user sub-phase gates, implement's tests, the done-gate's
evidence checks). When the **review gate** is enabled (`reviewGate` in
`.safeword/config.json` — e.g. autonomous runs where user gates auto-confirm,
ticket 2VCSZY), every phase advance requires a stamp, or a logged skip reason
(`… --phase <phase> --skip "<why no independent review is needed>"`).

---

## Resume Logic

**Resuming** means reconstruct where the ticket left off and continue. The ticket's `phase:` and the first unchecked ledger item tell you _where_; the last work-log entry tells you _what_. Announce where you're resuming, then continue.

**Resume by phase:**

| Phase                 | Resume action                                                                       |
| --------------------- | ----------------------------------------------------------------------------------- |
| `intake`              | Start understanding (propose-and-converge)                                          |
| `define-behavior`     | Continue drafting scenarios                                                         |
| `scenario-gate`       | Continue validating scenarios                                                       |
| `plan-implementation` | Continue the implementation plan ([PLAN_IMPLEMENTATION.md](PLAN_IMPLEMENTATION.md)) |
| `plan-execution`      | Continue the execution plan ([PLAN_EXECUTION.md](PLAN_EXECUTION.md))                |
| `implement`           | Find first unchecked scenario, run TDD                                              |
| `verify`              | Run /verify and /audit, write verify.md                                             |
| `done`                | Close ticket (verify.md must exist)                                                 |

---

## Phase Artifacts


**Artifact-first:** before doing a phase's work, create or verify its artifact — intake → `<namespace-root>/tickets/{ID}-{slug}/ticket.md`; define-behavior → the feature source at `features/<slug>.feature` (or the configured `paths.features` directory) plus the R/G/R ledger at `<namespace-root>/tickets/{ID}-{slug}/test-definitions.md`. Then execute the phase using its phase file, and update `phase:` on transition.

---

## Phase Files

Load the appropriate file based on current phase:

| Phase                 | File                                             |
| --------------------- | ------------------------------------------------ |
| `intake`              | [DISCOVERY.md](DISCOVERY.md)                     |
| `define-behavior`     | [SCENARIOS.md](SCENARIOS.md)                     |
| `scenario-gate`       | [SCENARIOS.md](SCENARIOS.md)                     |
| `plan-implementation` | [PLAN_IMPLEMENTATION.md](PLAN_IMPLEMENTATION.md) |
| `plan-execution`      | [PLAN_EXECUTION.md](PLAN_EXECUTION.md)           |
| `implement`           | [TDD.md](TDD.md)                                 |
| `verify`              | [VERIFY.md](VERIFY.md)                           |
| `done`                | [DONE.md](DONE.md)                               |

For splitting large features, see [SPLITTING.md](SPLITTING.md).
