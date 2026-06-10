# Dimensions: Gherkin foundation (102a)

Derived from spec.md (DEV1.AC1/AC2, SM1.AC1, done_when) + domain knowledge (Gherkin validity, runner separation).

| Dimension        | Partitions                                                                      | AC       |
| ---------------- | ------------------------------------------------------------------------------- | -------- |
| Gherkin emission | doc → Feature; `## Rule:` → Rule; `### Scenario:` → Scenario; G/W/T/And → steps | DEV1.AC1 |
| Lineage → tag    | lineage title → `@<jtbd>.AC#` tag; free-text title → no lineage tag             | DEV1.AC1 |
| Emitted validity | output parses with the official `@cucumber/gherkin` parser                      | DEV1.AC1 |
| Format selection | default → vitest; `--format gherkin` → `.feature`; unknown `--format` → error   | DEV1.AC2 |
| Runner wiring    | `test:bdd` runs the dogfood `.feature` green; vitest `test` excludes `.feature` | SM1.AC1  |

**Test layers:** DEV1.AC1 + the format-selection half of DEV1.AC2 → **unit** (pure renderer; assert the emitted string + parse it with `@cucumber/gherkin`). The `--format` flag validation (unknown-format) → **command-level** (CLI exit code). SM1.AC1 → **integration** (spawn cucumber-js / vitest; assert exit + separation). Build order: renderer unit-first, then the command flag, then the runner wiring + dogfood feature.
