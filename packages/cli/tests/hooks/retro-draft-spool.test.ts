import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  canonicalSignatureForDraft,
  draftSpoolPath,
  markDraftsFiled,
  readSpooledDrafts,
  spoolDrafts,
  verifyDraftBody,
} from '../../templates/hooks/lib/retro-draft-spool.js';
import { retroDraft as draft, sealedRetroDraft as sealedDraft } from '../helpers.js';

describe('retro draft spool (BNGK9W — persist post-egress drafts on filing failure)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-spool-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  // FG6V57: the session-token rule (substitute-not-strip, [\w.-], cap 80) is
  // pinned byte-identical with triage.ts and self-report.ts by a parity contract.
  it('collapses a hostile overlong session id to one bounded filename component', () => {
    const hostile = `../../evil session ${'x'.repeat(100)}`;
    const path = draftSpoolPath(projectDirectory, hostile);
    const base = nodePath.basename(path);
    expect(base).toMatch(/^[\w.-]{1,80}\.jsonl$/);
    // sanitized inside the project spool dir — the ../.. cannot escape it
    // (dirname equality, not a prefix check: /tmp/x must not match /tmp/x-sibling)
    expect(nodePath.dirname(path)).toBe(
      nodePath.join(projectDirectory, '.safeword', 'retro-drafts'),
    );
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

  it('counts a torn line toward the cap (raw-line bound, not valid-draft count)', () => {
    // Seed a torn line, then spool more valid drafts than remaining room. The cap
    // counts NON-BLANK LINES (torn included), so the file is bounded at 20 total and
    // the torn line consumes one slot — pins the shared line-count cap semantics.
    const file = draftSpoolPath(projectDirectory, 'sess-torn');
    mkdirSync(nodePath.dirname(file), { recursive: true });
    writeFileSync(file, '{"signature":"retro:\n', 'utf8'); // 1 torn line, newline-terminated
    spoolDrafts(
      projectDirectory,
      'sess-torn',
      Array.from({ length: 25 }, (_, i) =>
        draft(`retro:${i.toString().padStart(12, '0')}`, `f${i}`),
      ),
    );
    const lines = readFileSync(file, 'utf8')
      .split('\n')
      .filter(l => l.trim().length > 0);
    expect(lines).toHaveLength(20); // torn + 19 valid = 20, capped by raw line count
    expect(readSpooledDrafts(projectDirectory, 'sess-torn')).toHaveLength(19); // valid drafts only
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

  it('round-trips the body seal, and only the seal, as the fifth field (JDK0F0)', () => {
    const sealed = sealedDraft('retro:aaaaaaaaaaaa', 'Sealed');
    spoolDrafts(projectDirectory, 'sess-1', [sealed]);
    expect(readSpooledDrafts(projectDirectory, 'sess-1')).toEqual([sealed]);
    const raw = readFileSync(draftSpoolPath(projectDirectory, 'sess-1'), 'utf8').trim();
    expect(Object.keys(JSON.parse(raw)).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'body',
      'bodyDigest',
      'labels',
      'signature',
      'title',
    ]);
  });

  it('round-trips a canonical signature only when it is part of the code-assembled draft', () => {
    const base = draft('retro:aaaaaaaaaaaa', 'Canonical');
    const body = `${base.body}\n<!-- safeword-retro-canonical: canonical:aaaaaaaaaaaa -->`;
    const current = {
      ...base,
      canonicalSignature: 'canonical:aaaaaaaaaaaa',
      body,
      bodyDigest: createHash('sha256').update(body).digest('hex').slice(0, 12),
    };
    spoolDrafts(projectDirectory, 'sess-1', [current]);
    expect(readSpooledDrafts(projectDirectory, 'sess-1')).toEqual([current]);
    expect(verifyDraftBody(current)).toBe(true);
  });
});

describe('verifyDraftBody (JDK0F0 — refuse a body modified after sealing)', () => {
  let projectDirectory: string;
  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'retro-spool-'));
  });
  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('accepts a draft whose body matches its seal', () => {
    expect(verifyDraftBody(sealedDraft('retro:aaaaaaaaaaaa'))).toBe(true);
  });

  it('rejects a draft whose body was modified after sealing', () => {
    const tampered = { ...sealedDraft('retro:aaaaaaaaaaaa'), body: 're-worded by the agent' };
    expect(verifyDraftBody(tampered)).toBe(false);
  });

  it('accepts a legacy digest-less draft (pre-seal spools keep filing)', () => {
    expect(verifyDraftBody(draft('retro:aaaaaaaaaaaa'))).toBe(true);
  });

  it('drops a spool line whose bodyDigest is not a string (shape check, not legacy)', () => {
    // A malformed seal must not be read as "legacy, verified" — the line fails
    // the shape check like any other wrong-typed field.
    const file = draftSpoolPath(projectDirectory, 'sess-bad-seal');
    mkdirSync(nodePath.dirname(file), { recursive: true });
    const line = { ...draft('retro:aaaaaaaaaaaa'), bodyDigest: 123 };
    writeFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
    expect(readSpooledDrafts(projectDirectory, 'sess-bad-seal')).toEqual([]);
  });

  it('drops a spool line whose canonicalSignature is not a string', () => {
    const file = draftSpoolPath(projectDirectory, 'sess-bad-canonical');
    mkdirSync(nodePath.dirname(file), { recursive: true });
    writeFileSync(
      file,
      `${JSON.stringify({ ...draft('retro:aaaaaaaaaaaa'), canonicalSignature: 123 })}\n`,
      'utf8',
    );
    expect(readSpooledDrafts(projectDirectory, 'sess-bad-canonical')).toEqual([]);
  });

  it('permits canonical fallback only when the exact code-owned body marker agrees', () => {
    const body =
      'body\n<!-- safeword-retro-signature: retro:aaaaaaaaaaaa -->\n<!-- safeword-retro-canonical: canonical:aaaaaaaaaaaa -->';
    expect(
      canonicalSignatureForDraft({
        ...draft('retro:aaaaaaaaaaaa'),
        body,
        canonicalSignature: 'canonical:aaaaaaaaaaaa',
      }),
    ).toBe('canonical:aaaaaaaaaaaa');
    expect(
      canonicalSignatureForDraft({
        ...draft('retro:aaaaaaaaaaaa'),
        body,
        canonicalSignature: 'canonical:bbbbbbbbbbbb',
      }),
    ).toBeUndefined();
    expect(
      canonicalSignatureForDraft({
        ...draft('retro:aaaaaaaaaaaa'),
        canonicalSignature: 'canonical:aaaaaaaaaaaa',
      }),
    ).toBeUndefined();
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
