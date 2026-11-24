# Build & Distribution

The OpenCode profile copies `dispatcher.js` without sibling chunks or `node_modules`, so the post-build step re-bundles it as one file. Package exports: `.` (library), `./eslint` (preset), and `./schemas/cli-result-v1.json` (the published CLI result JSON Schema).

The npm tarball contains `dist/`, `schemas/`, the setup templates in `templates/`, and the Codex installation bundle in `codex-plugin/`. The Claude marketplace distributes the native Claude plugin from the repo-root `plugin/` directory.

**Publish path:** an annotated `v*` tag triggers `.github/workflows/release.yml`. Its unprivileged build job installs from the frozen lockfile, builds, runs the release-contract suite, and packs the tarball. When local retro cutover is enabled, a protected job validates fresh production evidence before publication; malformed cutover state or failed evidence blocks the release. A separate minimal OIDC job downloads the artifact and publishes stable versions to `latest` and prereleases to `next` with provenance and install scripts disabled. After a stable publish, a final job advances the non-forced `stable` branch only when it remains a fast-forward. The local `prepublishOnly` hook provides a backup check. It verifies the tag, runs the release tests, then builds.
