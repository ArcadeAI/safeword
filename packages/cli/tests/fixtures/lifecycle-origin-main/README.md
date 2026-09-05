# Lifecycle contract fixtures

These snapshots cover normalized lifecycle results and managed file trees, not real
package-manager integration. The test models devDependency additions/removals with
fixed resolutions and a minimal lockfile. It does not model registry resolution,
the dependency graph, production dependencies, or installation failures. Unknown
package requests fail rather than silently extending the model.

The execFileSync guard detects package-manager calls through the current execution
path; it is not a general subprocess or network sandbox. Real installation coverage
belongs in the integration and acceptance suites.

Tree hashes frame each path/content token as JSON. Temporary paths, current version,
project UUIDs, and embedded 64-character digests are normalized; changes only to those
values intentionally do not change the contract.

`originMainCommit` records the original contract lineage, not the source revision of
every subsequently regenerated snapshot. Git history supplies update provenance.

To update intentionally, from the repository root run:

```sh
SAFEWORD_UPDATE_ORIGIN_MAIN_FIXTURES=1 bun run test tests/lifecycle/origin-main-contract.test.ts
bun run test tests/lifecycle/origin-main-contract.test.ts
```

Inspect the diff and explain the behavior or canonicalization change. Update mode is
refused in CI; an update-mode pass alone is not verification.
