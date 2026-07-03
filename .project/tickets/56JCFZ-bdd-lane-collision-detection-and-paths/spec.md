# Spec: BDD lane: detect existing cucumber harness, configurable feature/step paths

## Intent

Stop `safeword setup` from scaffolding a second cucumber harness into repos that already have one, and let any host point safeword's BDD readers and scaffolded runner at its own feature/step directories — so safeword adopts the host's acceptance lane instead of competing with it.

## Intake Brief

- **Requested by:** Safeword maintainer (issue [#645](https://github.com/ArcadeAI/safeword/issues/645)), after setup dropped a cucumber v13 root lane into ArcadeAI/monorepo's CI-wired cucumber v12 suite.
- **Cost of inaction:** Every cucumber-shop install gets two runners at different majors, with cucumber-js config-discovery order deciding which config wins per invocation; `safeword codify` output lands in a different home than the host's real acceptance suite; `safeword reset` in such repos deletes the host's own `cucumber.mjs` and rips out their deps.
- **Reversibility:** Two-way for detection (a gate on existing scaffolding paths); one-way-ish for the `paths.features`/`paths.steps` config keys (public config schema — semver commitment once shipped). Keys kept minimal (two directory strings) for that reason.

## References

- Issue: <https://github.com/ArcadeAI/safeword/issues/645> (incl. design comment on adoption semantics — deferred to ticket 7CK2KP)
- Design decisions: ticket.md `## Decisions` (two figure-it-out passes + quality review, 2026-07-03)
- Prior art: ticket 102b (lane scaffolding, documented this collision as accepted risk), VM78NC (discovery alignment across runner/lint/check/codify), K7N2QM (`paths.*` config model)

## Personas

- Technical Builder (TB) — installs safeword into a repo that already has a mature cucumber harness, or relocates the scaffolded lane to fit repo conventions.

## Surfaces

Affected: skip — CLI-level behavior (`setup`/`upgrade`/`uninstall`/`check`/`codify`/`lint-gherkin` and the scaffolded runner config); identical across agent runtimes, no runtime-specific installed files or workflow.

## Vocabulary

- **Host harness** — a cucumber setup safeword did not scaffold: any `cucumber.{json,yaml,yml,js,cjs,mjs}` whose content is not safeword's template, or a `@cucumber/cucumber` dependency safeword did not add.
- **Starter lane** — safeword's scaffold: `cucumber.mjs`, `features/safeword-lane.feature`, `steps/world.ts`, `steps/shared.steps.ts`, the `@cucumber/cucumber`/`tsx`/`@types/node` deps, and the `test:bdd` script.
- **Augment semantics** — configured `paths.*` directories are added to the default search set; defaults stay searched.

## Jobs To Be Done

### bdd-lane-collision-detection-and-paths.TB1 — Install safeword without getting a second cucumber harness

**Persona:** Technical Builder (TB)

> When I run `safeword setup` in a repo that already has a cucumber suite, I want safeword to recognize and respect my harness instead of scaffolding its own, so I keep one runner and one acceptance-suite home.

#### bdd-lane-collision-detection-and-paths.TB1.AC1 — Setup into a repo with a host harness scaffolds no starter lane and names what it found plus how to point safeword at it

#### bdd-lane-collision-detection-and-paths.TB1.AC2 — Safeword never mistakes its own scaffold for a host harness (upgrades keep maintaining the lane it installed)

#### bdd-lane-collision-detection-and-paths.TB1.AC3 — Uninstall/reset never removes host-owned cucumber config or dependencies

#### bdd-lane-collision-detection-and-paths.TB1.AC4 — Repos without any cucumber keep getting the starter lane exactly as today

#### bdd-lane-collision-detection-and-paths.TB1.AC5 — Uninstall never deletes files at configured `paths.*` locations

### bdd-lane-collision-detection-and-paths.TB2 — Point safeword's BDD tooling at my repo's own lane locations

**Persona:** Technical Builder (TB)

> When my feature files and step definitions live somewhere other than root `features/`+`steps/`, I want to tell safeword once where they are, so codify, lint, check, and the scaffolded runner all read the same places my suite lives.

#### bdd-lane-collision-detection-and-paths.TB2.AC1 — With `paths.features`/`paths.steps` set, safeword's readers (codify, lint-gherkin, check) search the configured directories in addition to the defaults

#### bdd-lane-collision-detection-and-paths.TB2.AC2 — The scaffolded runner executes features/steps from the configured directories under a real cucumber-js run

#### bdd-lane-collision-detection-and-paths.TB2.AC3 — A missing or unparseable `.safeword/config.json` falls back to default behavior everywhere (no crash, no silent dead lane)

### bdd-lane-collision-detection-and-paths.TB3 — Be told when safeword and my harness are misaligned

**Persona:** Technical Builder (TB)

> When safeword detects my harness but isn't configured to read it, or when an older safeword left a duplicate lane in my repo, I want a persistent, specific warning with the exact fix, so I can align them myself without safeword editing or deleting anything.

#### bdd-lane-collision-detection-and-paths.TB3.AC1 — `safeword check` warns whenever a host harness is detected and `paths.*` is unset, and stays quiet when there is nothing to fix

#### bdd-lane-collision-detection-and-paths.TB3.AC2 — `safeword check` enumerates a leftover duplicate scaffold (files, deps, script — derived from the schema), and never edits or deletes anything

## Rave Moment

### bdd-lane-collision-detection-and-paths — "It found our cucumber suite"

- **Moment:** Setup in a decade-old cucumber monorepo finishes with "Detected your cucumber harness (cucumber.yaml, @cucumber/cucumber@12) — skipped safeword's starter lane" instead of a second runner appearing in the diff.
- **Beats:** The dread of vendor tooling stomping on a mature test suite (which is exactly what v0.x did to ArcadeAI/monorepo).
- **They'd say:** "It saw our harness and got out of the way."

## Outcomes

- Cucumber-shop installs produce zero duplicate-runner diffs; the ArcadeAI/monorepo failure mode is impossible on fresh setups and surfaced (not silently perpetuated) on existing ones.
- Hosts with relocated lanes get identical feature discovery across codify / lint-gherkin / check / runner from two config lines.
- No safeword operation (setup, upgrade, uninstall, check) ever mutates or deletes host-owned harness files or deps.

## Open Questions

- defer: stub convention / verification lane / tag semantics for adopted harnesses → ticket 7CK2KP (blocked on this ticket + N≥2 host evidence).
- defer: `hasJsSource` heuristic treating a relocated lane's `.ts` steps as real JS source → recorded out_of_scope in ticket.md; follow-up if it bites.
