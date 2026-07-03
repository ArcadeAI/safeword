# Impl Plan: BDD lane: detect existing cucumber harness, configurable feature/step paths

**Status:** implemented

## Approach

**Riskiest assumption:** detection can reliably distinguish safeword's own scaffold from a host harness — exact content match against the set of shipped `cucumber.mjs` template revisions plus "deps are safeword's only when the lane files sit at their default locations". If that's wrong, every existing install self-triggers on upgrade and safeword abandons lanes it owns. Cheapest proof: the three TB1.AC2 upgrade scenarios (own scaffold / previous template revision / bitten repo) — built in slice 1 so a wrong design fails while it's still cheap.

Proof plan by scenario group (highest practical scope; the CLI test suite runs commands in-process against real temp filesystems, which is this repo's integration idiom):

| Scenario group | Owner | Primary proof | Why sufficient / supporting proof |
| --- | --- | --- | --- |
| Detection partitions (root config / workspace dep / root dep / customer mjs / none) + self-exclusion trio | `project-detector.ts` (`ProjectType.existingCucumberHarness`) | unit vs real temp fs | pure detection over files; integration coverage arrives with the setup scenarios |
| Setup suppress/scaffold (TB1.AC1, AC4) | `schema.ts` gate + `reconcile.ts` + setup output | integration (run setup against temp fs, assert files/package.json/output) | proves config→reconcile wiring with real collaborators; mocks nothing |
| Upgrade self-exclusion (TB1.AC2) | same detection + reconcile path | integration | ibid |
| Uninstall/reset guards (TB1.AC3, AC5) | `reconcile.ts` removal planning | integration | destructive path needs real fs; positive assertion that safeword's files DID go |
| Reader augment + fallback (TB2.AC1, AC3-lint) | `configured-paths.ts` + `feature-source.ts` → codify/lint-gherkin | integration through the CLI commands; unit for feature-source resolution (incl. `check` via the shared choke point — deliberate call in ledger) | choke-point argument: one resolver feeds all three readers |
| Runner scenarios (TB2.AC2, AC3-runner ×2) | `templates/cucumber/cucumber.mjs` | E2E — spawn real cucumber-js in a fixture project | done_when demands a real run; this is the wiring test for the runner entry point (mocks only the subprocess boundary — i.e. nothing) |
| Check advisories (TB3.AC1 ×3, AC2) | `health.ts` + schema-derived enumeration | integration (run check against temp fixtures, assert output) | advisory text derived from schema entries, so tests pin derivation not prose |

Build order (each slice lands green before the next):

1. **Detection** (`existingCucumberHarness` in project-detector + template-revision registry) — the load-bearing slice; unit fixtures for all partitions incl. the three self-exclusion cases.
2. **Config keys** — `paths.features`/`paths.steps` in `configured-paths.ts` (directory keys, `projectRoot` pattern); unit tests incl. missing/unparseable fallback.
3. **Reader augment** — `feature-source.ts` consumes the keys (augment); codify/lint-gherkin integration scenarios go green.
4. **Setup gating** — thread detection through schema/reconcile: suppress `cucumber.mjs`, lane managedFiles, the three deps (conditional-packages mechanism, inverted), `test:bdd` merge; setup output message. Setup + upgrade scenarios green.
5. **Uninstall/reset guards** — detection-gated removal in uninstall planning; extend configKey skip to the new keys.
6. **Runner** — template reads `.safeword/config.json` at runtime (resolved against the config file's own location, try/catch fallback); template unit tests + the E2E fixture runs.
7. **Check advisories** — health.ts advisory (detected+unset, leftover scaffold enumeration); integration scenarios green.
8. **Docs** — website `configuration.mdx` (+`cli.mdx`) paths.* and scaffolded-files tables.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Detection home | TWO `ProjectType` fields: `existingCucumberHarness` (evidence, drives notice/advisories) + `scaffoldBddLane` (suppression) — split forced by the bitten-repo scenario, where evidence and lane-maintenance must diverge | single evidence field (the plan's original shape); standalone util | a single field conflates "harness exists" with "don't maintain the lane", breaking bitten-repo upgrades; `detectCucumberLane` also exported standalone for health.ts |
| Self-exclusion match | SHA-256 hash set of every shipped template revision (`cucumber-template-revisions.ts`) + byte-compare against the live bundled template; contract test fails when the template changes without a registry append | hash only current template | every pre-change install would self-trigger on upgrade (dimensions boundary note) |
| Dep attribution | root `@cucumber/cucumber` is safeword-added iff root `cucumber.mjs` matches a shipped template revision; workspace-package deps and config files are ALWAYS host evidence | tracking installs in config.json | new state file for one bit; the lane config is the observable safeword left behind |
| Lane-file suppression | generator-over-template precedence in `resolveFileContent`: lane entries keep `template` (schema↔templates contract) while the generator gates on `scaffoldBddLane` (undefined = skip) | new per-entry `condition` field; fork the schema by project type | the generator-skip mechanism already existed; a `condition` field would be a second way to say the same thing (no other entry combines generator+template, verified) |
| Uninstall guard | filter `cucumber.mjs` from owned-file removal when `!scaffoldBddLane`; deps ride the conditional mechanism (not in the removal set when suppressed) | content-check at removal time | `scaffoldBddLane` already encodes exactly that content check |
| Runner config read | runtime `JSON.parse` inside `cucumber.mjs`, path resolved via `import.meta.dirname` (config file's own location), try/catch → defaults; bare configured dir also recognized as a CLI feature-path arg | generating cucumber.mjs from config at setup; `fileURLToPath` (lint style) | generated file goes stale when user edits config.json; ownedFiles overwrite would fight user config |
| Discovery semantics | augment (configured dirs added to default set) — proven by dual-violation lint scenario + dual-lane E2E run | replace | ticket Decision 4 — replace silently breaks the scenario pipeline while prose still writes to root `features/` |
| Advisory silencing | `paths.features` alone silences the detected-harness advisory (readers consume only features; steps is runner-only), stated in the message | require both keys | forcing `paths.steps` on non-TS harnesses is a permanent nag with no consumer |

## Arch alignment

- **Reconciliation Engine** (ARCHITECTURE.md): all file-set changes go through schema-driven owned/managed planning — the gate is added inside that model, not around it.
- **Bundled Language Packs (No External Packages):** detection + gating live in core `packs/typescript` + `project-detector`, no new packages.
- **Schema drift prevention:** schema.ts changes here trigger the pre-push targeted tests by design.
- **Ticket VM78NC** (discovery alignment): reader/runner path changes keep the single-policy discovery invariant — one resolver (`feature-source.ts`) and the template mirror it.

## Known deviations

skip: no deviations planned — the one wrinkle (relocated `.ts` steps flipping `hasJsSource`) is recorded out_of_scope in ticket.md rather than deviated around.

## Assessment triggers

- A second real host harness arrives (ticket 7CK2KP unblocks) — revisit whether detection should also read json/yaml host configs for paths (the reserved resolution-order slot).
- `paths.*` gains a third+ directory key — revisit the ad-hoc key model vs a typed directory-key union.
- Template revisions registry grows past a handful — revisit exact-content matching vs normalized/structural matching.
- Advisory ignored in the wild (bitten repos stay bitten) — revisit the rejected de-scaffold command (B2).
- Harness evidence missed because it lives deeper than the direct-workspace-package radius (e.g. nested workspaces) — widen the scan; currently root + `packages|apps|libs|modules/*` for config files and deps (matches feature-source.ts).
- A second consumer for `paths.steps` outside the runner appears — revisit the features-only advisory-silencing rule.
