/**
 * Unit tests for the architecture-doc enforcement config switch (ticket FPV0E4,
 * Slice 2). Default-on: absent config or absent key ⇒ enabled; only a literal
 * `false` opts out. Drives the TB3 (opt-out) scenarios at the config layer.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isArchitectureDocumentEnforcementEnabled } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const context: { directory: string } = { directory: '' };

function writeConfig(directory: string, config: unknown): void {
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, '.safeword', 'config.json'),
    typeof config === 'string' ? config : JSON.stringify(config),
  );
}

beforeEach(() => {
  context.directory = createTemporaryDirectory();
});

afterEach(() => {
  removeTemporaryDirectory(context.directory);
});

describe('isArchitectureDocumentEnforcementEnabled — default-on with opt-out', () => {
  it('is enabled when no config file is present (default-on)', () => {
    expect(isArchitectureDocumentEnforcementEnabled(context.directory)).toBe(true);
  });

  it('is enabled when the config file omits the key', () => {
    writeConfig(context.directory, { installedPacks: ['typescript'] });

    expect(isArchitectureDocumentEnforcementEnabled(context.directory)).toBe(true);
  });

  it('is enabled when the key is explicitly true', () => {
    writeConfig(context.directory, { architectureDocEnforcement: true });

    expect(isArchitectureDocumentEnforcementEnabled(context.directory)).toBe(true);
  });

  it('is disabled only when the key is literally false', () => {
    writeConfig(context.directory, { architectureDocEnforcement: false });

    expect(isArchitectureDocumentEnforcementEnabled(context.directory)).toBe(false);
  });

  it('treats a non-boolean value as enabled (defensive — only false opts out)', () => {
    writeConfig(context.directory, { architectureDocEnforcement: 'no' });

    expect(isArchitectureDocumentEnforcementEnabled(context.directory)).toBe(true);
  });

  it('treats an unparseable config file as enabled (default-on, never silently off)', () => {
    writeConfig(context.directory, '{ not valid json');

    expect(isArchitectureDocumentEnforcementEnabled(context.directory)).toBe(true);
  });
});
