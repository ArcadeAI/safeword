Verified: 2026-05-14T23:01:00Z

## Verify Checklist

**Test Suite:** ✅ All checks pass in CI on commit `af309bf` (PR #81, run 25888275471):

- `test (node 20)`: SUCCESS
- `test (node 22)`: SUCCESS (re-run after a runner-side cancellation on first attempt)
- Local targeted suite: 57/57 pass across `tests/utils/version.test.ts`, `tests/utils/update-cache.test.ts`, `tests/utils/auto-upgrade.test.ts`, `tests/schema.test.ts`

**Build:** ✅ Success — `bun run --cwd packages/cli build` produces dist + .d.ts cleanly

**Lint:** ✅ Clean — CI lint job green; covers eslint, lockfile sync, build-CLI, typecheck, architecture, and version-consistency

**Scenarios:** ⏭️ Skipped — no `test-definitions.md` (ticket #081 is type `Improvement` and predates the BDD phase model; behavior pinned by `upgradeDecision()` unit tests in `tests/utils/version.test.ts`)

**Doc Refs:** ✅ Clean — added symbols only (`bumpType`, `compareVersions`, `parseVersion`, `upgradeDecision`, `UpdateCache`, `releaseAgeStatus`, `RELEASE_AGE_COOLDOWN_MS`), no removals or renames

**Dep Drift:** ✅ Clean — runtime deps covered in ARCHITECTURE.md (Bun, ESLint, Prettier explicit; eslint plugin family covered collectively; `yaml` and `commander` are implementation-detail tooling)

**Parent Epic:** N/A — #081 has no parent (`epic: setup-lifecycle` annotation only)

## Done-when status (all verified)

- [x] Session start auto-upgrades when newer version is available
- [x] Patch bumps auto-apply (same major + same minor + higher patch)
- [x] Minor bumps auto-apply within same major (additive-only contract)
- [x] Major bumps notify only — user runs `bunx safeword@<version> upgrade` manually
- [x] Policy pinned by unit tests on `upgradeDecision()` so reverting fails CI rather than drifts silently
- [x] `autoUpgrade: false` in config.json disables auto-upgrade
- [x] `SAFEWORD_NO_AUTO_UPGRADE` env var disables auto-upgrade
- [x] Upgrade is non-interactive (verified `upgrade.ts` and its call chain have zero prompts)
- [x] Upgrade output is committed automatically — inline `git add` + `git commit` in hook (not blocked on #078)
- [x] Network failure gracefully skipped
- [x] 24h release-age cooldown — versions <24h old skip with clear "remaining hours" message
- [x] Supply-chain: `bunx safeword@<exact-version>`, never `@latest`
- [x] Supply-chain: CI- and publish-time guard against install lifecycle scripts in safeword's `package.json`

## Smoke tests executed end-to-end

Against real `bunx safeword@<version>` invocations and synthetic cache states:

- Patch (0.30.0 → 0.30.3 real npm): upgrade applied, auto-commit landed ✓
- Minor (0.29.0 → 0.30.3 real npm, synthetic publishedAt 48h ago): upgrade applied ✓
- Major (0.30.3 → 1.0.0 synthetic): notify-only, no commit ✓
- Cooldown active (publishedAt 1h ago): "23h remaining" message, no upgrade ✓
- Cooldown expired (publishedAt 48h ago): upgrade applied ✓
- Fail-closed (publishedAt missing): "waiting on release-age info", no upgrade ✓
- ENOBUFS path (caught and fixed during smoke testing) ✓

## Discovered work (filed)

- #147 — worktree-clean dev loop (eslint config imports from `dist/`)
- #148 — auto-upgrade rollback on subprocess failure (partial-upgrade stuck state)
- #149 — derive safeword-managed paths from `SAFEWORD_SCHEMA` at build time
- #145 — enable MD040 + MD036 in markdownlint config

## Conventions introduced

- `audience: maintainer` skill frontmatter — drift test reads it via `YAML.parse` and skips maintainer-only skills from customer template mirrors. Verified against [official Claude Code skill spec](https://code.claude.com/docs/en/skills) — no field collision.

Ready to mark done. Update ticket: phase: done, status: done.
