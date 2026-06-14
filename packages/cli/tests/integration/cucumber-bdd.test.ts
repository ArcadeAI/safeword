/**
 * Integration test for the cucumber-js acceptance lane (ticket 102a — SM1.AC1).
 *
 * Proves safeword's own repo runs `.feature` specs through cucumber-js — the same
 * setup it scaffolds for customers — separate from the vitest unit suite. The
 * dogfood feature drives the built CLI from the outside; dist is already built by
 * the `pretest` step.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import vitestConfig from '../../vitest.config.js';
import { TIMEOUT_SETUP } from '../helpers.js';

const CLI_DIRECTORY = nodePath.resolve(import.meta.dirname, '../..');

describe('cucumber-js acceptance lane (SM1.AC1)', () => {
  it(
    'gherkin-typescript.SM1.AC1.dogfood_feature_runs_green',
    () => {
      const result = spawnSync('bunx', ['cucumber-js'], {
        cwd: CLI_DIRECTORY,
        encoding: 'utf8',
      });
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
      expect(result.status, output).toBe(0);
      expect(output).toMatch(/[1-9]\d* scenarios? \([1-9]\d* passed\)/);
      expect(output).not.toMatch(/undefined|pending/);
    },
    TIMEOUT_SETUP,
  );

  it('gherkin-typescript.SM1.AC1.vitest_excludes_the_dogfood_feature', () => {
    // The dogfood feature exists...
    expect(existsSync(nodePath.join(CLI_DIRECTORY, 'features', 'codify.feature'))).toBe(true);
    // ...but the vitest suite collects only `*.test.ts` under tests/ and src/, so
    // it can never run a `.feature` — the acceptance lane and unit suite partition
    // the tree.
    const include = (vitestConfig as { test?: { include?: string[] } }).test?.include ?? [];
    expect(include.length).toBeGreaterThan(0);
    expect(include.every(pattern => pattern.endsWith('.test.ts'))).toBe(true);
    expect(include.some(pattern => pattern.includes('feature'))).toBe(false);
  });
});
