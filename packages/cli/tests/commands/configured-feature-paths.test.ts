/**
 * Configured lane paths for safeword's readers (ticket 56JCFZ, TB2.AC1 +
 * TB2.AC3): `paths.features` in .safeword/config.json AUGMENTS the default
 * feature discovery — codify, lint-gherkin, and check read the configured
 * directory in addition to root/workspace `features/`. A missing or
 * unparseable config file falls back to default behavior. End-to-end via the
 * built CLI on temp fixtures (no setup needed — readers only).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
  TIMEOUT_QUICK,
  writeSafewordPathsConfig,
  writeTestFile,
} from '../helpers.js';

const FEATURE_SOURCE = [
  'Feature: Demo feature source',
  '',
  '  Rule: source rule',
  '',
  '    Scenario: configured location scenario',
  '      Given a',
  '      When b',
  '      Then c',
  '',
].join('\n');

/** Feature content with a deliberate trailing-space lint violation. */
const TRAILING_SPACE_FEATURE = [
  'Feature: Default dir',
  '',
  '  Scenario: bad ',
  '    Given ok',
  '',
].join('\n');

/** Feature content with a deliberate duplicate-scenario-name violation. */
const DUPLICATE_NAME_FEATURE = [
  'Feature: Configured dir',
  '',
  '  Scenario: duplicated',
  '    Given one',
  '',
  '  Scenario: duplicated',
  '    Given two',
  '',
].join('\n');

describe('codify finds a feature source in a configured directory (TB2.AC1)', () => {
  let directory: string;

  beforeAll(() => {
    directory = createTemporaryDirectory();
    writeSafewordPathsConfig(directory);
    writeTestFile(directory, '.project/tickets/DEMO01-demo/ticket.md', '# demo');
    writeTestFile(directory, 'tests/behaviors/demo.feature', FEATURE_SOURCE);
  });

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it(
    'bdd-lane-collision-detection-and-paths.TB2.AC1.codify_reads_the_configured_directory',
    async () => {
      const result = await runCli(['codify', 'DEMO01'], { cwd: directory });
      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain('configured location scenario');
    },
    TIMEOUT_QUICK,
  );
});

describe('lint-gherkin lints configured and default directories together (TB2.AC1)', () => {
  let directory: string;

  beforeAll(() => {
    directory = createTemporaryDirectory();
    writeSafewordPathsConfig(directory);
    writeTestFile(directory, 'features/default-dir.feature', TRAILING_SPACE_FEATURE);
    writeTestFile(directory, 'tests/behaviors/configured-dir.feature', DUPLICATE_NAME_FEATURE);
  });

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it(
    'bdd-lane-collision-detection-and-paths.TB2.AC1.violations_in_both_directories_are_reported',
    async () => {
      const result = await runCli(['lint-gherkin'], { cwd: directory });
      expect(result.exitCode).toBe(1);
      const output = `${result.stdout}\n${result.stderr}`;
      expect(output).toContain('features/default-dir.feature');
      expect(output).toContain('no-trailing-spaces');
      expect(output).toContain('tests/behaviors/configured-dir.feature');
      expect(output).toContain('no-dupe-scenario-names');
    },
    TIMEOUT_QUICK,
  );
});

describe('an unparseable config file falls back to default discovery (TB2.AC3)', () => {
  let directory: string;

  beforeAll(() => {
    directory = createTemporaryDirectory();
    writeTestFile(directory, '.safeword/config.json', '{ not json !!!');
    writeTestFile(directory, 'features/default-dir.feature', TRAILING_SPACE_FEATURE);
  });

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it(
    'bdd-lane-collision-detection-and-paths.TB2.AC3.default_directory_violation_is_still_reported',
    async () => {
      const result = await runCli(['lint-gherkin'], { cwd: directory });
      expect(result.exitCode).toBe(1);
      const output = `${result.stdout}\n${result.stderr}`;
      expect(output).toContain('features/default-dir.feature');
      expect(output).toContain('no-trailing-spaces');
    },
    TIMEOUT_QUICK,
  );
});
