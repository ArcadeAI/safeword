---
id: 8B4GVR
slug: root-bdd-lane-advisory
type: task
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/1105
created: 2026-07-23T13:17:28.289Z
last_modified: 2026-07-24T03:18:00Z
---

# Keep default BDD lanes visible without manual configuration

**Goal:** Avoid a misleading Cucumber-harness advisory when Safeword already discovers a host suite under the default root features directory.

**Why:** A root feature suite is already readable by Safeword, so asking users to set redundant paths creates needless configuration work and undermines trust in check output.

## Task Specification

**Type:** Bug

**User story:** As a team whose existing Cucumber suite lives under the conventional root `features/` directory, I want Safeword to recognise that default lane without configuration so `setup` and `check` do not send me on a redundant manual-config step.

**Scope:** When a host Cucumber harness has at least one discoverable feature file in Safeword's default search locations, `setup` and `check` must recognise that Safeword can already read the suite and must not recommend `paths.features` / `paths.steps`.

**Out of Scope:** Writing `paths.*` automatically; inferring non-default paths or parsing host Cucumber configuration; altering Cucumber-harness collision detection, scaffolding suppression, or the configured-path behavior.

**User-directed audit remediation:** Apply only audited, low-risk repository hygiene improvements discovered during the requested verification pass. This includes the dev-only `lint-staged` patch update; it does not expand the host-harness behavior change.

**Done When:**

- [x] A host harness with a feature file in the default root `features/` directory receives no manual-path instruction from `setup` or `check`.
- [x] A host harness without a discoverable default feature file still receives the existing explicit configuration guidance.
- [x] A configured non-default path continues to silence the advisory.

**Tests:**

- [x] Integration RED/GREEN: a host `cucumber.yaml` plus `features/host.feature` is recognised without `paths.*`.
- [x] Regression: a host harness with no discoverable default feature file still reports the exact path guidance.
- [x] Regression: the existing configured-path and duplicate-scaffold cases remain unchanged.

## Decision Record

**Figure-it-out (2026-07-23):** Decide whether to write inferred `paths.*`, leave the current advisory, or recognise the already-supported default lane. The relevant domains were filesystem evidence, Cucumber feature/step discovery, user-owned configuration durability, and Safeword's existing harness-collision contract.

**Decision:** Recognise a real default lane and suppress only the redundant advisory. Writing `paths.*` would restate Safeword's default discovery and conflicts with 56JCFZ's intentional no-auto-write rule: host configuration can be dynamic and a persisted inferred path can become stale. Leaving the warning is false-negative UX because `feature-source.ts` already reads root `features/` before any configured location. Cucumber treats feature files and glue as discoverable inputs, while Node's directory APIs support exact, local evidence rather than guessing from configuration. Sources: [Cucumber reference](https://cucumber.io/docs/cucumber/api/), [Node file-system API](https://nodejs.org/api/fs.html).

**Premortem:** If a non-suite `features/` directory accidentally suppresses a needed warning, the warning becomes misleadingly quiet; require at least one discoverable `.feature` file rather than directory existence alone.

## Work Log

- 2026-07-23T13:17:28.289Z Started: Created ticket 8B4GVR
- 2026-07-23T13:17:28Z Revalidated #1105: root `features/` is already a default `feature-source.ts` location, but `findCucumberHarnessAdvisories` still warns whenever `paths.features` is unset.
- 2026-07-23T13:17:28Z Decision: `/figure-it-out` selected default-lane recognition over auto-writing user-owned `paths.*`; explicit configuration remains required only for non-default suites.
- 2026-07-23T13:17:28Z Implement: task specification and behavior-level integration proof are ready; begin RED with a host root feature suite.
- 2026-07-23T13:37:10Z RED: the new host-root-suite integration scenario failed because both setup and check still instructed the user to configure `paths.features`.
- 2026-07-23T13:37:10Z GREEN: added exact default-feature discovery to the shared feature-source utility and used it only to suppress redundant setup/check advice. Focused advisory integration suite passed 7/7; lint, typecheck, Prettier, and `git diff --check` passed.
- 2026-07-23T13:37:10Z Docs/audit: the configured docs sources already state that `features/` is the default. Config sync and dependency-cruiser were clean; Knip's unused `mermaid`, jscpd's existing clone inventory, and the lint-staged update are baseline findings unrelated to this ticket.
- 2026-07-23T13:42:06Z Verification limit: the broad Vitest suite remained active for 15 minutes without reporting a failure, so it was interrupted to avoid leaving an unbounded local process. Focused integration (7/7), lint, typecheck, format check, and diff check are green; rerun `bun run test` before closing the task.
- 2026-07-23T21:27:32Z Verify: the generated full plan completed — 355 Vitest files / 5,286 passed tests (5 skipped), 484 Cucumber scenarios passed (3 skipped), then build, typecheck, and dependency lanes passed.
- 2026-07-23T21:27:32Z Audit: config sync and dependency-cruiser are clean; Knip, docs/domain reconciliation, and test-quality review have no current actionable finding. The 478-clone count is the established mirror-heavy baseline. Updated dev-only `lint-staged` from 17.1.1 to 17.2.0; `bun outdated` is clean.
- 2026-07-23T21:27:32Z Quality/refactor: official Node and Cucumber references support the filesystem and feature-lane approach. Reworked the default-lane predicate to short-circuit on its first `.feature` file. A first version tripped `unicorn/no-useless-undefined`; it was reverted, narrowed, and the real setup/check integration suite passed 7/7 with ESLint clean. No commit was made because this worktree combines the active task change and user-directed audit remediation.
- 2026-07-23T21:27:32Z Skill evidence: `/verify`, `/audit`, and `/quality-review` were invoked, but the helper could not bind this Codex run identity. This is a task ticket, so the unavailable session proof is recorded but non-gating.
- 2026-07-24T03:19:23.700Z Phase: verify → done
- 2026-07-24T03:19:23.700Z Done-flip: independent review confirmed all three Done-When behaviors are backed by real, passing assertions in `check-cucumber-advisories.test.ts` (default lane → no `paths.*` advice; no discoverable feature → guidance retained; configured path → silent), CI green on node 22/24, 0 commits behind main. Flipped to clear the done-gate so the PR can merge.
