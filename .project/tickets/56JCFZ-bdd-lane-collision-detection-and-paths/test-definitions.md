# Test Definitions: Detect existing cucumber harness, configurable feature/step paths

Feature source: `features/bdd-lane-collision-detection-and-paths.feature`

test-definitions.md is the R/G/R ledger.

Deliberate coverage calls (scenario-gate 2026-07-03): `safeword check` as a
configured-paths reader is proven via the shared `feature-source.ts` choke point
(sole discovery used by codify/lint-gherkin/check) plus feature-source unit
tests — no separate check E2E scenario. A cucumber config *file* inside a
workspace package is covered by the union of the root-config-file and
workspace-dep scenarios (detection unions signals × radii); accepted, revisit if
detection stops being a union.

## Rule: Setup never scaffolds a second harness

### Scenario: Setup skips the starter lane when a root cucumber config exists

- [x] RED 8c855fc
- [x] GREEN bb7f8c5
- [x] REFACTOR skip: no structural improvement needed — reused existing generator-skip and conditional-package mechanisms

### Scenario: Setup skips the starter lane when a workspace package depends on cucumber

- [x] RED 7f24ae3
- [x] GREEN c764480
- [x] REFACTOR skip: helper extraction already done at GREEN under the lint gate (findCucumberDependencyUnderRoot)

### Scenario: Setup skips the starter lane when a customer-authored cucumber.mjs exists

- [x] RED skip: behavior shipped with scenario-1 GREEN (content-match self-exclusion) — test passed on first run, added as regression pin
- [x] GREEN f4059dd
- [x] REFACTOR skip: pin test only, no production code changed

### Scenario: Setup skips the starter lane when only a root cucumber dependency exists

- [x] RED 0023633
- [x] GREEN fb216b4
- [x] REFACTOR skip: single guarded branch added, no structural debt

### Scenario: Setup scaffolds the starter lane when no cucumber exists anywhere

- [x] RED skip: no-change guard — pinned by pre-existing setup-bdd-lane.test.ts (102b), which fails if detection over-fires
- [x] GREEN skip: behavior pre-exists (102b); suite re-verified green alongside scenario-4 GREEN (fb216b4, 23/23)
- [x] REFACTOR skip: no code changed for this scenario

## Rule: Safeword never mistakes its own scaffold for a host harness

### Scenario: Upgrade keeps maintaining the lane safeword installed

- [x] RED skip: self-exclusion was forced into scenario-1 GREEN to keep the 102b suite green — test passed on first run, added as regression pin
- [x] GREEN c793521
- [x] REFACTOR skip: pin test only, no production code changed

### Scenario: Upgrade recognizes a previous template revision as its own scaffold

- [x] RED 52761710
- [x] GREEN 2f4d4417
- [x] REFACTOR skip: registry is a fresh single-purpose module; nothing to restructure

### Scenario: Upgrade on a bitten repo maintains safeword's lane without touching the host harness

- [x] RED 45488bf0
- [x] GREEN 79351a70
- [x] REFACTOR skip: the evidence/suppression split IS the clean structure; no residue left

## Rule: Uninstall removes only what safeword owns

### Scenario: Reset leaves a host harness untouched

- [x] RED fd42c498
- [x] GREEN cceaeb70
- [x] REFACTOR skip: one-line filter on the existing removal planner

### Scenario: Full uninstall never deletes files at configured paths locations

- [x] RED skip: holds structurally — uninstall only removes fixed default schema paths; test passed on first run as the regression pin (fd42c498)
- [x] GREEN skip: no code needed; pinned in fd42c498, re-verified green after scenario-9 GREEN (29/29)
- [x] REFACTOR skip: no code changed for this scenario

## Rule: Configured paths augment discovery for safeword's readers

### Scenario: Codify finds a ticket's feature source in a configured directory

- [x] RED dceb225c
- [x] GREEN 5d85ec3a
- [x] REFACTOR skip: one resolver + one append at the existing choke point

### Scenario: Lint-gherkin lints configured and default directories together

- [x] RED dceb225c
- [x] GREEN 5d85ec3a
- [x] REFACTOR skip: shares the choke-point change; nothing to restructure

### Scenario: An unparseable config file falls back to default discovery

- [x] RED skip: readSafewordConfig was already parse-defensive — test passed on first run, added as regression pin (dceb225c)
- [x] GREEN skip: no code needed; pin re-verified green after augment GREEN (5d85ec3a, 18/18)
- [x] REFACTOR skip: no code changed for this scenario

## Rule: The scaffolded runner honors configured paths

### Scenario: A real cucumber-js run executes features from configured directories

- [x] RED a61e5a31
- [x] GREEN 6f370507
- [x] REFACTOR skip: template stays a single flat config module; lint gate already shaped the helpers

### Scenario: The runner behaves exactly as today when no config file exists

- [x] RED skip: no-change guard — test passed on first run as pin (a61e5a31); falsifiable against a template that hard-requires config.json
- [x] GREEN skip: no code needed; re-verified green after runner GREEN (6f370507, 19/19)
- [x] REFACTOR skip: no code changed for this scenario

### Scenario: The runner falls back to default directories when the config file is unparseable

- [x] RED skip: pinned alongside the runner RED (a61e5a31); try/catch fallback shipped in the same GREEN
- [x] GREEN 6f370507
- [x] REFACTOR skip: shares the runner template change

## Rule: Check advisories name misalignment without editing anything

### Scenario: Check warns when a harness is detected and paths are unset

- [x] RED 60b46a6f
- [x] GREEN dab65eab
- [x] REFACTOR skip: one advisory function following the established findXxxAdvisories pattern

### Scenario: Check stays silent when safeword's own lane is the only harness

- [x] RED skip: negative guard — passed on first run as pin (60b46a6f); falsifiable against an over-firing advisory
- [x] GREEN dab65eab
- [x] REFACTOR skip: shares the advisory function

### Scenario: Check stays silent once configured paths point at the detected harness

- [x] RED skip: negative guard — passed on first run as pin (60b46a6f); falsifiable against a warn-forever advisory
- [x] GREEN dab65eab
- [x] REFACTOR skip: shares the advisory function

### Scenario: Check enumerates a leftover duplicate scaffold without touching it

- [x] RED 60b46a6f
- [x] GREEN dab65eab
- [x] REFACTOR skip: enumeration derives from schema constants by construction

## Feature-level cross-scenario refactor

- [x] cross-scenario dba2c978
