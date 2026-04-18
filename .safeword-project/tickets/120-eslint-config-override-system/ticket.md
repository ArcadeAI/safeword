---
id: '120'
slug: eslint-config-override-system
type: task
phase: verify
status: in_progress
created: 2026-04-14
scope:
  - Move override presets into configs namespace (configs.cli, configs.relaxedTypes) — matches ecosystem convention
  - Switch generated eslint.config.mjs template to use defineConfig() from eslint/config — eliminates object-vs-array spread footgun
  - Dogfood presets in packages/cli/eslint.config.mjs using defineConfig
  - Document both paths (presets and individual rule overrides) in config.mdx and FAQ
  - Update docs to show defineConfig + extends usage for file-scoped overrides
out_of_scope:
  - Auto-detection of project type (rejected — heuristics fragile in monorepos)
  - Sidecar override file .safeword-project/eslint-overrides.mjs (deferred to ticket 019)
  - Hook-level smart lint-error suggestions (future ticket)
  - Test-file override preset (test relaxations already covered by configs.vitest/playwright)
  - Changing .safeword/eslint.config.mjs hook template (extends parent config + strict rules, doesn't consume overrides)
done_when:
  - Override presets exported under configs (configs.cli, configs.relaxedTypes) and typed on SafewordEslint interface
  - overrides property removed from plugin export
  - Generated eslint.config.mjs template uses defineConfig() instead of raw array export
  - packages/cli/eslint.config.mjs dogfoods presets via defineConfig
  - Unit tests verify preset shape, rule contents, and plugin export under configs namespace
  - Docs show defineConfig usage with both preset and individual rule override paths
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

## Design Decisions

### Resolved: Named presets over auto-detection

Per-project-type presets (cli, relaxedTypes) that users opt into explicitly. Auto-detection rejected — heuristics are fragile in monorepos. Matches ecosystem convention (typescript-eslint exposes `disableTypeChecked` as a named config).

### Resolved: Presets live under `configs.*`, not `overrides.*`

No major ESLint plugin uses a separate `overrides` namespace. typescript-eslint, eslint-config-prettier, eslint-plugin-security — all expose everything under `configs`. The name "overrides" also collides with the legacy eslintrc `overrides` key. Moving to `configs.cli` and `configs.relaxedTypes` enables `defineConfig` string resolution (`extends: ["safeword/cli"]`).

### Resolved: `defineConfig()` for generated configs

Override presets are single objects while base configs are arrays — mixed shapes in `configs` create a silent spread footgun (`...singleObject` produces garbage without errors). `defineConfig()` from `eslint/config` (ESLint ≥9.22, March 2025) flattens both shapes transparently. This is the recommended path — typescript-eslint deprecated `tseslint.config()` in favor of it. ESLint 9.22 is 13 months old; requiring it is reasonable since safeword already requires ESLint 9+ for flat config.

### Resolved: Hook-level config unchanged

`.safeword/eslint.config.mjs` dynamically imports the parent project config and layers strict rules on top. It doesn't consume override presets, so no changes needed. If the parent uses `defineConfig()` (which returns an array), the existing `[...projectConfig, strictRules]` pattern still works.

### Additive principle preserved

Override presets only turn rules `off` — they never add new rules. This aligns with the core principle: safeword adds rules, never replaces customer choices. Customers can also override individual rules directly in their config array.

## Work Log

- 2026-04-14 Discovered during audit: 363 lint errors in packages/cli/ from strict rules that don't apply to CLI tools. Root config has overrides, package config doesn't. Post-tool hook uses root config path so per-edit linting works correctly.
- 2026-04-15 Researched ESLint flat config ecosystem patterns (defineConfig, extends, shareable config authoring). Debated 4 approaches: named presets, auto-detection, sidecar file, hybrid. Selected named presets — matches ecosystem convention (typescript-eslint, eslint-config-prettier), preserves additive principle, minimal code.
- 2026-04-15 Implemented overrides.cli (5 security rules) and overrides.relaxedTypes (10 TS strict rules). Exported as objects (not arrays) matching eslint-config-prettier convention. CLI config dogfoods both presets: 363 errors → 38 (remaining are test-file-only, covered by root monorepo config). Unit tests pass (8/8). Docs updated in configuration.mdx and FAQ.
- 2026-04-17 Design review: identified three issues with current implementation. (1) `overrides` property has no ecosystem precedent — every major plugin uses `configs.*`. (2) Name collides with legacy eslintrc `overrides` key. (3) Mixed object/array shapes in `configs` create silent spread footgun. Resolution: move presets to `configs.*`, switch generated template to `defineConfig()`, keep hook-level config unchanged. Verified `.safeword/eslint.config.mjs` doesn't consume overrides — blast radius limited to plugin export, generated project-level template, dogfood config, tests, and docs.
- 2026-04-17 Research pass on ESLint 9.39.3 docs (via Context7): every canonical flat-config example uses `defineConfig`; `extends:` inside config objects is the documented mechanism and requires `defineConfig`. typescript-eslint deprecated `tseslint.config()` in favor of it. `tseslint.configs.disableTypeChecked` is ecosystem precedent for single-object presets — same shape as our `cli`/`relaxedTypes`. Decided to keep presets as single objects (not arrays) to match that precedent, rename exports `cliOverrides`→`cliConfig` and `relaxedTypesOverrides`→`relaxedTypesConfig` to match local naming convention (`vitestConfig`, `playwrightConfig`), and add `meta.namespace: 'safeword'` to the plugin for `extends: ["safeword/cli"]` string-resolution support.
- 2026-04-17 FAQ snippet decision: chose `defineConfig`-wrapped examples over raw arrays. Driver is consistency with what `safeword setup` now generates — mixing dialects across docs and generated output creates translation friction. FAQ snippet assumes the reader's generated file already imports `defineConfig`, elides the import line to keep snippets tight.
- 2026-04-17 Implementation. Changed files: plugin index (configs.cli/relaxedTypes + meta.namespace, removed `overrides`), preset files (exports renamed, `name:` → `safeword/cli`/`safeword/relaxed-types`), `packages/cli/eslint.config.mjs` (dogfood via defineConfig), `src/templates/config.ts` (standard/formatter-agnostic/standalone templates use `defineConfig` — extending/legacy hook-level templates unchanged as ticket requires), `tests/presets/eslint-overrides.test.ts` (rewrote for new shape; added assertion that legacy `overrides` namespace is gone and `meta.namespace` is set). Bumped `eslint` peer dep `^9.0.0`→`^9.22.0` and `ESLINT_PACKAGE` in typescript pack to match — required for `eslint/config` helper. Docs: `configuration.mdx` consolidated override table into main configs table, added file-scoped `extends:` example; `faq.mdx` Option 1 rewritten for `defineConfig`.
- 2026-04-17 Verification: preset tests 10/10, full eslint-configs test suite 171/171, integration (tooling-validation, invisible-extension, golden-path E2E) all pass. Golden-path E2E is the critical signal — it runs `safeword setup` end-to-end, generates the new defineConfig template, and lints a real file with it. Lint clean on all changed files. Pre-existing typecheck errors in `failure-memory.test.ts` and `schema.test.ts` are unrelated (untouched files).
