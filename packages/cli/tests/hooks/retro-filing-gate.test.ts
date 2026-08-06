import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ackFilePath,
  draftSpoolPath,
  markDraftsFiled,
  spoolDrafts,
  spoolSiblingPath,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import {
  CODEX_FILER_SKILL_NAME,
  decideRetroFilingGate,
  FILER_AGENT_NAME,
  FILING_ATTEMPT_CAP,
  formatCodexFilingDispatch,
  formatFilingDispatch,
} from '../../templates/hooks/lib/retro-filing-gate.js';
import { appendRetroAck, retroDraft as draft, writeSelfReportConfig } from '../helpers.js';

function corruptPersistedAttempts(
  projectDirectory: string,
  sessionId: string,
  attempts: string,
): void {
  const markerFile = spoolSiblingPath(projectDirectory, sessionId, '.filing-attempts');
  const persisted = JSON.parse(readFileSync(markerFile, 'utf8')) as Record<string, unknown>;
  // Written as raw JSON text, not via JSON.stringify: `1e999` has to survive to
  // disk as a literal, and stringify would emit the Infinity it parses to as null.
  const others = Object.entries(persisted)
    .filter(([field]) => field !== 'attempts')
    .map(([field, value]) => `${JSON.stringify(field)}:${JSON.stringify(value)}`);
  writeFileSync(markerFile, `{"attempts":${attempts},${others.join(',')}}\n`);
}

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

  // The count only reaches the cap comparison when the marker's key equals the
  // CURRENT batchKey — a sha256 hex. Seeding a placeholder key (e.g. "k") makes
  // `attempts` dead code and the test vacuous, so corrupt the count in a marker
  // the gate itself wrote: dispatch once for the real key, then rewrite only
  // `attempts`. Measured on the unsanitized code these gave 7 dispatches
  // (negative: widened budget) and 0 (Infinity: drafts stranded unfiled).
  it.each([
    ['non-finite', '1e999'],
    ['negative', '-5'],
    ['fractional', '1.5'],
    ['oversized', String(FILING_ATTEMPT_CAP + 1)],
  ])('clamps a %s persisted count so the cap still binds', (_label, attempts) => {
    spoolDrafts(projectDirectory, 'sess-1', [draft('retro:aaaaaaaaaaaa')]);
    expect(decideRetroFilingGate(projectDirectory, 'sess-1')).toBeDefined(); // writes the real key
    corruptPersistedAttempts(projectDirectory, 'sess-1', attempts);

    // Clamped to 0, so the batch gets its full budget back and then goes quiet —
    // never unbounded (the negative case) and never silent-forever (Infinity).
    for (let attempt = 1; attempt <= FILING_ATTEMPT_CAP; attempt++) {
      expect(decideRetroFilingGate(projectDirectory, 'sess-1')).toBeDefined();
    }
    expect(decideRetroFilingGate(projectDirectory, 'sess-1')).toBeUndefined();
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

  // #1900: the dispatch is the only account of the handoff in the transcript, and
  // retro's extractor mines that transcript. Diagnosing the spool as a broken
  // transport made it auto-file a bug against a working subsystem every cloud
  // session, so neither dispatch may assert a transport failure.
  // The class of claim that is banned, not three literal spellings of it. The exact
  // wording is already pinned by the characterization test below, so asserting a
  // specific reassuring phrase here would only add breakage surface without
  // catching a rephrased diagnosis.
  it('makes no claim that the transport failed or was rejected', () => {
    for (const text of [
      formatFilingDispatch(1, '/proj/.safeword/retro-drafts/sess-1.jsonl'),
      formatCodexFilingDispatch(1, '/proj/.safeword/retro-drafts/sess-1.jsonl'),
    ]) {
      for (const diagnosis of [
        /authenticat/i,
        /unauthori[sz]ed/i,
        /\b401\b/,
        /\bbroken\b/i,
        /\bfailed\b|\bfailure\b/i,
        /\brejected\b/i,
        /credential (error|problem|failure)/i,
      ]) {
        expect(diagnosis.test(text), `dispatch must not assert: ${diagnosis}`).toBe(false);
      }
    }
  });

  // Characterization: both carriers render one shared body that differs only in
  // how the carrier is named. Pinning the full strings is what lets the two
  // formatters share a template without either wording drifting silently.
  it('renders the exact Claude/Cursor and Codex dispatch wording', () => {
    const shared =
      "Safeword's retro spooled 2 sanitized findings for its own upstream tracker at /p/s.jsonl. " +
      'They remain queued for filing through your GitHub access. This handoff uses ' +
      "safeword's normal recovery lane for unfiled drafts. ";
    const tail =
      'so it files them through your GitHub access, then end the turn. ' +
      'Only %DRAIN% drains the spool. %PROHIBIT%, and do not narrate or summarize the filing in ' +
      'this or later responses. If the %NOUN% or write access to ArcadeAI/safeword is ' +
      'unavailable, state that in one line and stop.';

    expect(formatFilingDispatch(2, '/p/s.jsonl')).toBe(
      `${shared}Invoke the safeword-retro-filer subagent (foreground) with that spool path ${tail
        .replace('%DRAIN%', 'the safeword-retro-filer')
        .replace('%PROHIBIT%', 'Do not file them inline yourself')
        .replace('%NOUN%', 'subagent')}`,
    );
    expect(formatCodexFilingDispatch(2, '/p/s.jsonl')).toBe(
      `${shared}Invoke the safeword:retro-filer skill with that spool path ${tail
        .replace('%DRAIN%', 'the safeword:retro-filer workflow')
        .replace('%PROHIBIT%', 'Do not file them outside that workflow')
        .replace('%NOUN%', 'skill')}`,
    );
  });

  it('routes Codex through the packaged filer skill without embedding a procedure', () => {
    const text = formatCodexFilingDispatch(3, '/proj/.safeword/retro-drafts/sess-1.jsonl');
    expect(text).toContain(CODEX_FILER_SKILL_NAME);
    expect(text).toContain('/proj/.safeword/retro-drafts/sess-1.jsonl');
    expect(text).not.toContain(FILER_AGENT_NAME);
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
  const ack = (sessionId: string, signature: string, issue: number): void => {
    appendRetroAck(projectDirectory, sessionId, signature, issue);
  };
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

  // A corrupt attempt count must not cost the batch snapshot. Dropping the whole
  // marker would take `signatures` with it, and this path — spool already drained,
  // so the gate returns before any rewrite — is where nothing would ever repair it.
  // The tripwire would then stay disarmed for the rest of the session.
  it('still trips on a bare drain when the persisted count is corrupt', () => {
    dispatchBatch('s1', ['retro:aaaaaaaaaaaa']);
    corruptPersistedAttempts(projectDirectory, 's1', '-5');

    markDraftsFiled(projectDirectory, 's1', ['retro:aaaaaaaaaaaa']); // drained, no acks
    evaluate('s1');
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
    // `1e999` parses to Infinity, the one way JSON yields a non-finite count.
    [
      'marker with a non-finite attempt count',
      (s: string) => {
        writeFileSync(
          nodePath.join(projectDirectory, '.safeword/retro-drafts', `${s}.filing-attempts`),
          '{"key":"k","attempts":1e999}\n',
        );
      },
    ],
    [
      'marker with a negative attempt count',
      (s: string) => {
        writeFileSync(
          nodePath.join(projectDirectory, '.safeword/retro-drafts', `${s}.filing-attempts`),
          '{"key":"k","attempts":-5}\n',
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
