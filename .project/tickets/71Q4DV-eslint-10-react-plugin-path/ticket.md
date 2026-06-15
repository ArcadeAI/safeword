---
id: 71Q4DV
slug: eslint-10-react-plugin-path
type: task
phase: intake
status: in_progress
created: 2026-06-15T02:54:20.170Z
last_modified: 2026-06-15T02:58:54Z
---

# Replace legacy React lint plugin with ESLint React

**Goal:** Replace Safeword's `eslint-plugin-react` dependency with the newer `@eslint-react/eslint-plugin` stack while preserving the agent-facing React guardrails customers rely on.

**Why:** `eslint-plugin-react` is the blocker for ESLint 10 and has a slower release path, while `@eslint-react/eslint-plugin` is active, ESLint 10-ready, and covers modern React surfaces including DOM, RSC, Web API, and React Compiler-style rules.

**Type:** Improvement

**Scope:** Build the migration plan and implementation for replacing Safeword's React preset usage of `eslint-plugin-react` with `@eslint-react/eslint-plugin`, including a rule parity matrix, package dependency changes, preset updates, and regression tests for every load-bearing agent-error rule.

**Out of Scope:** Waiting for upstream `eslint-plugin-react` ESLint 10 support, keeping a permanent dual React plugin path, or shipping weaker React guardrails just to finish the replacement. The ESLint 10 package bump itself may remain in ticket 099 if this ticket only removes the React-plugin blocker.

**Done When:**

- [ ] Safeword no longer depends on `eslint-plugin-react` for its recommended React preset.
- [ ] The recommendation includes a rule-by-rule parity matrix for current Safeword React error rules.
- [ ] The React preset uses `@eslint-react/eslint-plugin` and keeps `eslint-plugin-react-hooks` for official Hooks and React Compiler diagnostics unless evidence supports replacing those rules too.
- [ ] The updated React preset loads successfully with the current supported ESLint version and is proven compatible with `eslint@10`.
- [ ] Replacement rules report at `error` severity for agent self-correction.
- [ ] Any missing rule parity is explicitly documented with either an accepted replacement, a Safeword custom rule follow-up, or a conscious non-goal.

**Tests:**

- [ ] Unit or integration: the updated React preset does not import or require `eslint-plugin-react`.
- [ ] Unit or integration: ESLint 10 can load the updated React preset without `RuleContext` API crashes.
- [ ] Integration: missing JSX keys are reported as errors.
- [ ] Integration: direct state mutation is reported as an error.
- [ ] Integration: unsafe target blank links are reported as errors.
- [ ] Integration: unknown DOM properties are reported as errors.
- [ ] Integration: current Safeword-only gaps such as duplicate JSX props and unescaped entities are either covered by replacement rules or captured as explicit follow-up work.

## Current Evidence

- `eslint-plugin-react@7.37.5` still declares peer support only through ESLint `^9.7` and remains the mainstream React plugin by adoption.
- `@eslint-react/eslint-plugin@5.9.0` is active, ESLint 10-ready, and exposes React, JSX, DOM, RSC, Web API, and naming-convention presets.
- `@eslint-react/eslint-plugin` requires Node `>=22.0.0`, which affects Safeword's customer compatibility story.
- Next.js still documents the traditional React lint stack around `eslint-plugin-react`, `eslint-plugin-react-hooks`, and framework-specific rules; this is adoption friction, not a reason to keep Safeword blocked on the old plugin.
- Upstream ESLint 10 support for `eslint-plugin-react` is still tied to open work in `jsx-eslint/eslint-plugin-react#3979` and `import-js/eslint-plugin-import#3227`.

## Initial Rule Matrix

| Current Safeword rule            | Candidate `@eslint-react` replacement                                                             | Status               |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------- |
| `react/jsx-key`                  | `@eslint-react/no-missing-key`, `@eslint-react/no-duplicate-key`, `@eslint-react/no-implicit-key` | Needs behavior tests |
| `react/jsx-no-duplicate-props`   | No obvious direct equivalent found                                                                | Gap to resolve       |
| `react/no-direct-mutation-state` | `@eslint-react/no-direct-mutation-state`                                                          | Likely equivalent    |
| `react/no-children-prop`         | `@eslint-react/jsx-no-children-prop`                                                              | Likely equivalent    |
| `react/jsx-no-target-blank`      | `@eslint-react/dom-no-unsafe-target-blank`                                                        | Likely equivalent    |
| `react/no-unknown-property`      | `@eslint-react/dom-no-unknown-property`                                                           | Likely equivalent    |
| `react/no-unescaped-entities`    | No obvious direct equivalent found                                                                | Gap to resolve       |

## Recommended Starting Approach

Pursue replacement, not permanent dual-path support: migrate Safeword's recommended React preset to `@eslint-react/eslint-plugin`, keep `eslint-plugin-react-hooks` where it remains the official and higher-value source of Hooks/Compiler diagnostics, and treat any uncovered old-plugin rules as explicit parity gaps to close or consciously drop.

## Work Log

- 2026-06-15T02:58:54Z Updated: Reframed ticket from dual-path exploration to replacing `eslint-plugin-react` with `@eslint-react/eslint-plugin`, with parity tests as the safety bar.
- 2026-06-15T02:54:30Z Found: `@eslint-react/eslint-plugin` is viable but semantically different; preserve the current default while prototyping an ESLint 10 path.
- 2026-06-15T02:54:20.170Z Started: Created ticket 71Q4DV
