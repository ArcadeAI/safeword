/**
 * Test Suite: Auto-Upgrade Configuration
 *
 * Tests for shouldAutoUpgrade() and the autoUpgrade config field.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { shouldAutoUpgrade } from '../../src/packs/config.js';

describe('shouldAutoUpgrade()', () => {
  let temporaryDirectory: string;
  let savedNoAutoUpgrade: string | undefined;
  let savedCi: string | undefined;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'auto-upgrade-test-'));
    savedNoAutoUpgrade = process.env.SAFEWORD_NO_AUTO_UPGRADE;
    savedCi = process.env.CI;
    delete process.env.SAFEWORD_NO_AUTO_UPGRADE;
    delete process.env.CI;
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    if (savedNoAutoUpgrade === undefined) {
      delete process.env.SAFEWORD_NO_AUTO_UPGRADE;
    } else {
      process.env.SAFEWORD_NO_AUTO_UPGRADE = savedNoAutoUpgrade;
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
    expect(shouldAutoUpgrade(temporaryDirectory)).toBe(true);
  });

  it('returns true when config exists but autoUpgrade is not set', () => {
    writeConfig({ version: '0.27.0', installedPacks: [] });
    expect(shouldAutoUpgrade(temporaryDirectory)).toBe(true);
  });

  it('returns true when autoUpgrade is explicitly true', () => {
    writeConfig({ version: '0.27.0', installedPacks: [], autoUpgrade: true });
    expect(shouldAutoUpgrade(temporaryDirectory)).toBe(true);
  });

  it('returns false when autoUpgrade is false in config', () => {
    writeConfig({ version: '0.27.0', installedPacks: [], autoUpgrade: false });
    expect(shouldAutoUpgrade(temporaryDirectory)).toBe(false);
  });

  it('returns false when SAFEWORD_NO_AUTO_UPGRADE env var is set', () => {
    process.env.SAFEWORD_NO_AUTO_UPGRADE = '1';
    expect(shouldAutoUpgrade(temporaryDirectory)).toBe(false);
  });

  it('returns false when CI env var is set', () => {
    process.env.CI = 'true';
    expect(shouldAutoUpgrade(temporaryDirectory)).toBe(false);
  });

  it('env var overrides config (env=disabled, config=enabled)', () => {
    writeConfig({ version: '0.27.0', installedPacks: [], autoUpgrade: true });
    process.env.SAFEWORD_NO_AUTO_UPGRADE = '1';
    expect(shouldAutoUpgrade(temporaryDirectory)).toBe(false);
  });
});
