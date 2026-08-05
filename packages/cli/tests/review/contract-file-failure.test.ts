import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ReviewPacket } from '../../src/review/contract.js';
import { ReviewRuntimeError, runHeadlessReviewer } from '../../src/review/runtime.js';
import { REVIEWER_CAPABILITIES } from '../review-fixtures.js';

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
  const scratch = mkdtempSync(nodePath.join(tmpdir(), 'safeword-contract-'));
  // The executable must live OUTSIDE the untrusted root, or candidate
  // selection discards it and the run fails as not_installed before the
  // contract file is ever written — a vacuous pass.
  const binRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-contract-bin-'));
  const bin = nodePath.join(binRoot, 'bin');
  mkdirSync(bin, { recursive: true });
  const executable = nodePath.join(bin, 'codex');
  writeFileSync(
    executable,
    `#!/bin/sh\nif printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\\n' '${REVIEWER_CAPABILITIES.codex}'; exit 0; fi\nprintf 'launched\\n' >> '${nodePath.join(binRoot, 'launched.log')}'\nexit 0\n`,
    { mode: 0o755 },
  );
  chmodSync(executable, 0o755);

  const readonly = nodePath.join(scratch, 'readonly');
  mkdirSync(readonly);
  chmodSync(readonly, 0o500);

  const originalTemporary = process.env.TMPDIR;
  const originalPath = process.env.PATH;
  process.env.TMPDIR = readonly;
  process.env.PATH = `${bin}:/usr/bin:/bin`;
  try {
    await body(scratch, binRoot);
  } finally {
    if (originalTemporary === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = originalTemporary;
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    chmodSync(readonly, 0o700);
    rmSync(scratch, { recursive: true, force: true });
    rmSync(binRoot, { recursive: true, force: true });
  }
}

describe('when the result contract cannot be written', () => {
  it('reports a classified review failure instead of crashing, and launches no reviewer', async () => {
    await withUnwritableTemporaryRoot(async scratch => {
      await expect(runHeadlessReviewer('codex', packet, scratch, scratch)).rejects.toBeInstanceOf(
        ReviewRuntimeError,
      );
      expect(readdirSync(scratch)).not.toContain('launched.log');
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
      expect(reported?.message).toBeDefined();
      expect(reported?.message).not.toContain(nodePath.join(scratch, 'readonly'));
      expect(reported?.message).not.toContain('schema');
    });
  });
});
