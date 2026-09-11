---
id: P0WEJD
slug: keep-claude-upgrades-on-selected-release
type: task
subtype: bug-investigated
phase: verify
status: in_progress
created: 2026-09-10T23:33:09.817Z
last_modified: 2026-09-10T23:33:09.817Z
---

# Keep Claude upgrades on the selected release

**Goal:** Upgrade an existing Claude installation to the requested Safeword release tag while preserving customer configuration and rollback safety.

**Why:** Claude reports marketplace update success after a stored ref change but leaves the checkout on the prior ref, blocking public release-candidate upgrades.

**Type:** Bug

**Scope:** Replace the ineffective stale-ref refresh with a rollback-safe Claude
marketplace replacement that installs the requested release tag.

**Out of Scope:** Claude CLI changes, stable promotion, other host installers,
and unrelated profile reconciliation.

**Done When:**

- [x] A real `0.83.1` Claude profile upgrades to the requested prerelease.
- [x] Failed replacement restores the exact prior settings, registry, marketplace,
      plugin registration, and customer-authored data.
- [x] A repeated install is a no-op.

**Tests:**

- [x] Integration: a stale marketplace is replaced before the plugin is installed.
- [x] Integration: replacement failure restores the prior profile exactly.
- [x] Real-host prepublication proof: public `0.83.1` upgrades through the patched
      CLI to the requested candidate; repeat install is unchanged.

## Root Cause

Two defects combine. Safeword treated the released `stable` marketplace ref as
current even when the requested version was a prerelease, so the real upgrade
never entered its marketplace migration. For explicitly versioned older refs,
Claude Code 2.1.244 reads the edited `ref` and reports `marketplace update`
success, but does not move the existing checkout to that ref. Either path leaves
`safeword@safeword` at `0.83.1`, and Safeword correctly rejects the final
postcondition.

Confirmed in a disposable public-package fixture: after changing both stored refs
to `v1.0.0-rc.2`, `claude plugin marketplace update safeword` exited zero while
the checkout remained at `f15c55f7` and `claude plugin list --json` still reported
`0.83.1`. Removing the marketplace, re-adding the requested ref, and installing
the plugin produced enabled `1.0.0-rc.2` metadata.

The first patched-host rerun preserved and restored the profile but proved the
`stable` classification prevented the replacement path; the unit fixture had
covered only an explicit `v0.83.1` ref. The regression now uses the exact
released `stable` shape.

Ruled out: npm/package corruption (RC.2 is public with matching integrity and
provenance); scope parsing (Claude continued to report user scope); environment
loss (the isolated `CLAUDE_CONFIG_DIR` contained every observed mutation); final
metadata lag (the marketplace checkout itself never moved).

## Work Log

- 2026-09-10T23:33:09.817Z Started: Created ticket P0WEJD
- 2026-09-10T23:34:00.000Z Investigated: public RC.2 upgrade reproduced;
  rollback preserved the customer sentinel and restored the exact `0.83.1` profile.
- 2026-09-10T23:34:30.000Z Root cause: Claude's marketplace update command
  accepts a rewritten ref without checking out that ref; remove/re-add works.
- 2026-09-10T23:55:30.000Z Real-host rerun found the paired classification
  defect: prerelease requests treated the released `stable` ref as current.
- 2026-09-10T23:58:00.000Z GREEN: 26/26 profile integration tests pass;
  targeted ESLint and TypeScript pass. A real isolated Claude profile upgraded
  from public `0.83.1` to enabled `1.0.0-rc.2`, preserved the customer sentinel,
  and converged to a no-op on the second install.
- 2026-09-11T00:00:00.000Z Restart check: reran all 26 profile integration
  tests, targeted ESLint, TypeScript, and the isolated Claude no-op; every check
  passed and the stored checkout still resolves exactly to `v1.0.0-rc.2`.
- 2026-09-11T00:37:00.000Z Review: external reviewer routes were exhausted.
  Same-thread supplemental review found a rollback gap after marketplace
  replacement; auto-update enrollment now shares the rollback boundary, with
  failure injection proving exact restoration.
- 2026-09-11T00:44:00.000Z Final verification: 27/27 Claude profile tests,
  73/73 release-contract tests, lint/typecheck, and the full 9,588-test suite
  pass. Diff audit passed after documenting the transactional profile decision.
- 2026-09-11T01:47:14.000Z Release verification: fixed generator mtime churn
  and brought the Claude lifecycle fixture in line with the real marketplace
  registry. The exact wrapper passed 9,939 package tests, 1,499 acceptance
  scenarios, 45 proof-tag checks, every build/typecheck, and dependency audits.
  A final diff audit found no architecture or dependency violations.
- 2026-09-11T02:05:00.000Z Independent review: corrected rolled-back marketplace
  replacement reporting so an exactly restored profile returns `changed: false`
  with no completed effects. Also accepted packed trusted marketplace URLs without
  a ref and restored test mocks between cases. All 28 profile tests and 35 focused
  Claude scenarios pass.
- 2026-09-11T02:10:00.000Z Release recheck: regenerated both bundled runtimes;
  73/73 release-contract tests, repository lint, Gherkin lint, TypeScript, and
  whitespace validation pass with the pinned Bun 1.3.14 toolchain.
- 2026-09-11T02:50:00.000Z Independent re-review: moved effect compensation
  into the replacement transaction so later plugin or payload failures report
  the fully restored profile as unchanged. Added a discriminating payload-failure
  regression and scoped marketplace removal to the selected profile.
- 2026-09-11T03:02:00.000Z Confirmation review: preserved live effects for raw
  host/filesystem failures and made restore failures return the explicit
  rollback-failed result. A targeted injected checkout-restore failure proves
  the result remains truthful when exact restoration cannot complete.
- 2026-09-11T03:12:00.000Z Focused confirmation: aligned mutation planning with
  installation's canonical project root and added a nested-directory regression.
  Missing marketplace checkouts now return the intended diagnostic.
