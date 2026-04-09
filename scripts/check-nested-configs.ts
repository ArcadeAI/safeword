#!/usr/bin/env bun
/**
 * Check for nested config files in packages/
 *
 * Derives patterns from SAFEWORD_SCHEMA to stay in sync with what safeword creates.
 * Used by pre-commit hook to prevent accidental commits of misplaced configs.
 *
 * Exit codes:
 *   0 - No nested configs found
 *   1 - Nested configs found (prints paths and fix command)
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';

// Get safeword-specific patterns that indicate wrong-directory setup
// These are directories and files that safeword creates at project root
// but should NEVER exist nested in packages/
function extractPatterns(): Set<string> {
  const patterns = new Set<string>();

  // Directories owned by safeword (top-level only)
  // .safeword, .cursor from ownedDirs
  for (const dir of SAFEWORD_SCHEMA.ownedDirs) {
    const topLevel = dir.split('/')[0];
    if (topLevel) patterns.add(topLevel);
  }

  // Directories shared with other tools
  // .claude from sharedDirs
  for (const dir of SAFEWORD_SCHEMA.sharedDirs) {
    const topLevel = dir.split('/')[0];
    if (topLevel) patterns.add(topLevel);
  }

  // Preserved directories (user data)
  // .safeword-project from preservedDirs
  for (const dir of SAFEWORD_SCHEMA.preservedDirs) {
    const topLevel = dir.split('/')[0];
    if (topLevel) patterns.add(topLevel);
  }

  // Root-level owned files (not in .safeword/)
  // .jscpd.json
  for (const file of Object.keys(SAFEWORD_SCHEMA.ownedFiles)) {
    // Only top-level files, not those inside .safeword/
    if (!file.includes('/')) {
      patterns.add(file);
    }
  }

  // Root-level JSON merges - only safeword-specific ones
  // .mcp.json is safeword-specific
  // package.json, .prettierrc, biome.json are standard JS/TS files that packages should have
  const STANDARD_JS_FILES = new Set(['package.json', '.prettierrc', 'biome.json', 'biome.jsonc']);
  for (const file of Object.keys(SAFEWORD_SCHEMA.jsonMerges)) {
    if (!file.includes('/') && !STANDARD_JS_FILES.has(file)) {
      patterns.add(file);
    }
  }

  // Text patches (files at root)
  // AGENTS.md, CLAUDE.md — but not standard files like .gitignore
  const STANDARD_ROOT_FILES = new Set(['.gitignore']);
  for (const file of Object.keys(SAFEWORD_SCHEMA.textPatches)) {
    if (!STANDARD_ROOT_FILES.has(file)) {
      patterns.add(file);
    }
  }

  // NOTE: We intentionally exclude managedFiles like tsconfig.json, eslint.config.mjs,
  // package.json, etc. because those are SUPPOSED to exist in packages.
  // We only care about safeword-specific directories and root-level configs.

  // Extra patterns not in schema but in .gitignore (created by other tools)
  patterns.add('ARCHITECTURE.md');

  return patterns;
}

// Find nested configs in packages/*/
function findNestedConfigs(packagesDir: string, patterns: Set<string>): string[] {
  const found: string[] = [];

  if (!existsSync(packagesDir)) {
    return found;
  }

  // Get all package directories
  const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  for (const pkg of packageDirs) {
    const pkgPath = nodePath.join(packagesDir, pkg);

    // Check for each pattern
    for (const pattern of patterns) {
      const targetPath = nodePath.join(pkgPath, pattern);
      if (existsSync(targetPath)) {
        found.push(targetPath);
      }
    }

    // Also check for .dependency-cruiser* (glob pattern)
    try {
      const entries = readdirSync(pkgPath);
      for (const entry of entries) {
        if (entry.startsWith('.dependency-cruiser')) {
          found.push(nodePath.join(pkgPath, entry));
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return found;
}

// Main
const patterns = extractPatterns();
const packagesDir = nodePath.join(process.cwd(), 'packages');
const found = findNestedConfigs(packagesDir, patterns);

if (found.length > 0) {
  console.error('ERROR: Found nested config files in packages/');
  for (const path of found) {
    console.error(`  ${path}`);
  }
  console.error('');
  console.error('This happens when tools run from the wrong directory.');
  console.error(`Fix: rm -rf ${found.join(' ')}`);
  process.exit(1);
}

// Success - no nested configs
process.exit(0);
