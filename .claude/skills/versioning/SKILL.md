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
0.x from auto-merge by default. Our patch + minor auto-upgrade policy is a
deliberate commitment backed by this skill, not an ecosystem default.
Contributors are held to a higher standard than the ecosystem expects for 0.x
packages: minor releases must be strictly additive and pass the "auto-upgrade
at SessionStart — does anything break?" test in the negative.

## Applying This

- **Auto-upgrade logic:** Auto-apply patch + minor bumps silently. Notify on major.
- **Changelog:** Label every entry as patch/minor/major
- **PR review:** Verify the version bump matches the change type. **Bumping minor for anything other than strict addition is now a contract break** — be especially careful here, because minors auto-propagate.
- **When unsure:** Bump major, not minor — false-major costs users a manual upgrade; false-minor silently breaks them.

## Operating: cutting a release

The publish path is CI-driven via OIDC trusted publishing. Tag push → GitHub Actions `Release` workflow → npm with provenance. No local `bun publish` needed (or wanted) for normal releases.

**Procedure:**

1. **Decide the bump** using rules above. Patch / Minor / Major.

2. **Bump version in all four release-tracked artifacts** (pre-commit and release-contract tests enforce the Codex match):
   - `packages/cli/package.json` → `version`
   - `marketplace.json` → `plugins[0].version`
   - `packages/cli/codex-plugin/.codex-plugin/plugin.json` → `version`
   - `packages/cli/codex-plugin/hooks.json` → all five `bunx` commands pin `safeword@<version>`

   Then **regenerate the lockfile** so `bun.lock`'s `packages/cli` workspace
   version tracks `package.json` — otherwise it drifts and CI's lockfile-drift
   gate fails the next PR that touches `package.json` (see #312):

   ```bash
   bun install # rewrites bun.lock's workspace version; no resolution change
   ```

3. **PR + admin-merge.** `main` is protected:

   ```bash
   git checkout -b release/vX.Y.Z
   git add packages/cli/package.json marketplace.json packages/cli/codex-plugin/.codex-plugin/plugin.json packages/cli/codex-plugin/hooks.json bun.lock
   git commit -m "chore(release): vX.Y.Z"
   git push -u origin release/vX.Y.Z
   gh pr create --title "chore(release): vX.Y.Z" --body "..."
   # after CI green:
   gh pr merge --delete-branch --admin < num > --squash
   ```

4. **Annotated tag on the merge commit.** Body should roll up changes since the prior tag — see `git show v0.35.1` for the style.

   ```bash
   git checkout main && git pull --ff-only origin main
   git tag -a vX.Y.Z HEAD -m "Release vX.Y.Z
   
   <rollup of changes since prior tag>"
   git push origin vX.Y.Z
   ```

   Tag push triggers `.github/workflows/release.yml`.

5. **Verify the publish.** Watch the run, then confirm on npm:

   ```bash
   gh run view conclusion -q '.conclusion' < id > --json # → success
   npm view safeword version                             # → X.Y.Z
   ```

   Optional: `bunx safeword@latest upgrade` in this repo to round-trip the dogfood install.

**Named failure modes** (match symptoms, then fix):

- **Workflow doesn't fire after tag push** — the tagged commit lacks `.github/workflows/release.yml`. Move the tag forward to a commit that has it (`git tag -d vX.Y.Z && git tag -a vX.Y.Z origin/main ... && git push --delete origin vX.Y.Z && git push origin vX.Y.Z`).
- **`404 Not Found - PUT /safeword` at npm publish step** — trusted-publisher config on https://www.npmjs.com/package/safeword/access doesn't match the OIDC claims. Verify Organization/Repository/Workflow filename/Environment name fields exactly match `release.yml`.
- **`422 Unprocessable Entity ... repository.url is ""`** — `packages/cli/package.json` lost its `repository` field. Restore it.
- **Verify-npm-version step fails** — Node 24's bundled npm dropped below 11.5.1 (rare; means Node was downgraded). Pin `node-version` higher in `release.yml`.
- **`404 OIDC token exchange ... package not found`** — npm trusted publisher entry was deleted or never saved. Re-create on npmjs.com.

**Failure-mode triage:** the workflow's `release.yml` has inline comments at each non-obvious step; read those before guessing. The publish-job step list (post-#146) is intentionally minimal — failures are localized.
