# Behavioral Dimensions — stale tooling-config warning

Two units: a pure scanner `(cwd → stale-config hits)`, and the upgrade wiring
that fires the warning `(migration outcome → warn | silent)`.

| Dimension        | Partitions (equivalence classes + boundaries)                                                                                                                        | ACs proved |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Config file type | eslint flat (.ts/.mjs/.cjs/.js) · .eslintrc*· tsconfig*.json · .github/workflows/\*.yml (one level deep, boundary) · prettier/knip/depcruise/jscpd                   | AC1        |
| Match presence   | config references `.safeword-project` (hit) · config clean (no hit)                                                                                                  | AC1, AC3   |
| Exclusion zone   | under `.project/` (documentary, skip) · under `.safeword/` (owned, skip) · inside managed prettierignore block (skip) · customer line in same file (count, boundary) | AC3        |
| Edit behavior    | flagged file is byte-identical after the warning (never edited)                                                                                                      | AC2        |
| Firing condition | migration moved → warn · declined / both-dirs / custom-root / already-current → silent                                                                               | AC4        |
| Output content   | each stale file named + the `.safeword-project/` → `.project/` mapping printed                                                                                       | AC1        |

**Domain-knowledge boundaries not surfaced in intake:**

- **Managed-block scoping** — the `.prettierignore` skip must apply ONLY to lines inside the `# Safeword - managed prettier exclusions` block, not the whole file; a customer's own stale line elsewhere in `.prettierignore` must still flag. Tested as an adversarial pair.
- **Documentary pollution** — the moved `.project/` dir contains ~159 legitimate `.safeword-project` references (tickets, learnings); excluding the namespace dir from the scan is load-bearing, not incidental.
- **No-move firing** — the warning is gated on an actual move, not on the flag being present; `--migrate-namespace` against a both-dirs/custom-root install does not move, so it must stay silent.
