/**
 * Namespace-migration core tests (ticket 9MMWS7, epic AQJ95G).
 *
 * planNamespaceMigration classifies the install state; executeNamespaceMigration
 * performs the consensual move (git mv when tracked, fs rename otherwise) and
 * rewrites stale per-file `paths.*` legacy prefixes in `.safeword/config.json`.
 *
 * Scenario lineage: upgrade-namespace-migration.DEV1.* (test-definitions.md).
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { maybeMigrateNamespace, promptYesDefault } from '../../src/commands/upgrade.js';
import {
  executeNamespaceMigration,
  planNamespaceMigration,
} from '../../src/utils/namespace-migration.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

function seedLegacy(cwd: string): void {
  mkdirSync(nodePath.join(cwd, '.safeword-project', 'tickets'), { recursive: true });
  writeFileSync(
    nodePath.join(cwd, '.safeword-project', 'personas.md'),
    '# Personas\nuser content\n',
  );
}

function initGit(cwd: string): void {
  execSync('git init -q && git config user.email t@e && git config user.name t', { cwd });
}

describe('planNamespaceMigration (9MMWS7)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('offers on a legacy-only install', () => {
    seedLegacy(cwd);

    expect(planNamespaceMigration(cwd)).toBe('offer');
  });

  it('DEV1.AC2.current_install_gets_no_offer (already-current)', () => {
    mkdirSync(nodePath.join(cwd, '.project'));

    expect(planNamespaceMigration(cwd)).toBe('already-current');
  });

  it('reports both-dirs when both roots exist', () => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.project'));

    expect(planNamespaceMigration(cwd)).toBe('both-dirs');
  });

  it('DEV1.AC3.configured_custom_root_not_offered (custom-root)', () => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'team-ns' } }),
    );

    expect(planNamespaceMigration(cwd)).toBe('custom-root');
  });

  it('DEV1.AC2.move_failure_reports_and_changes_nothing (blocked target)', () => {
    seedLegacy(cwd);
    writeFileSync(nodePath.join(cwd, '.project'), 'a file, not a directory');

    expect(planNamespaceMigration(cwd)).toBe('blocked');
  });

  it('reports nothing to do on a fresh repo (no namespace at all)', () => {
    expect(planNamespaceMigration(cwd)).toBe('already-current');
  });
});

describe('executeNamespaceMigration (9MMWS7)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('DEV1.AC1.flag_migrates_legacy_install — git mv preserves history', () => {
    initGit(cwd);
    seedLegacy(cwd);
    execSync('git add -A && git commit -qm seed', { cwd });

    const result = executeNamespaceMigration(cwd);

    expect(result.method).toBe('git');
    expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
    expect(readFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'utf8')).toContain(
      'user content',
    );
    const status = execSync('git status --porcelain', { cwd, encoding: 'utf8' });
    expect(status).toMatch(/^R\s+\.safeword-project\/personas\.md -> \.project\/personas\.md/m);
  });

  it('DEV1.AC1.untracked_dir_falls_back_to_rename — non-git repo', () => {
    seedLegacy(cwd);

    const result = executeNamespaceMigration(cwd);

    expect(result.method).toBe('rename');
    expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
    expect(readFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'utf8')).toContain(
      'user content',
    );
  });

  it('DEV1.AC3.stale_per_file_overrides_rewritten — config rewrite', () => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({
        installedPacks: [],
        paths: { personas: '.safeword-project/personas.md' },
      }),
    );

    const result = executeNamespaceMigration(cwd);

    expect(result.rewrittenKeys).toEqual(['personas']);
    const config = JSON.parse(
      readFileSync(nodePath.join(cwd, '.safeword', 'config.json'), 'utf8'),
    ) as { paths: { personas: string } };
    expect(config.paths.personas).toBe('.project/personas.md');
  });
});

describe('migration prompt seam (9MMWS7)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('DEV1.AC1.prompt_accept_migrates — default answer moves the namespace', async () => {
    seedLegacy(cwd);

    await maybeMigrateNamespace(cwd, { confirmMigration: () => Promise.resolve(true) });

    expect(existsSync(nodePath.join(cwd, '.project', 'personas.md'))).toBe(true);
    expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
  });

  it('DEV1.AC2.prompt_decline_leaves_legacy_untouched', async () => {
    seedLegacy(cwd);
    const personasBefore = readFileSync(
      nodePath.join(cwd, '.safeword-project', 'personas.md'),
      'utf8',
    );

    await maybeMigrateNamespace(cwd, { confirmMigration: () => Promise.resolve(false) });

    expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
    expect(readFileSync(nodePath.join(cwd, '.safeword-project', 'personas.md'), 'utf8')).toBe(
      personasBefore,
    );
  });
});

describe('promptYesDefault (AV3PYY) — EOF-safe [Y/n], default yes', () => {
  async function answerWith(chunks: string[], end = true): Promise<boolean> {
    const { PassThrough } = await import('node:stream');
    const input = new PassThrough();
    const output = new PassThrough();
    const pending = promptYesDefault('move? [Y/n] ', input, output);
    for (const chunk of chunks) input.write(chunk);
    if (end) input.end();
    return pending;
  }

  it('Enter accepts (default yes)', async () => {
    await expect(answerWith(['\n'])).resolves.toBe(true);
  });

  it('y accepts', async () => {
    await expect(answerWith(['y\n'])).resolves.toBe(true);
  });

  it('Y accepts (case-insensitive)', async () => {
    await expect(answerWith(['Y\n'])).resolves.toBe(true);
  });

  it('n declines', async () => {
    await expect(answerWith(['n\n'])).resolves.toBe(false);
  });

  it('N declines (case-insensitive)', async () => {
    await expect(answerWith(['N\n'])).resolves.toBe(false);
  });

  it('stdin EOF with no answer declines (a dead stream never auto-migrates; nodejs#53497)', async () => {
    await expect(answerWith([])).resolves.toBe(false);
  });
});
