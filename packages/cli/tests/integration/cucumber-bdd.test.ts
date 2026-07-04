/**
 * Integration test for the cucumber-js acceptance lane (ticket 102a — SM1.AC1).
 *
 * Proves safeword's package-level Cucumber wiring loads feature specs and step
 * definitions. Full scenario execution belongs to the root `test:bdd`
 * acceptance lane, which also discovers package features.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import vitestConfig from '../../vitest.config.js';
import { TIMEOUT_ACCEPTANCE_LANE } from '../helpers.js';

const CLI_DIRECTORY = nodePath.resolve(import.meta.dirname, '../..');
const CUCUMBER_WIRING_CHECK_ARGS = ['cucumber-js', '--dry-run', '--format', 'summary'];

describe('cucumber-js acceptance lane (SM1.AC1)', () => {
  it(
    'gherkin-typescript.SM1.AC1.dogfood_feature_wiring_loads_without_executing_steps',
    () => {
      const result = spawnSync('bunx', CUCUMBER_WIRING_CHECK_ARGS, {
        cwd: CLI_DIRECTORY,
        encoding: 'utf8',
      });
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
      expect(result.status, output).toBe(0);
      expect(output).toMatch(/\b[1-9]\d* scenarios? \([1-9]\d* skipped\)/);
      expect(output).not.toMatch(/undefined|ambiguous|pending|passed/);
    },
    TIMEOUT_ACCEPTANCE_LANE,
  );

  it(
    'rule-tier.TB2.AC1.tag_expression_on_a_rule_id_selects_exactly_that_rules_scenarios',
    () => {
      const fixtureDirectory = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'rule-tag-'));
      try {
        const featurePath = nodePath.join(fixtureDirectory, 'demo.feature');
        writeFileSync(
          featurePath,
          [
            'Feature: Demo',
            '',
            '  @demo.DEV2.R1',
            '  Rule: demo.DEV2.R1 — retries use exponential backoff',
            '',
            '    Scenario: first retry after one minute',
            '      Given a failed delivery',
            '',
            '    Scenario: second retry doubles the wait',
            '      Given a failed delivery',
            '',
            '  @demo.DEV2.R2',
            '  Rule: demo.DEV2.R2 — deliveries stop after the retry budget',
            '',
            '    Scenario: delivery abandoned after final retry',
            '      Given an exhausted budget',
            '',
          ].join('\n'),
        );

        const result = spawnSync(
          'bunx',
          [
            'cucumber-js',
            '--dry-run',
            '--format',
            'summary',
            '--tags',
            '@demo.DEV2.R1',
            featurePath,
          ],
          { cwd: CLI_DIRECTORY, encoding: 'utf8' },
        );

        const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
        expect(result.status, output).toBe(0);
        // Rule-level tag inheritance: exactly R1's two scenarios are selected
        // (undefined — the fixture ships no step definitions); R2's scenario is
        // filtered out entirely, so the total is 2, not 3.
        expect(output).toMatch(/\b2 scenarios? \(2 undefined\)/);
      } finally {
        rmSync(fixtureDirectory, { recursive: true, force: true });
      }
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
