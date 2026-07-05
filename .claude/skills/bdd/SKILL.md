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
phase: implement # intake | define-behavior | scenario-gate | implement | verify | done
---
```

**Phase meanings:**

| Phase             | What happens                    | Details      |
| ----------------- | ------------------------------- | ------------ |
| `intake`          | Context check, discovery        | DISCOVERY.md |
| `define-behavior` | Writing Given/When/Then         | SCENARIOS.md |
| `scenario-gate`   | Validating scenarios            | SCENARIOS.md |
| `implement`       | Outside-in TDD                  | TDD.md       |
| `verify`          | Evidence gate: /verify + /audit | VERIFY.md    |
| `done`            | Close ticket                    | DONE.md      |

**Update phase when:**

- Completing a BDD phase → set next phase
- Scenario-gate complete → set `implement` (proof plan + sequencing happens at the scenario-gate exit)
- Handing off to TDD → set `implement`
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

Other phase exits don't need an independent review by default — they carry their
own guards (intake's user sub-phase gates, implement's tests, the done-gate's
evidence checks). When the **review gate** is enabled (`reviewGate` in
`.safeword/config.json` — e.g. autonomous runs where user gates auto-confirm,
ticket 2VCSZY), every phase advance requires a stamp, or a logged skip reason
(`… --phase <phase> --skip "<why no independent review is needed>"`).

---

## Resume Logic

When user references a ticket, resume work:

1. **Read ticket** → get current `phase:`
2. **Find progress** → first unchecked `[ ]` in test-definitions
3. **Check context** → read last work log entry
4. **Announce resume** → "Resuming at [phase]. Last: [log entry]."

**Resume by phase:**

| Phase             | Resume action                              |
| ----------------- | ------------------------------------------ |
| `intake`          | Start understanding (propose-and-converge) |
| `define-behavior` | Continue drafting scenarios                |
| `scenario-gate`   | Continue validating scenarios              |
| `implement`       | Find first unchecked scenario, run TDD     |
| `verify`          | Run /verify and /audit, write verify.md    |
| `done`            | Close ticket (verify.md must exist)        |

---

## Current Behavior

1. Understand first (see SAFEWORD.md "Understanding") — propose-and-converge until user accepts proposal with structured scope
2. Size internally (see SAFEWORD.md "Sizing") — state scope assessment in proposal, not as a separate announcement
3. **If user references iteration/story/phase from a spec:**
   - Check if child ticket exists for that iteration
   - If not → create ticket, run full BDD
   - If yes → resume at current phase
4. **If ticket exists:** Read phase, resume at appropriate point
5. **Artifact-first rule:** Before doing work, create/verify the phase artifact:
   - intake → ticket at `<namespace-root>/tickets/{ID}-{slug}/ticket.md`
   - define-behavior → feature source at `features/<slug>.feature` (or the configured `paths.features` directory) plus R/G/R ledger at `<namespace-root>/tickets/{ID}-{slug}/test-definitions.md`
6. **Execute phase** using the appropriate phase file
7. **Update phase** in ticket when transitioning

---

## Phase Files

Load the appropriate file based on current phase:

| Phase             | File         |
| ----------------- | ------------ |
| `intake`          | DISCOVERY.md |
| `define-behavior` | SCENARIOS.md |
| `scenario-gate`   | SCENARIOS.md |
| `implement`       | TDD.md       |
| `verify`          | VERIFY.md    |
| `done`            | DONE.md      |

For splitting large features, see SPLITTING.md.
