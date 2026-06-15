---
id: 71Q4DV
slug: eslint-10-react-plugin-path
type: task
phase: implement
status: in_progress
created: 2026-06-15T02:54:20.170Z
last_modified: 2026-06-15T21:51:39Z
---

# Replace legacy React lint plugin with ESLint React

**Goal:** Replace Safeword's `eslint-plugin-react` dependency with the newer `@eslint-react/eslint-plugin` stack while preserving the agent-facing React guardrails customers rely on.

**Why:** `eslint-plugin-react` is the blocker for ESLint 10 and has a slower release path, while `@eslint-react/eslint-plugin` is active, ESLint 10-ready, and covers modern React surfaces including DOM, RSC, Web API, and React Compiler-style rules.

**Type:** Improvement

**Scope:** Build the migration plan and implementation for replacing Safeword's React preset usage of `eslint-plugin-react` with `@eslint-react/eslint-plugin`, including a rule parity matrix, package dependency changes, preset updates, and regression tests for every load-bearing agent-error rule.

**Out of Scope:** Waiting for upstream `eslint-plugin-react` ESLint 10 support, keeping a permanent dual React plugin path, or shipping weaker React guardrails just to finish the replacement. The ESLint 10 package bump itself may remain in ticket 099 if this ticket only removes the React-plugin blocker.

**Done When:**

- [x] Safeword no longer depends on `eslint-plugin-react` for its recommended React preset.
- [x] The recommendation includes a rule-by-rule parity matrix for current Safeword React error rules.
- [x] The React preset uses `@eslint-react/eslint-plugin` and keeps `eslint-plugin-react-hooks` for official Hooks and React Compiler diagnostics unless evidence supports replacing those rules too.
- [x] The updated React preset loads successfully with the current supported ESLint version and is proven compatible with `eslint@10`.
- [x] Replacement rules report at `error` severity for agent self-correction.
- [x] Any missing rule parity is explicitly documented with either an accepted replacement, a Safeword custom rule follow-up, or a conscious non-goal.

**Tests:**

- [x] Unit or integration: the updated React preset does not import or require `eslint-plugin-react`.
- [x] Unit or integration: ESLint 10 can load the updated React preset without `RuleContext` API crashes.
- [x] Integration: missing JSX keys are reported as errors.
- [x] Integration: direct state mutation is reported as an error.
- [x] Integration: unsafe target blank links are reported as errors.
- [x] Integration: unknown DOM properties are reported as errors.
- [x] Integration: current Safeword-only gaps such as duplicate JSX props and unescaped entities are either covered by replacement rules or captured as explicit follow-up work.

## Current Evidence

- Revalidated 2026-06-15 with `npm view`: `eslint-plugin-react@7.37.5` still declares peer support only through ESLint `^9.7`.
- Revalidated 2026-06-15 with `npm view`: `@eslint-react/eslint-plugin@5.9.0` is latest, peers on `eslint: "*"` and `typescript: "*"`, and exposes React, JSX, DOM, RSC, Web API, and naming-convention presets.
- `@eslint-react/eslint-plugin` requires Node `>=22.0.0`; Safeword already requires Node `>=22.12`, so this dependency does not lower customer compatibility.
- `eslint-plugin-react-hooks@7.1.1` still peers through ESLint `^10.0.0`, remains the official React Hooks/Compiler diagnostics package, and should stay.
- Next.js still documents the traditional React lint stack around `eslint-plugin-react`, `eslint-plugin-react-hooks`, and framework-specific rules; this is adoption friction, not a reason to keep Safeword blocked on the old plugin.
- Upstream ESLint 10 support for `eslint-plugin-react` is still tied to open work in `jsx-eslint/eslint-plugin-react#3979` and `import-js/eslint-plugin-import#3227`.

## Validated Rule Parity Matrix

| Current Safeword rule            | Replacement decision                                                 | Status                                                                 |
| -------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `react/jsx-key`                  | `@eslint-react/no-missing-key` plus `@eslint-react/no-duplicate-key` | Accepted replacement; both are behavior-tested at `error` severity.    |
| `react/jsx-no-duplicate-props`   | No `@eslint-react` equivalent exists                                 | Explicit parity gap; Safeword custom-rule follow-up if still required. |
| `react/no-direct-mutation-state` | `@eslint-react/no-direct-mutation-state`                             | Accepted replacement; behavior-tested at `error` severity.             |
| `react/no-children-prop`         | `@eslint-react/jsx-no-children-prop`                                 | Accepted replacement; behavior-tested at `error` severity.             |
| `react/jsx-no-target-blank`      | `@eslint-react/dom-no-unsafe-target-blank`                           | Accepted replacement; behavior-tested at `error` severity.             |
| `react/no-unknown-property`      | `@eslint-react/dom-no-unknown-property`                              | Accepted replacement; behavior-tested at `error` severity.             |
| `react/no-unescaped-entities`    | No `@eslint-react` equivalent exists                                 | Explicit parity gap; Safeword custom-rule follow-up if still required. |

`@eslint-react/no-implicit-key` remains a conscious non-goal for this migration because Safeword's old `react/jsx-key` config used default options and did not explicitly enforce implicit key spread patterns.

## Recommended Starting Approach

Pursue replacement, not permanent dual-path support: migrate Safeword's recommended React preset to `@eslint-react/eslint-plugin`, keep `eslint-plugin-react-hooks` where it remains the official and higher-value source of Hooks/Compiler diagnostics, and treat any uncovered old-plugin rules as explicit parity gaps to close or consciously drop.

## Work Log

- 2026-06-15T21:51:39Z Revalidated: Exact CI package test lane `TEST_POETRY=1 bun run --cwd packages/cli test` passed 198/198 test files and 2923/2923 tests in 1662.58s. Branch-local `sync-config --check` and `bun run deps` also pass; the published `safeword@latest` stale depcruise warning is tracked separately.
- 2026-06-15T21:13:00Z Review fix: Disabled overlapping `@eslint-react` hook/compiler diagnostics so `eslint-plugin-react-hooks` stays authoritative, normalized inherited `@eslint-react` warnings to errors, and added focused tests for both guarantees.
- 2026-06-15T20:48:00Z Verified: Focused React preset tests, related preset/schema tests, smoke-fast tests, BDD scenarios, build, typecheck, ESLint, markdown lint, Gherkin lint, and Prettier checks pass; full-suite and knip caveats recorded in `verify.md`.
- 2026-06-15T20:31:00Z Implemented: Replaced `eslint-plugin-react` with `@eslint-react/eslint-plugin`, kept `eslint-plugin-react-hooks`, added ESLint 10 alias coverage, and validated behavior-level React rule parity for load-bearing replacements.
- 2026-06-15T02:58:54Z Updated: Reframed ticket from dual-path exploration to replacing `eslint-plugin-react` with `@eslint-react/eslint-plugin`, with parity tests as the safety bar.
- 2026-06-15T02:54:30Z Found: `@eslint-react/eslint-plugin` is viable but semantically different; preserve the current default while prototyping an ESLint 10 path.
- 2026-06-15T02:54:20.170Z Started: Created ticket 71Q4DV
