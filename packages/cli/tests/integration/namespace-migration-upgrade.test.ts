/**
 * Upgrade-vehicle namespace migration, end to end (ticket 9MMWS7, epic AQJ95G).
 *
 * `safeword upgrade` offers/performs the legacy → `.project/` move via the
 * consent flags (the TTY prompt pair is proven at the unit layer against the
 * injected confirm seam — subprocesses have no TTY), and `safeword check`
 * carries the both-dirs advisory.
 *
 * Scenario lineage: upgrade-namespace-migration.DEV1.* (test-definitions.md).
 */

import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
  TIMEOUT_BUN_INSTALL,
} from '../helpers.js';

/**
 * Build a realistic legacy install: run a real setup (which scaffolds the
 * .project/ default since N9S5XG), then rename the namespace to the legacy
 * root and add a user-authored marker so non-destructive moves are provable.
 */
async function seedLegacyInstall(cwd: string): Promise<void> {
  await createConfiguredProject(cwd);
  renameSync(nodePath.join(cwd, '.project'), nodePath.join(cwd, '.safeword-project'));
  writeFileSync(
    nodePath.join(cwd, '.safeword-project', 'personas.md'),
    '# Personas\n\n## Test User (TU)\n\n**Role:** user content marker.\n',
  );
}

function listTree(root: string): string[] {
  return existsSync(root) ? readdirSync(root, { recursive: true }).map(String) : [];
}

describe('upgrade --migrate-namespace (9MMWS7)', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = createTemporaryDirectory();
    await seedLegacyInstall(cwd);
  }, TIMEOUT_BUN_INSTALL);

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it(
    'DEV1.AC3.same_run_reconciles_on_new_root',
    async () => {
      // Legacy install missing its glossary — the same run must move AND scaffold.
      rmSync(nodePath.join(cwd, '.safeword-project', 'glossary.md'), { force: true });

      const result = await runCli(['upgrade', '--migrate-namespace'], { cwd });

      expect(result.exitCode).toBe(0);
      expect(existsSync(nodePath.join(cwd, '.project', 'glossary.md'))).toBe(true);
      expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
      expect(readFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'utf8')).toContain(
        'user content',
      );
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'DEV1.AC2.decline_flag_skips_prompt_and_move',
    async () => {
      const legacyBefore = listTree(nodePath.join(cwd, '.safeword-project'));

      const result = await runCli(['upgrade', '--no-migrate-namespace'], { cwd });

      expect(result.exitCode).toBe(0);
      expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
      // Legacy root still reconciled (upgrade scaffolds missing glossary there).
      expect(existsSync(nodePath.join(cwd, '.safeword-project', 'glossary.md'))).toBe(true);
      expect(listTree(nodePath.join(cwd, '.safeword-project'))).toEqual(
        expect.arrayContaining(legacyBefore),
      );
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'DEV1.AC2.non_interactive_nudges_only',
    async () => {
      // Subprocess has no TTY and no flag → nudge, no move.
      const result = await runCli(['upgrade'], { cwd });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain('--migrate-namespace');
      expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
      expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(true);
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'DEV1.AC2.move_failure_reports_and_changes_nothing',
    async () => {
      writeFileSync(nodePath.join(cwd, '.project'), 'a file, not a directory');
      const legacyBefore = listTree(nodePath.join(cwd, '.safeword-project'));

      const result = await runCli(['upgrade', '--migrate-namespace'], { cwd });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(
        /\.project.*(exists|blocked|not a directory)/i,
      );
      expect(listTree(nodePath.join(cwd, '.safeword-project'))).toEqual(
        expect.arrayContaining(legacyBefore),
      );
      expect(readFileSync(nodePath.join(cwd, '.project'), 'utf8')).toBe('a file, not a directory');
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'DEV1.AC4.both_dirs_refuses_move_and_advises',
    async () => {
      mkdirSync(nodePath.join(cwd, '.project'));
      writeFileSync(nodePath.join(cwd, '.project', 'user-file.md'), 'pre-existing\n');
      const legacyBefore = listTree(nodePath.join(cwd, '.safeword-project'));

      const result = await runCli(['upgrade', '--migrate-namespace'], { cwd });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(/\.project.*already exists/i);
      expect(listTree(nodePath.join(cwd, '.safeword-project'))).toEqual(
        expect.arrayContaining(legacyBefore),
      );
      expect(readFileSync(nodePath.join(cwd, '.project', 'user-file.md'), 'utf8')).toBe(
        'pre-existing\n',
      );
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'DEV1.AC2.current_install_gets_no_offer',
    async () => {
      // Convert the seed to a .project-only install first.
      const result0 = await runCli(['upgrade', '--migrate-namespace'], { cwd });
      expect(result0.exitCode).toBe(0);

      const result = await runCli(['upgrade'], { cwd });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}${result.stderr}`).not.toContain('--migrate-namespace');
      expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
    },
    TIMEOUT_BUN_INSTALL,
  );
});

describe('check both-dirs advisory (9MMWS7)', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = createTemporaryDirectory();
    await seedLegacyInstall(cwd);
  }, TIMEOUT_BUN_INSTALL);

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it(
    'DEV1.AC4.check_advisory_fires_on_both_dirs',
    async () => {
      // Realistic mid-migration state: populated .project/ plus a legacy
      // leftover. Advisory fires zero-exit; the resolver reads .project/.
      execSync(`cp -R .safeword-project .project-tmp && mv .project-tmp .project`, { cwd });

      const result = await runCli(['check', '--offline'], { cwd });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(
        /Both \.project\/ and \.safeword-project\//,
      );
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'DEV1.AC4.check_silent_on_single_root — legacy only',
    async () => {
      const result = await runCli(['check', '--offline'], { cwd });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}${result.stderr}`).not.toMatch(/migrate-namespace/);
    },
    TIMEOUT_BUN_INSTALL,
  );

  it(
    'DEV1.AC4.check_silent_on_single_root — project only',
    async () => {
      const result0 = await runCli(['upgrade', '--migrate-namespace'], { cwd });
      expect(result0.exitCode).toBe(0);

      const result = await runCli(['check', '--offline'], { cwd });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}${result.stderr}`).not.toMatch(/migrate-namespace/);
    },
    TIMEOUT_BUN_INSTALL,
  );
});
