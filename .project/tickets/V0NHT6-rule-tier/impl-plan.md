# Impl Plan: Numbered Rule tier between JTBD and scenarios

**Status:** planned

## Approach

**Riskiest assumption:** the whole tier can ride the existing single-lineage-ref pipeline —
extending the ref grammar to (AC | R) at the two parse points (`parseAcReferenceFromTag` /
`uniqueAcReferences` in `gherkin-feature.ts`; the `parseAcIdsByJtbd` heading walk in
`scenario-coverage.ts`) buckets coverage correctly without restructuring the report
builders. **Cheapest proof:** the AC-precedence scenario (`@feat.R1.AC1` attributes to the
AC, no false R ref) plus the R-tag inheritance scenario — both pure-parser unit tests,
sequenced as slice 1 so a wrong grammar design fails before anything is built on it.

Proof plan + build order (primary proof per `testing/SKILL.md` highest-practical-scope —
parsers and report builders are pure functions, so unit is the highest scope that runs
them fully; CLI/hook/cucumber surfaces get integration wiring proofs):

1. **Ref grammar (load-bearing):** R-ref parse + AC-wins precedence + direct-vs-inherited
   R tags — `gherkin-feature.ts` unit. Proves: AC-precedence, direct-tag, inheritance
   scenarios.
2. **Spec catalog walk:** classify AC vs R headings per JTBD + mixed-kind detection —
   `scenario-coverage.ts` unit. Proves: mixed-JTBD issue scenario (report side).
3. **Coverage buckets + advisories:** rule uncovered/stale/orphan, zero-rejection with
   unnumbered-block exemption, message contract strings (id + plain-language problem +
   next action) — unit on the report builders. Proves: drift trio, rejection trio, the
   NTB message outline rows for check-owned messages.
4. **Lint additions:** name-token/tag mismatch; lineage lint accepting exactly one AC-or-R
   ref — unit. Proves: mismatch and multiple-lineage scenarios + their message rows.
5. **`safeword check` wiring:** health.ts over real fixture ticket dirs (real fs, no
   internal mocks) — integration. Proves: end-to-end check scenarios, AC-only snapshot
   compat (path-normalized golden), corpus coverage scenario.
6. **Intake-exit gate:** hook-side `jtbd.ts` classifies criteria kind; accepts R-only,
   skip, and mixed (fail-open); denial message names Rules — unit in tests/hooks +
   existing hook-parity/differential pattern. Proves: all four gate scenarios + denial
   message row.
7. **Cucumber selection:** tag expression on an R id over a fixture feature through the
   repo's cucumber lane — integration. Proves: tag-expression scenario (pins the upstream
   rule-tag-inheritance contract).
8. **Templates + docs:** spec-template, bdd DISCOVERY/SCENARIOS, review-spec, migration
   mapping; hook mirrors byte-identical — covered by parity check + full suite.

Each slice lands as its own RED→GREEN→REFACTOR loop(s) against the ledger; nothing in a
later slice is needed to prove an earlier one.

## Decisions

| Decision                     | Choice                                                                          | Alternatives considered              | Rejected because                                                               |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| R-ref recognition            | Extend the ref-parsing helpers in `gherkin-feature.ts` beside the AC regex       | Standalone rule-parser module        | Duplicates the tag walk; doubles the hook-mirror surface                        |
| Mixed-kind detection site    | The spec-catalog heading walk (`scenario-coverage.ts`), surfaced via health.ts   | A separate check pass                | Second walk over the same headings for one classification bit                  |
| Zero-rejection data source   | Effective tags on `ParsedFeatureScenario` grouped by rule ref                    | Structural parse of Rule blocks      | Effective-tag inheritance already exists; structure adds no information         |
| Gate classification          | Minimal heading-kind classifier added to hook-side `jtbd.ts`                     | Porting the CLI parser into the hook | Hooks can't import the CLI dist; the mirror stays deliberately minimal          |
| Compat proof                 | Path-normalized golden snapshot of check/lint output on an AC-only fixture       | Byte-exact raw output comparison     | Absolute paths in output flake across machines/CI                               |

## Arch alignment

Honors (from `ARCHITECTURE.md` → Key Decisions):

- **Product-Framing Layer in BDD Phase 0 (JTBD / Personas / Acceptance Criteria)** — the
  tier extends this layer's grammar downward without replacing its artifacts.
- **Unified BDD+TDD Workflow** — scenarios stay the single behavior source; the ledger and
  hooks are untouched in shape.
- **Continuous Quality Gates (LOC + Phase + TDD)** — new signals follow the established
  advisory-first posture (issues for grammar violations, advisories for coverage; the
  intake gate stays fail-open on mixed JTBDs).
- **Frozen Transcript Fixture Testing** (pattern precedent) — compat proven against
  recorded fixtures rather than live regeneration.
- Cross-runtime hook-mirror pattern with differential/parity pinning (the `jtbd.ts` /
  `markdown-sections.ts` precedent, P58R22).

## Known deviations

skip: no deviations planned

## Assessment triggers

- ZRMDKD (blocking coverage gate) starts — its hook-side port must adopt the tier-aware
  coverage from slice 3, not re-derive it.
- NMSD94 review stamps land — revisit the deferred hard numbering-lock (deny renumbering a
  stamped rule ID).
- Arcade corpus migration in practice — if mechanical tag respelling proves too costly,
  revisit the deferred split-axis (`@job:`/`@rule:`) compat flag.
- `@rejection` tag collisions with existing user tag conventions — revisit the tag name or
  make it configurable.
