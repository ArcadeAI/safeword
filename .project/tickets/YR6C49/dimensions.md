# YR6C49 — Behavioral Dimensions

Systematic coverage analysis for the project-glossary feature. Each
dimension is partitioned into equivalence classes + boundary values;
scenarios in `test-definitions.md` cover one per partition (with
boundary cases).

## Dimension table

| Dimension                       | Partitions                                                                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entry shape**                 | minimal (Term + Definition only) / rich (all 4 optional fields) / with `**Aliases:**` line / with unknown `**Field:**` (forward-compat) / arcade `**Used in**:` colon-outside variant                                               |
| **Non-term content**            | header inside fenced code block / header inside HTML comment block / inline `<!-- … -->` on header line                                                                                                                             |
| **Structural validity**         | missing `**Definition:**` / duplicate term name / duplicate alias across terms / alias references unknown term / empty term name (`##`)                                                                                             |
| **Configured-path state**       | unset (default) / relative override / absolute override / empty-string override (boundary — defensive) / configured-but-missing                                                                                                     |
| **Scaffold + schema-ownership** | default file absent → scaffold / default file present → idempotent / `paths.glossary` configured → reconcile skips default scaffold / `paths.glossary` configured AND legacy default present → advisory (boundary — migration trap) |
| **`safeword check` reporting**  | malformed file → line-numbered errors + non-zero exit / configured-but-missing → loud non-zero exit / legacy + override → zero-exit advisory / well-formed → silent pass                                                            |
| **Lookup result**               | exact term match / alias match → resolves to canonical / case-mismatch on name → suggestion / unknown reference                                                                                                                     |
| **External integration**        | arcade's existing `.project/glossary.md` parses unchanged / `DISCOVERY.md` Phase 0 documents glossary-loading sub-step                                                                                                              |

## Notes on derivation

- **Entry shape — `**Aliases:**`** is a new field this ticket introduces.
  Arcade's existing glossary doesn't use it (so the arcade-parses-unchanged
  scenario covers absence) but the alias-resolution validator path needs
  positive coverage.

- **Entry shape — arcade `**Used in**:` colon-outside variant** is a
  domain-knowledge partition surfaced by reading
  `/Users/alex/Projects/arcade-monorepo/.project/glossary.md` directly:
  line 59 of that file uses `**Used in**:` (colon outside the bold) while
  lines 30/45/72 use `**Used in:**` (colon inside). The parser must
  tolerate both or the arcade-parse Done-When fails. Surfaced during
  intake critique.

- **Non-term content** partitions mirror the persona parser's
  `computeSkipMask` semantics ([personas.ts:193-220](packages/cli/src/utils/personas.ts:193)) —
  fenced code and block HTML comments mask whole regions; inline HTML
  comments are stripped from header text. Same three partitions cover
  the same parser surface here.

- **Configured-path state** partitions mirror K7N2QM's dimension table
  verbatim. The contract is identical — the glossary just becomes
  another key under `paths.*`. `empty-string` boundary preserves the
  defensive-programming guard K7N2QM R1.6 established.

- **Scaffold + schema-ownership** — the "legacy + override" partition is
  the migration-trap boundary K7N2QM R2.6 surfaced for personas. Same
  shape recurs for glossary; one scenario pins the advisory path.

- **`safeword check` reporting** — partitions map 1:1 to K7N2QM R2.3 /
  R2.6 / silent-pass branches. The "malformed" partition is new
  (personas had this too via 7YN5QB; glossary inherits the pattern).

- **Lookup result** partitions mirror `lookupPersonaReference`
  ([personas.ts:410-434](packages/cli/src/utils/personas.ts:410)) plus
  the new alias-match path that's unique to glossary.

- **External integration** — two partitions because they're two
  distinct artifacts on disk. Arcade compatibility is the KD4BYF
  done-when assertion; DISCOVERY.md sub-step is the Phase 0 hook the
  agent actually reads at intake.
