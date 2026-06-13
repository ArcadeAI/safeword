# Dimensions — Ticket 147

Derived from intake: scope (log mechanism + phase-gate config + gate check), resolved open questions (features only; honor bypass; transition via lastKnownPhase).

## Behavioral dimensions

| Dimension                       | Partitions                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Log file presence               | exists / doesn't exist / unreadable                                                                               |
| Log content for current session | both verify + audit entries / verify only / audit only / neither                                                  |
| Cross-session entries           | other-session entries present (must not satisfy gate)                                                             |
| Phase transition state          | entering gated phase (lastKnownPhase ≠ gated) / already in gated phase (lastKnownPhase = gated) / non-gated phase |
| Ticket type                     | feature / task / patch / epic                                                                                     |
| stop_hook_active bypass         | true (skip gate) / false (gate fires)                                                                             |
| PHASE_GATES config              | phase has required skills / phase has no entry (no gate)                                                          |
| Log line robustness             | well-formed / malformed / partial / empty file                                                                    |

## Boundary cases

- First-ever invocation in fresh project — log file + parent directory don't exist yet → must be created
- Concurrent sessions writing to log — entries from session A don't satisfy gate for session B
- Re-entering done phase (after bypass + revert) — lastKnownPhase = done → gate doesn't re-fire
- Empty PHASE_GATES (config wiped) — every phase trivially passes (no required skills)
- Log file corrupted mid-write — gate fails closed (blocks; surfaces parse error)

## Rule mapping

- Log file presence × Log content → **Rule: Log gets written on skill invocation, scoped to session**
- PHASE_GATES config → **Rule: Phase-gate check consults the config map**
- Phase transition state × Ticket type → **Rule: Gate fires only on transition into a gated phase for feature tickets**
- Required-skill presence in log → **Rule: Missing required skills hard-block with skill-specific message**
- stop_hook_active bypass → **Rule: Bypass mechanisms honored consistently with existing done-gate**
- Log line robustness → **Rule: Log parsing is robust to malformed entries**

## Out-of-scope dimensions

- Instrumentation of /bdd, /tdd-review, /refactor, /quality-review, /debug (v2+ tickets).
- Phase gates beyond `done` (v2+ tickets).
- Auto-rotation of the log file (manual only at v1 scale).
- Cursor stop hook enforcement (gate is Claude Code-only; Cursor stop.ts unaffected).

## Card-ratio self-check

- **Rules:** 6. Each gets 3-4 scenarios.
- **Target scenarios:** ~20.
- **Open questions remaining at this phase:** 0 (all resolved in intake-final per spec-vs-impl contract).
