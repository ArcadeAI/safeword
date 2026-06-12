# Behavioral Dimensions — setup scaffolds .project/

Setup's namespace behavior is a function of `(repo starting state, lifecycle
command)`. The resolver (TAGWZ8) supplies the root; this child makes the
reconcile planners honor it.

| Dimension                    | Partitions (equivalence classes + boundaries)                                                                                                                                                                    | ACs proved |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Repo starting state          | fresh (no namespace dir) · arcade (`.project/` exists with user personas.md) · legacy (`.safeword-project/` only) · **both dirs present** (boundary) · configured root (boundary)                                | AC1-AC3    |
| Scaffold completeness        | namespace dirs (learnings, tickets, tickets/completed, tmp) · starter files (personas.md, glossary.md)                                                                                                           | AC1        |
| Adoption non-destructiveness | existing personas.md byte-identical after setup · missing glossary.md added alongside (partial-adopt boundary)                                                                                                   | AC2        |
| Single-namespace invariant   | fresh setup creates no `.safeword-project/` · legacy setup creates no `.project/`                                                                                                                                | AC1, AC3   |
| Lifecycle-command agreement  | upgrade stays on the resolved root (legacy repo → legacy; .project repo → .project) · diff reports clean after fresh setup · reset removes empty preserved dirs at the resolved root while user content survives | AC4        |

**Domain-knowledge boundaries not surfaced in intake:**

- **Partial arcade dir** — `.project/` exists with personas.md but no tickets/ or glossary.md: setup must fill the gaps without touching the existing file (the adopt-and-complete cell, most seamlessness-critical).
- **Configured root** — `paths.projectRoot` set pre-setup: scaffold lands there; covered as a boundary partition, not a full matrix row (resolver precedence already proven in TAGWZ8).
- **Per-file override skip (K7N2QM)** — `paths.personas` set: reconcile already skips the entry via `configKey`; regression-guarded by existing tests, no new scenario.
