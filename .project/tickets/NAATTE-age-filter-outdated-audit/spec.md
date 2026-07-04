# Spec: Reduce outdated dependency noise in audit

## Intent

`/audit` should help builders notice dependency maintenance work that is old enough to deserve attention, not flood them with every release that landed yesterday. SafeWord should apply that noise filter consistently across JavaScript, Python, Go, and Rust while leaving the project owner's package-manager, Renovate, and Dependabot policies untouched.

## Intake Brief

- **Requested by:** Alex, during audit-skill tuning discussion.
- **Cost of inaction:** Audit remains noisy enough that dependency findings become easy to ignore, especially in polyglot repos where native tools report different levels of detail.
- **Reversibility:** Two-way door if implemented as SafeWord-owned reporting policy in `.safeword/config.json`; risk increases if it writes package-manager or updater-tool configuration, which is explicitly out of scope.

## References

- Prior discussion: filter audit output by candidate release age, not by the age of the installed package.
- Prior decision: SafeWord should not mutate `.npmrc`, `.yarnrc.yml`, `pnpm-workspace.yaml`, `bunfig.toml`, Renovate, or Dependabot config to achieve this.

## Personas

- Technical Builder (TB)
- Safeword Maintainer (SM)

## Vocabulary

- **Candidate update:** A newer package version reported by the ecosystem's normal outdated-dependency command.
- **Release-age threshold:** The minimum age a candidate update must reach before `/audit` lists it as actionable. Default: 30 days.
- **Direct dependency:** A package named by the project manifest. Transitive dependencies are pulled in by direct dependencies and are excluded from the main freshness report by default.
- **Security finding:** A known vulnerability or advisory. Security findings bypass the release-age threshold.

## Jobs To Be Done

### age-filter-outdated-audit.TB1 — Act on stale dependency updates without release-feed noise

**Persona:** Technical Builder (TB)

> When I run `/audit` near the end of feature work, I want dependency freshness findings to show updates that have been available long enough to matter, so I can act on real maintenance debt instead of triaging every fresh release.

#### age-filter-outdated-audit.TB1.R1 — Fresh releases are suppressed until they pass the threshold

#### age-filter-outdated-audit.TB1.R2 — Suppressed update counts remain visible without filling the findings table

#### age-filter-outdated-audit.TB1.R3 — Security findings appear immediately, even when the fixed version is newer than the threshold

### age-filter-outdated-audit.TB2 — Get consistent behavior across supported language stacks

**Persona:** Technical Builder (TB)

> When I audit a JavaScript, Python, Go, or Rust project outside the SafeWord repo itself, I want the same dependency-noise policy to apply, so the audit report feels like one SafeWord feature instead of four unrelated package-manager dumps.

#### age-filter-outdated-audit.TB2.R1 — JavaScript candidate updates use npm registry release times for age filtering

#### age-filter-outdated-audit.TB2.R2 — Python candidate updates use PyPI release upload times for age filtering

#### age-filter-outdated-audit.TB2.R3 — Go candidate updates use module version times for age filtering

#### age-filter-outdated-audit.TB2.R4 — Rust candidate updates use crate version publish times when available and report unknown-age candidates separately

#### age-filter-outdated-audit.TB2.R5 — Non-dogfood project fixtures prove behavior without relying on SafeWord's own package.json, .agents, or dogfood install layout

### age-filter-outdated-audit.SM1 — Preserve repo-owned update policy

**Persona:** Safeword Maintainer (SM)

> When I ship the audit noise filter, I want it to live in SafeWord's report policy rather than package-manager config, so SafeWord does not collide with a repo's install behavior, Renovate schedule, Dependabot rules, or lockfile workflow.

#### age-filter-outdated-audit.SM1.R1 — Audit filtering does not write package-manager, updater, manifest, or lockfile configuration

#### age-filter-outdated-audit.SM1.R2 — The configured threshold belongs to SafeWord audit behavior, not package installation behavior

## Rave Moment

skip: table-stakes

## Outcomes

- `/audit` no longer prints a long table of very recent dependency releases by default.
- Builders can still see that recent updates were suppressed and can lower the threshold if they want a raw freshness feed.
- JavaScript, Python, Go, and Rust audit behavior share the same release-age concept even though their metadata sources differ.
- Ordinary target projects get the behavior through generated SafeWord templates; this repo's dogfood copy is only a sync check.
- Existing repo policy files remain untouched.

## Open Questions

- Should the v1 threshold config allow `0` to mean "show all outdated candidates" for teams that want raw package-manager behavior?
- Should v1 read Renovate/Dependabot schedules as advisory context, or keep them entirely out until a later integration ticket?
