import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RetroDraft } from './draft.js';
import { draftSpoolPath, readSpooledDrafts, spoolDrafts } from './draft-spool.js';

const draft = (signature: string, title = 'A friction'): RetroDraft => ({
  signature,
  title,
  body: `body for ${title}\n<!-- safeword-retro-signature: ${signature} -->`,
  labels: ['self-report', 'retro', 'rough-edge'],
});

describe('retro draft spool (BNGK9W — persist post-egress drafts on filing failure)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-spool-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('round-trips spooled drafts, keyed by session id', () => {
    const drafts = [draft('retro:aaaaaaaaaaaa', 'One'), draft('retro:bbbbbbbbbbbb', 'Two')];
    spoolDrafts(projectDirectory, 'sess-1', drafts);
    expect(readSpooledDrafts(projectDirectory, 'sess-1')).toEqual(drafts);
    // keyed by session id — a different session is independent
    expect(readSpooledDrafts(projectDirectory, 'sess-2')).toEqual([]);
  });

  it('appends across calls (delta re-fires accumulate into one session spool)', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa')]);
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:bbbbbbbbbbbb')]);
    expect(readSpooledDrafts(projectDirectory, 'sess-1')).toHaveLength(2);
  });

  it('reads an empty list when the spool is absent or unreadable (never throws)', () => {
    expect(readSpooledDrafts(projectDirectory, 'never-spooled')).toEqual([]);
    const tornPath = draftSpoolPath(projectDirectory, 'torn');
    mkdirSync(nodePath.dirname(tornPath), { recursive: true });
    writeFileSync(tornPath, '{"signature":"retro:', 'utf8'); // truncated JSONL
    expect(readSpooledDrafts(projectDirectory, 'torn')).toEqual([]);
  });

  it('caps the spool so a runaway session cannot grow it without bound', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      draft(`retro:${i.toString().padStart(12, '0')}`, `f${i}`),
    );
    spoolDrafts(projectDirectory, 'sess-1', many);
    expect(readSpooledDrafts(projectDirectory, 'sess-1').length).toBeLessThanOrEqual(20);
  });

  it('writes only the code-assembled draft fields (no extra keys reach disk)', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa')]);
    const raw = readFileSync(draftSpoolPath(projectDirectory, 'sess-1'), 'utf8').trim();
    expect(Object.keys(JSON.parse(raw)).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'body',
      'labels',
      'signature',
      'title',
    ]);
  });
});
