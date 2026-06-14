# Spec: Codex PreToolUse Deny Spike

**Feature:** Prove one safeword phase gate can run as a Codex `PreToolUse` hook for supported edit calls.

## Jobs To Be Done

### codex-pretooluse-deny-spike.SM1 - Prove Codex can enforce safeword's edit gate

**Persona:** Safeword Maintainer (SM)

> When I add Codex as a supported agent surface, I want a real `PreToolUse` denial proof for the existing phase gate, so I can design the rest of the Codex integration from measured enforcement behavior instead of assumptions.

#### codex-pretooluse-deny-spike.SM1.AC1 - Unsupported intake state is denied before a scenario file is created

The adapter denies supported Codex edit calls that attempt to create `test-definitions.md` before the existing safeword intake prerequisites are satisfied.

#### codex-pretooluse-deny-spike.SM1.AC2 - Satisfied intake state is allowed without adding a new gate implementation

The adapter allows the same edit when the existing safeword phase-gate checks pass, proving the Codex path delegates to the established hook behavior instead of drifting.

#### codex-pretooluse-deny-spike.SM1.AC3 - Fallback denial is observable through Codex's exit-code-2 contract

The adapter can surface the same denial reason through Codex's documented stderr fallback so the spike records both supported signaling paths.

## Open Questions

defer: real interactive Codex-session observation depends on local Codex CLI availability and hook trust; automated fixture coverage comes first, then the live run records any environment-specific message surface.

## Scope

- Add a narrow Codex `PreToolUse` adapter for supported Codex edit calls.
- Reuse the existing safeword phase-gate behavior from the Claude hook path.
- Cover JSON-deny and exit-code-2 deny signaling with focused tests.
- Document unsupported or untested Codex tool paths as spike findings.

## Out Of Scope

- Full Codex setup/generator work.
- Full lifecycle hook mapping.
- Managed enterprise enforcement recipes.
- Plugin packaging.

## Done When

- Missing intake prerequisites deny `test-definitions.md` creation.
- Satisfied intake prerequisites allow `test-definitions.md` creation.
- Exit-code-2 fallback emits the blocking reason on stderr.
- The spike output names the guardrail limits rather than promising complete enforcement.
