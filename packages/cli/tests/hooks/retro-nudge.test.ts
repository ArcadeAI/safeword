import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { spoolDrafts } from '../../templates/hooks/lib/retro-draft-spool.js';
import { decideRetroFilingNudge, formatRetroNudge } from '../../templates/hooks/lib/retro-nudge.js';
import { retroDraft as draft } from '../helpers.js';

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
    expect(line).toContain('observed them queued'); // time-bounded to this filesystem read
    expect(line).not.toContain('remain queued'); // does not promise later state
    // None of the banned imperative markers, as whole words (so "unfiled"/"filing" are fine).
    for (const marker of [/\brun\b/i, /\bfile\b/i, /\bplease\b/i, /\byou must\b/i, /\bshould\b/i]) {
      expect(marker.test(line)).toBe(false);
    }
  });

  it('is a single line', () => {
    expect(formatRetroNudge(1, '/proj/.safeword/retro-drafts/sess-1.jsonl')).not.toContain('\n');
  });

  // #1900: this line lands in the transcript retro's own extractor mines, so
  // diagnosing the spool as a transport failure made it auto-file a bug against a
  // working subsystem. Pin the whole string — an exact-phrase `toContain` breaks on
  // compliant rewording while still admitting a non-matching rephrasing of the very
  // diagnosis it exists to forbid.
  it('renders the exact nudge wording', () => {
    expect(formatRetroNudge(2, '/proj/.safeword/retro-drafts/sess-1.jsonl')).toBe(
      "Safeword's retro spooled 2 unfiled findings from this session at " +
        '/proj/.safeword/retro-drafts/sess-1.jsonl; the CLI process has no GitHub credential of ' +
        "its own. This handoff is safeword's normal filing lane in agent sessions, not a defect. " +
        'This boundary observed them queued for the safeword-retro-filer subagent (or the live ' +
        "agent's GitHub access); the filing path re-reads the spool before reporting what " +
        'remains. The filing procedure is in .safeword/guides/self-report-filing.md.',
    );
  });

  // The class of claim that is banned, not three literal spellings of it — the old
  // guard let "its transport is unauthorized in this environment" through untouched.
  it('makes no claim that the transport failed or was rejected', () => {
    const line = formatRetroNudge(2, '/proj/.safeword/retro-drafts/sess-1.jsonl');
    for (const diagnosis of [
      /authenticat/i,
      /unauthori[sz]ed/i,
      /\b401\b/,
      /\bbroken\b/i,
      /\bfailed\b|\bfailure\b/i,
      /\brejected\b/i,
      /credential (error|problem|failure)/i,
    ]) {
      expect(diagnosis.test(line), `nudge must not assert: ${diagnosis}`).toBe(false);
    }
  });
});
