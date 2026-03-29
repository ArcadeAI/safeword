/**
 * E2E Test: SQL Golden Path
 *
 * Verifies that a SQL project (dbt) with safeword works correctly:
 * - dbt_project.yml triggers SQL language detection
 * - SQLFluff config is created (.sqlfluff + .safeword/sqlfluff.cfg)
 * - Existing .sqlfluff is not overwritten
 * - Projects without SQL markers don't get SQL pack
 */

import { mkdirSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

/**
 * Create a minimal dbt project with dbt_project.yml.
 */
function createDbtProject(directory: string): void {
  writeTestFile(
    directory,
    'dbt_project.yml',
    `name: test_dbt_project
version: '1.0.0'
config-version: 2
profile: default
model-paths: ["models"]
`,
  );
  // dbt projects often coexist with package.json (for tooling/CI)
  writeTestFile(
    directory,
    'package.json',
    JSON.stringify({ name: 'test-dbt-project', private: true }),
  );
  mkdirSync(nodePath.join(directory, 'models', 'staging'), { recursive: true });
  writeTestFile(
    directory,
    'models/staging/stg_orders.sql',
    `select
    id,
    customer_id,
    order_date,
    status
from {{ source('raw', 'orders') }}
`,
  );
}

// =========================================================================
// Suite 1: Detection
// =========================================================================

describe('E2E: dbt Golden Path', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Suite 1: Detection', () => {
    it('1.1: detects dbt when dbt_project.yml is present', async () => {
      createDbtProject(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.sqlfluff')).toBe(true);
      expect(fileExists(temporaryDirectory, '.safeword/sqlfluff.cfg')).toBe(true);
    });

    it('1.2: does NOT detect dbt without dbt_project.yml', async () => {
      writeTestFile(
        temporaryDirectory,
        'package.json',
        JSON.stringify({ name: 'test', private: true }),
      );
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.sqlfluff')).toBe(false);
      expect(fileExists(temporaryDirectory, '.safeword/sqlfluff.cfg')).toBe(false);
    });

    it('1.3: does NOT detect dbt with .sql files but no dbt_project.yml', async () => {
      writeTestFile(
        temporaryDirectory,
        'package.json',
        JSON.stringify({ name: 'test', private: true }),
      );
      mkdirSync(nodePath.join(temporaryDirectory, 'migrations'), { recursive: true });
      writeTestFile(
        temporaryDirectory,
        'migrations/001_create_users.sql',
        'CREATE TABLE users (id INT);',
      );
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.sqlfluff')).toBe(false);
    });
  });

  // =========================================================================
  // Suite 2: Config Generation
  // =========================================================================

  describe('Suite 2: Config Generation', () => {
    it('2.1: creates .sqlfluff with ansi dialect and jinja templater', async () => {
      createDbtProject(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const config = readTestFile(temporaryDirectory, '.sqlfluff');
      expect(config).toContain('dialect = ansi');
      expect(config).toContain('templater = jinja');
    });

    it('2.2: creates .safeword/sqlfluff.cfg with strict rules', async () => {
      createDbtProject(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const config = readTestFile(temporaryDirectory, '.safeword/sqlfluff.cfg');
      expect(config).toContain('dialect = ansi');
      expect(config).toContain('capitalisation_policy');
    });

    it('2.5: detected dialect flows into both generated configs', async () => {
      createDbtProject(temporaryDirectory);
      writeTestFile(
        temporaryDirectory,
        'profiles.yml',
        `default:
  target: dev
  outputs:
    dev:
      type: snowflake
      account: test
      database: test
`,
      );
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const managedConfig = readTestFile(temporaryDirectory, '.sqlfluff');
      expect(managedConfig).toContain('dialect = snowflake');
      expect(managedConfig).not.toContain('dialect = ansi');

      const ownedConfig = readTestFile(temporaryDirectory, '.safeword/sqlfluff.cfg');
      expect(ownedConfig).toContain('dialect = snowflake');
      expect(ownedConfig).not.toContain('dialect = ansi');
    });

    it('2.3: does NOT overwrite existing .sqlfluff', async () => {
      createDbtProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, '.sqlfluff', '[sqlfluff]\ndialect = bigquery\n');
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const config = readTestFile(temporaryDirectory, '.sqlfluff');
      expect(config).toContain('dialect = bigquery');
      expect(config).not.toContain('dialect = ansi');
    });

    it('2.4: upgrades .safeword/sqlfluff.cfg on upgrade', async () => {
      createDbtProject(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });
      writeTestFile(temporaryDirectory, '.safeword/sqlfluff.cfg', '# old config');

      await runCli(['upgrade'], { cwd: temporaryDirectory });

      const config = readTestFile(temporaryDirectory, '.safeword/sqlfluff.cfg');
      expect(config).toContain('capitalisation_policy');
    });
  });

  // =========================================================================
  // Suite 3: Schema & Registry
  // =========================================================================

  describe('Suite 3: Schema & Registry', () => {
    it('3.1: dbt config files have entries in schema', async () => {
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');

      expect('.safeword/sqlfluff.cfg' in SAFEWORD_SCHEMA.ownedFiles).toBe(true);
      expect('.sqlfluff' in SAFEWORD_SCHEMA.managedFiles).toBe(true);
    });

    it('3.2: sql pack is registered in LANGUAGE_PACKS', async () => {
      const { LANGUAGE_PACKS } = await import('../../src/packs/registry.js');

      const sqlPack = LANGUAGE_PACKS.sql;
      expect(sqlPack).toBeDefined();
      expect(sqlPack?.id).toBe('sql');
      expect(sqlPack?.extensions).toContain('.sql');
    });

    it('3.3: setup completes successfully for dbt projects', async () => {
      createDbtProject(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      const result = await runCli(['setup'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
    });
  });

  // =========================================================================
  // Suite 4: Lint Hook Integration
  // =========================================================================

  describe('Suite 4: Lint Hook Integration', () => {
    it('4.2: config exists for lint hook to use', async () => {
      createDbtProject(temporaryDirectory);
      initGitRepo(temporaryDirectory);
      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.safeword/sqlfluff.cfg')).toBe(true);
    });

    it('4.3: no SQL linting config in non-dbt projects', async () => {
      writeTestFile(
        temporaryDirectory,
        'package.json',
        JSON.stringify({ name: 'test', private: true }),
      );
      initGitRepo(temporaryDirectory);
      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.safeword/sqlfluff.cfg')).toBe(false);
    });
  });

  // =========================================================================
  // Suite 5: Upgrade & Late Detection
  // =========================================================================

  describe('Suite 5: Upgrade & Late Detection', () => {
    it('5.1: upgrade updates owned dbt files', async () => {
      createDbtProject(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });
      writeTestFile(temporaryDirectory, '.safeword/sqlfluff.cfg', '# tampered');

      await runCli(['upgrade'], { cwd: temporaryDirectory });

      const config = readTestFile(temporaryDirectory, '.safeword/sqlfluff.cfg');
      expect(config).not.toBe('# tampered');
      expect(config).toContain('capitalisation_policy');
    });

    it('5.2: detects dbt when dbt_project.yml added after initial setup', async () => {
      writeTestFile(
        temporaryDirectory,
        'package.json',
        JSON.stringify({ name: 'test', private: true }),
      );
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });
      expect(fileExists(temporaryDirectory, '.sqlfluff')).toBe(false);

      createDbtProject(temporaryDirectory);

      await runCli(['upgrade'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.sqlfluff')).toBe(true);
      expect(fileExists(temporaryDirectory, '.safeword/sqlfluff.cfg')).toBe(true);
    });
  });
});
