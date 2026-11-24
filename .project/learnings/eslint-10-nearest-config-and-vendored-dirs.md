# ESLint 10 Lints Each File With Its Nearest Config

Covers: ESLint 10 config lookup, .safeword/eslint.config.mjs, vendored directory ignores, basePath, --config base path.

ESLint 10 resolves the config **nearest to each linted file**, not one config
from the working directory. A root `eslint.config.mjs` that ignores
`**/.safeword/**` therefore does nothing for files inside `.safeword/`. Those
files are linted by `.safeword/eslint.config.mjs` itself, which is how a fresh
install with Cursor's hook sources in `.safeword/hooks/` failed `eslint .`
(#6966).

## The two modes use different base paths

- **Nearest-config lookup** (`eslint .`): patterns are relative to the config
  file's directory, so `.safeword/foo.ts` is seen as `foo.ts`.
- **Explicit `--config`** (the edit-time lint hook): patterns are relative to
  the working directory, so the same file is `.safeword/foo.ts`.

So a relative self-ignore such as `eslint.config.mjs` or `hooks/**` is wrong in
one mode or the other. In hook mode it would ignore the project's root files.

## What works

An ignores-only object with an **absolute** `basePath`:
`{ basePath: import.meta.dirname, ignores: ["**"] }`. It names the same
directory in both modes. `basePath` needs ESLint 9.30+, and Safeword supports
`^9.22`, so the generated hook config only adds it when `ESLint.version` is 10+.
That's also the only version where nearest-config lookup is the default.
Proof lives in `packages/cli/tests/scaffold-lint-clean.test.ts`, which runs real
ESLint in both modes.

## Related trap

Don't make generated file content depend on whether another generated file
exists yet. Setup writes both in the same run, so the second identical install
rewrites the file and never converges (`setup-convergence.test.ts`).
