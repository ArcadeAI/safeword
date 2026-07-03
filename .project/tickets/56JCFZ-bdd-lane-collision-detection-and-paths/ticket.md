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
  - On detection, suppress the starter lane — `cucumber.mjs` (ownedFiles), `features/` + `steps/` scaffold (managedFiles), and the `@cucumber/cucumber`/`tsx`/`@types/node` deps — and print what was found.
  - Add `paths.features` / `paths.steps` to `.safeword/config.json` (plain strings alongside `paths.projectRoot`), consumed by `feature-source.ts` (→ `codify`, `lint-gherkin`, `safeword check` spec gate) and read at runtime by the scaffolded `cucumber.mjs`.
  - Persistent `safeword check` advisory when a host harness is detected and `paths.*` is unset (setup print alone is ignorable), and for already-bitten installs — leftover scaffold enumerated from schema entries (lane files + conditional deps + `test:bdd` script), with content-checked wording (pristine template vs contains-your-edits).
out_of_scope:
  - Auto-writing detected paths into `paths.*` (rejected — lossy glob→dir mapping, silent-stale snapshot, writes into user-owned key space; see Decisions).
  - Live-reading the host's cucumber config as a discovery source (compatible later addition; resolution order specced as explicit `paths.*` → default, leaving the slot).
  - Auto-removing the duplicate lane on upgrade (violates silent-minor auto-upgrade contract; features/steps are customer-owned).
  - A de-scaffold command (advisory first; add only if advisories prove insufficient).
  - Adoption semantics — stub convention, verification lane, tag semantics (ticket 7CK2KP).
  - Changing the default: root `features/` stays (settled in issue #645).
done_when:
  - Fresh setup into a repo with a host cucumber harness scaffolds no lane files, adds no cucumber deps, and prints the detected harness + the exact `paths.*` lines to add.
  - Fresh setup into a repo without cucumber is byte-identical to today (the 95% case is a no-op).
  - Upgrade on an existing safeword install does NOT self-trigger detection on safeword's own scaffold (content-aware self-exclusion, test-backed for fresh/existing/collision cases).
  - With `paths.features`/`paths.steps` set, `codify`, `lint-gherkin`, `safeword check`, and the scaffolded `cucumber.mjs` all read the configured directories; unset keys behave exactly as today.
  - `safeword check` warns persistently on (a) detected harness + unset `paths.*`, (b) leftover duplicate scaffold, listing files/deps/script derived from the schema, never editing or deleting.
  - Reconcile/uninstall never deletes files at configured `paths.*` locations (K7N2QM semantics extended to the new keys).
---

# BDD lane: detect existing cucumber harness, configurable feature/step paths

**Goal:** Stop `safeword setup` from scaffolding a second cucumber harness into repos that already have one, and let hosts point safeword's BDD readers (codify / lint-gherkin / check) and the scaffolded runner at their own feature/step directories.

**Why:** In ArcadeAI/monorepo, setup dropped a root cucumber v13 lane into a repo with a CI-wired cucumber v12 suite under `tests/` — two runners at different majors, and cucumber-js native config discovery (`json` → `yaml` → `yml` → `js` → `cjs` → `mjs`, first wins) makes which config wins depend on invocation. Ticket 102b documented this exact collision as accepted risk ("safeword-owned config wins"); issue #645 revokes that acceptance.

## Evidence

- `schema.ts:607` — `cucumber.mjs` in ownedFiles (overwritten every upgrade); `schema.ts:1018-1020` — `features/`+`steps/` scaffold in managedFiles.
- `packs/typescript/files.ts:523` — `@cucumber/cucumber`, `tsx`, `@types/node` in the unconditional base package set (how the second major got installed). `test:bdd` already add-if-missing.
- `feature-source.ts` — single discovery choke point for codify/lint-gherkin/check; hardcodes root `features/` + `packages|apps|libs|modules/*/features/`.
- `project-detector.ts:298-343` — `existing*Config` detection precedent; conditional-packages mechanism in `reconcile.ts:62` gates deps off `ProjectType` booleans.
- Cucumber-js docs: config discovery order and executable-config reality (JS configs can be dynamic/async — not statically parseable); `--dry-run` loads support code, skips hooks, reports undefined/ambiguous steps but does not fail the process.
- Self-trigger trap: safeword itself installs `@cucumber/cucumber` + `cucumber.mjs`, so naive "cucumber exists → host harness" fires on every existing install at upgrade. Detection must content-match safeword's template and ignore safeword-added deps.

## Decisions (figure-it-out, 2026-07-03)

1. **Skip-and-point over adopt-into-config or read-host-config:** detection changes what safeword writes, never what the customer owns. Rich `bdd` config block rejected (schema from N=1 host, semver-committed too early — K7N2QM); parsing host configs rejected as foundation (executable JS configs).
2. **Print-only + persistent check advisory over auto-writing `paths.*`:** cucumber `paths` are per-profile globs — collapsing to a dir is lossy, and a persisted snapshot goes silently stale. `paths.*` stays user-authored (reconcile.ts:736 uninstall semantics).
3. **Stop-and-hint over active removal for bitten installs:** matches `stale-config-scan.ts` warn-never-edit precedent; silent deletion can't ride auto-applied minors; features/steps may carry customer scenarios. Advisory list generated from schema entries, not prose.

## Work Log

- 2026-07-03T14:30:29.116Z Started: Created ticket 56JCFZ
- 2026-07-03 Scoped from issue #645 investigation + two figure-it-out passes (options A/B/C for the design; persist-vs-print and hint-vs-remove for the open questions). Follow-up adoption semantics split to 7CK2KP.
