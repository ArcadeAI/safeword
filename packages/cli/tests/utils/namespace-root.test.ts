/**
 * Namespace-root resolver tests (ticket TAGWZ8, epic AQJ95G).
 *
 * Covers the resolution precedence — explicit config `paths.projectRoot` →
 * `.project/` → legacy `.safeword-project/` — plus relative/absolute config
 * semantics and malformed-config fallthrough. Default-subpath derivation and
 * per-file override interaction live in namespace-root-defaults.test.ts.
 *
 * Scenario lineage: namespace-root-resolver.SM1.AC1.*, DEV1.AC2, DEV2.AC1
 * (test-definitions.md in the ticket folder).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveNamespaceRoot } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

function writeConfig(cwd: string, config: Record<string, unknown>): void {
  const directory = nodePath.join(cwd, '.safeword');
  mkdirSync(directory, { recursive: true });
  writeFileSync(nodePath.join(directory, 'config.json'), JSON.stringify(config, undefined, 2));
}

function writeRawConfig(cwd: string, raw: string): void {
  const directory = nodePath.join(cwd, '.safeword');
  mkdirSync(directory, { recursive: true });
  writeFileSync(nodePath.join(directory, 'config.json'), raw);
}

describe('resolveNamespaceRoot — precedence (TAGWZ8)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('SM1.AC1.config_root_wins_when_set', () => {
    // Both namespace directories present — config still wins.
    mkdirSync(nodePath.join(cwd, '.project'));
    mkdirSync(nodePath.join(cwd, '.safeword-project'));
    writeConfig(cwd, { installedPacks: [], paths: { projectRoot: 'custom-ns' } });

    expect(resolveNamespaceRoot(cwd)).toBe(nodePath.join(cwd, 'custom-ns'));
  });

  it('SM1.AC1.project_dir_preferred_over_legacy', () => {
    mkdirSync(nodePath.join(cwd, '.project'));

    expect(resolveNamespaceRoot(cwd)).toBe(nodePath.join(cwd, '.project'));
  });

  it('DEV1.AC2.legacy_only_resolves_there', () => {
    mkdirSync(nodePath.join(cwd, '.safeword-project'));

    expect(resolveNamespaceRoot(cwd)).toBe(nodePath.join(cwd, '.safeword-project'));
  });

  it('SM1.AC1.both_dirs_present_prefers_project', () => {
    mkdirSync(nodePath.join(cwd, '.project'));
    mkdirSync(nodePath.join(cwd, '.safeword-project'));

    expect(resolveNamespaceRoot(cwd)).toBe(nodePath.join(cwd, '.project'));
  });

  it('SM1.AC1.neither_dir_defaults_to_project', () => {
    expect(resolveNamespaceRoot(cwd)).toBe(nodePath.join(cwd, '.project'));
  });

  it('DEV2.AC1.relative_project_root_resolves_against_cwd', () => {
    writeConfig(cwd, { installedPacks: [], paths: { projectRoot: 'shared/ns' } });

    expect(resolveNamespaceRoot(cwd)).toBe(nodePath.join(cwd, 'shared', 'ns'));
  });

  it('DEV2.AC1.absolute_project_root_used_verbatim', () => {
    const externalDirectory = createTemporaryDirectory();
    try {
      writeConfig(cwd, { installedPacks: [], paths: { projectRoot: externalDirectory } });

      expect(resolveNamespaceRoot(cwd)).toBe(externalDirectory);
    } finally {
      removeTemporaryDirectory(externalDirectory);
    }
  });

  it('SM1.AC1.empty_project_root_treated_as_unset', () => {
    mkdirSync(nodePath.join(cwd, '.safeword-project'));
    writeConfig(cwd, { installedPacks: [], paths: { projectRoot: '' } });

    expect(resolveNamespaceRoot(cwd)).toBe(nodePath.join(cwd, '.safeword-project'));
  });

  it('SM1.AC1.missing_config_falls_through_to_precedence', () => {
    mkdirSync(nodePath.join(cwd, '.project'));

    expect(resolveNamespaceRoot(cwd)).toBe(nodePath.join(cwd, '.project'));
  });

  it('SM1.AC1.non_string_project_root_treated_as_unset', () => {
    mkdirSync(nodePath.join(cwd, '.safeword-project'));
    writeConfig(cwd, { installedPacks: [], paths: { projectRoot: 123 } });

    expect(resolveNamespaceRoot(cwd)).toBe(nodePath.join(cwd, '.safeword-project'));
  });

  it('SM1.AC1.unparseable_config_treated_as_unset', () => {
    mkdirSync(nodePath.join(cwd, '.project'));
    writeRawConfig(cwd, '{ not json');

    expect(resolveNamespaceRoot(cwd)).toBe(nodePath.join(cwd, '.project'));
  });
});
