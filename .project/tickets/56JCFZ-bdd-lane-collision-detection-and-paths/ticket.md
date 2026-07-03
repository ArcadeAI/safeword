---
id: 56JCFZ
slug: bdd-lane-collision-detection-and-paths
type: feature
phase: intake
status: in_progress
relates_to: [102b, VM78NC, 7CK2KP]
external_issue: https://github.com/ArcadeAI/safeword/issues/645
scope:
  - Detect an existing host cucumber harness at setup/upgrade — any cucumber config file (`cucumber.{json,yaml,yml,js,cjs,mjs}`, root or direct workspace package) whose content is not safeword's own template, or a `@cucumber/cucumber` dependency safeword did not add.
  - On detection, suppress the starter lane — `cucumber.mjs` (ownedFiles), `features/` + `steps/` scaffold (managedFiles), the `@cucumber/cucumber`/`tsx`/`@types/node` deps, and the `test:bdd` script merge — and print what was found. ownedFiles currently have NO conditional mechanism (reconcile.ts:553-578); the detection gate is new machinery.
  - Uninstall/reset safety in detected-harness repos — reset currently removes every existing ownedFiles path with no content check (reconcile.ts:701 → planExistingFilesRemoval) and computePackagesToRemove rips cucumber deps regardless of who installed them; removal must be detection-gated or content-matched so a host's own `cucumber.mjs`/deps are never touched.
  - Add `paths.features` / `paths.steps` to `.safeword/config.json` (directory keys following the `projectRoot` pattern, not the `ConfiguredPathKey` file-path pattern), consumed by `feature-source.ts` (→ `codify`, `lint-gherkin`, `safeword check` spec gate) and read at runtime by the scaffolded `cucumber.mjs`. AUGMENT semantics — configured dirs are added to the default search set, defaults stay searched — so BDD skill prose directing writes to root `features/` keeps working until 7CK2KP parameterizes it.
  - Persistent `safeword check` advisory when a host harness is detected and `paths.*` is unset (setup print alone is ignorable), and for already-bitten installs — leftover scaffold enumerated from schema entries (lane files + conditional deps + `test:bdd` script), never editing or deleting.
  - Update website reference docs (`configuration.mdx` paths.* enumeration + scaffolded-files tables, `cli.mdx`) alongside the code.
