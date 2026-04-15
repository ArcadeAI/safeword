---
id: 124b
type: task
phase: intake
status: in_progress
created: 2026-04-15T14:12:00Z
last_modified: 2026-04-15T14:12:00Z
---

# Add verify phase before done — done means done

**Goal:** Split the overloaded `done` phase into `verify` (run evidence gates) and `done` (ticket closed). Prevents agents from skipping /verify + /audit by jumping straight to done.

**Origin:** Process audit of ticket #124. Agent set `phase: done` without running /verify or /audit. The stop hook's done gate didn't catch it because the phase transition and completion declaration happened in a single turn.

## Scope

**In scope:**

- Add `verify` phase to BDD phase list (between `implement` and `done`)
- Prompt hook: add `verify` reminder ("Run /verify and /audit. Cross-scenario refactor if clear wins exist.")
- `/verify` skill: write output to `{ticket-folder}/verify.md` as artifact
- Stop hook done gate: check for `verify.md` artifact existence (replace or supplement text-pattern evidence checks)
- Update SKILL.md phase table and resume logic
- Update DONE.md to reflect the split (verify = run gates, done = close)

**Out of scope:**

- Pre-tool gate on phase: done (fragile — requires parsing edit content for field values)
- Changing how /audit works (separate concern)
- Retroactive verification of existing done tickets

**Done when:**

- Phase list includes `verify` between `implement` and `done`
- Prompt hook shows verify-specific reminder
- /verify writes `verify.md` artifact to ticket folder
- Stop hook hard-blocks `phase: done` when `verify.md` is missing
- Agent cannot close a ticket without running /verify first
- Existing tests pass + new tests for verify gate

## Work Log

- 2026-04-15T14:12:00Z Created: from process audit of #124 — agent skipped Phase 7 (done gate) because no hard gate prevented the transition
