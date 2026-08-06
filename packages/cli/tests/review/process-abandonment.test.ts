import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReviewPacket } from '../../src/review/contract.js';
import { runHeadlessReviewer } from '../../src/review/runtime.js';
import { REVIEWER_CAPABILITIES } from '../review-fixtures.js';

const packet: ReviewPacket = {
  schema_version: 1,
  dispatch_id: 'dispatch-1',
  kind: 'quality-review',
  logical_files: [{ path: 'a.md', content: 'bounded review input' }],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('an uncleanable reviewer process group', () => {
  it('is reported instead of being concealed as an ordinary timeout', async () => {
    if (process.platform === 'win32') return;

    const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-abandoned-project-'));
    const host = mkdtempSync(nodePath.join(tmpdir(), 'safeword-abandoned-bin-'));
    const bin = nodePath.join(host, 'bin');
    mkdirSync(bin);
    const executable = nodePath.join(bin, 'codex');
    writeFileSync(
      executable,
      `#!/bin/sh\nif printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\\n' '${REVIEWER_CAPABILITIES.codex}'; exit 0; fi\nexec /bin/sleep 3600\n`,
      { mode: 0o755 },
    );
    chmodSync(executable, 0o755);

    vi.stubEnv('PATH', `${bin}:/usr/bin:/bin`);
    vi.stubEnv('SAFEWORD_REVIEW_TIMEOUT_MS', '100');
    const realKill = process.kill.bind(process);
    let abandonedGroup: number | undefined;
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (typeof pid === 'number' && pid < 0 && signal === 'SIGTERM') {
        const signalled = realKill(pid, signal);
        abandonedGroup = pid;
        return signalled;
      }
      if (pid === abandonedGroup && signal === 0) return true;
      return realKill(pid, signal);
    });

    try {
      await expect(runHeadlessReviewer('codex', packet, project, project)).rejects.toMatchObject({
        failure: 'process_failed',
        message: 'codex reviewer processes could not be stopped',
      });
    } finally {
      rmSync(project, { recursive: true, force: true });
      rmSync(host, { recursive: true, force: true });
    }
  });
});
