# Verify: Capture upgraded safeword version in package.json

## Commands

- `bun run --cwd packages/cli test tests/commands/upgrade.test.ts -t "package.json safeword|local safeword"` — 2 passed, 14 skipped.
- `bun run --cwd packages/cli test tests/commands/upgrade.test.ts -t "package-lock stays in sync"` — 1 passed, 16 skipped.
- `bun run --cwd packages/cli test tests/commands/upgrade.test.ts -t "package.json safeword|local safeword|package-lock stays in sync"` — 3 passed, 14 skipped.
- `bun run --cwd packages/cli lint` — passed (`eslint src tests && tsc --noEmit`).
- `bun run --cwd packages/cli test tests/commands/upgrade.test.ts` — 17 passed.
- `bunx prettier --check packages/cli/src/commands/upgrade.ts packages/cli/tests/commands/upgrade.test.ts .project/tickets/72VX8K-upgrade-captures-package-version/ticket.md .project/tickets/72VX8K-upgrade-captures-package-version/verify.md` — passed.
- `git diff --check` — passed.
- `bunx safeword@latest sync-config --check` — passed (`✓ Config in sync`).
- `bunx depcruise --output-type err --config .dependency-cruiser.cjs .` — 0 errors, 3 pre-existing warnings.
- `bunx knip --reporter json` — reported pre-existing unused/unresolved items outside this change.
- `bunx jscpd . --min-lines 10 --reporters console` — reported pre-existing duplicate blocks; no new duplicate in the upgrade change.
- `bun outdated` — reported `eslint` current `9.39.4`, latest `10.5.0`.

## Evidence

- Branch verification ran after rebasing onto `origin/main` at `0fb014ac` with `packages/cli` version `0.46.2`.
- RED: before implementation, `should update package.json safeword dependency to the CLI version` failed with `Received: "^0.1.0"` and `Expected: "^0.46.1"`.
- RED: quality-review lockfile regression failed because `npm-args.log` was not created, proving upgrade did not delegate the stale safeword bump to npm.
- RED: refactor regression caught npm range drift: installing `safeword@^0.46.1` wrote `^0.46.2`, so upgrade now installs the exact running CLI version while accepting npm's saved manifest prefix.
- GREEN: final full upgrade command test file passed after the package-manager-backed refactor.
- CI-stability: registry-spec tests use a fake npm binary, avoiding live registry installs while still asserting that `upgrade` delegates `safeword@${VERSION}` to the package manager.
