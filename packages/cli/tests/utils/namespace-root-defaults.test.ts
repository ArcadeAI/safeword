/**
 * Default-subpath derivation tests (ticket TAGWZ8, epic AQJ95G).
 *
 * Personas/glossary/architecture defaults derive from the resolved namespace
 * root (`resolveNamespaceRoot`), and per-file `paths.*` overrides keep winning
 * over the derived default. Surface inventory is part of that same project
 * knowledge set. Precedence itself lives in namespace-root.test.ts.
 *
 * Scenario lineage: namespace-root-resolver.DEV1.AC1.*, DEV2.AC2.*
 * (test-definitions.md in the ticket folder).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveConfiguredPath } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

function writeConfig(cwd: string, config: Record<string, unknown>): void {
  const directory = nodePath.join(cwd, '.safeword');
  mkdirSync(directory, { recursive: true });
  writeFileSync(nodePath.join(directory, 'config.json'), JSON.stringify(config, undefined, 2));
}

describe('resolveConfiguredPath — defaults derive from the resolved root (TAGWZ8)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
    mkdirSync(nodePath.join(cwd, '.project'));
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('DEV1.AC1.personas_default_derives_from_root', () => {
    expect(resolveConfiguredPath(cwd, 'personas')).toBe(
      nodePath.join(cwd, '.project', 'personas.md'),
    );
  });

  it('DEV1.AC1.glossary_default_derives_from_root', () => {
    expect(resolveConfiguredPath(cwd, 'glossary')).toBe(
      nodePath.join(cwd, '.project', 'glossary.md'),
    );
  });

  it('DEV1.AC1.architecture_default_derives_from_root', () => {
    expect(resolveConfiguredPath(cwd, 'architecture')).toBe(
      nodePath.join(cwd, '.project', 'architecture.md'),
    );
  });

  it('DEV1.AC1.surfaces_default_derives_from_root', () => {
    expect(resolveConfiguredPath(cwd, 'surfaces')).toBe(
      nodePath.join(cwd, '.project', 'surfaces.md'),
    );
  });

  it('DEV2.AC2.per_file_override_wins_for_its_file', () => {
    writeConfig(cwd, { installedPacks: [], paths: { personas: 'team/people.md' } });

    expect(resolveConfiguredPath(cwd, 'personas')).toBe(nodePath.join(cwd, 'team', 'people.md'));
  });

  it('DEV2.AC2.surfaces_override_wins_for_surfaces_file', () => {
    writeConfig(cwd, { installedPacks: [], paths: { surfaces: 'docs/product-surfaces.md' } });

    expect(resolveConfiguredPath(cwd, 'surfaces')).toBe(
      nodePath.join(cwd, 'docs', 'product-surfaces.md'),
    );
  });

  it('DEV2.AC2.unset_per_file_falls_back_to_root', () => {
    writeConfig(cwd, { installedPacks: [], paths: { personas: 'team/people.md' } });

    expect(resolveConfiguredPath(cwd, 'glossary')).toBe(
      nodePath.join(cwd, '.project', 'glossary.md'),
    );
  });

  it('legacy root derives legacy defaults (regression guard)', () => {
    // A legacy-only project keeps reading .safeword-project/<file>.md.
    const legacyCwd = createTemporaryDirectory();
    try {
      mkdirSync(nodePath.join(legacyCwd, '.safeword-project'));

      expect(resolveConfiguredPath(legacyCwd, 'personas')).toBe(
        nodePath.join(legacyCwd, '.safeword-project', 'personas.md'),
      );
      expect(resolveConfiguredPath(legacyCwd, 'surfaces')).toBe(
        nodePath.join(legacyCwd, '.safeword-project', 'surfaces.md'),
      );
    } finally {
      removeTemporaryDirectory(legacyCwd);
    }
  });
});
