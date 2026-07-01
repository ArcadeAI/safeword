/**
 * Unit + integration tests for the done-gate ARCHITECTURE.md staleness nudge
 * (ticket AXRC4D, GitHub #559). The nudge fires when a ticket moved the top-level
 * architecture fingerprint (the value recorded in `<namespace>/architecture.generated.md`)
 * vs the branch base AND a human `ARCHITECTURE.md` exists — reusing the existing
 * fingerprint as a cheap, deterministic trigger. Pure decision tests pin the boundary;
 * the git-backed integration test exercises the real base-resolution path and maps to the
 * five AXRC4D done_when flows (new module, removed module, in-sync, non-structural, absent).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ARCHITECTURE_DOCUMENT_NUDGE,
  architectureDocumentNudge,
  architectureDocumentNudgeForProject,
  parseGeneratedFingerprint,
} from '../../templates/hooks/lib/architecture-document-nudge.js';

function generatedDocument(fingerprint: string): string {
  return `---\ngenerator: safeword-architecture\nfingerprint: ${fingerprint}\n---\n\n# Architecture\n\n## Modules\n`;
}

describe('parseGeneratedFingerprint', () => {
  it('reads the fingerprint from a generated-doc frontmatter', () => {
    expect(parseGeneratedFingerprint(generatedDocument('abc123'))).toBe('abc123');
  });

  it('is CRLF-tolerant', () => {
    expect(parseGeneratedFingerprint('---\r\nfingerprint: deadbeef\r\n---\r\n')).toBe('deadbeef');
  });

  it('returns undefined when there is no frontmatter', () => {
    expect(parseGeneratedFingerprint('# Architecture\n\nno frontmatter here')).toBeUndefined();
  });

  it('returns undefined for an empty fingerprint value', () => {
    expect(parseGeneratedFingerprint('---\nfingerprint:\n---\n')).toBeUndefined();
  });

  it('returns undefined for empty content', () => {
    expect(parseGeneratedFingerprint('')).toBeUndefined();
  });
});

describe('architectureDocumentNudge (pure decision)', () => {
  it('nudges when the fingerprint moved and ARCHITECTURE.md exists (module added/removed)', () => {
    expect(
      architectureDocumentNudge({
        architectureMdExists: true,
        baseFingerprint: 'old',
        currentFingerprint: 'new',
      }),
    ).toBe(ARCHITECTURE_DOCUMENT_NUDGE);
  });

  it('nudges when the shape map was newly introduced this ticket (no base doc)', () => {
    expect(
      architectureDocumentNudge({
        architectureMdExists: true,
        baseFingerprint: undefined,
        currentFingerprint: 'new',
      }),
    ).toBe(ARCHITECTURE_DOCUMENT_NUDGE);
  });

  it('stays silent when the fingerprint is unchanged (in-sync / non-structural ticket)', () => {
    expect(
      architectureDocumentNudge({
        architectureMdExists: true,
        baseFingerprint: 'same',
        currentFingerprint: 'same',
      }),
    ).toBeNull();
  });

  it('stays silent when no human ARCHITECTURE.md exists (audit owns the absent case)', () => {
    expect(
      architectureDocumentNudge({
        architectureMdExists: false,
        baseFingerprint: 'old',
        currentFingerprint: 'new',
      }),
    ).toBeNull();
  });

  it('stays silent when there is no generated shape doc to compare', () => {
    expect(
      architectureDocumentNudge({
        architectureMdExists: true,
        baseFingerprint: 'old',
        currentFingerprint: undefined,
      }),
    ).toBeNull();
  });
});

describe('architectureDocumentNudgeForProject (git-backed, AXRC4D done_when flows)', () => {
  const created: string[] = [];

  function git(cwd: string, ...args: string[]): void {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
  }

  /**
   * A repo on a feature branch whose upstream is `main` (so `@{u}` + merge-base
   * resolve); baseline doc has `baseFp`. `upstream: false` leaves the branch with no
   * upstream — the unresolvable-baseline case the nudge must fail closed on.
   */
  function repoWithBaseline(
    baseFp: string,
    options: { architectureMd?: boolean; upstream?: boolean } = {},
  ): string {
    const dir = mkdtempSync(nodePath.join(tmpdir(), 'arch-drift-'));
    created.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'test@example.com');
    git(dir, 'config', 'user.name', 'Test');
    if (options.architectureMd !== false) {
      writeFileSync(
        nodePath.join(dir, 'ARCHITECTURE.md'),
        '# Architecture\n\nThe human narrative.\n',
      );
    }
    mkdirSync(nodePath.join(dir, '.project'), { recursive: true });
    writeFileSync(
      nodePath.join(dir, '.project', 'architecture.generated.md'),
      generatedDocument(baseFp),
    );
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'baseline');
    // Diverge onto a feature branch tracking main — `@{u}` resolves to main.
    git(dir, 'checkout', '-q', '-b', 'feature');
    if (options.upstream !== false) git(dir, 'branch', '--set-upstream-to=main', 'feature');
    return dir;
  }

  function setCurrentFingerprint(dir: string, fingerprint: string): void {
    writeFileSync(
      nodePath.join(dir, '.project', 'architecture.generated.md'),
      generatedDocument(fingerprint),
    );
  }

  afterEach(() => {
    const directories = [...created];
    created.length = 0;
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  });

  it('new/removed module → fingerprint moved vs base → nudges', () => {
    const dir = repoWithBaseline('base-fp');
    setCurrentFingerprint(dir, 'moved-fp'); // a top-level module added/removed this ticket

    expect(architectureDocumentNudgeForProject(dir)).toBe(ARCHITECTURE_DOCUMENT_NUDGE);
  });

  it('in-sync (fingerprint unchanged) → no nudge', () => {
    const dir = repoWithBaseline('same-fp');
    // working tree leaves the generated doc untouched

    expect(architectureDocumentNudgeForProject(dir)).toBeNull();
  });

  it('non-structural ticket (shape doc unchanged) → no nudge', () => {
    const dir = repoWithBaseline('same-fp');
    writeFileSync(nodePath.join(dir, 'README.md'), 'docs only, no shape change\n'); // unrelated edit

    expect(architectureDocumentNudgeForProject(dir)).toBeNull();
  });

  it('ARCHITECTURE.md absent → no nudge (audit create-from-template path owns it)', () => {
    const dir = repoWithBaseline('base-fp', { architectureMd: false });
    setCurrentFingerprint(dir, 'moved-fp');

    expect(architectureDocumentNudgeForProject(dir)).toBeNull();
  });

  it('unresolvable baseline (no upstream) → no nudge, even when the fingerprint moved', () => {
    // The fail-closed boundary the no-false-alarm design rests on: with no upstream,
    // `@{u}` / merge-base can't resolve, so the nudge must NOT guess that the shape moved.
    const dir = repoWithBaseline('base-fp', { upstream: false });
    setCurrentFingerprint(dir, 'moved-fp');

    expect(architectureDocumentNudgeForProject(dir)).toBeNull();
  });
});
