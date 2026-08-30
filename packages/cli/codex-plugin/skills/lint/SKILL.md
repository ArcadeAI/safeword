---
name: lint
description: Run linters and formatters to fix code style issues. Use when
  cleaning up style violations, formatting code, or after implementation to
  ensure code meets project standards.
---

# Lint

Give fast lint and formatting feedback for the files changed in the current
worktree. This is an iterative cleanup lane, not authoritative release evidence;
`$safeword:verify` owns the project's full lint, type-check, build, and test suites.

## Instructions

1. Collect tracked and untracked changed files with `git diff --name-only
--diff-filter=ACMR HEAD` and `git ls-files --others --exclude-standard`.
2. Group them by language. Run every applicable language below in a polyglot
   project, but pass only those changed files (or their Go package directories).
3. If there are no changed source files, report that and stop.
4. Only when the user explicitly asks for a **full** lint, run the repository's
   existing full lint/format scripts instead. Do not infer that request merely
   because implementation finished; `$safeword:verify` is the full closing gate.

Use the repository's installed tools and configuration. Examples (`<files...>`
means the explicit changed-file list, never `.`):

```bash
# Python
ruff check --fix <changed-python-files...>
ruff format <changed-python-files...>
mypy <changed-python-files...>

# JavaScript / TypeScript
bunx eslint --fix -- <changed-js-ts-files...>
bunx prettier --write -- <changed-js-ts-files...>

# Go (translate changed .go files to unique package directory patterns)
golangci-lint run --fix <changed-go-package-patterns...>
golangci-lint fmt <changed-go-package-patterns...>
```

Do not append changed files to a script that already contains `eslint .`,
`prettier .`, or another repository-wide target: the `.` still expands the run
to the whole repository. Do not hide failures with `|| true`; capture each exit
status, continue with the other applicable language groups, then report every
failure.

## Summary

After running, report:

1. The changed-file scope used, or that the user explicitly requested full scope
2. Any linting errors that couldn't be auto-fixed (Ruff, ESLint, or golangci-lint)
3. Any formatting issues
4. Type errors reported by a targeted tool; remind the user that `$safeword:verify` owns
   authoritative project-wide type checking
