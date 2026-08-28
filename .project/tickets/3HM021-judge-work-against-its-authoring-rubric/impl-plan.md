---
status: planned
---

# Implementation Plan

**Status:** planned

## Approach

Keep `review-spec/SKILL.md` as the public, canonical standard. Add explicit authoring and review modes. Make define-behavior load authoring mode before scenario generation. At independent dispatch, load the bundled canonical skill through the package template resolver and embed it as the scenario-gate rubric. Update the documented command to pass project knowledge as context, and align phase reminder/evidence strings with the same workflow.

## Proof Plan

- A skill-contract test proves authoring mode is loaded before generation and no second rubric is introduced in SCENARIOS.md.
- A real spawned-reviewer test captures stdin and proves the canonical skill marker reaches a scenario-gate prompt.
- Contract tests prove the documented command supplies required context and phase prompts require independent review evidence.

## Build Order

1. Add failing template and runtime prompt tests.
2. Restructure review-spec into shared standard plus explicit modes.
3. Wire define-behavior and scenario review context.
4. Replace the scenario runtime summary with the canonical bundled skill.
5. Align reminders and exit evidence; regenerate host skills.

## Decisions

- Keep `review-spec` for compatibility; renaming touches commands, schema, wrappers, generated plugins, and tests without improving enforcement.
- Use existing `getTemplatesDirectory()` so source and packaged runtime resolve the same canonical template.
- Send project knowledge as `--context`, not review targets, preserving the coordinator's bounded-work semantics.

## Design alignment

- **Schema as single source of truth:** `review-spec/SKILL.md` owns the authored rubric; a generated runtime projection prevents a second hand-maintained standard.
- **Agent parity:** Claude, Codex, and dogfood surfaces are generated from the same templates and protected by parity tests.
- **Reconciliation over copy:** templates remain authoritative and installed/generated surfaces are synchronized through the existing generators.
- **Hooks for invariants:** phase reminders and evidence checks enforce only routing and gate state; rubric judgment remains in the shared skill and independent reviewer.

## Assessment triggers

- The shared marked block cannot be extracted uniquely or contains host-only coordinator instructions.
- A generated reviewer rubric differs byte-for-byte from the canonical marked block.
- Scenario-gate dispatch lacks a nonblank `spec.md` as its first supporting context.
- BDD begins launching the scenario coordinator directly instead of delegating to `review-spec`.
- A generated host or lifecycle fixture diverges from the canonical template contract.

## Known Deviations

skip: the original issue covers three review kinds; this pilot intentionally proves the pattern only for scenario authoring and scenario-gate before generalization.
