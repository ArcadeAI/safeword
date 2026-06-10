# Dimensions: ADR consultation step

| Dimension                    | Partitions                                                                       | Notes                                                               |
| ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Architecture location shape  | single file / directory of `.md` / directory with README.md / absent / empty dir | The file-or-dir polymorphism on resolved `paths.architecture`       |
| Directory contents           | accept-any names (numeric prefix, ADR- prefix, arbitrary) / README.md excluded   | Accept-any per replan; README is convention boilerplate, not an ADR |
| Path configuration           | default `.safeword-project/architecture.md` / overridden (e.g. `docs/docs/arch`) | Override resolution already shipped (K7N2QM) — sample one override  |
| Arch alignment section state | content / `skip: <reason>` / (absent impl-plan out of scope — XDNSZA gate owns)  | Drives the check advisory                                           |
| Location presence (advisory) | present / absent                                                                 | Crossed with section state at the decision boundary                 |
| Doc surfaces                 | canonical templates copy / dogfood copy                                          | Parity pair for the consultation procedure + worked example         |

**Pruning:** section-state × location-presence full cross (3×2) sampled at the three decision cells: content+absent (flags), skip+absent (clean), content+present (clean). skip+present (stale skip) deliberately unflagged — checking skip-reason text against location state is prose interpretation, out of scope per the structural-only ruling. The empty-section state is impossible at advisory time — XDNSZA's gate enforces content-or-skip on every section before a new-flow feature reaches implement (recorded per scenario-gate review). Directory-content naming variants collapse into one accept-any scenario plus the README exclusion; that scenario's Given also pins non-`.md` exclusion and no-recursion.
