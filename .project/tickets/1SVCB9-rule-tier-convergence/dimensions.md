# Behavioral dimensions — rule-tier-convergence

Derived from the 7 Rules in spec.md (SM1.R1–R3, NTB1.R1–R2, TB1.R1–R2), the done-when
list, and domain knowledge of the #713 parser/gate/coverage surface.

| Dimension                              | Partitions / equivalence classes + boundaries                                                                                                                                             | Proves        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Authoring-surface vocabulary           | scaffolds only `#### <id>.R<n>` + `@<id>.R<n>`; **no** "one criteria kind, never both" doctrine; **no** AC-as-co-equal option                                                              | SM1.R1        |
| Mixed-criteria guard                   | JTBD with both `.AC` + `.R` → **no** `safeword check` issue (guard deleted)                                                                                                                | SM1.R2        |
| Coverage vocabulary vs id spelling     | uncovered / stale / orphan for a `.R` id **and** for a legacy `.AC` id → worded once, in Rule terms                                                                                        | SM1.R2        |
| Intake-gate verdict × criteria present | ≥1 Rule → pass; ≥1 legacy AC → pass; neither + no skip → **deny**, message names `#### <id>.R<n>`; empty `skip:` → deny                                                                    | SM1.R3, NTB1.R1 |
| Legacy `.AC` parsing (back-compat)     | AC-only spec/feature → gate passes + coverage traces identically to pre-change (boundary: unchanged output)                                                                                | NTB1.R1       |
| Ref-parse precedence (tag shape)       | `@f.PO1.R1` → rule R1 of `f.PO1`; `@f.R1.AC1` → **AC** of JTBD `f.R1` (AC-wins retained); `@f.R1.R2` → rule R2 of JTBD `f.R1` (persona-code-`R` safe)                                       | NTB1.R1       |
| Deprecation-nudge trigger              | `.AC` heading in in-progress spec → advisory; `@…AC` tag in in-progress feature → advisory; Rule-only in-progress → **no** advisory; advisory is zero-exit (never a gate/issue)             | NTB1.R2       |
| Codemod transform target               | spec.md `#### x.AC1` heading; `.feature` `@x.AC1` tag; test-definitions.md `### Scenario: x.AC1.<name>` ref → each rewritten to `.R1`, same number, declaration + refs together             | TB1.R1        |
| Codemod run mode                       | fresh run → rewrite + report; re-run on migrated files → **no-op** (idempotent); `--dry-run` → preview, **no writes**; collision (AC→R clashes existing `.R<n>` in same JTBD) → refuse + report | TB1.R2        |

Notes:

- The deprecation nudge reuses the existing in-progress + spec-bearing `safeword check`
  path (no new global scan) — the same scope as coverage advisories today.
- AC-wins precedence and the greedy-terminal `.R` anchor are **retained** (soft-deprecate),
  so no ref-grammar collapse; only the mixed-criteria *guard* and the dual *vocabulary* go.
- Content-assertion scenarios (authoring-surface vocabulary) are proven by asserting the
  shipped template/skill strings, mirroring how #713 pinned template↔hook parity.
