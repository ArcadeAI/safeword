/**
 * Python Language Pack - Schema Definitions
 *
 * All Python-specific file definitions and config generators.
 * Imported by schema.ts and spread into SAFEWORD_SCHEMA.
 *
 * Mirrors the structure of typescript/files.ts and golang/files.ts for consistency.
 *
 * Note: Generator functions return `string | undefined` by design (undefined = skip file).
 * This conflicts with sonarjs/no-inconsistent-returns vs unicorn/no-useless-undefined (#1199).
 * Inline disables target only generator arrow functions, not regular functions in this file.
 */

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { FileDefinition, ManagedFileDefinition } from '../types.js';
import { detectPythonLayers, detectRootPackage } from './setup.js';

/**
 * Detect a pre-138 legacy ruff.toml layout where the customer's project-level
 * ruff.toml extends `.safeword/ruff.toml`. In that case, making `.safeword/ruff.toml`
 * also extend `../ruff.toml` would create a circular configuration (ruff errors).
 *
 * We keep those projects on the old standalone shape until the customer migrates
 * by removing the `extend = ".safeword/ruff.toml"` line from their ruff.toml.
 */
function hasLegacyCustomerRuffExtend(cwd: string): boolean {
  const ruffPath = nodePath.join(cwd, 'ruff.toml');
  if (!existsSync(ruffPath)) return false;
  try {
    const content = readFileSync(ruffPath, 'utf8');
    return content.includes('extend = ".safeword/ruff.toml"');
  } catch {
    return false;
  }
}

// ============================================================================
// Shared Ruff Configuration
// ============================================================================

/**
 * Curated rule set — covers correctness, security, and modern Python
 * without the upgrade-breakage and noise of select = ["ALL"].
 *
 * See: https://docs.astral.sh/ruff/linter/ (ruff maintainers discourage ALL)
 */
const SAFEWORD_RULES = [
  '"E"', // pycodestyle errors
  '"F"', // Pyflakes
  '"W"', // pycodestyle warnings
  '"I"', // isort
  '"UP"', // pyupgrade
  '"B"', // flake8-bugbear
  '"SIM"', // flake8-simplify
  '"C4"', // flake8-comprehensions
  '"RUF"', // ruff-specific rules
  '"PTH"', // pathlib enforcement
  '"RET"', // return statement checks
  '"S"', // bandit security
  '"T20"', // print statement detection
  '"TC"', // type-checking imports
  '"ERA"', // commented-out code (LLMs leave dead comments)
  '"PERF"', // performance anti-patterns
  '"PLE"', // pylint errors
  '"PLW"', // pylint warnings
].join(', ');

const RUFF_SHARED_SETTINGS = `ignore = [
    "COM812", # missing trailing comma - conflicts with formatter
    "ISC001", # single-line-implicit-string-concatenation - conflicts with formatter
    "E501",   # line too long - formatter handles this
]

[lint.per-file-ignores]
"tests/**" = ["S101"]  # allow assert in tests

[lint.mccabe]
max-complexity = 10`;

/**
 * Standalone lint rules — used in legacy mode (pre-138 customers whose
 * ruff.toml contains `extend = ".safeword/ruff.toml"`). Defines the full
 * baseline via `select`. Kept to avoid circular extends until the customer
 * migrates by removing that line.
 */
const RUFF_LINT_STANDALONE = `[lint]
select = [${SAFEWORD_RULES}]
${RUFF_SHARED_SETTINGS}`;

/**
 * Additive lint rules — used in `.safeword/ruff.toml` in unified mode (ticket 138),
 * which extends the project-level `ruff.toml`. Uses `extend-select` so customer's
 * `select` is preserved.
 */
const RUFF_LINT_ADDITIVE = `[lint]
extend-select = [${SAFEWORD_RULES}]
${RUFF_SHARED_SETTINGS}`;

// ============================================================================
// Config Generators for .safeword/ (ownedFiles)
// ============================================================================

/**
 * Generate Ruff configuration for .safeword/ruff.toml.
 *
 * If project has existing ruff config, extends it with stricter rules.
 * Otherwise generates standalone config.
 *
 * Used by hooks via --config .safeword/ruff.toml flag.
 *
 * @param existingRuffConfig - Path to existing config ('ruff.toml' or 'pyproject.toml'), or undefined
 */
