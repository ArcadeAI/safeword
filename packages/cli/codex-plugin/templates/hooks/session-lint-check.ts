#!/usr/bin/env bun
// Safeword: Lint configuration sync check (SessionStart)
// Warns if ESLint or Prettier configs are missing or out of sync

import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

import {
  detectAlternativeFormatter,
  shouldWarnMissingEslint,
  shouldWarnMissingPrettier,
} from './lib/lint-config.ts';
import { BIOME_CONFIG_FILES, resolveHostToolchain } from './lib/host-toolchain.ts';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const safewordDir = `${projectDir}/.safeword`;

// Not a safeword project, skip silently
if (!existsSync(safewordDir)) {
  process.exit(0);
}

const warnings: string[] = [];

// List the project dir once; detect config presence by filename prefix so new
// eslint/prettier config extensions are covered without enumerating each.
const entries = (() => {
  try {
    return readdirSync(projectDir);
  } catch {
    return [];
  }
})();

const ownsAlternativeFormatter = detectAlternativeFormatter(entries);
// Biome/ultracite lint through the host toolchain, so ESLint is the fallback
// for repos without one — not a requirement (#3792). Formatting and linting
// have separate owners: dprint/oxfmt/deno format only, and still want ESLint.
const hostLintConfig = BIOME_CONFIG_FILES.find(name => entries.includes(name));
const hostToolchain = hostLintConfig
  ? resolveHostToolchain(nodePath.join(projectDir, hostLintConfig), projectDir)
  : undefined;

if (shouldWarnMissingEslint(entries)) {
  warnings.push("ESLint config not found - run 'bun run lint' may fail");
}

// Skip Prettier warnings when a non-Prettier formatter owns the repo (V7GGJZ):
// a Biome/dprint/oxfmt/deno shop deliberately doesn't use Prettier.
if (shouldWarnMissingPrettier(entries)) {
  warnings.push('Prettier config not found - formatting may be inconsistent');
}

if (hostToolchain?.kind === 'unavailable') {
  const owner = hostToolchain.owner === 'biome' ? 'Biome' : 'Ultracite';
  warnings.push(
    `${owner} config found, but no project-local executable is available - install project dependencies`,
  );
} else if (hostToolchain?.kind === 'outside-root') {
  warnings.push('Biome config resolves outside the project root, so safeword will not run it');
}

// Check for required dependencies in package.json
const pkgJsonFile = Bun.file(`${projectDir}/package.json`);
if (await pkgJsonFile.exists()) {
  try {
    const pkgJson = await pkgJsonFile.text();
    if (hostLintConfig === undefined && !pkgJson.includes('"eslint"')) {
      warnings.push("ESLint not in package.json - run 'bun add -D eslint'");
    }
    if (!ownsAlternativeFormatter && !pkgJson.includes('"prettier"')) {
      warnings.push("Prettier not in package.json - run 'bun add -D prettier'");
    }
  } catch (error) {
    if (process.env.DEBUG) console.error('[session-lint-check] package.json parse error:', error);
  }
}

// Output warnings if any
if (warnings.length > 0) {
  console.log(
    "Heads-up: your code-style tools aren't fully set up, so safeword's automatic checks may not run:",
  );
  for (const warning of warnings) {
    console.log(`  ⚠️  ${warning}`);
  }
}
