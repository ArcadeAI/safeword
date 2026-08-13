/**
 * Namespace-migration core tests (ticket 9MMWS7, epic AQJ95G).
 *
 * planNamespaceMigration classifies the install state; executeNamespaceMigration
 * performs the consensual move (git mv when tracked, fs rename otherwise) and
 * rewrites stale per-file `paths.*` legacy prefixes in `.safeword/config.json`.
 *
 * Scenario lineage: upgrade-namespace-migration.TB1.* (test-definitions.md).
 */

import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

  it('TB1.AC2.current_install_gets_no_offer (already-current)', () => {
    mkdirSync(nodePath.join(cwd, '.project'));

    expect(planNamespaceMigration(cwd)).toBe('already-current');
  });

  it('reports both-dirs when both roots exist', () => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.project'));

    expect(planNamespaceMigration(cwd)).toBe('both-dirs');
  });

  it('TB1.AC3.configured_custom_root_not_offered (custom-root)', () => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'team-ns' } }),
    );

    expect(planNamespaceMigration(cwd)).toBe('custom-root');
  });

  it('TB1.AC2.move_failure_reports_and_changes_nothing (blocked target)', () => {
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

  it('TB1.AC1.flag_migrates_legacy_install — git mv preserves history', () => {
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

  it('TB1.AC1.untracked_dir_falls_back_to_rename — non-git repo', () => {
    seedLegacy(cwd);

    const result = executeNamespaceMigration(cwd);

    expect(result.method).toBe('rename');
    expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
    expect(readFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'utf8')).toContain(
      'user content',
    );
  });

  it('automatically merges both roots and archives authored collisions', () => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword-project', 'learnings'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword-project', 'learnings', 'legacy.md'), 'legacy\n');
    mkdirSync(nodePath.join(cwd, '.project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'current\n');

    const result = executeNamespaceMigration(cwd);

    expect(result.method).toBe('merge');
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        path: 'personas.md',
        archivedAs: expect.stringMatching(
          /^\.safeword\/namespace-migration-conflicts-v1\/[a-f\d]{64}\/personas\.md$/u,
        ),
      }),
    ]);
    expect(readFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'utf8')).toBe('current\n');
    expect(readFileSync(nodePath.join(cwd, '.project', 'learnings', 'legacy.md'), 'utf8')).toBe(
      'legacy\n',
    );
    const archivedConflict = result.conflicts.at(0);
    expect(archivedConflict).toBeDefined();
    if (archivedConflict === undefined) throw new Error('Expected an archived namespace conflict.');
    expect(readFileSync(nodePath.join(cwd, archivedConflict.archivedAs), 'utf8')).toContain(
      'user content',
    );
  });

  it('refuses a legacy symlink before changing either namespace', () => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.project'), { recursive: true });
    const external = nodePath.join(cwd, 'external.md');
    writeFileSync(external, 'outside\n');
    symlinkSync(external, nodePath.join(cwd, '.safeword-project', 'escaped.md'));

    expect(() => executeNamespaceMigration(cwd)).toThrow(/symlink/u);
    expect(readFileSync(external, 'utf8')).toBe('outside\n');
    expect(existsSync(nodePath.join(cwd, '.safeword-project', 'personas.md'))).toBe(true);
    expect(existsSync(nodePath.join(cwd, '.project', 'personas.md'))).toBe(false);
    expect(existsSync(nodePath.join(cwd, '.safeword', 'namespace-migration-conflicts-v1'))).toBe(
      false,
    );
  });

  it('refuses a destination symlink before changing either namespace', () => {
    seedLegacy(cwd);
    const external = nodePath.join(cwd, 'external-project');
    mkdirSync(external);
    symlinkSync(external, nodePath.join(cwd, '.project'));

    expect(() => executeNamespaceMigration(cwd)).toThrow(/symlink/u);
    expect(existsSync(nodePath.join(cwd, '.safeword-project', 'personas.md'))).toBe(true);
    expect(existsSync(nodePath.join(external, 'personas.md'))).toBe(false);
  });

  it('refuses a symlinked legacy root before a legacy-only move', () => {
    const external = nodePath.join(cwd, 'external-legacy');
    mkdirSync(external);
    writeFileSync(nodePath.join(external, 'personas.md'), 'outside\n');
    symlinkSync(external, nodePath.join(cwd, '.safeword-project'), 'dir');

    expect(() => executeNamespaceMigration(cwd)).toThrow(/symlink/u);

    expect(readFileSync(nodePath.join(external, 'personas.md'), 'utf8')).toBe('outside\n');
    expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
  });

  it('refuses a nested symlink before a legacy-only move', () => {
    seedLegacy(cwd);
    const external = nodePath.join(cwd, 'external.md');
    writeFileSync(external, 'outside\n');
    symlinkSync(external, nodePath.join(cwd, '.safeword-project', 'escaped.md'));

    expect(() => executeNamespaceMigration(cwd)).toThrow(/symlink/u);

    expect(readFileSync(external, 'utf8')).toBe('outside\n');
    expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
  });

  it('preserves an earlier archived collision when a different legacy copy returns', () => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.project'));
    writeFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'current\n');

    const first = executeNamespaceMigration(cwd);
    const firstArchive = first.conflicts[0]?.archivedAs;
    expect(firstArchive).toBeDefined();

    mkdirSync(nodePath.join(cwd, '.safeword-project'));
    writeFileSync(nodePath.join(cwd, '.safeword-project', 'personas.md'), 'later legacy\n');
    const second = executeNamespaceMigration(cwd);
    const secondArchive = second.conflicts[0]?.archivedAs;

    expect(secondArchive).toBeDefined();
    expect(secondArchive).not.toBe(firstArchive);
    if (firstArchive === undefined || secondArchive === undefined) {
      throw new Error('Expected both namespace conflict archives.');
    }
    expect(readFileSync(nodePath.join(cwd, firstArchive), 'utf8')).toContain('user content');
    expect(readFileSync(nodePath.join(cwd, secondArchive), 'utf8')).toBe('later legacy\n');
  });

  it.each([
    [
      'after copying files',
      {
        afterFilesCopied: () => {
          throw new Error('copy boundary');
        },
      },
    ],
    [
      'after retiring the legacy tree',
      {
        afterLegacyRetired: () => {
          throw new Error('retire boundary');
        },
      },
    ],
  ] as const)('rolls back a handled failure %s', (_label, hooks) => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword-project', 'learnings'));
    writeFileSync(nodePath.join(cwd, '.safeword-project', 'learnings', 'legacy.md'), 'legacy\n');
    mkdirSync(nodePath.join(cwd, '.project'));
    writeFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'current\n');

    expect(() => executeNamespaceMigration(cwd, hooks)).toThrow(/boundary/u);

    expect(readFileSync(nodePath.join(cwd, '.safeword-project', 'personas.md'), 'utf8')).toContain(
      'user content',
    );
    expect(existsSync(nodePath.join(cwd, '.project', 'learnings', 'legacy.md'))).toBe(false);
    expect(readFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'utf8')).toBe('current\n');
    expect(existsSync(nodePath.join(cwd, '.safeword', 'namespace-migration-conflicts-v1'))).toBe(
      false,
    );
  });

  it('commits the complete merge when retired-tree cleanup fails', () => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.project'));

    const result = executeNamespaceMigration(cwd, {
      removeRetiredLegacy: () => {
        throw new Error('cleanup boundary');
      },
    });

    expect(result.method).toBe('merge');
    expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
    expect(readFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'utf8')).toContain(
      'user content',
    );
    expect(readdirSync(nodePath.join(cwd, '.safeword'))).toContain(
      `namespace-migration-retired-${process.pid}`,
    );
  });

  it('TB1.AC3.stale_per_file_overrides_rewritten — config rewrite', () => {
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

  it('does not follow a symlinked config while rewriting legacy paths', () => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword'));
    const external = nodePath.join(cwd, 'external-config.json');
    const externalContent = JSON.stringify({
      paths: { personas: '.safeword-project/personas.md' },
    });
    writeFileSync(external, externalContent);
    symlinkSync(external, nodePath.join(cwd, '.safeword', 'config.json'));

    executeNamespaceMigration(cwd);

    expect(readFileSync(external, 'utf8')).toBe(externalContent);
    expect(existsSync(nodePath.join(cwd, '.project', 'personas.md'))).toBe(true);
  });

  it.each([
    ['a string', '"legacy"'],
    ['an array', '[]'],
    ['null', 'null'],
  ])('ignores paths when it is %s', (_label, pathsJson) => {
    seedLegacy(cwd);
    mkdirSync(nodePath.join(cwd, '.safeword'));
    const configPath = nodePath.join(cwd, '.safeword', 'config.json');
    const content = `{ "paths": ${pathsJson} }\n`;
    writeFileSync(configPath, content);

    expect(() => executeNamespaceMigration(cwd)).not.toThrow();
    expect(readFileSync(configPath, 'utf8')).toBe(content);
  });
});