function generateRuffBaseConfig(
  cwd: string,
  existingRuffConfig: 'ruff.toml' | 'pyproject.toml' | undefined = 'ruff.toml',
): string {
  // Ticket 138 migration: if customer's ruff.toml still contains the pre-138
  // line `extend = ".safeword/ruff.toml"`, extending customer back would create
  // a circular configuration (ruff errors). Fall back to legacy standalone mode
  // for those projects until the customer removes that line.
  if (hasLegacyCustomerRuffExtend(cwd)) {
    return `# Safeword Ruff config — LEGACY standalone mode
# Your project's ruff.toml still extends this file (pre-138 layout). To enable
# the unified override contract (your rules win in the LLM hook too), remove
# the line \`extend = ".safeword/ruff.toml"\` from your ruff.toml and re-run
# \`safeword upgrade\`.

line-length = 100

${RUFF_LINT_STANDALONE}
`;
  }

  // Unified (ticket 138): always extend from a project-level ruff config.
  // - If customer had pre-existing config (ruff.toml or [tool.ruff] in pyproject.toml), extend that file.
  // - If not, safeword generates a bare project-level ruff.toml (see generateProjectRuffConfig) — extend it.
  // This makes the LLM hook consistently honor customer overrides via ruff's native `extend`.
  return `# Safeword Ruff config - adds rules on top of project config
# Used by hooks for LLM enforcement. Human pre-commits use project config.
# Re-run \`safeword upgrade\` to regenerate after project config changes.
#
# NOTE: Uses extend-select (additive) so your select/ignore are preserved.
# Known edge case: ruff may drop parent ignore rules when child uses
# extend-select (https://github.com/astral-sh/ruff/issues/10622).
# If a project ignore stops working, duplicate it in this file.

# Inherit from project's ${existingRuffConfig}
extend = "../${existingRuffConfig}"

line-length = 100

${RUFF_LINT_ADDITIVE}
`;
}

// ============================================================================
// Owned Files (overwritten on upgrade)
// ============================================================================

/**
 * Python owned files for .safeword/ directory.
 * These are overwritten on upgrade if content changed.
 */
export const pythonOwnedFiles: Record<string, FileDefinition> = {
  // Ruff config for hooks (extends project config if exists)
  '.safeword/ruff.toml': {
    generator: ctx =>
      ctx.languages?.python
        ? generateRuffBaseConfig(ctx.cwd, ctx.projectType.existingRuffConfig)
        : undefined,
  },
};

// ============================================================================
// Config Generators for project root (managedFiles)
// ============================================================================

/**
 * Generate a bare project-level ruff.toml (ticket 138).
 *
 * Customer-owned from the moment it's created: safeword never overwrites it.
 * The LLM hook's `.safeword/ruff.toml` extends this file via ruff's native
 * `extend` directive, so anything the customer adds here wins in both human
 * and LLM lint runs.
 */
function generateProjectRuffConfig(): string {
  return `# Your project's Ruff config — customer-owned, safe to edit.
# Your rules take precedence in the LLM hook (via .safeword/ruff.toml's extend).
#
# Add your rules below, e.g.:
# [lint]
# select = ["E", "F"]
# ignore = ["E501"]
`;
}

/**
 * Generate standalone mypy.ini for project root.
 * Strict config for LLM agents - enforces type annotations.
 */
function generateProjectMypyConfig(): string {
  return `# Generated by safeword
# Strict config for LLM agents - type annotations enforced.

[mypy]
strict = True
warn_unreachable = True
ignore_missing_imports = True
show_error_codes = True
pretty = True
`;
}

/**
 * Generate standalone .importlinter for project root.
 *
 * @param layers - Detected layers (e.g., ['domain', 'services', 'api'])
 * @param rootPackage - Root package name for the project
 */
function generateProjectImportLinterConfig(layers: string[], rootPackage: string): string {
  if (layers.length < 2) return '';

  const layerList = layers.map(l => `    ${rootPackage}.${l}`).join('\n');

  return `# Generated by safeword
# Layer architecture contracts - enforces clean dependencies

[importlinter]
root_packages = ${rootPackage}

[importlinter:contract:layers]
name = Layer architecture
type = layers
layers =
${layerList}
`;
}

// ============================================================================
// Managed Files (create if missing, reconciled on reset/upgrade)
// ============================================================================

export const pythonManagedFiles: Record<string, ManagedFileDefinition> = {
  // Project-level ruff config (created only if no existing ruff config)
  'ruff.toml': {
    generator: ctx =>
      ctx.languages?.python && !ctx.projectType.existingRuffConfig
        ? generateProjectRuffConfig()
        : undefined,
  },

  // Project-level mypy config (created only if no existing mypy config)
  'mypy.ini': {
    generator: ctx =>
      ctx.languages?.python && !ctx.projectType.existingMypyConfig
        ? generateProjectMypyConfig()
        : undefined,
  },

  // Project-level import-linter config (created only if layers detected and no existing config)
  '.importlinter': {
    // eslint-disable-next-line sonarjs/no-inconsistent-returns -- generator returns undefined to skip file
    generator: ctx => {
      if (!ctx.languages?.python) return;
      if (ctx.projectType.existingImportLinterConfig) return;

      // Detect layers - need at least 2 for boundary enforcement
      const layers = detectPythonLayers(ctx.cwd);
      if (layers.length < 2) return;

      const rootPackage = detectRootPackage(ctx.cwd);
      return generateProjectImportLinterConfig(layers, rootPackage);
    },
  },
};
