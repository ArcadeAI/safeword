---
id: JKQW03
slug: clear-development-dependency-advisories
type: task
phase: implement
status: in_progress
scope:
  - Update vulnerable JavaScript and Python lockfile dependencies to patched versions.
  - Upgrade the pinned Bun toolchain so a scoped minimatch override preserves the older compatible ESLint plugin copy.
  - Verify audits, lint, builds, generated plugin parity, and relevant tests.
out_of_scope:
  - Changes to Safeword's explain behavior or unrelated feature work.
done_when:
  - Prescribed dependency audits report no known vulnerabilities.
  - Pinned local, CI, and container toolchains agree and the repository checks pass.
created: 2026-11-12T01:02:46.536Z
last_modified: 2026-11-12T01:02:46.536Z
---

# Keep development checks safe for contributors

**Goal:** Remove known advisories from locked development dependencies without breaking their consumers.

**Why:** The prescribed Safeword verify dependency lane reports existing advisories and cannot pass.

## Work Log

- 2026-11-12T01:02:46.536Z Started: Created ticket JKQW03
- 2026-11-12T01:07:00Z Investigated: Updated Python locks and fast-uri, leaving minimatch and KaTeX findings. Bun 1.3.14 supports only global overrides; forcing minimatch 11 globally breaks eslint-plugin-jsx-a11y, which requires minimatch 3's callable API.
- 2026-11-12T01:08:00Z Built: Pinned Bun 1.4.4 across local, CI, and container sources; scoped minimatch 3 to eslint-plugin-jsx-a11y, pinned patched minimatch 11 elsewhere and KaTeX 0.18.2, and regenerated bundled runtimes. Bun and Python audits now pass.
- 2026-11-12T01:15:00Z Reviewed: Independent intake review approved. Re-resolving with Bun 1.4 also moved postcss-selector-parser from 7.1.5 to 7.2.0 and its nested copy from 6.1.4 to 6.1.5; these are intentional lockfile updates.
- 2026-11-12T01:19:00Z Fixed: A brace-pattern smoke check exposed that the global brace-expansion override broke minimatch 3. Scoped minimatch 3 to patched brace-expansion 1.1.22; the brace-pattern check and both dependency audits now pass.
- 2026-11-12T01:30:00Z Fixed: Full CLI tests exposed that eslint-plugin-import-x 4.17.1 imports an API absent from minimatch 11. Updated that plugin to 4.18.1, which declares minimatch 11 support, and kept the patched minimatch 11 override; targeted integration tests are running.
- 2026-11-12T03:00:00Z Checked: The affected integration tests and new brace-pattern regression test passed, 33/33. An isolated Codex plugin contract failed because Bun 1.4 emits a guarded inlined literal where the test expected a bare literal. Updated the test parser to check the statically true guard. The full suite also hit widespread slow integration timeouts while other worktrees competed for the shared test lock; isolated reruns are pending.

## Decision and failure modes

Bun 1.4 supports parent-scoped overrides; Bun 1.3.14 does not. The scoped rule keeps the older callable minimatch API for eslint-plugin-jsx-a11y while replacing the vulnerable newer copy for other consumers. A global minimatch override was rejected because it breaks that plugin. The toolchain upgrade may change generated bundle bytes, lockfile format, and container builds; generated-surface checks, frozen install, lint, package tests, and Docker builds must prove these boundaries.

## Proof so far

- `scripts/dev bun --version` reports 1.4.4; `mise.toml` and root `package.json` pin it. CI's `oven-sh/setup-bun` steps read `package.json` through `bun-version-file`; the website deployment pins `bun@1.4.4` explicitly. Both container build stages use `oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d`, checked with `docker buildx imagetools inspect`.
- The generated `bun.lock` resolves minimatch 11.0.8 for general consumers and a nested minimatch 3.1.5 for `eslint-plugin-jsx-a11y`. The installed plugin resolves a callable minimatch 3 export; the root ESLint copy resolves minimatch 11.0.8. `scripts/dev bun ci --ignore-scripts` accepted the lock without changes.
- `scripts/dev bun audit` found no vulnerabilities in 1,169 packages. `scripts/dev uv audit` found none in 39 Python packages.
- `scripts/dev bun run lint`, `scripts/dev bun run --cwd packages/website build`, the pinned-Bun contract test (4/4), and all five generated-surface checks passed. Both retro service Docker build stages passed. The full repository test suite remains to run.
