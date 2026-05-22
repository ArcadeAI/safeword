---
id: '172'
slug: phase-step-enforcement
title: 'Epic: Phase step enforcement — make sure each step inside a phase actually happens'
type: Feature
status: open
epic: phase-step-enforcement
---

# Epic: Phase step enforcement

**Type:** Feature (epic — shell, not yet scoped)

**Goal:** Today's hooks enforce phase _transitions_ (phase gate, LOC gate, done gate). They don't enforce the _steps within_ a phase. You can skip propose-and-converge in Clarify, skip REFACTOR after GREEN, or close Verify without running scenarios — and nothing catches it. This epic audits each phase's expected internal steps, inventories the existing hooks, and adds whatever's missing so the model can't shortcut within a phase.

**Context:** Most phase leaks are silent — they look like "done" but skipped the rigor that made the phase meaningful. Examples:

- **Clarify** — jumps to `scope` without contribution techniques, specificity self-test, or research-before-proposing.
- **Build / TDD** — RED → GREEN with no REFACTOR; or GREEN without re-running the test it just wrote.
- **Verify** — `/verify` produces the artifact even when not every check passed.
- **Done** — closes the ticket without surfacing any learnings.

## Open questions (to resolve when this epic is Clarified)

- Which phases are leakiest today? (Needs an audit pass before fanning out children.)
- Enforcement style per leak: hard block via hook, soft nudge via prompt injection, or artifact-based (no artifact → can't advance)?
- One stop hook that knows the current phase, or one stop hook per phase?
- Do steps get their own checklist artifact, or extend ticket frontmatter (`steps_completed: [...]`)?
- How do we keep this from turning into bureaucracy — what's the test for "this step is worth enforcing"?

## Tension with 170 (Propulsive by default)

These two epics pull opposite directions: 170 says "keep moving unless blocked," 172 says "make sure every step happened." Likely resolution: enforcement should be **artifact-based** wherever possible — Claude can blast through phases as fast as it wants, as long as the required artifact gets produced. Pause-based enforcement is the failure mode. Worth deciding the rule before either epic ships scope.

## Child tickets

_(none yet — fan out after this epic is Clarified)_
