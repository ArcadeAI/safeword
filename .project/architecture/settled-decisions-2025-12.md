# Settled Decisions (2025-12)

## Lint behavior

- **Graceful Linter Fallback:** When a linter is missing, `lint.ts` skips it silently (`.nothrow().quiet()`). A missing linter should never block Claude's workflow.
- **Ruff in Hook, mypy in Command Only:** Ruff takes milliseconds per file, so it can run in hooks. mypy takes seconds per project and runs only through `/lint`.

**Linter crash resilience:** `captureRemainingErrors()` reads stderr when stdout is empty on non-zero exit. This distinguishes "linter found no issues" from "linter crashed" (e.g., golangci-lint Go version mismatch). The existing `warnings` array reports crashes separately from lint errors, so a broken linter cannot appear to have passed.

**golangci-lint version check:** The lint hook checks `golangci-lint version --short` before running Go linting. Safeword generates v2 config format — v1 users get a clear warning with upgrade instructions instead of an opaque config parse error. The check runs once per session (cached via `toolWarnings` set).

**ESLint disable comment governance:** `@eslint-community/eslint-plugin-eslint-comments` enforces suppression hygiene: `disable-enable-pair` (block orphaned disables), `no-unlimited-disable` (require rule name), `require-description` (require `-- reason`), `no-duplicate-disable`, `no-unused-enable`. Combined with `reportUnusedDisableDirectives: 'error'` via `linterOptions` to catch stale disables.

## Configuration and schema

- **TOML Parsing — line-based for detection, `smol-toml` for configuration changes:** pyproject.toml detection uses line-based extraction; it only needs `[tool.poetry]`/`[tool.uv]` and pulls in no TOML parser (`project-detector.ts`). Codex plugin migration uses `smol-toml` to validate config parseability before its line-based hook surgery (`migrate-codex-plugin.ts`). The bundled Go lint executor also uses it to preserve TOML policies while normalizing their path context.

**Schema drift prevention:** `.husky/pre-push` runs two pure, filesystem-read-only tests (`schema.test.ts`, `skills-commands-validation.test.ts`; ~0.5s) when `git diff origin/main...HEAD` touches `schema.ts`. Install/dist-dependent E2E runs only in CI. Skippable with `git push --no-verify`.
