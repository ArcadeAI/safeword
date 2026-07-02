import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { spoolDrafts, type SpooledDraft } from '../../templates/hooks/lib/retro-draft-spool.js';
import { decideRetroFilingNudge, formatRetroNudge } from '../../templates/hooks/lib/retro-nudge.js';

const draft = (signature: string, title = 'A friction'): SpooledDraft => ({
  signature,
  title,
  body: `body for ${title}\n<!-- safeword-retro-signature: ${signature} -->`,
  labels: ['self-report', 'retro', 'rough-edge'],
});

describe('retro nudge decision (BNGK9W — one factual line per unfiled batch)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-nudge-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('surfaces exactly one factual line referencing the count when unfiled drafts exist', () => {
    spoolDrafts(projectDirectory, 'sess-1', [
      draft('retro:aaaaaaaaaaaa'),
      draft('retro:bbbbbbbbbbbb'),
      draft('retro:cccccccccccc'),
    ]);
    const line = decideRetroFilingNudge(projectDirectory, 'sess-1');
    expect(line).toBeDefined();
    expect(line).not.toContain('\n'); // exactly one line
    expect(line).toContain('3'); // references the count
  });

  it('stays silent when there are no unfiled drafts', () => {
    expect(decideRetroFilingNudge(projectDirectory, 'sess-1')).toBeUndefined();
  });

  it('nudges once per unfiled batch — a fresh evaluation of the same set is silent', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa')]);
    expect(decideRetroFilingNudge(projectDirectory, 'sess-1')).toBeDefined();
    // A fresh boundary reads the PERSISTED marker — the same batch must not re-nudge.
    expect(decideRetroFilingNudge(projectDirectory, 'sess-1')).toBeUndefined();
  });

  it('nudges again when the batch gains a new unfiled draft', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa')]);
    expect(decideRetroFilingNudge(projectDirectory, 'sess-1')).toBeDefined();
    expect(decideRetroFilingNudge(projectDirectory, 'sess-1')).toBeUndefined();
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:bbbbbbbbbbbb')]);
    expect(decideRetroFilingNudge(projectDirectory, 'sess-1')).toBeDefined();
  });
});

describe('formatRetroNudge (BNGK9W — a statement, never an imperative)', () => {
  it('names the count and where the drafts are, with no imperative markers', () => {
    const line = formatRetroNudge(2, '/proj/.safeword/retro-drafts/sess-1.jsonl');
    expect(line).toContain('2'); // the count
    expect(line).toContain('.safeword/retro-drafts/sess-1.jsonl'); // where they are
    // None of the banned imperative markers, as whole words (so "unfiled"/"filing" are fine).
    for (const marker of [/\brun\b/i, /\bfile\b/i, /\bplease\b/i, /\byou must\b/i, /\bshould\b/i]) {
      expect(marker.test(line)).toBe(false);
    }
  });

  it('is a single line', () => {
    expect(formatRetroNudge(1, '/proj/.safeword/retro-drafts/sess-1.jsonl')).not.toContain('\n');
  });
});
