/**
 * `.gitattributes merge=union` for generated artifacts (ticket GA7T6M, GitHub #566).
 *
 * safeword's committed-but-deterministically-regenerated artifacts (architecture docs +
 * ticket index) conflicted on every default-branch merge. Setup now ships a managed
 * `.gitattributes` block marking them `merge=union` (a built-in, attribute-only driver) so
 * local merges auto-resolve. These tests pin: the block reconciles at the resolved
 * namespace root, is idempotent, preserves a consumer's own `.gitattributes`, and that
 * `merge=union` actually makes git auto-resolve the conflict the issue reported.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reconcile } from '../src/reconcile.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';
import { createProjectContext } from '../src/utils/context.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from './helpers.js';

const HEADER = '# Safeword - managed merge strategy for generated artifacts';

describe('.gitattributes merge=union for generated artifacts (GA7T6M / #566)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
    writeFileSync(nodePath.join(cwd, 'package.json'), JSON.stringify({ name: 'consumer' }));
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  function gitattributes(): string {
    return readFileSync(nodePath.join(cwd, '.gitattributes'), 'utf8');
  }

  it('install writes the managed block marking the generated artifacts merge=union', async () => {
    await reconcile(SAFEWORD_SCHEMA, 'install', createProjectContext(cwd));

    const content = gitattributes();
    expect(content).toContain(HEADER);
    expect(content).toContain('**/architecture.generated.md merge=union linguist-generated=true');
    expect(content).toContain('.project/tickets/INDEX.md merge=union linguist-generated=true');
    expect(content).toContain(
      '.project/tickets/INDEX-completed.md merge=union linguist-generated=true',
    );
  });

  it('is idempotent — a second install does not duplicate the block', async () => {
    await reconcile(SAFEWORD_SCHEMA, 'install', createProjectContext(cwd));
    await reconcile(SAFEWORD_SCHEMA, 'install', createProjectContext(cwd));

    const unionLines = gitattributes()
      .split('\n')
      .filter(line => line.includes('merge=union'));
    expect(unionLines).toHaveLength(3);
  });

  it('resolves the ticket-index paths against a custom paths.projectRoot', async () => {
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot: 'team-ns' } }),
    );

    await reconcile(SAFEWORD_SCHEMA, 'install', createProjectContext(cwd));

    const content = gitattributes();
    expect(content).toContain('team-ns/tickets/INDEX.md merge=union linguist-generated=true');
    // The architecture-doc glob is root-agnostic, so it stays the same.
    expect(content).toContain('**/architecture.generated.md merge=union linguist-generated=true');
  });

  it("appends to (preserves) a consumer's existing .gitattributes", async () => {
    writeFileSync(nodePath.join(cwd, '.gitattributes'), '*.png binary\n');

    await reconcile(SAFEWORD_SCHEMA, 'install', createProjectContext(cwd));

    const content = gitattributes();
    expect(content).toContain('*.png binary'); // consumer's line survives
    expect(content).toContain(HEADER); // safeword block appended
  });

  it('marks only generated artifacts — never a hand-authored doc, a broad *.md, or a lockfile', async () => {
    // The danger of merge=union is an over-broad pattern silently both-sides-merging a
    // hand-maintained file with no conflict signal. Pin that every union line targets a
    // generated/derived artifact, and that the obvious leak targets are never marked.
    await reconcile(SAFEWORD_SCHEMA, 'install', createProjectContext(cwd));

    const content = gitattributes();
    const unionLines = content.split('\n').filter(line => line.includes('merge=union'));
    for (const line of unionLines) {
      expect(line).toMatch(/architecture\.generated\.md|tickets\/INDEX(-completed)?\.md/);
    }
    // The hand-authored ARCHITECTURE.md (what #562 reconciles), a blanket markdown glob, and
    // lockfiles must never be union-merged.
    expect(content).not.toMatch(/ARCHITECTURE\.md\s+merge=union/);
    expect(content).not.toMatch(/\*\.md\s+merge=union/);
    expect(content).not.toMatch(/lock[\w.]*\s+merge=union/i);
  });
});

describe('merge=union actually auto-resolves the #566 conflict (git-level)', () => {
  const created: string[] = [];

  function git(dir: string, ...args: string[]): void {
    execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  }
  function write(dir: string, relativePath: string, body: string): void {
    const abs = nodePath.join(dir, relativePath);
    mkdirSync(nodePath.dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }

  afterEach(() => {
    const directories = [...created];
    created.length = 0;
    for (const dir of directories) rmSync(dir, { recursive: true, force: true });
  });

  it('a generated-doc divergence that conflicts WITHOUT the attribute auto-merges WITH it', () => {
    const dir = mkdtempSync(nodePath.join(tmpdir(), 'union-'));
    created.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 't@t.co');
    git(dir, 'config', 'user.name', 't');
    write(dir, '.gitattributes', '.project/architecture.generated.md merge=union\n');
    write(dir, '.project/architecture.generated.md', '---\nfingerprint: AAAA\n---\n### web\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'base');

    git(dir, 'checkout', '-q', '-b', 'feature-1');
    write(
      dir,
      '.project/architecture.generated.md',
      '---\nfingerprint: BBBB\n---\n### web\n### billing\n',
    );
    git(dir, 'commit', '-qam', 'f1');

    git(dir, 'checkout', '-q', 'main');
    git(dir, 'checkout', '-q', '-b', 'feature-2');
    write(
      dir,
      '.project/architecture.generated.md',
      '---\nfingerprint: CCCC\n---\n### web\n### auth\n',
    );
    git(dir, 'commit', '-qam', 'f2');

    // Merge feature-1 into feature-2 — the issue's "merge the default branch in" shape.
    // Without `merge=union` this conflicts (verified separately); with it, git auto-resolves.
    git(dir, 'merge', 'feature-1'); // throws if the merge fails (conflict → non-zero exit)

    const merged = readFileSync(nodePath.join(dir, '.project/architecture.generated.md'), 'utf8');
    expect(merged).not.toContain('<<<<<<<');
    expect(merged).not.toContain('>>>>>>>');
  });
});
