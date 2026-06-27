---
id: NAATTE
slug: age-filter-outdated-audit
type: feature
phase: intake
status: in_progress
scope:
  - Add an audit-owned outdated-dependency age filter, defaulting to 30 days, configurable from `.safeword/config.json` as audit behavior.
  - Normalize outdated dependency candidates across JavaScript, Python, Go, and Rust before reporting them.
  - Limit the main outdated-dependency report to direct dependencies by default; transitive package freshness stays out of the report unless it is a security finding.
  - Enrich each candidate with its release timestamp from the ecosystem's package metadata when available, then hide candidates newer than the configured threshold.
  - Report a short suppression summary for hidden recent updates and a separate note for candidates whose release age cannot be determined.
  - Keep security findings outside the age filter so known vulnerabilities surface immediately.
  - Update the shipped audit command/skill templates so Claude, Cursor, and Codex installs get the same behavior in ordinary target projects.
  - Keep this repo's dogfood-installed audit surfaces in sync as verification only, not as the implementation target.
out_of_scope:
  - Writing or modifying package-manager policy files such as `.npmrc`, `.yarnrc.yml`, `pnpm-workspace.yaml`, `bunfig.toml`, Renovate config, or Dependabot config.
  - Automatically upgrading packages, editing lockfiles, or choosing changelog migration actions.
  - Full transitive dependency freshness reporting for Go/Rust/Python/JavaScript outside explicit security findings.
  - Private registry authentication or organization-specific package metadata connectors.
  - Replacing dedicated vulnerability scanners; this ticket only preserves the rule that security findings bypass the age filter.
done_when:
  - `/audit` shows outdated direct dependencies only when the candidate update is at least the configured age threshold, defaulting to 30 days.
  - `/audit` summarizes hidden recent updates without listing every package in the main findings table.
  - JavaScript, Python, Go, and Rust projects each have covered candidate parsing and release-age filtering behavior.
  - Candidates with unknown release age are reported separately from the actionable aged table.
  - No package-manager config, Renovate config, Dependabot config, lockfile, or manifest is changed by the audit check.
  - Tests prove the age filter, direct-dependency default, unknown-age handling, and no-config-mutation guarantee.
  - Tests or fixtures prove the behavior in non-dogfood target projects for JavaScript, Python, Go, and Rust.
  - Audit templates, generated install surfaces, and this repo's dogfood-installed audit surfaces stay in sync.
created: 2026-06-27T04:16:34.785Z
last_modified: 2026-06-27T04:42:52Z
---

# Reduce outdated dependency noise in audit

**Goal:** Make `/audit` report only dependency updates old enough to be worth action, across supported language ecosystems, without changing the target repo's package-management policy.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-27T04:42:52Z Scope check: Found dogfood-flavored wording in scope/done_when. Tightened the ticket so ordinary target projects are the implementation target, with this repo's dogfood-installed files only a sync verification surface.
- 2026-06-27T04:24:09Z Quality-review: Approved intake scope with one non-blocking note — keep Renovate/Dependabot reading out of v1 unless it becomes an explicit later acceptance criterion. Primary-source check supports npm/PyPI/Go timestamp lookup; Rust is covered via publish-time-when-available plus unknown-age fallback.
- 2026-06-27T04:19:41Z Intake: Scoped the feature as a SafeWord-owned audit report filter: default 30-day release-age threshold, direct dependencies by default, no package-manager config mutation, cross-ecosystem support for JavaScript/Python/Go/Rust, and security findings outside the filter.
- 2026-06-27T04:16:34.785Z Started: Created ticket NAATTE
