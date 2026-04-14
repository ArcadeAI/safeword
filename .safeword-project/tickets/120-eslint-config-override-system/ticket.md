---
id: '120'
slug: eslint-config-override-system
type: feature
phase: intake
status: backlog
created: 2026-04-14
---

# ESLint Config Override System

## Problem

Safeword ships strict ESLint rules via `.safeword/eslint.config.mjs` that extend the customer's project config. Some rules produce false positives for certain project types:

- **CLI tools:** `security/detect-non-literal-fs-filename`, `security/detect-object-injection`, `sonarjs/os-command` — CLI tools work with dynamic paths and exec commands by design
- **Untyped external data:** `@typescript-eslint/strict-boolean-expressions`, `@typescript-eslint/no-unsafe-*` — projects that handle JSON, YAML, or user input have legitimate `any` values
- **Async patterns:** `@typescript-eslint/require-await` — interface conformance sometimes requires async without await

These are correct rules for web apps but false positives for CLIs, SDKs, and other project types.

## Discovery Context

Found during dogfooding: the Safeword CLI's own `packages/cli/eslint.config.mjs` is a minimal config that doesn't have the overrides the root `eslint.config.mjs` carefully defines. The post-tool hook uses `.safeword/eslint.config.mjs` (which imports root config + overrides), so per-edit linting passes. But `bun run lint` from `packages/cli/` uses the package config and sees 363 errors — all from rules the root config already suppresses.

Two separate issues:

1. **Internal:** `packages/cli/eslint.config.mjs` needs the same overrides as the root config (config drift bug)
2. **Customer-facing:** Customers need a way to override safeword's strict rules for their project type without forking the config

## Open Questions

- Should overrides be per-project-type (CLI, web app, library) or per-rule?
- Should safeword detect project type and apply overrides automatically, or require manual config?
- How does this interact with the additive config principle (linter configs add rules, never replace customer choices)?
- Should `.safeword/eslint.config.mjs` support a local overrides file (e.g., `.safeword/eslint.local.mjs`) that customers can edit without it being overwritten by `safeword upgrade`?

## Work Log

- 2026-04-14 Discovered during audit: 363 lint errors in packages/cli/ from strict rules that don't apply to CLI tools. Root config has overrides, package config doesn't. Post-tool hook uses root config path so per-edit linting works correctly.
