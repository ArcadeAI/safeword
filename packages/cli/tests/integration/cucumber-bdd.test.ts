/**
 * Integration test for the cucumber-js acceptance lane (ticket 102a — SM1.AC1).
 *
 * Proves safeword's package-level Cucumber wiring loads feature specs and step
 * definitions. Full scenario execution belongs to the root `test:bdd`
 * acceptance lane, which also discovers package features.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import vitestConfig from '../../vitest.config.js';
import { TIMEOUT_ACCEPTANCE_LANE, TIMEOUT_CUCUMBER_CHILD } from '../helpers.js';

const CLI_DIRECTORY = nodePath.resolve(import.meta.dirname, '../..');
const CUCUMBER_WIRING_CHECK_ARGS = ['cucumber-js', '--dry-run', '--format', 'summary'];

describe('cucumber-js acceptance lane (SM1.AC1)', () => {
  it(
    'gherkin-typescript.SM1.AC1.dogfood_feature_wiring_loads_without_executing_steps',
    () => {
      const result = spawnSync('bunx', CUCUMBER_WIRING_CHECK_ARGS, {
        cwd: CLI_DIRECTORY,
        encoding: 'utf8',
        // Kill a hung child instead of letting blocking spawnSync starve the
        // outer Vitest lane timeout (issue #488). SIGKILL because cucumber-js
        // can ignore SIGTERM; the child timeout sits below the lane ceiling.
        timeout: TIMEOUT_CUCUMBER_CHILD,
        killSignal: 'SIGKILL',
      });
      // On timeout spawnSync sets `error` (ETIMEDOUT) and `signal`, status null,
      // and returns whatever stdout/stderr the child emitted before the kill.
      // Surface all of it so a hang fails cleanly with useful diagnostics.
      const output = [
        result.error ? `error: ${result.error.message}` : '',
        result.signal ? `terminated by signal: ${result.signal}` : '',
        `stdout:\n${result.stdout ?? ''}`,
        `stderr:\n${result.stderr ?? ''}`,
      ]
        .filter(Boolean)
        .join('\n');
      expect(result.status, output).toBe(0);
      expect(output).toMatch(/\b[1-9]\d* scenarios? \([1-9]\d* skipped\)/);
      expect(output).not.toMatch(/undefined|ambiguous|pending|passed/);
    },
    TIMEOUT_ACCEPTANCE_LANE,
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
