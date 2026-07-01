import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { SpooledDraft } from '../../templates/hooks/lib/retro-draft-spool.js';
import {
  draftSpoolPath,
  markDraftsFiled,
  readSpooledDrafts,
  spoolDrafts,
} from '../../templates/hooks/lib/retro-draft-spool.js';

const draft = (signature: string, title = 'A friction'): SpooledDraft => ({
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

describe('markDraftsFiled (BNGK9W — drain filed drafts so they neither re-nudge nor re-file)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-spool-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('drains a filed draft from the persisted spool, leaving the unfiled one (fresh re-read)', () => {
    spoolDrafts(projectDirectory, 'sess-1', [
      draft('retro:aaaaaaaaaaaa', 'Filed'),
      draft('retro:bbbbbbbbbbbb', 'Unfiled'),
    ]);
    markDraftsFiled(projectDirectory, 'sess-1', ['retro:aaaaaaaaaaaa']);
    // A FRESH read of the persisted file — an in-memory-only drain would still show both.
    expect(readSpooledDrafts(projectDirectory, 'sess-1')).toEqual([
      draft('retro:bbbbbbbbbbbb', 'Unfiled'),
    ]);
  });

  it('drains only the filed subset on a partial result (the rest stay spooled for retry)', () => {
    spoolDrafts(projectDirectory, 'sess-1', [
      draft('retro:aaaaaaaaaaaa', 'One'),
      draft('retro:bbbbbbbbbbbb', 'Two'),
      draft('retro:cccccccccccc', 'Three'),
    ]);
    markDraftsFiled(projectDirectory, 'sess-1', ['retro:aaaaaaaaaaaa', 'retro:cccccccccccc']);
    expect(readSpooledDrafts(projectDirectory, 'sess-1')).toEqual([
      draft('retro:bbbbbbbbbbbb', 'Two'),
    ]);
  });

  it('is a no-op for a signature not in the spool (never drops an unmatched draft)', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa')]);
    markDraftsFiled(projectDirectory, 'sess-1', ['retro:zzzzzzzzzzzz']);
    expect(readSpooledDrafts(projectDirectory, 'sess-1')).toEqual([draft('retro:aaaaaaaaaaaa')]);
  });

  it('draining every draft leaves an empty spool, not a crash on the next read', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa')]);
    markDraftsFiled(projectDirectory, 'sess-1', ['retro:aaaaaaaaaaaa']);
    expect(readSpooledDrafts(projectDirectory, 'sess-1')).toEqual([]);
  });

  it('never throws when the spool is absent (fail-open, like spoolDrafts)', () => {
    expect(() => {
      markDraftsFiled(projectDirectory, 'never-spooled', ['retro:aaaaaaaaaaaa']);
    }).not.toThrow();
    expect(readSpooledDrafts(projectDirectory, 'never-spooled')).toEqual([]);
  });
});
