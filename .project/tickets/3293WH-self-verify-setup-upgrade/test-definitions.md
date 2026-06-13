# Test Definitions — self-verify-setup-upgrade

Scenarios for child [3293WH](./ticket.md) of epic
[VKNF1T](../VKNF1T-platform-uplift-epic/ticket.md). Lineage
`<jtbd-id>.AC<#>.<scenario_name>`; dimensions in [dimensions.md](./dimensions.md).

## Rule: Setup proves its own postcondition

> Rationale: DEV1.AC1 — a mutating command verifies what it wrote at the
> moment it exits, where the breakage actually is.

### Scenario: self-verify-setup-upgrade.DEV1.AC1.clean_setup_ends_with_health_verification

Given a fresh project with no safeword configuration
When `safeword setup` runs to completion
Then the output ends with the health verification's `Configuration is healthy` success line, and the command exits zero

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

### Scenario: self-verify-setup-upgrade.DEV1.AC1.setup_with_post_run_issues_exits_nonzero

Given a setup whose final health verification finds configuration issues
When `safeword setup` reaches its tail
Then each issue is reported and the command exits non-zero

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

## Rule: A deliberately-skipped install is not a postcondition failure

> Rationale: DEV1.AC1 — `SAFEWORD_SKIP_INSTALL` is an existing "don't install"
> signal (honored in `install.ts`). When setup/upgrade is told not to install,
> the self-verify must not fault absent packages/packs — the command did what
> it was asked. Config-file health (missing files, broken patches,
> persona/glossary) is still verified. Standalone `check` is unaffected (a
> diagnostic still reports missing packages). Surfaced at verify: the gap broke
> the pre-existing `setup-workspaces` test, which skips install for speed.

### Scenario: self-verify-setup-upgrade.DEV1.AC1.skipped_install_setup_does_not_fault_absent_packages

Given a fresh project whose package.json omits safeword's dev dependencies and `SAFEWORD_SKIP_INSTALL` is set
When `safeword setup` runs to completion
Then the self-verify reports `Configuration is healthy`, names no missing packages, and the command exits zero

- [x] RED 829d29dc
- [x] GREEN 829d29dc
- [x] REFACTOR 829d29dc

## Rule: Upgrade proves its own postcondition

> Rationale: DEV1.AC2 — same failure semantics as setup; report-and-fail, no
> repair loop (reconcile already ran — an issue it couldn't fix won't be fixed
> by running it again).

### Scenario: self-verify-setup-upgrade.DEV1.AC2.clean_upgrade_ends_with_health_verification

Given a configured project on an older safeword version
When `safeword upgrade` runs to completion
Then the output ends with the health verification's `Configuration is healthy` success line, and the command exits zero

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

### Scenario: self-verify-setup-upgrade.DEV1.AC2.upgrade_with_post_run_issues_exits_nonzero

Given an upgrade whose final health verification finds configuration issues
When `safeword upgrade` reaches its tail
Then each issue is reported and the command exits non-zero

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

## Rule: The self-verify is config-health only — never a network call

> Rationale: DEV1.AC3 — an "update available" nag right after upgrading is
> wrong, and a postcondition check must not depend on the registry being
> reachable. The negative is anchored to the self-verify's presence (gate
> review 2026-06-13: the bare negative passed with the feature deleted), and
> the no-network claim is proven at the seam.

### Scenario: self-verify-setup-upgrade.DEV1.AC3.setup_health_verification_carries_no_update_check

Given a fresh project
When `safeword setup` runs to completion
Then the output contains the `Configuration is healthy` line AND contains no update-check lines (`Checking for updates`, `Update available`)

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

### Scenario: self-verify-setup-upgrade.DEV1.AC3.upgrade_health_verification_carries_no_update_check

Given a configured project
When `safeword upgrade` runs to completion
Then the output contains the `Configuration is healthy` line AND contains no update-check lines (`Checking for updates`, `Update available`)

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

### Scenario: self-verify-setup-upgrade.DEV1.AC3.health_module_has_no_update_check_path

Given the extracted health module's entry point
When the health verification runs at the unit seam
Then the npm version-check function is never invoked (no registry fetch can originate from the self-verify)

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

## Rule: A clean result stays quiet

> Rationale: DEV1.AC4 — the happy path must not get noisier; one brief success
> line (CLI convention: brief on success, never silent). Both commands, since
> the fresh-install flow runs setup then upgrade back-to-back.

### Scenario: self-verify-setup-upgrade.DEV1.AC4.clean_setup_prints_one_health_summary

Given a fresh project that sets up cleanly
When `safeword setup` runs to completion
Then the `Configuration is healthy` line appears exactly once in the output

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

### Scenario: self-verify-setup-upgrade.DEV1.AC4.clean_upgrade_prints_one_health_summary

Given a configured project that upgrades cleanly
When `safeword upgrade` runs to completion
Then the `Configuration is healthy` line appears exactly once in the output

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

### Scenario: self-verify-setup-upgrade.DEV1.AC4.advisories_surface_once_without_failing

Given a configured project whose health verification yields advisories but no issues
When `safeword upgrade` runs to completion
Then the advisories appear exactly once, the summary still reports healthy, and the command exits zero

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

## Rule: The remediation hint matches the context

> Rationale: DEV1.AC5 — "run `safeword upgrade` to repair" printed by upgrade
> itself is a contradiction. All three failure branches (missing packs,
> missing packages, config issues) carry the hint today; each must be
> context-aware at the seam.

### Scenario Outline: self-verify-setup-upgrade.DEV1.AC5.post_upgrade_failure_hint_omits_run_upgrade

Given an upgrade whose final health verification fails via <failure-kind>
When the failure summary is reported
Then each finding line appears in the output, the output contains no `Run \`safeword upgrade\``instruction, and the summary line is not`Configuration is healthy`

Examples:

| failure-kind     |
| ---------------- |
| missing packs    |
| missing packages |
| config issues    |

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

### Scenario: self-verify-setup-upgrade.DEV1.AC5.standalone_check_keeps_existing_hint

Given a project with configuration issues
When `safeword check` runs standalone
Then the summary still instructs "Run `safeword upgrade` to repair configuration" exactly as before

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

## Rule: check is demoted in docs but unchanged in behavior

> Rationale: DEV2.AC1 + DEV2.AC2 — the doctor-style diagnostic stays public
> for CI/debugging; humans just stop being told to run it routinely.

### Scenario: self-verify-setup-upgrade.DEV2.AC1.docs_present_check_as_automatic_first

Given the SAFEWORD.md template+dogfood pair and the website CLI reference (cli.mdx)
When their health-verification sections are inspected
Then each surface's `check` documentation contains the automatic-after phrase (literal pinned at RED, e.g. "runs automatically after `setup` and `upgrade`"), and no surface matches the imperative pattern ``Run `safeword check` `` outside an explicitly-labeled CI/debugging context

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c

> Note (gate review): post-setup deliberately keeps the existing
> "Run `safeword upgrade` to repair" hint — after a failed _setup_, pointing at
> `upgrade` is correct, non-self-referencing repair advice. Recorded in
> dimensions.md; AC5 is post-upgrade only by design.

### Scenario: self-verify-setup-upgrade.DEV2.AC2.standalone_check_behavior_unchanged

Given the existing standalone check test suite
When the suite runs against the extracted health module
Then every existing check test passes unmodified

- [x] RED 2fe0edfa
- [x] GREEN 911e139c
- [x] REFACTOR 911e139c
