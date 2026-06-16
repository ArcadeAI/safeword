/**
 * Filesystem-backed tests for the autonomy-policy IO layer (ticket HPQ43R).
 *
 * Proves project-config reading, the personal-override precedence and
 * fail-safe paths against real files on disk, and that the personal override
 * path is registered for gitignoring (DEV2.AC2). The pure resolution rules
 * are unit-tested in `src/utils/autonomy-policy.test.ts`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SAFEWORD_TRANSIENT_PATHS } from '../../src/schema.js';
import { presetPostureMap } from '../../src/utils/autonomy-policy.js';
import {
  PERSONAL_CONFIG_SUBPATH,
  readAutonomyPolicy,
} from '../../src/utils/autonomy-policy-config.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

function writeJsonFile(cwd: string, subpath: readonly string[], data: unknown): void {
  const filePath = nodePath.join(cwd, ...subpath);
  mkdirSync(nodePath.dirname(filePath), { recursive: true });
  writeFileSync(filePath, typeof data === 'string' ? data : JSON.stringify(data, undefined, 2));
}

describe('readAutonomyPolicy', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('defaults to Full review when no config exists', () => {
    expect(readAutonomyPolicy(cwd)).toEqual(presetPostureMap('Full review'));
  });

  it('reads the project preset from .safeword/config.json', () => {
    writeJsonFile(cwd, ['.safeword', 'config.json'], {
      autonomy: { preset: 'Guard the contract' },
    });
    expect(readAutonomyPolicy(cwd)).toEqual(presetPostureMap('Guard the contract'));
  });

  it('lets the personal override win over the project policy', () => {
    writeJsonFile(cwd, ['.safeword', 'config.json'], { autonomy: { preset: 'Full review' } });
    writeJsonFile(cwd, PERSONAL_CONFIG_SUBPATH, {
      autonomy: { overrides: { execution: 'autonomous' } },
    });
    const map = readAutonomyPolicy(cwd);
    expect(map.execution).toBe('autonomous');
    expect(map['intent-and-scope']).toBe('ask');
  });

  it('falls back to the project policy when the personal override is malformed', () => {
    writeJsonFile(cwd, ['.safeword', 'config.json'], {
      autonomy: { preset: 'Guard the contract' },
    });
    writeJsonFile(cwd, PERSONAL_CONFIG_SUBPATH, '{ not valid json');
    expect(readAutonomyPolicy(cwd)).toEqual(presetPostureMap('Guard the contract'));
  });

  it('fails safe to Full review when the project config is malformed', () => {
    writeJsonFile(cwd, ['.safeword', 'config.json'], '{ broken');
    expect(readAutonomyPolicy(cwd)).toEqual(presetPostureMap('Full review'));
  });

  it('registers the personal override path for gitignoring', () => {
    expect(SAFEWORD_TRANSIENT_PATHS).toContain(PERSONAL_CONFIG_SUBPATH.join('/'));
  });
});
