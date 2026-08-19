/**
 * `safeword project retro-drain` (ticket GJB22B) — the public subcommand
 * replacing `.safeword/hooks/lib/drain-retro-spool.ts` for hosts with no
 * installed hooks directory.
 *
 * The subcommand delegates to the hook's own exported guard, so these cases
 * pin that the egress boundary still reaches a caller going through the CLI:
 * a spool outside `.safeword/retro-drafts/*.jsonl` is refused rather than
 * read, and a refusal is a failed result rather than a silent empty drain.
 */

import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runRetroDrain } from '../../src/commands/retro-drain.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

function spoolPathIn(root: string, sessionId = 'session'): string {
  const draftsDirectory = nodePath.join(root, '.safeword', 'retro-drafts');
  mkdirSync(draftsDirectory, { recursive: true });
  return nodePath.join(draftsDirectory, `${sessionId}.jsonl`);
}

describe('project retro-drain', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  it('requires a spool path rather than defaulting to one', async () => {
    const result = await runRetroDrain(undefined, {});

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('RETRO_DRAIN_SPOOL_REQUIRED');
  });

  it('refuses a spool outside .safeword/retro-drafts/*.jsonl', async () => {
    const outside = nodePath.join(temporaryDirectory, 'drafts.jsonl');
    writeFileSync(outside, '{"id":"1"}\n');

    const result = await runRetroDrain(outside, { validatedJsonl: true });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('RETRO_DRAIN_REFUSED');
    // The refusal must be a failed result, never an empty success that a
    // caller would read as "nothing to file".
    expect(result.state).toBe('failed');
  });

  it('refuses a symlinked spool', async () => {
    const spool = spoolPathIn(temporaryDirectory);
    const target = nodePath.join(temporaryDirectory, 'elsewhere.jsonl');
    writeFileSync(target, '{"id":"1"}\n');
    symlinkSync(target, spool);

    const result = await runRetroDrain(spool, { validatedJsonl: true });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('RETRO_DRAIN_REFUSED');
  });

  it('emits one JSON object per line for a canonical spool', async () => {
    const spool = spoolPathIn(temporaryDirectory);
    writeFileSync(spool, '');

    const result = await runRetroDrain(spool, { validatedJsonl: true });

    expect(result.ok).toBe(true);
    expect(result.presentation?.kind).toBe('raw');
    // Raw stdout, not the envelope: the filer streams these lines onward.
    expect(result.presentation?.body).toBe('');
  });
});
