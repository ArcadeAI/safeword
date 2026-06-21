/**
 * Recommended ESLint configuration for React + TypeScript + LLM coding agents
 *
 * Extends the TypeScript config with React-specific rules:
 * - @eslint-react/eslint-plugin: React, JSX, DOM, RSC, and Web API rules
 * - eslint-plugin-react-hooks 7.x: Hook rules + React Compiler diagnostics
 * - eslint-plugin-jsx-a11y: Accessibility rules (strict preset)
 *
 * Philosophy: LLMs make React-specific mistakes. These rules catch them.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ESLint config types are incompatible across plugin packages */

import eslintReactPlugin from '@eslint-react/eslint-plugin';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooksPluginImport from 'eslint-plugin-react-hooks';

// Type assertion - react-hooks 7.x exports configs but types don't declare it
const reactHooksPlugin = reactHooksPluginImport as unknown as {
  configs?: { flat?: { 'recommended-latest'?: any } };
};

const eslintReactConfig = eslintReactPlugin as unknown as {
  configs?: {
    'recommended-typescript'?: any;
  };
};

import { recommendedTypeScript } from './recommended-typescript.js';

// Runtime validation - ensure react-hooks 7.x with flat config support
const reactHooksConfig = reactHooksPlugin.configs?.flat?.['recommended-latest'];
if (!reactHooksConfig) {
  throw new Error(
    'safeword requires eslint-plugin-react-hooks >= 7.0.0 with flat config support. ' +
      'Please upgrade react-hooks: npm install eslint-plugin-react-hooks@latest',
  );
}

const eslintReactRecommendedTypeScriptConfig =
  eslintReactConfig.configs?.['recommended-typescript'];
if (!eslintReactRecommendedTypeScriptConfig) {
  throw new Error(
    'safeword requires @eslint-react/eslint-plugin with recommended-typescript flat config support. ' +
      'Please upgrade ESLint React: npm install @eslint-react/eslint-plugin@latest',
  );
}

const ESLINT_REACT_HOOK_COMPILER_RULES = [
  '@eslint-react/error-boundaries',
  '@eslint-react/exhaustive-deps',
  '@eslint-react/purity',
  '@eslint-react/rules-of-hooks',
  '@eslint-react/set-state-in-effect',
  '@eslint-react/set-state-in-render',
  '@eslint-react/static-components',
  '@eslint-react/unsupported-syntax',
  '@eslint-react/use-memo',
] as const;

function withSeverity(ruleConfig: unknown, severity: 'error' | 'off'): unknown {
  if (Array.isArray(ruleConfig)) return [severity, ...ruleConfig.slice(1)];
  return severity;
}

function normalizeEslintReactRulesToError(config: { rules?: Record<string, unknown> }) {
  const overrides: Record<string, unknown> = {};

  const ruleEntries = Object.entries(config.rules ?? {});
  for (const [ruleId, ruleConfig] of ruleEntries) {
    if (ruleId.startsWith('@eslint-react/')) {
      overrides[ruleId] = withSeverity(ruleConfig, 'error');
    }
  }

  return overrides;
}

const eslintReactRuleOverrides = {
  ...normalizeEslintReactRulesToError(eslintReactRecommendedTypeScriptConfig),

  // Keep eslint-plugin-react-hooks as the only source for Hooks and Compiler diagnostics.
  ...Object.fromEntries(ESLINT_REACT_HOOK_COMPILER_RULES.map(ruleId => [ruleId, 'off'])),

  // Load-bearing React guardrails retained from the legacy react/* migration.
  '@eslint-react/no-missing-key': 'error', // LLMs forget keys in map()
  '@eslint-react/no-duplicate-key': 'error', // Replaces the duplicate-key coverage in jsx-key
  '@eslint-react/no-direct-mutation-state': 'error', // Critical React bug
  '@eslint-react/jsx-no-children-prop': 'error', // Anti-pattern
  '@eslint-react/dom-no-unsafe-target-blank': 'error', // Security
  '@eslint-react/dom-no-unknown-property': 'error', // class -> className, has autofix
};

/**
 * React + TypeScript recommended config
 *
 * Extends TypeScript config with React-specific rules for catching
 * common LLM mistakes: missing keys, hook violations, stale closures.
 *
 * Uses @eslint-react for React/JSX/DOM rules, while retaining the official
 * eslint-plugin-react-hooks rules for Hooks and React Compiler diagnostics.
 *
 * Includes React Compiler rules (v7.x) for detecting purity violations,
 * improper memoization, and other compiler-incompatible patterns.
 */
export const recommendedTypeScriptReact: any[] = [
  // All TypeScript rules (includes base plugins)
  ...recommendedTypeScript,

  // React, JSX, DOM, RSC, and Web API rules
  eslintReactRecommendedTypeScriptConfig,

  // React Hooks + Compiler rules (v7.x flat config)
  // Using recommended-latest which includes void-use-memo
  reactHooksConfig,

  // Accessibility rules - strict preset (all at error level)
  jsxA11y.flatConfigs.strict,

  // Escalate warn rules to error + add LLM-critical rules
  {
    name: 'safeword/react-hooks-rules',
    rules: {
      // Escalate default warns to error (LLMs ignore warnings)
      'react-hooks/exhaustive-deps': 'error', // Default: warn
      'react-hooks/incompatible-library': 'error', // Default: warn
      'react-hooks/unsupported-syntax': 'error', // Default: warn

      // LLM-critical rules NOT in recommended-latest preset
      'react-hooks/memoized-effect-dependencies': 'error', // LLMs create unstable refs as deps
      'react-hooks/no-deriving-state-in-effects': 'error', // LLMs derive state in useEffect
    },
  },

  // React rule overrides for TypeScript projects
  {
    name: 'safeword/react-rules',
    rules: eslintReactRuleOverrides,
  },
];
