---
name: versioning
description: Safeword semver commitment and release discipline. Use when bumping versions, cutting releases, deciding what goes in a patch vs minor vs major, or reviewing changelog entries. Also use when auto-upgrade logic needs to know what's safe to apply silently.
allowed-tools: '*'
audience: maintainer
---

# Versioning

Safeword follows strict semver. This contract enables auto-upgrade to trust
patch AND minor bumps within the same major. Major bumps are the only class
that requires user action.

## Semver Rules

### Patch (0.27.0 -> 0.27.1) — Auto-upgradeable

- Bug fixes in hooks, reconcile, or CLI commands
- Typo/grammar fixes in owned docs and guides
- Performance improvements with no behavior change
- Bumping safeword's own dependencies (at patch level)

### Minor (0.27.0 -> 0.28.0) — Auto-upgradeable (additive only)

Auto-applied silently at SessionStart, same as patch. The contract: minors are
**strictly additive**. They may add capability but must not remove or change
existing behavior. If a change can't fit this constraint, bump major instead.

- New hooks, skills, guides, or templates
- New CLI commands or flags
- New language pack support
- Additive schema changes (new owned/managed files)
- New quality gates or checks
- **Additive** config.json fields (new optional keys with defaults)
- Changes to hook output format (additive only — extra lines, new fields; no removal/rename)

### Major (0.x -> 1.0, 1.x -> 2.0) — Notify, user decides

The only class that breaks auto-upgrade silence. User runs
`bunx safeword@<version> upgrade` manually after reviewing the changelog.

- Removed or renamed hooks, skills, or commands
- Changed reconcile behavior (owned -> managed, file moves)
- Breaking schema changes
- Changed config file format
- Removed language pack support
- Hook exit code or protocol changes
- Any change that would make an existing user's working setup behave differently

## The Key Test

> "If a project auto-upgrades to this version at SessionStart, will anything break?"
>
> **No, only fixes** -> patch. **No, but adds new capability** -> minor (still auto). **Possibly** -> major (notify only).

## Pre-1.0 Note

Safeword is pre-1.0 but follows strict semver anyway. The ecosystem convention
(Renovate, Dependabot) treats 0.x as inherently unstable — Renovate excludes
0.x from auto-merge by default. Our patch-only auto-upgrade is a deliberate
commitment backed by this skill, not an ecosystem default. Contributors are
held to a higher standard than the ecosystem expects for 0.x packages.

## Applying This

- **Auto-upgrade logic:** Auto-apply patch + minor bumps silently. Notify on major.
- **Changelog:** Label every entry as patch/minor/major
- **PR review:** Verify the version bump matches the change type. **Bumping minor for anything other than strict addition is now a contract break** — be especially careful here, because minors auto-propagate.
- **When unsure:** Bump major, not minor — false-major costs users a manual upgrade; false-minor silently breaks them.
