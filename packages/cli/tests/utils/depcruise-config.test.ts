/**
 * Test Suite: DepCruise Config Generator
 *
 * Tests for generating dependency-cruiser configuration from detected architecture.
 * See: .safeword/planning/test-definitions/feature-architecture-audit.md
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  detectWorkspaces,
  generateDependencyCruiseConfigFile,
  generateDependencyCruiseMainConfig,
} from '../../src/utils/depcruise-config.js';
import { removeTemporaryDirectory } from '../helpers.js';

describe('DepCruise Config Generator', () => {
  describe('generateDependencyCruiseConfigFile', () => {
    it('generates circular dependency rule', () => {
      // Test 1.1: Config always includes no-circular rule regardless of architecture
      const config = generateDependencyCruiseConfigFile({
        elements: [],
        isMonorepo: false,
      });

      // Should contain module.exports with forbidden array
      expect(config).toContain('module.exports');
      expect(config).toContain('forbidden');

      // Should contain no-circular rule
      expect(config).toContain("name: 'no-circular'");
      expect(config).toContain("severity: 'error'");
      expect(config).toContain('circular: true');

      // Type-only edges are erased at compile time and cannot cause runtime cycles —
      // the rule must scope to runtime edges only, per dependency-cruiser's documented
      // pattern. See https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
      expect(config).toContain("viaOnly: { dependencyTypesNot: ['type-only'] }");
    });

    it('generates monorepo layer rules from workspaces', () => {
      // Test 1.2: Detects workspaces and generates hierarchy rules
      const config = generateDependencyCruiseConfigFile({
        elements: [],
        isMonorepo: true,
        workspaces: ['packages/*', 'apps/*', 'libs/*'],
      });

      // libs cannot import packages or apps
      expect(config).toContain("name: 'libs-cannot-import-packages-or-apps'");
      expect(config).toContain("from: { path: '^libs/' }");
      expect(config).toContain("to: { path: '^(packages|apps)/' }");

      // packages cannot import apps
      expect(config).toContain("name: 'packages-cannot-import-apps'");
      expect(config).toContain("from: { path: '^packages/' }");
      expect(config).toContain("to: { path: '^apps/' }");
    });

    it('generates orphan detection rule with comprehensive exclusions', () => {
      const config = generateDependencyCruiseConfigFile({
        elements: [],
        isMonorepo: false,
      });

      expect(config).toContain("name: 'no-orphans'");
      expect(config).toContain("severity: 'warn'");
      expect(config).toContain('orphan: true');

      // Should exclude common entry points and framework patterns
      expect(config).toContain(String.raw`index\\.[tj]sx?$`);
      expect(config).toContain(String.raw`cli\\.[tj]s$`);
      expect(config).toContain(String.raw`cucumber\\.mjs$`);
      expect(config).toContain('/src/pages/');
      expect(config).toContain('/src/content/');
      expect(config).toContain('/__tests__/');
    });

    it('generates no-deprecated-deps rule', () => {
      const config = generateDependencyCruiseConfigFile({
        elements: [],
        isMonorepo: false,
      });

      expect(config).toContain("name: 'no-deprecated-deps'");
      expect(config).toContain("severity: 'error'");
      expect(config).toContain("dependencyTypes: ['deprecated']");
    });

    it('generates no-dev-deps-in-src rule as warning', () => {
      const config = generateDependencyCruiseConfigFile({
        elements: [],
        isMonorepo: false,
      });

      expect(config).toContain("name: 'no-dev-deps-in-src'");
      expect(config).toContain("severity: 'warn'");
      expect(config).toContain("dependencyTypes: ['npm-dev']");
      // Should exclude test files
      expect(config).toContain('pathNot');
      expect(config).toContain(String.raw`.test\\.[tj]sx?$`);
    });

    it('includes doNotFollow for node_modules and .safeword', () => {
      const config = generateDependencyCruiseConfigFile({
        elements: [],
        isMonorepo: false,
      });

      expect(config).toContain('doNotFollow');
      expect(config).toContain('node_modules');
      expect(config).toContain('.safeword');
    });

    it('includes exclude patterns for build artifacts', () => {
      const config = generateDependencyCruiseConfigFile({
        elements: [],
        isMonorepo: false,
      });

      expect(config).toContain('exclude');
      expect(config).toContain('dist');
      expect(config).toContain('build');
      expect(config).toContain('coverage');
      // Also excludes TypeScript declaration files (regex pattern)
      expect(config).toContain('ts$');
    });

    it('enables TypeScript pre-compilation deps analysis', () => {
      const config = generateDependencyCruiseConfigFile({
        elements: [],
        isMonorepo: false,
      });

      expect(config).toContain('tsPreCompilationDeps: true');
    });

    it('configures modern module resolution options', () => {
      const config = generateDependencyCruiseConfigFile({
        elements: [],
        isMonorepo: false,
      });

      expect(config).toContain('exportsFields');
      expect(config).toContain('conditionNames');
      expect(config).toContain('import');
      expect(config).toContain('require');
    });
  });

  describe('generateDependencyCruiseMainConfig', () => {
    it('generates main config that imports generated', () => {
      // Test 1.4: Main config imports and spreads generated rules
      const config = generateDependencyCruiseMainConfig();

      // Imports from .safeword
      expect(config).toContain('./.safeword/depcruise-config.cjs');

      // Spreads generated
      expect(config).toContain('...generated.forbidden');
      expect(config).toContain('...generated.options');

      // Has comment for customization
      expect(config).toContain('ADD YOUR CUSTOM RULES');
    });
  });
});

describe('detectWorkspaces', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = nodePath.join(tmpdir(), `depcruise-test-${Date.now()}`);
    mkdirSync(temporaryDirectory, { recursive: true });
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  it('returns undefined when no package.json exists', () => {
    const workspaces = detectWorkspaces(temporaryDirectory);
    expect(workspaces).toBeUndefined();
  });

  it('returns undefined when package.json has no workspaces', () => {
    writeFileSync(
      nodePath.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' }),
    );

    const workspaces = detectWorkspaces(temporaryDirectory);
    expect(workspaces).toBeUndefined();
  });

  it('detects workspaces from array format', () => {
    writeFileSync(
      nodePath.join(temporaryDirectory, 'package.json'),
      JSON.stringify({
        name: 'test',
        workspaces: ['packages/*', 'apps/*', 'libs/*'],
      }),
    );

    const workspaces = detectWorkspaces(temporaryDirectory);
    expect(workspaces).toEqual(['packages/*', 'apps/*', 'libs/*']);
  });

  it('detects workspaces from object format (yarn)', () => {
    writeFileSync(
      nodePath.join(temporaryDirectory, 'package.json'),
      JSON.stringify({
        name: 'test',
        workspaces: { packages: ['packages/*', 'tools/*'] },
      }),
    );

    const workspaces = detectWorkspaces(temporaryDirectory);
    expect(workspaces).toEqual(['packages/*', 'tools/*']);
  });

  it('returns undefined for empty workspaces array', () => {
    writeFileSync(
      nodePath.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ name: 'test', workspaces: [] }),
    );

    const workspaces = detectWorkspaces(temporaryDirectory);
    expect(workspaces).toBeUndefined();
  });
});
