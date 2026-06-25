# Spec: Normalize hook run identity across Claude, Codex, and Cursor

## Intent

Safeword hooks currently treat Claude `session_id` as the generic run identity. Codex and Cursor expose similar but different identifiers, so shared hook state, quality notes, and proof logs can collide, disappear, or fall back to fake `unknown-session` values.

Normalize hook run identity behind one local contract so Claude, Codex, and Cursor can all reuse the same proof and state logic without pretending every runtime is Claude.

## Intake Brief

- **Requested by:** Alex, after Codex/Cursor surfaced problems with the Claude-session-id assumption.
- **Cost of inaction:** Cross-runtime hooks keep losing state or writing misleading proof records. That blocks reliable Codex/Cursor parity and makes future hook debugging noisy.
- **Reversibility:** Medium. The storage naming change needs legacy Claude read compatibility, but the helper itself is local and can be adjusted without a public API break.

## References

- GitHub issue: https://github.com/ArcadeAI/safeword/issues/401
- Related self-reporting work: https://github.com/ArcadeAI/safeword/issues/345

## Personas

- Safeword Maintainer (SM): Maintains hook templates and validates cross-agent parity.
- Technical Builder (TB): Uses safeword from Claude, Codex, or Cursor and expects guardrails to behave consistently.

## Vocabulary

- **Run identity:** The normalized identity of the current agent interaction, including runtime, durable session/conversation key, optional turn/generation key, and source.
- **Runtime:** The host agent integration that invoked the hook: `claude`, `codex`, `cursor`, or `unknown`.
- **Session key:** A durable runtime-scoped key suitable for state and proof correlation.
- **Turn key:** Optional per-turn or per-generation metadata that should not replace the durable session key.

## Jobs To Be Done

### normalize-hook-run-identity.SM1 — Maintain hook state across runtimes

**Persona:** Safeword Maintainer (SM)

> When I add or debug hooks for a supported agent runtime, I want one shared run identity contract, so I can correlate state and proof without special-casing every caller.

#### normalize-hook-run-identity.SM1.AC1 — Supported runtime ids normalize to one contract

Claude, Codex, and Cursor hook inputs produce a runtime, durable session key, optional turn key, and source without each hook reimplementing field selection.

#### normalize-hook-run-identity.SM1.AC2 — Runtime storage keys cannot collide

The same raw id from different runtimes maps to distinct storage keys.

#### normalize-hook-run-identity.SM1.AC3 — Proof writers do not invent fake sessions

When no runtime identity is available, proof writers skip or fail visibly instead of writing `unknown-session`.

### normalize-hook-run-identity.TB1 — Keep existing Claude state usable

**Persona:** Technical Builder (TB)

> When safeword upgrades its hook identity behavior, I want existing Claude quality state to remain readable, so I do not lose guardrail context mid-project.

#### normalize-hook-run-identity.TB1.AC1 — Legacy Claude quality state is still read

Pre-existing `quality-state-<session>.json` files remain readable after new runtime-scoped state files are introduced.

#### normalize-hook-run-identity.TB1.AC2 — Codex/Cursor state does not overwrite Claude state

State written from non-Claude runtimes is stored under runtime-scoped keys that do not clobber legacy or new Claude state.

## Rave Moment

skip: table-stakes internal platform correctness.

## Outcomes

- Tests cover Claude, Codex, and Cursor identity normalization.
- Quality state stores new writes under runtime-scoped keys while reading old Claude files.
- Proof logs no longer contain newly written `unknown-session` rows.
- New hook helper is registered in schema and available in dogfood config.

## Open Questions

skip: implementation details are captured in the design and test definitions.
