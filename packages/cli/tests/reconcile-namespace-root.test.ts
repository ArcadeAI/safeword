/**
 * Namespace-root scaffolding tests (ticket N9S5XG, epic AQJ95G).
 *
 * setup/upgrade/diff/reset scaffold and reconcile at the resolved namespace
 * root — `.project/` for fresh repos, an adopted existing `.project/`, the
 * legacy `.safeword-project/` where only it exists, or a configured
 * `paths.projectRoot`. Scenario lineage: setup-scaffolds-project-dir.DEV1.*
 * (test-definitions.md in the ticket folder).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reconcile } from '../src/reconcile.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';
import { createProjectContext } from '../src/utils/context.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from './helpers.js';

const NAMESPACE_DIRECTORIES = ['learnings', 'tickets', 'tickets/completed', 'tmp'];

function listTree(root: string): string[] {
  return existsSync(root) ? readdirSync(root, { recursive: true }).map(String) : [];
}

describe('reconcile scaffolds at the resolved namespace root (N9S5XG)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
    writeFileSync(
      nodePath.join(cwd, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' }),
    );
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  async function runInstall() {
    return reconcile(SAFEWORD_SCHEMA, 'install', createProjectContext(cwd));
  }

  it('DEV1.AC1.fresh_setup_creates_project_namespace', async () => {
    await runInstall();

    for (const directory of NAMESPACE_DIRECTORIES) {
      expect(existsSync(nodePath.join(cwd, '.project', directory)), directory).toBe(true);
    }
    expect(readFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'utf8')).toContain(
      '# Personas',
    );
    expect(readFileSync(nodePath.join(cwd, '.project', 'glossary.md'), 'utf8')).toContain(
      '# Glossary',
    );
  });

  it('DEV1.AC1.fresh_setup_creates_no_legacy_dir', async () => {
    await runInstall();

    expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
  });

  it('DEV1.AC2.existing_personas_survive_setup_byte_identical', async () => {
    const personas = '# Personas\n\n## Platform Operator (PO)\n\n**Role:** Owns infra.\n';
    mkdirSync(nodePath.join(cwd, '.project'));
    writeFileSync(nodePath.join(cwd, '.project', 'personas.md'), personas);

    await runInstall();

    expect(readFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'utf8')).toBe(personas);
    expect(existsSync(nodePath.join(cwd, '.project', 'glossary.md'))).toBe(true);
    for (const directory of NAMESPACE_DIRECTORIES) {
      expect(existsSync(nodePath.join(cwd, '.project', directory)), directory).toBe(true);
    }
  });

  it('DEV1.AC2.partial_project_dir_gets_missing_pieces', async () => {
    mkdirSync(nodePath.join(cwd, '.project'));
    writeFileSync(nodePath.join(cwd, '.project', 'personas.md'), '# Personas\n');

    await runInstall();

    for (const piece of ['tickets/completed', 'learnings', 'tmp', 'glossary.md']) {
      expect(existsSync(nodePath.join(cwd, '.project', piece)), piece).toBe(true);
    }
    expect(readFileSync(nodePath.join(cwd, '.project', 'personas.md'), 'utf8')).toBe(
      '# Personas\n',
    );
  });

  it('DEV1.AC2.both_dirs_setup_operates_only_on_project', async () => {
    mkdirSync(nodePath.join(cwd, '.project'));
    mkdirSync(nodePath.join(cwd, '.safeword-project', 'tickets'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword-project', 'personas.md'), 'legacy personas\n');
    const legacyBefore = listTree(nodePath.join(cwd, '.safeword-project'));

    await runInstall();

    expect(existsSync(nodePath.join(cwd, '.project', 'glossary.md'))).toBe(true);
    expect(listTree(nodePath.join(cwd, '.safeword-project'))).toEqual(legacyBefore);
    expect(readFileSync(nodePath.join(cwd, '.safeword-project', 'personas.md'), 'utf8')).toBe(
      'legacy personas\n',
    );
  });

  it('DEV1.AC3.legacy_setup_stays_legacy', async () => {
    mkdirSync(nodePath.join(cwd, '.safeword-project', 'tickets'), { recursive: true });

    await runInstall();

    expect(existsSync(nodePath.join(cwd, '.safeword-project', 'personas.md'))).toBe(true);
    expect(existsSync(nodePath.join(cwd, '.safeword-project', 'glossary.md'))).toBe(true);
    expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
  });

  it('DEV1.AC3.legacy_upgrade_stays_legacy', async () => {
    mkdirSync(nodePath.join(cwd, '.safeword-project', 'tickets'), { recursive: true });

    await reconcile(SAFEWORD_SCHEMA, 'upgrade', createProjectContext(cwd));

    expect(existsSync(nodePath.join(cwd, '.safeword-project', 'personas.md'))).toBe(true);
    expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
  });

  it('DEV1.AC4.configured_root_scaffolds_there', async () => {
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'team-ns' } }),
    );

    await runInstall();

    for (const directory of NAMESPACE_DIRECTORIES) {
      expect(existsSync(nodePath.join(cwd, 'team-ns', directory)), directory).toBe(true);
    }
    expect(existsSync(nodePath.join(cwd, 'team-ns', 'personas.md'))).toBe(true);
    expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
    expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
  });

  // Issue #272: the static repo-root .gitignore block names only `.project/` and
  // `.safeword-project/`, so a custom paths.projectRoot's transient files would
  // leak into `git status`. The per-root .gitignore (written into the resolved
  // root) covers it — and never ignores durable knowledge files.
  it('DEV1.AC4.configured_root_gets_transient_gitignore', async () => {
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'team-ns' } }),
    );

    await runInstall();

    const gitignore = readFileSync(nodePath.join(cwd, 'team-ns', '.gitignore'), 'utf8');
    // Leading-slash-anchored so they match only the root-level transient files,
    // not a same-named file deeper in the tree (e.g. tickets/.../re-entry.md).
    for (const name of [
      '/quality-state*.json',
      '/failure-counts.json',
      '/skill-invocations.log',
      '/re-entry.md',
      '/dependency-readiness.json',
    ]) {
      expect(gitignore).toContain(name);
    }
    // Durable siblings must stay tracked — no bare wildcard, and every pattern
    // is root-anchored (starts with `/`) so it can't recurse into tickets/.
    expect(gitignore).not.toMatch(/^\*\s*$/m);
    expect(gitignore).not.toContain('tickets');
    for (const line of gitignore.split('\n')) {
      if (line === '' || line.startsWith('#')) continue;
      expect(line.startsWith('/'), `pattern must be root-anchored: ${line}`).toBe(true);
    }
  });

  it('DEV1.AC4.default_root_gets_transient_gitignore', async () => {
    await runInstall();

    const gitignore = readFileSync(nodePath.join(cwd, '.project', '.gitignore'), 'utf8');
    expect(gitignore).toContain('/re-entry.md');
    expect(gitignore).toContain('/quality-state*.json');
    expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
  });

  // paths.projectRoot: '.' resolves the namespace to the repo root, where a
  // per-root .gitignore would BE the user's own root .gitignore. Install must
  // not clobber it, and a full uninstall must not delete it (issue #272 review).
  it('DEV1.AC4.repo_root_namespace_never_manages_root_gitignore', async () => {
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: '.' } }),
    );
    const rootGitignore = nodePath.join(cwd, '.gitignore');
    writeFileSync(rootGitignore, 'node_modules/\nmy-secret.env\n');

    await runInstall();
    // Our managed transient block is never appended as a per-root file here, and
    // the user's content survives untouched.
    expect(readFileSync(rootGitignore, 'utf8')).toContain('my-secret.env');

    await reconcile(SAFEWORD_SCHEMA, 'uninstall-full', createProjectContext(cwd));
    expect(existsSync(rootGitignore), 'root .gitignore must survive full uninstall').toBe(true);
    expect(readFileSync(rootGitignore, 'utf8')).toContain('my-secret.env');
  });

  it('DEV1.AC4.upgrade_on_project_repo_stays_project', async () => {
    await runInstall();
    const glossaryPath = nodePath.join(cwd, '.project', 'glossary.md');
    rmSync(glossaryPath);

    await reconcile(SAFEWORD_SCHEMA, 'upgrade', createProjectContext(cwd));

    expect(existsSync(glossaryPath)).toBe(true);
    expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
  });

  it('DEV1.AC4.reset_preserves_namespace_at_resolved_root', async () => {
    await runInstall();
    const ticketDirectory = nodePath.join(cwd, '.project', 'tickets', 'ABC123-keep-me');
    mkdirSync(ticketDirectory, { recursive: true });
    writeFileSync(nodePath.join(ticketDirectory, 'ticket.md'), '---\nid: ABC123\n---\n');

    await reconcile(SAFEWORD_SCHEMA, 'uninstall', createProjectContext(cwd));

    expect(existsSync(nodePath.join(cwd, '.project', 'tmp'))).toBe(false);
    expect(existsSync(nodePath.join(ticketDirectory, 'ticket.md'))).toBe(true);
    expect(existsSync(nodePath.join(cwd, '.safeword'))).toBe(false);
  });

  it('DEV1.AC4.repo_root_configured_namespace_lands_at_cwd', async () => {
    // paths.projectRoot '.' = namespace at the repo root — reconcile must
    // agree with the runtime resolver instead of falling back to legacy.
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: '.' } }),
    );

    await runInstall();

    expect(existsSync(nodePath.join(cwd, 'personas.md'))).toBe(true);
    expect(existsSync(nodePath.join(cwd, 'tickets', 'completed'))).toBe(true);
    expect(existsSync(nodePath.join(cwd, '.safeword-project'))).toBe(false);
    expect(existsSync(nodePath.join(cwd, '.project'))).toBe(false);
  });

  it('DEV1.AC4.diff_reports_clean_after_fresh_setup', async () => {
    await runInstall();

    const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', createProjectContext(cwd), {
      dryRun: true,
    });

    const namespaceCreates = [...result.created, ...result.updated].filter(path =>
      path.includes('.safeword-project'),
    );
    expect(namespaceCreates).toEqual([]);
  });
});