out_of_scope:
  - Auto-writing detected paths into `paths.*` (rejected — lossy glob→dir mapping, silent-stale snapshot, writes into user-owned key space; see Decisions).
  - Live-reading the host's cucumber config as a discovery source (compatible later addition; resolution order specced as explicit `paths.*` → default, leaving the slot).
  - Auto-removing the duplicate lane on upgrade (violates silent-minor auto-upgrade contract; features/steps are customer-owned).
  - A de-scaffold command (advisory first; add only if advisories prove insufficient).
  - Adoption semantics — stub convention, verification lane, tag semantics (ticket 7CK2KP).
  - Changing the default: root `features/` stays (settled in issue #645).
  - Teaching the `hasJsSource` heuristic about configured lane dirs (project-detector.ts:401-413 excludes only root-default `steps/`/`features/`; a custom lane of .ts steps counting as "real JS source" is a known, accepted wrinkle — record as follow-up if it bites).
done_when:
  - Fresh setup into a repo with a host cucumber harness scaffolds no lane files, adds no cucumber deps, adds no `test:bdd` script, and prints the detected harness + the exact `paths.*` lines to add.
  - Fresh setup into a repo without cucumber produces the same file set, dependency set, and scripts as today, with behaviorally identical results (template content may change to add the config read; behavior without config is identical, test-backed).
  - Upgrade on an existing safeword install does NOT self-trigger detection on safeword's own scaffold (content-aware self-exclusion, test-backed for fresh/existing/collision cases).
  - With `paths.features`/`paths.steps` set, `codify`, `lint-gherkin`, and `safeword check` read configured + default directories (unit-tested via feature-source), and the scaffolded `cucumber.mjs` honors them under a REAL cucumber-js run against a fixture (not just a config-module unit test). Missing or unparseable `.safeword/config.json` falls back to default behavior, test-backed.
  - `safeword check` warns persistently on (a) detected harness + unset `paths.*`, (b) leftover duplicate scaffold, listing files/deps/script derived from the schema, never editing or deleting — advisory content test-backed.
  - Uninstall/reset in a detected-harness repo removes nothing host-owned (no `cucumber.mjs` deletion, no host dep removal), and never deletes files at configured `paths.*` locations (K7N2QM semantics extended to the new keys) — test-backed.
---

# BDD lane: detect existing cucumber harness, configurable feature/step paths

**Goal:** Stop `safeword setup` from scaffolding a second cucumber harness into repos that already have one, and let hosts point safeword's BDD readers (codify / lint-gherkin / check) and the scaffolded runner at their own feature/step directories.

**Why:** In ArcadeAI/monorepo, setup dropped a root cucumber v13 lane into a repo with a CI-wired cucumber v12 suite under `tests/` — two runners at different majors, and cucumber-js native config discovery (`json` → `yaml` → `yml` → `js` → `cjs` → `mjs`, first wins) makes which config wins depend on invocation. Ticket 102b documented this exact collision as accepted risk ("safeword-owned config wins"); issue #645 revokes that acceptance.

## Evidence

- `schema.ts:607` — `cucumber.mjs` in ownedFiles (overwritten every upgrade); `schema.ts:1018-1020` — `features/`+`steps/` scaffold in managedFiles.
- `packs/typescript/files.ts:523` — `@cucumber/cucumber`, `tsx`, `@types/node` in the unconditional base package set (how the second major got installed). `test:bdd` add-if-missing at files.ts:385 — but still added in suppressed-lane repos unless gated.
- `feature-source.ts` — single discovery choke point for codify/lint-gherkin/check (sole importers: codify.ts:14, lint-gherkin.ts:10, health.ts:30); hardcodes root `features/` + `packages|apps|libs|modules/*/features/`.
- `project-detector.ts:298-343` — `existing*Config` detection precedent; conditional-packages mechanism (`getConditionalPackages`, reconcile.ts:65) gates deps off `ProjectType` booleans.
- ownedFiles have no conditional/skip mechanism (writes: reconcile.ts:553-578; uninstall removal: reconcile.ts:701 via planExistingFilesRemoval, no content check) — both the setup gate and the uninstall guard are new machinery.
- Cucumber-js docs: config discovery order and executable-config reality (JS configs can be dynamic/async — not statically parseable); `--dry-run` loads support code, skips hooks, reports undefined/ambiguous steps but does not fail the process.
- Self-trigger trap: safeword itself installs `@cucumber/cucumber` + `cucumber.mjs`, so naive "cucumber exists → host harness" fires on every existing install at upgrade. Detection must content-match safeword's template and ignore safeword-added deps.
- Version currency (verified 2026-07-03): scaffold pins `^13.0.0` = npm latest (published 2026-06-02); no published cucumber-js security advisories.

## Decisions (figure-it-out, 2026-07-03)

1. **Skip-and-point over adopt-into-config or read-host-config:** detection changes what safeword writes, never what the customer owns. Rich `bdd` config block rejected (schema from N=1 host, semver-committed too early — K7N2QM); parsing host configs rejected as foundation (executable JS configs).
2. **Print-only + persistent check advisory over auto-writing `paths.*`:** cucumber `paths` are per-profile globs — collapsing to a dir is lossy, and a persisted snapshot goes silently stale. `paths.*` stays user-authored (reconcile.ts:736 uninstall semantics).
3. **Stop-and-hint over active removal for bitten installs:** matches `stale-config-scan.ts` warn-never-edit precedent; silent deletion can't ride auto-applied minors; features/steps may carry customer scenarios. Advisory list generated from schema entries, not prose.
4. **Augment over replace for `paths.*` discovery** (quality-review 2026-07-03): configured dirs add to the default search set. Replace semantics would silently break the scenario pipeline for key-setting users — generated BDD prose still directs writes to root `features/` until 7CK2KP.

## Work Log

- 2026-07-03T14:30:29.116Z Started: Created ticket 56JCFZ
- 2026-07-03 Scoped from issue #645 investigation + two figure-it-out passes (options A/B/C for the design; persist-vs-print and hint-vs-remove for the open questions). Follow-up adoption semantics split to 7CK2KP.
- 2026-07-03T14:45Z Quality-review pass 1 (fresh-context reviewer): 4 criticals fixed — uninstall/reset data-loss brought into scope (reset would delete a host's cucumber.mjs + deps); "byte-identical" done_when reworded (template content legitimately changes); augment-vs-replace semantics decided (augment); test:bdd suppression added. Also: docs in scope, fixture-run test obligations in done_when, hasJsSource wrinkle recorded out_of_scope.
