/**
 * Test Suite: Language Packs
 * Tests for pack registry, config tracking, and installation.
 *
 * Test Definitions: .safeword/planning/test-definitions/feature-language-packs.md
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getInstalledPacks, isPackInstalled } from '../../src/packs/config.js';
import { installPack } from '../../src/packs/install.js';
import { detectLanguages, findPackForExtension } from '../../src/packs/registry.js';
import {
  createPackageJson,
  createPythonProject,
  createRustProject,
  createTemporaryDirectory,
  initGitRepo,
  readSafewordConfig,
  readTestFile,
  removeTemporaryDirectory,
  writeSafewordConfig,
  writeTestFile,
} from '../helpers.js';

const fixture: { testDirectory: string } = { testDirectory: '' };

beforeEach(() => {
  fixture.testDirectory = createTemporaryDirectory();
});

afterEach(() => {
  if (fixture.testDirectory) {
    removeTemporaryDirectory(fixture.testDirectory);
  }
});

// =============================================================================
// Test Suite 1: Pack Registry (Unit Tests)
// =============================================================================

describe('Pack Registry', () => {
  it('Test 1.1: Maps file extensions to language packs', () => {
    // Python extensions → python pack
    const pyPack = findPackForExtension('.py');
    expect(pyPack).toBeDefined();
    expect(pyPack?.id).toBe('python');

    // TypeScript/JS extensions → typescript pack
    const tsPack = findPackForExtension('.ts');
    expect(tsPack).toBeDefined();
    expect(tsPack?.id).toBe('typescript');

    const tsxPack = findPackForExtension('.tsx');
    expect(tsxPack?.id).toBe('typescript');

    const jsPack = findPackForExtension('.js');
    expect(jsPack?.id).toBe('typescript');

    // Rust extensions → rust pack
    const rsPack = findPackForExtension('.rs');
    expect(rsPack).toBeDefined();
    expect(rsPack?.id).toBe('rust');

    // Unknown extensions → undefined
    const unknownPack = findPackForExtension('.xyz');
    expect(unknownPack).toBeUndefined();
  });

  it('Test 1.2: Detects languages from project markers', () => {
    // Create project with both Python and TypeScript markers
    createPythonProject(fixture.testDirectory);
    createPackageJson(fixture.testDirectory, {
      devDependencies: { typescript: '^5.0.0' },
    });

    const detected = detectLanguages(fixture.testDirectory);

    // Should detect both (order doesn't matter)
    expect(detected).toContain('python');
    expect(detected).toContain('typescript');
    expect(detected).toHaveLength(2);
  });

  it('Test 1.8: Detects Python from requirements.txt only', () => {
    writeTestFile(fixture.testDirectory, 'requirements.txt', 'flask>=3.0\n');

    const detected = detectLanguages(fixture.testDirectory);

    expect(detected).toContain('python');
  });

  it('Test 1.6: Detects Rust from Cargo.toml', () => {
    createRustProject(fixture.testDirectory);

    const detected = detectLanguages(fixture.testDirectory);

    expect(detected).toContain('rust');
    expect(detected).toHaveLength(1);
  });

  it('Test 1.7: Detects multiple languages including Rust', () => {
    // Create project with TypeScript AND Rust
    createPackageJson(fixture.testDirectory, {
      devDependencies: { typescript: '^5.0.0' },
    });
    createRustProject(fixture.testDirectory);

    const detected = detectLanguages(fixture.testDirectory);

    expect(detected).toContain('typescript');
    expect(detected).toContain('rust');
    expect(detected).toHaveLength(2);
  });
});

// =============================================================================
// Test Suite 2: Config Tracking (Unit Tests)
// =============================================================================

describe('Config Tracking', () => {
  it('Test 1.3: Reads installed packs from config', () => {
    // Empty config → empty array
    writeSafewordConfig(fixture.testDirectory, { installedPacks: [] });
    expect(getInstalledPacks(fixture.testDirectory)).toEqual([]);
    expect(isPackInstalled(fixture.testDirectory, 'python')).toBe(false);

    // With installed pack
    writeSafewordConfig(fixture.testDirectory, { installedPacks: ['python'] });
    expect(getInstalledPacks(fixture.testDirectory)).toEqual(['python']);
    expect(isPackInstalled(fixture.testDirectory, 'python')).toBe(true);
    expect(isPackInstalled(fixture.testDirectory, 'go')).toBe(false);
  });
});

// =============================================================================
// Test Suite 3: Pack Installation (Unit Tests)
// =============================================================================

describe('Pack Installation', () => {
  it('Test 1.4: Installs pack and updates config', () => {
    createPythonProject(fixture.testDirectory);
    initGitRepo(fixture.testDirectory);
    writeSafewordConfig(fixture.testDirectory, { installedPacks: [] });

    installPack('python', fixture.testDirectory);

    // Config updated
    const config = readSafewordConfig(fixture.testDirectory);
    expect(config.installedPacks).toContain('python');

    // Pack setup ran - setupPythonTooling now returns empty (reconciliation handles files)
    // Just verify the pack was registered
    expect(config.installedPacks).toContain('python');
  });

  it('Test 1.5: Skips already-installed packs', () => {
    createPythonProject(fixture.testDirectory);
    initGitRepo(fixture.testDirectory);
    writeSafewordConfig(fixture.testDirectory, { installedPacks: ['python'] });
    const initialPyproject = readTestFile(fixture.testDirectory, 'pyproject.toml');

    installPack('python', fixture.testDirectory);

    // Config unchanged
    const config = readSafewordConfig(fixture.testDirectory);
    expect(config.installedPacks).toEqual(['python']);

    // Setup not called (pyproject unchanged)
    expect(readTestFile(fixture.testDirectory, 'pyproject.toml')).toBe(initialPyproject);
  });

  it('Test 1.6: Fresh install writes config without `version` field (ticket 154)', () => {
    createPythonProject(fixture.testDirectory);
    initGitRepo(fixture.testDirectory);

    installPack('python', fixture.testDirectory);

    // Read raw JSON — the `version` key must not exist on disk
    const raw = JSON.parse(readTestFile(fixture.testDirectory, '.safeword/config.json')) as Record<
      string,
      unknown
    >;
    expect(raw.installedPacks).toEqual(['python']);
    expect('version' in raw).toBe(false);
  });
});
