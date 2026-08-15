import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ReviewPacket } from '../../src/review/contract.js';
import { ReviewRuntimeError, runHeadlessReviewer } from '../../src/review/runtime.js';
import { blockChildren } from '../helpers/io-failure.js';
import { createTrustedReviewerDirectory, REVIEWER_CAPABILITIES } from '../review-fixtures.js';

const packet: ReviewPacket = {
  schema_version: 1,
  dispatch_id: 'dispatch-1',
  kind: 'quality-review',
  logical_files: [{ path: 'a.md', content: 'bounded review input' }],
};

/**
 * Runs `body` with a temp root the process cannot write into, and a Codex on
 * PATH that records any launch. Restores the environment afterwards.
 */
async function withUnwritableTemporaryRoot(
  body: (scratch: string, binRoot: string) => Promise<void>,
): Promise<void> {
  let scratch: string | undefined;
  let binRoot: string | undefined;
  const originalTemporary = process.env.TMPDIR;
  const originalPath = process.env.PATH;
  try {
    scratch = mkdtempSync(nodePath.join(tmpdir(), 'safeword-contract-'));
    // The executable must live OUTSIDE the untrusted root, or candidate
    // selection discards it and the run fails as not_installed before the
    // contract file is ever written — a vacuous pass.
    binRoot = createTrustedReviewerDirectory('safeword-contract-bin-');
    const bin = nodePath.join(binRoot, 'bin');
    mkdirSync(bin, { recursive: true });
    const executable = nodePath.join(bin, 'codex');
    writeFileSync(
      executable,
      `#!/bin/sh\nif printf '%s' "$*" | grep -q -- '--help'; then printf '%s\\n' '${REVIEWER_CAPABILITIES.codex}'; exit 0; fi\nprintf 'launched\\n' >> '${nodePath.join(binRoot, 'launched.log')}'\nexit 0\n`,
      { mode: 0o755 },
    );
    chmodSync(executable, 0o755);
    process.env.TMPDIR = blockChildren(nodePath.join(scratch, 'readonly'));
    process.env.PATH = `${bin}:/usr/bin:/bin`;
    await body(scratch, binRoot);
  } finally {
    if (originalTemporary === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = originalTemporary;
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (scratch) rmSync(scratch, { recursive: true, force: true });
    if (binRoot) rmSync(binRoot, { recursive: true, force: true });
  }
}

describe('when the result contract cannot be written', () => {
  it('reports a classified review failure instead of crashing, and launches no reviewer', async () => {
    await withUnwritableTemporaryRoot(async (scratch, binRoot) => {
      await expect(runHeadlessReviewer('codex', packet, scratch, scratch)).rejects.toBeInstanceOf(
        ReviewRuntimeError,
      );
      expect(existsSync(nodePath.join(binRoot, 'launched.log'))).toBe(false);
    });
  });

  it('never puts the contract path into the failure it reports', async () => {
    await withUnwritableTemporaryRoot(async scratch => {
      let reported: ReviewRuntimeError | undefined;
      try {
        await runHeadlessReviewer('codex', packet, scratch, scratch);
      } catch (error) {
        reported = error as ReviewRuntimeError;
      }
      // The message says what happened and nothing about where it happened.
      expect(reported?.message).toBe('The codex review could not be prepared');
      expect(reported?.failure).toBe('process_failed');
      expect(reported?.message).not.toContain(nodePath.join(scratch, 'readonly'));
    });
  });
});
