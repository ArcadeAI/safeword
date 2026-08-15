import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReviewPacket } from '../../src/review/contract.js';
import { runHeadlessReviewer } from '../../src/review/runtime.js';
import { createTrustedReviewerDirectory, REVIEWER_CAPABILITIES } from '../review-fixtures.js';

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
  it.skipIf(process.platform === 'win32')(
    'is reported instead of being concealed as an ordinary timeout',
    async () => {
      const project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-abandoned-project-'));
      const host = createTrustedReviewerDirectory('safeword-abandoned-bin-');
      const bin = nodePath.join(host, 'bin');
      mkdirSync(bin);
      const executable = nodePath.join(bin, 'codex');
      writeFileSync(
        executable,
        `#!/bin/sh\nif printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\\n' '${REVIEWER_CAPABILITIES.codex}'; exit 0; fi\nexec /bin/sleep 3600\n`,
        { mode: 0o755 },
      );
      chmodSync(executable, 0o755);

      const fallbackHost = createTrustedReviewerDirectory('safeword-abandoned-fallback-');
      const fallbackBin = nodePath.join(fallbackHost, 'bin');
      const fallbackLaunch = nodePath.join(fallbackHost, 'launched');
      mkdirSync(fallbackBin);
      writeFileSync(
        nodePath.join(fallbackBin, 'codex'),
        `#!/bin/sh\nif printf '%s' "$*" | /usr/bin/grep -q -- '--help'; then printf '%s\\n' '${REVIEWER_CAPABILITIES.codex}'; exit 0; fi\nprintf 'launched\\n' > '${fallbackLaunch}'\nexit 0\n`,
        { mode: 0o755 },
      );
      chmodSync(nodePath.join(fallbackBin, 'codex'), 0o755);

      vi.stubEnv('PATH', `${bin}:${fallbackBin}:/usr/bin:/bin`);
      vi.stubEnv('SAFEWORD_REVIEW_TIMEOUT_MS', '1000');
      const realKill = process.kill.bind(process);
      let abandonedGroup: number | undefined;
      // Swallow every signal aimed at the reviewer's process group, so the tree
      // genuinely survives cleanup and stays RUNNING. Faking only the liveness
      // probe is not enough: liveness is read from /proc so that a group holding
      // nothing but zombies is correctly seen as stopped, and a fake probe would
      // no longer describe an uncleanable group.
      vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (typeof pid === 'number' && pid < 0) {
          abandonedGroup = pid;
          return true;
        }
        return realKill(pid, signal);
      });

      try {
        await expect(runHeadlessReviewer('codex', packet, project, project)).rejects.toMatchObject({
          failure: 'process_failed',
          message: 'codex reviewer processes could not be stopped',
        });
        expect(existsSync(fallbackLaunch)).toBe(false);
      } finally {
        // The mock kept the tree alive on purpose; stop it for real, or a
        // `sleep 3600` outlives the suite.
        if (abandonedGroup !== undefined) {
          try {
            realKill(abandonedGroup, 'SIGKILL');
          } catch {
            // Already gone.
          }
        }
        rmSync(project, { recursive: true, force: true });
        rmSync(host, { recursive: true, force: true });
        rmSync(fallbackHost, { recursive: true, force: true });
      }
    },
  );
});
