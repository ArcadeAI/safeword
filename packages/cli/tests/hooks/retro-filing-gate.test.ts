import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  draftSpoolPath,
  markDraftsFiled,
  spoolDrafts,
  type SpooledDraft,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import {
  decideRetroFilingGate,
  FILER_AGENT_NAME,
  FILING_ATTEMPT_CAP,
  formatFilingDispatch,
} from '../../templates/hooks/lib/retro-filing-gate.js';

const draft = (signature: string, title = 'A friction'): SpooledDraft => ({
  signature,
  title,
  body: `body for ${title}\n<!-- safeword-retro-signature: ${signature} -->`,
  labels: ['self-report', 'retro', 'rough-edge'],
});

describe('retro filing gate decision (GH628F — dispatch until drained, capped)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-filing-gate-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('emits the dispatch naming the filer agent, spool path, and count for unfiled drafts', () => {
    spoolDrafts(projectDirectory, 'sess-1', [
      draft('retro:aaaaaaaaaaaa'),
      draft('retro:bbbbbbbbbbbb'),
    ]);
    const dispatch = decideRetroFilingGate(projectDirectory, 'sess-1');
    expect(dispatch).toBeDefined();
    expect(dispatch).toContain(FILER_AGENT_NAME);
    expect(dispatch).toContain(draftSpoolPath(projectDirectory, 'sess-1'));
    expect(dispatch).toContain('2');
  });

  it('stays silent when the spool is absent', () => {
    expect(decideRetroFilingGate(projectDirectory, 'sess-1')).toBeUndefined();
  });

  it('stays silent once the filer drained the spool (the ack)', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa')]);
    expect(decideRetroFilingGate(projectDirectory, 'sess-1')).toBeDefined();
    markDraftsFiled(projectDirectory, 'sess-1', ['retro:aaaaaaaaaaaa']);
    expect(decideRetroFilingGate(projectDirectory, 'sess-1')).toBeUndefined();
  });

  it(`re-fires for an undrained batch up to ${FILING_ATTEMPT_CAP} attempts, then goes quiet`, () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa')]);
    for (let attempt = 1; attempt <= FILING_ATTEMPT_CAP; attempt++) {
      // Each evaluation is a fresh boundary reading the PERSISTED counter.
      expect(decideRetroFilingGate(projectDirectory, 'sess-1')).toBeDefined();
    }
    expect(decideRetroFilingGate(projectDirectory, 'sess-1')).toBeUndefined();
  });

  it('re-arms the attempt budget when the batch gains a draft', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa')]);
    for (let attempt = 1; attempt <= FILING_ATTEMPT_CAP; attempt++) {
      decideRetroFilingGate(projectDirectory, 'sess-1');
    }
    expect(decideRetroFilingGate(projectDirectory, 'sess-1')).toBeUndefined();
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:bbbbbbbbbbbb')]);
    expect(decideRetroFilingGate(projectDirectory, 'sess-1')).toBeDefined();
  });

  it('keys the attempt budget per session spool', () => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa')]);
    spoolDrafts(projectDirectory, 'sess-2', [draft('retro:aaaaaaaaaaaa')]);
    for (let attempt = 1; attempt <= FILING_ATTEMPT_CAP; attempt++) {
      decideRetroFilingGate(projectDirectory, 'sess-1');
    }
    expect(decideRetroFilingGate(projectDirectory, 'sess-1')).toBeUndefined();
    expect(decideRetroFilingGate(projectDirectory, 'sess-2')).toBeDefined();
  });
});

describe('formatFilingDispatch (GH628F — one dispatch action plus silence contract)', () => {
  it('requests the subagent dispatch and forbids inline filing and narration', () => {
    const text = formatFilingDispatch(1, '/proj/.safeword/retro-drafts/sess-1.jsonl');
    expect(text).toContain(FILER_AGENT_NAME);
    expect(text).toContain('/proj/.safeword/retro-drafts/sess-1.jsonl');
    expect(text.toLowerCase()).toContain('do not file them inline');
    expect(text.toLowerCase()).toContain('do not narrate');
  });

  it('contains no inline filing procedure (no dedup/search/create steps)', () => {
    const text = formatFilingDispatch(3, '/proj/.safeword/retro-drafts/sess-1.jsonl');
    for (const procedureWord of [/dedup/i, /search issues/i, /create an issue/i, /\blabels\b/i]) {
      expect(procedureWord.test(text)).toBe(false);
    }
  });
});
