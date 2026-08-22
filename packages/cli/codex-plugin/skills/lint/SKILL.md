---
name: lint
description: Run linters and formatters to fix code style issues. Use when
  cleaning up style violations, formatting code, or after implementation to
  ensure code meets project standards.
---

# Lint

Run the full linting and formatting suite for the detected project type(s).

## Instructions

Run these commands based on project type. All detected languages run for polyglot projects.

```bash
lint_status=0
run_lint_step() {
  "$@" 2>&1
  step_status=$?
  if [ "$step_status" -ne 0 ] && [ "$lint_status" -eq 0 ]; then
    lint_status="$step_status"
  fi
}

# Python linting (if pyproject.toml or requirements.txt exists)
([ -f pyproject.toml ] || [ -f requirements.txt ]) && {
  # Ruff - fix code quality issues
  run_lint_step ruff check --fix .
  # Ruff - format all files
  run_lint_step ruff format .
  # mypy - type check
  run_lint_step mypy .
}

# JS/TS linting (if package.json exists)
[ -f package.json ] && {
  # ESLint - use lint:eslint if exists (projects with existing linter), else lint
  if grep -q '"lint:eslint"' package.json 2> /dev/null; then
    run_lint_step bun run lint:eslint
  else
    run_lint_step bun run lint
  fi
  # Prettier - format all files
  run_lint_step bun run format --if-present
  # TypeScript type check (if tsconfig.json exists)
  if [ -f tsconfig.json ]; then
    run_lint_step bunx tsc --noEmit
  fi
}

# Go linting (if go.mod exists)
if [ -f go.mod ]; then
  # golangci-lint - fix and report issues
  run_lint_step golangci-lint run --fix ./...
  # golangci-lint - format
  run_lint_step golangci-lint fmt ./...
fi

exit "$lint_status"
```

## Summary

After running, report:

1. Any linting errors that couldn't be auto-fixed (Ruff, ESLint, or golangci-lint)
2. Any formatting issues
3. Type errors (mypy or TypeScript)
4. Interrupted checks as unverified, never clean
