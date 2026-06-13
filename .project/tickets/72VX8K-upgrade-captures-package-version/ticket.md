---
id: 72VX8K
slug: upgrade-captures-package-version
title: Capture upgraded safeword version in package.json
type: task
phase: done
status: done
priority: medium
created: 2026-06-13T00:00:00Z
last_modified: 2026-06-13T18:27:56Z
scope:
  - Update `safeword upgrade` so a root `package.json` that depends on safeword records the current CLI version after upgrade.
  - Preserve local-only dependency specs such as `file:` and `workspace:` so development and dogfood installs keep working.
  - Route stale registry-style safeword bumps through the detected package manager using the exact running CLI version so lockfiles can stay in sync.
out_of_scope:
  - Changing install-time package manager behavior.
  - Hand-editing lockfiles or changing non-safeword dependency semantics.
  - Adding safeword to package.json when the project intentionally relies on a workspace member package instead.
done_when:
  - `safeword upgrade` changes an older registry-style safeword devDependency to the running CLI version.
  - Upgrade leaves local `file:` or `workspace:` safeword specs unchanged.
  - npm-lock projects update stale registry-style safeword specs via the package manager path.
  - Existing upgrade behavior for `.safeword/version` still passes.
---

# Task: Capture upgraded safeword version in package.json

**Type:** Improvement

**Scope:** Keep package.json aligned with the safeword version installed by an upgrade. This records the new version in the project manifest instead of relying only on `.safeword/version`.

**Out of Scope:** Direct lockfile editing, package-manager install strategy changes, and dogfood/workspace self-install behavior.

**Done When:**

- [x] Older registry-style safeword dependency specs update to the current CLI version.
- [x] Local `file:` and `workspace:` safeword specs are preserved.
- [x] npm-lock projects use the package-manager path for stale registry-style safeword bumps.
- [x] Existing upgrade tests remain green.

**Tests:**

- [x] CLI integration: upgrade rewrites an old registry-style `devDependencies.safeword` spec.
- [x] CLI integration: upgrade preserves a local `file:` safeword spec.
- [x] CLI integration: upgrade delegates stale npm-lock safeword bumps to npm so package-lock can update.

## Work Log

- 2026-06-13T08:33:00Z Complete: added upgrade-side package.json sync for existing registry-style safeword dependency specs while preserving local specs. Verified with upgrade command tests and package lint/typecheck.
- 2026-06-13T09:23:00Z Quality-review fix: changed stale registry-spec sync to call the detected package manager instead of editing `package.json` directly. Added an npm-lock regression using a fake npm binary to prove package-lock can be updated by the package-manager path.
- 2026-06-13T17:38:20Z Refactor pass: separated exact install target (`safeword@${VERSION}`) from saved manifest specs (`^${VERSION}` / `${VERSION}` / `~${VERSION}`), after a focused regression exposed that installing `safeword@^${VERSION}` can resolve a newer compatible package version. Extracted local package.json helpers in the upgrade test.
- 2026-06-13T18:10:21Z Audit pass: rebased the uncommitted work onto `origin/main` (`0fb014ac`, CLI `0.46.2`) and reran audit/verification checks before commit.
- 2026-06-13T18:27:56Z CI-stability fix: reused the fake npm fixture for registry-spec package.json assertions so tests verify package-manager delegation without depending on live npm registry latency.
