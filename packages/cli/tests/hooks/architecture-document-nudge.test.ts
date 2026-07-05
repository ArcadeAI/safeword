/**
 * Unit + integration tests for the done-gate architecture-narrative staleness nudge
 * (ticket AXRC4D, GitHub #559; narrative resolution BY7RNR, GitHub #848). The nudge
 * fires when a ticket moved the top-level architecture fingerprint (the value recorded
 * in `<namespace>/architecture.generated.md`) vs the branch base AND the resolved
 * narrative exists — `paths.architecture` when configured (winning outright, even over
 * a present root file when its target is missing), root `ARCHITECTURE.md` otherwise.
 * Pure decision tests pin the boundary; the git-backed integration tests exercise the
 * real base-resolution path across the AXRC4D done_when flows plus the BY7RNR
 * narrative-location flows (TB1 rules of the feature source).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  architectureDocumentNudge,
  architectureDocumentNudgeForProject,
  architectureDocumentNudgeText,
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
  it('nudges when the fingerprint moved and the narrative exists (module added/removed)', () => {
    expect(
      architectureDocumentNudge({
        narrativeExists: true,
        narrativeDisplayPath: 'ARCHITECTURE.md',
        baseFingerprint: 'old',
        currentFingerprint: 'new',
      }),
    ).toBe(architectureDocumentNudgeText('ARCHITECTURE.md'));
  });

  it('nudges when the shape map was newly introduced this ticket (no base doc)', () => {
    expect(
      architectureDocumentNudge({
        narrativeExists: true,
        narrativeDisplayPath: 'ARCHITECTURE.md',
        baseFingerprint: undefined,
        currentFingerprint: 'new',
      }),
    ).toBe(architectureDocumentNudgeText('ARCHITECTURE.md'));
  });

  it('names the resolved narrative in the advisory text', () => {
    const nudge = architectureDocumentNudge({
      narrativeExists: true,
      narrativeDisplayPath: 'docs/agents/architecture.md',
      baseFingerprint: 'old',
      currentFingerprint: 'new',
    });
    expect(nudge).toContain('docs/agents/architecture.md');
    expect(nudge).not.toContain('(ARCHITECTURE.md)');
  });

  it('stays silent when the fingerprint is unchanged (in-sync / non-structural ticket)', () => {
    expect(
      architectureDocumentNudge({
        narrativeExists: true,
        narrativeDisplayPath: 'ARCHITECTURE.md',
        baseFingerprint: 'same',
        currentFingerprint: 'same',
      }),
    ).toBeNull();
  });

  it('stays silent when no narrative exists (audit owns the absent case)', () => {
    expect(
      architectureDocumentNudge({
        narrativeExists: false,
        narrativeDisplayPath: 'ARCHITECTURE.md',
        baseFingerprint: 'old',
        currentFingerprint: 'new',
      }),
    ).toBeNull();
  });

  it('stays silent when there is no generated shape doc to compare', () => {
    expect(
      architectureDocumentNudge({
        narrativeExists: true,
        narrativeDisplayPath: 'ARCHITECTURE.md',
        baseFingerprint: 'old',
        currentFingerprint: undefined,
      }),
    ).toBeNull();
  });
});

describe('architectureDocumentNudgeForProject (git-backed)', () => {
  const created: string[] = [];

  function git(cwd: string, ...args: string[]): void {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
  }

  /**
   * A repo on a feature branch whose upstream is `main` (so `@{u}` + merge-base
   * resolve); baseline doc has `baseFp`. `upstream: false` leaves the branch with no
   * upstream — the unresolvable-baseline case the nudge must fail closed on.
   * `narrativePath` writes the narrative somewhere other than root; `rawConfig`
   * writes `.safeword/config.json` verbatim (unparseable-config coverage).
   */
  function repoWithBaseline(
    baseFp: string,
    options: {
      architectureMd?: boolean;
      upstream?: boolean;
      narrativePath?: string;
      rawConfig?: string;
    } = {},
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
    if (options.narrativePath !== undefined) {
      const absolute = nodePath.join(dir, options.narrativePath);
      mkdirSync(nodePath.dirname(absolute), { recursive: true });
      writeFileSync(absolute, '# Architecture\n\nThe relocated narrative.\n');
    }
    if (options.rawConfig !== undefined) {
      mkdirSync(nodePath.join(dir, '.safeword'), { recursive: true });
      writeFileSync(nodePath.join(dir, '.safeword', 'config.json'), options.rawConfig);
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

  function architectureConfig(architecture: string): string {
    return JSON.stringify({ paths: { architecture } });
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

  describe('AXRC4D done_when flows (root fallback)', () => {
    it('new/removed module → fingerprint moved vs base → nudges, naming ARCHITECTURE.md', () => {
      const dir = repoWithBaseline('base-fp');
      setCurrentFingerprint(dir, 'moved-fp'); // a top-level module added/removed this ticket

      expect(architectureDocumentNudgeForProject(dir)).toBe(
        architectureDocumentNudgeText('ARCHITECTURE.md'),
      );
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

    it('no narrative anywhere → no nudge (audit create-from-template path owns it)', () => {
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

  describe('BY7RNR narrative resolution (paths.architecture)', () => {
    it('configured non-root narrative → nudges on movement, naming the configured path', () => {
      const dir = repoWithBaseline('base-fp', {
        architectureMd: false,
        narrativePath: 'docs/agents/architecture.md',
        rawConfig: architectureConfig('docs/agents/architecture.md'),
      });
      setCurrentFingerprint(dir, 'moved-fp');

      expect(architectureDocumentNudgeForProject(dir)).toBe(
        architectureDocumentNudgeText('docs/agents/architecture.md'),
      );
    });

    it('configured decision-record directory → counts as a narrative, nudges on movement', () => {
      const dir = repoWithBaseline('base-fp', {
        architectureMd: false,
        narrativePath: nodePath.join('docs', 'adr', '0001-first.md'),
        rawConfig: architectureConfig('docs/adr'),
      });
      setCurrentFingerprint(dir, 'moved-fp');

      expect(architectureDocumentNudgeForProject(dir)).toBe(
        architectureDocumentNudgeText('docs/adr'),
      );
    });

    it('configured target missing, no root file → no nudge', () => {
      const dir = repoWithBaseline('base-fp', {
        architectureMd: false,
        rawConfig: architectureConfig('docs/missing.md'),
      });
      setCurrentFingerprint(dir, 'moved-fp');

      expect(architectureDocumentNudgeForProject(dir)).toBeNull();
    });

    it('explicit configuration wins over a present root file even when its target is missing', () => {
      const dir = repoWithBaseline('base-fp', {
        rawConfig: architectureConfig('docs/missing.md'),
      });
      setCurrentFingerprint(dir, 'moved-fp');

      expect(architectureDocumentNudgeForProject(dir)).toBeNull();
    });

    it('unchanged fingerprint stays silent even with a configured narrative', () => {
      const dir = repoWithBaseline('same-fp', {
        architectureMd: false,
        narrativePath: 'docs/agents/architecture.md',
        rawConfig: architectureConfig('docs/agents/architecture.md'),
      });

      expect(architectureDocumentNudgeForProject(dir)).toBeNull();
    });

    it('unparseable config falls back to the root ARCHITECTURE.md', () => {
      const dir = repoWithBaseline('base-fp', { rawConfig: '{ not json' });
      setCurrentFingerprint(dir, 'moved-fp');

      expect(architectureDocumentNudgeForProject(dir)).toBe(
        architectureDocumentNudgeText('ARCHITECTURE.md'),
      );
    });

    it('empty-string paths.architecture behaves as unconfigured (root fallback)', () => {
      const dir = repoWithBaseline('base-fp', { rawConfig: architectureConfig('') });
      setCurrentFingerprint(dir, 'moved-fp');

      expect(architectureDocumentNudgeForProject(dir)).toBe(
        architectureDocumentNudgeText('ARCHITECTURE.md'),
      );
    });
  });
});
