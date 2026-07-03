import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ackFilePath,
  draftSpoolPath,
  markDraftsFiled,
  spoolDrafts,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import {
  decideRetroFilingGate,
  FILER_AGENT_NAME,
  FILING_ATTEMPT_CAP,
  formatFilingDispatch,
} from '../../templates/hooks/lib/retro-filing-gate.js';
import { retroDraft as draft, writeSelfReportConfig } from '../helpers.js';

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

// ---------------------------------------------------------------------------
// GH644A — bare-drain tripwire: acks are the only proof a removed draft was
// filed; an unacked removal captures ONE RetroBareDrain signal per batch.
// ---------------------------------------------------------------------------
describe('retro filing tripwire (GH644A — unacked removals become telemetry)', () => {
  let projectDirectory: string;
  let trips: number;
  const spy = (): void => {
    trips += 1;
  };
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-tripwire-'));
    trips = 0;
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  /** Dispatch once (snapshots the batch), optionally drain signatures bare. */
  function dispatchBatch(sessionId: string, signatures: string[]): void {
    spoolDrafts(
      projectDirectory,
      sessionId,
      signatures.map(s => draft(s)),
    );
    decideRetroFilingGate(projectDirectory, sessionId, { captureBareDrain: spy });
  }
  function ack(sessionId: string, signature: string, issue: number): void {
    mkdirSync(nodePath.dirname(ackFilePath(projectDirectory, sessionId)), { recursive: true });
    appendFileSync(
      ackFilePath(projectDirectory, sessionId),
      `${JSON.stringify({ signature, issue })}\n`,
    );
  }
  const evaluate = (sessionId: string): string | undefined =>
    decideRetroFilingGate(projectDirectory, sessionId, { captureBareDrain: spy });

  it('captures exactly one RetroBareDrain for a dispatched signature gone without an ack', () => {
    dispatchBatch('s1', ['retro:aaaaaaaaaaaa']);
    markDraftsFiled(projectDirectory, 's1', ['retro:aaaaaaaaaaaa']); // bare drain, no ack
    expect(trips).toBe(0);
    evaluate('s1');
    expect(trips).toBe(1);
  });

  it('does not trip the same batch twice', () => {
    dispatchBatch('s1', ['retro:aaaaaaaaaaaa']);
    markDraftsFiled(projectDirectory, 's1', ['retro:aaaaaaaaaaaa']);
    evaluate('s1');
    evaluate('s1');
    expect(trips).toBe(1);
  });

  it('re-arms for a new dispatched batch after an earlier trip', () => {
    dispatchBatch('s1', ['retro:aaaaaaaaaaaa']);
    markDraftsFiled(projectDirectory, 's1', ['retro:aaaaaaaaaaaa']);
    evaluate('s1'); // trip 1
    dispatchBatch('s1', ['retro:bbbbbbbbbbbb']); // new batch snapshot
    markDraftsFiled(projectDirectory, 's1', ['retro:bbbbbbbbbbbb']); // bare again
    evaluate('s1');
    expect(trips).toBe(2);
  });

  it('stays silent when every removed signature is shape-validly acked', () => {
    dispatchBatch('s1', ['retro:aaaaaaaaaaaa', 'retro:bbbbbbbbbbbb']);
    ack('s1', 'retro:aaaaaaaaaaaa', 101);
    ack('s1', 'retro:bbbbbbbbbbbb', 102);
    markDraftsFiled(projectDirectory, 's1', ['retro:aaaaaaaaaaaa', 'retro:bbbbbbbbbbbb']);
    evaluate('s1');
    expect(trips).toBe(0);
  });

  it('skips torn ack lines and still trips once for the unacked removal', () => {
    dispatchBatch('s1', ['retro:aaaaaaaaaaaa', 'retro:bbbbbbbbbbbb']);
    ack('s1', 'retro:aaaaaaaaaaaa', 101);
    appendFileSync(ackFilePath(projectDirectory, 's1'), '{"signature": "retro:bb'); // torn
    markDraftsFiled(projectDirectory, 's1', ['retro:aaaaaaaaaaaa', 'retro:bbbbbbbbbbbb']);
    expect(() => evaluate('s1')).not.toThrow();
    expect(trips).toBe(1);
  });

  it('stays silent while every dispatched signature still sits in the spool', () => {
    dispatchBatch('s1', ['retro:aaaaaaaaaaaa']);
    evaluate('s1');
    expect(trips).toBe(0);
  });

  it.each([
    [
      'pre-upgrade marker without snapshot',
      (s: string) => {
        writeFileSync(
          nodePath.join(projectDirectory, '.safeword/retro-drafts', `${s}.filing-attempts`),
          '{"key":"k","attempts":1}\n',
        );
      },
    ],
    ['missing marker', () => {}],
    [
      'corrupt marker',
      (s: string) => {
        writeFileSync(
          nodePath.join(projectDirectory, '.safeword/retro-drafts', `${s}.filing-attempts`),
          'not json',
        );
      },
    ],
  ])('fails open after a drain with a %s', (_label, seed) => {
    spoolDrafts(projectDirectory, 's1', [draft('retro:aaaaaaaaaaaa')]);
    markDraftsFiled(projectDirectory, 's1', ['retro:aaaaaaaaaaaa']); // emptied, no dispatch state
    seed('s1');
    expect(() => evaluate('s1')).not.toThrow();
    expect(trips).toBe(0);
    expect(evaluate('s1')).toBeUndefined(); // GH628F semantics: empty spool → no dispatch
  });

  it('capture gates the tripwire; file gates only the dispatch', () => {
    // capture:false → unacked removal trips nothing.
    writeSelfReportConfig(projectDirectory, { capture: false, file: true });
    dispatchBatch('s1', ['retro:aaaaaaaaaaaa']);
    markDraftsFiled(projectDirectory, 's1', ['retro:aaaaaaaaaaaa']);
    evaluate('s1');
    expect(trips).toBe(0);
    // capture:true, file:false → tripwire fires, dispatch stays suppressed.
    writeSelfReportConfig(projectDirectory, { capture: true, file: false });
    spoolDrafts(projectDirectory, 's2', [draft('retro:cccccccccccc')]);
    expect(evaluate('s2')).toBeUndefined(); // no dispatch when file:false…
    markDraftsFiled(projectDirectory, 's2', ['retro:cccccccccccc']);
    evaluate('s2');
    expect(trips).toBe(1); // …but the tripwire still fired for the bare drain
  });
});
