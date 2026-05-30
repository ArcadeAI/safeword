# Dimensions: Scenario-lineage numbering (XT1FFM)

Derived from scope + done_when, plus the `safeword check` advisory precedent
(persona/glossary drift) the coverage report rides.

| Dimension                  | Partitions                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Scenario-title conformance | conformant `<jtbd-id>.AC<#>.<name>` → AC ref · free-text title → no ref                                       |
| AC coverage status         | covered (≥1 scenario) · uncovered (0 scenarios) · stale ref (JTBD matches, AC# absent) · orphan (JTBD absent) |
| Scenario multiplicity / AC | one scenario · multiple scenarios (boundary — AC counts once, no double-finding)                              |
| Input artifact presence    | spec ACs + test-defs · spec ACs, no test-defs · no ACs / no spec.md                                           |

## Notable partitions from domain knowledge

- **Three buckets, not one** — `/figure-it-out` split "orphan" into three findings:
  **uncovered AC** (real AC, no scenario), **stale AC ref** (scenario names a real
  JTBD but an AC# that JTBD lacks — usually a typo or an AC that was renumbered),
  and **orphan** (scenario names a JTBD absent from spec.md — usually a deleted or
  renamed JTBD). A single bucket would conflate fixes that differ: edit the AC# vs.
  delete/repoint the scenario vs. restore the JTBD.
- **Free-text title is not a finding** — a scenario whose title carries no parseable
  ref contributes no coverage AND raises no flag. It's pre-scheme prose, not a
  mis-reference; flagging it would punish grandfathered/old-flow scenarios.
- **Degradation by absence** — spec has ACs but no test-definitions.md → **no flags**
  (mirrors the AC gate's grandfather-by-absence; a ticket that hasn't reached
  define-behavior shouldn't drown in uncovered-AC noise). No ACs / no spec.md →
  empty report.
- **Advisory, never a gate** — the report rides the existing `safeword check`
  advisory channel; there is no `deny` partition and `pre-tool-quality.ts` is
  untouched (converged Q2). Multi-scenario-per-AC is a boundary on coverage
  counting, not a new behavior class.
