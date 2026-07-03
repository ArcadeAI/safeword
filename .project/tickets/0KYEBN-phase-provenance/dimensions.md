# Dimensions: phase-provenance gate

Derived from intake (scope, done_when, resolved /figure-it-out decisions) plus
domain knowledge of the pre-tool gate machinery (#385 pre-edit evaluation,
existing gate exemptions).

| Dimension                | Partitions                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Write kind               | creation (no prior ticket.md) · phase-changing edit · edit that leaves phase untouched               |
| Ticket type              | feature (gated) · task / patch / epic / absent (exempt)                                              |
| Birth phase              | intake or absent (allowed) · past intake (boundary: define-behavior, the minimal jump) · off-enum    |
| Transition step          | +1 canonical step · > +1 forward (boundary: intake → done, the maximal jump) · backward · into off-enum |
| Prior phase              | canonical · off-enum or absent (counts as intake for step-counting)                                  |
| phase_skips hatch        | absent · covers every skipped phase · covers only some (partial) · entry with empty reason           |
| Type trajectory          | type unchanged · non-feature → feature flip · absent → feature flip (both count as a birth at the current phase, with the hatch honored both ways) |
| Frontmatter parseability | parses · unparseable/missing on creation (fail closed, #119) · at-rest tolerance on edits · repair (unparseable prior → parseable frontmatter: evaluated as a birth at the repaired values, never a free pass) |

Boundary notes:

- Minimal violation: born at define-behavior (skips only intake) — must still deny.
- Maximal jump: intake → done — denial must name every skipped phase, not just the first.
- Hatch is per-phase by design (/figure-it-out 2026-07-03): partial cover denies, naming only the uncovered phases.
- At-rest tolerance is the deliberate negative space: an edit that doesn't change phase never trips the gate, whatever the stored value (protects ~15 legacy off-enum tickets).
