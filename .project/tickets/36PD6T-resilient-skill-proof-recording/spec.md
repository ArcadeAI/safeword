# Spec: Keep skill verification proof working in normal shell commands

## Intent

Let people running safeword through Codex or Cursor get reliable proof that they
ran quality skills, even when using the short installed-helper path or several
proof commands in one shell command.

## Intake Brief

- **Requested by:** Safeword Maintainer (SWM) following a real Codex session failure
- **Cost of inaction:** valid quality work can be left unrecorded, so the done gate asks the maintainer to repeat it or appears to contradict the work already completed
- **Reversibility:** two-way door; private hook behavior and tests, with no stored data or public API migration

## References

- Prior art: `WHFTDK-normalize-hook-run-identity` established the Codex/Cursor proof bridge.
- POSIX shell AND lists execute the next command only after the preceding command succeeds, so the bridge must preserve proof independently for each recognized command in a chain: [Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html).

## Personas

- Safeword Maintainer (SWM)

## Surfaces

Affected:

- OpenAI Codex
- Cursor

Unaffected:

- Claude Code — its explicit session environment remains the proof source.
- Safeword CLI — no CLI command behavior changes.

## Vocabulary

- **Proof bridge:** a short-lived cache that lets a runtime hook pass its session identity to the immediately following helper process.

## Jobs To Be Done

### resilient-skill-proof-recording.SWM1 — Finish a quality workflow without a false missing-proof block

**Persona:** Safeword Maintainer (SWM)

> When I run a required quality skill from Codex or Cursor, I want its proof to be captured using the normal installed command form, so I can finish a ticket without rerunning valid work or weakening the gate.

#### resilient-skill-proof-recording.SWM1.R1 — A documented helper command records proof for its requested skill

#### resilient-skill-proof-recording.SWM1.R2 — Each helper command in one shell command, including repeated skills, retains its own current-session proof

#### resilient-skill-proof-recording.SWM1.R3 — Unrecognized paths and missing or expired identities never produce proof

## Rave Moment

skip: table-stakes — this removes an interruption; it does not create a shareable new capability.

## Outcomes

- The documented relative path records current-session proof on each affected runtime.
- `verify && audit` and `verify && verify` record one separate proof entry per helper command for the same session.
- A malformed or foreign-root helper path, missing identity, stale identity, out-of-order request, or short-circuited chain tail writes no proof.

## Open Questions

None.
