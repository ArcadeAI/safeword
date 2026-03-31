/**
 * Test Suite: Auto-Upgrade Configuration
 *
 * Tests for shouldAutoUpdate() and the autoUpdate config field.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { shouldAutoUpdate } from '../../src/packs/config.js';

describe('shouldAutoUpdate()', () => {
  let temporaryDirectory: string;
  let savedNoAutoUpdate: string | undefined;
  let savedCi: string | undefined;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'auto-upgrade-test-'));
    savedNoAutoUpdate = process.env.SAFEWORD_NO_AUTO_UPDATE;
    savedCi = process.env.CI;
    delete process.env.SAFEWORD_NO_AUTO_UPDATE;
    delete process.env.CI;
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    if (savedNoAutoUpdate === undefined) {
      delete process.env.SAFEWORD_NO_AUTO_UPDATE;
    } else {
      process.env.SAFEWORD_NO_AUTO_UPDATE = savedNoAutoUpdate;
    }
    if (savedCi === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = savedCi;
    }
  });

  function writeConfig(data: Record<string, unknown>): void {
    const configDirectory = nodePath.join(temporaryDirectory, '.safeword');
    mkdirSync(configDirectory, { recursive: true });
    writeFileSync(nodePath.join(configDirectory, 'config.json'), JSON.stringify(data));
  }

  it('returns true by default (no config file)', () => {
    expect(shouldAutoUpdate(temporaryDirectory)).toBe(true);
  });

  it('returns true when config exists but autoUpdate is not set', () => {
    writeConfig({ version: '0.27.0', installedPacks: [] });
    expect(shouldAutoUpdate(temporaryDirectory)).toBe(true);
  });

  it('returns true when autoUpdate is explicitly true', () => {
    writeConfig({ version: '0.27.0', installedPacks: [], autoUpdate: true });
    expect(shouldAutoUpdate(temporaryDirectory)).toBe(true);
  });

  it('returns false when autoUpdate is false in config', () => {
    writeConfig({ version: '0.27.0', installedPacks: [], autoUpdate: false });
    expect(shouldAutoUpdate(temporaryDirectory)).toBe(false);
  });

  it('returns false when SAFEWORD_NO_AUTO_UPDATE env var is set', () => {
    process.env.SAFEWORD_NO_AUTO_UPDATE = '1';
    expect(shouldAutoUpdate(temporaryDirectory)).toBe(false);
  });

  it('returns false when CI env var is set', () => {
    process.env.CI = 'true';
    expect(shouldAutoUpdate(temporaryDirectory)).toBe(false);
  });

  it('env var overrides config (env=disabled, config=enabled)', () => {
    writeConfig({ version: '0.27.0', installedPacks: [], autoUpdate: true });
    process.env.SAFEWORD_NO_AUTO_UPDATE = '1';
    expect(shouldAutoUpdate(temporaryDirectory)).toBe(false);
  });
});
