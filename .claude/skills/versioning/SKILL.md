---
name: versioning
description: Safeword semver commitment and release discipline. Use when bumping versions, cutting releases, deciding what goes in a patch vs minor vs major, or reviewing changelog entries. Also use when auto-upgrade logic needs to know what's safe to apply silently.
allowed-tools: '*'
---

# Versioning

Safeword follows strict semver. This contract enables auto-upgrade to trust patch bumps.

## Semver Rules

### Patch (0.27.0 -> 0.27.1) — Auto-upgradeable

- Bug fixes in hooks, reconcile, or CLI commands
- Typo/grammar fixes in owned docs and guides
- Performance improvements with no behavior change
- Dependency bumps (patch-level only)

### Minor (0.27.0 -> 0.28.0) — Notify, user decides

- New hooks, skills, guides, or templates
- New CLI commands or flags
- New language pack support
- Additive schema changes (new owned/managed files)
- New quality gates or checks
- Changes to hook output format

### Major (0.x -> 1.0, 1.x -> 2.0) — Notify, user decides

- Removed or renamed hooks, skills, or commands
- Changed reconcile behavior (owned -> managed, file moves)
- Breaking schema changes
- Changed config file format
- Removed language pack support
- Hook exit code or protocol changes

## The Key Test

> "If a project auto-upgrades to this version at SessionStart, will the session behave identically?"
>
> **Yes** -> patch. **Adds capability but nothing breaks** -> minor. **Anything else** -> major.

## Pre-1.0 Note

Safeword is pre-1.0 but follows strict semver anyway. The ecosystem convention
(Renovate, Dependabot) treats 0.x as inherently unstable — Renovate excludes
0.x from auto-merge by default. Our patch-only auto-upgrade is a deliberate
commitment backed by this skill, not an ecosystem default. Contributors are
held to a higher standard than the ecosystem expects for 0.x packages.

## Applying This

- **Auto-upgrade logic:** Only auto-apply patch bumps silently
- **Changelog:** Label every entry as patch/minor/major
- **PR review:** Verify the version bump matches the change type
- **When unsure:** Bump minor, not patch — false-minor is safe, false-patch breaks trust
