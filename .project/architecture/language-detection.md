# Language Detection

## Pattern: Detect Languages Before Framework

Detect languages before running framework probes. This prevents JavaScript setup from creating a package manifest in a Python-only project.

## Data Model

The [project detector](../../packages/cli/src/utils/project-detector.ts) passes the detected languages and frameworks to setup as part of the project context.

## ESLint Plugin Configuration

The [preset configurations](../../packages/cli/src/presets/typescript/eslint-configs/) define base, framework, and tooling rules. The [preset detector](../../packages/cli/src/presets/typescript/detect.ts) selects conditional configurations.

Safeword’s React framework configurations use `@eslint-react/eslint-plugin` for React, JSX, DOM,
RSC, and web API guardrails. `eslint-plugin-react-hooks` remains the official
source for Hooks and React Compiler diagnostics; legacy `eslint-plugin-react` is
not bundled.

`@eslint-react/no-duplicate-key` is intentionally enabled for agent guardrail
parity even though upstream marks it experimental. Keep
`@eslint-react/eslint-plugin` exact-pinned until that rule is stable or the
guardrail is replaced, so minor package updates cannot silently change the
published React preset.
