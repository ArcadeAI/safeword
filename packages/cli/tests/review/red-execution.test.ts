import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { startReviewJob } from '../../src/review/job.js';
import { executeRedProof } from '../../src/review/red-execution.js';

afterEach(() => vi.unstubAllEnvs());

describe('trusted executable RED observation', () => {
  it('attests a real missing-behavior failure at the process boundary', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-red-execution-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword', 'config.json'), '{"crossAgentReview":"off"}\n');
    writeFileSync(nodePath.join(cwd, 'proof.md'), 'actor sees missing behavior\n');
    const keyRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-red-key-'));
    vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', keyRoot);
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');

    const result = await startReviewJob({
      cwd,
      kind: 'executable-red',
      targets: ['proof.md'],
      execution: {
        argv: [
          process.execPath,
          '-e',
          "console.error('expected actor assertion'); process.exit(1)",
        ],
        cwd: '.',
        evidenceClass: 'pure-contract',
        expectedFailure: 'expected actor assertion',
        timeoutMs: 1000,
      },
    });

    expect(result.data).toMatchObject({
      execution_attestation: {
        argv: [
          process.execPath,
          '-e',
          "console.error('expected actor assertion'); process.exit(1)",
        ],
        cwd: '.',
        evidence_class: 'pure-contract',
        expected_failure: { literal: 'expected actor assertion', matched: true },
        timeout_ms: 1000,
        termination: { exit_code: 1, timed_out: false },
        stderr: { excerpt: 'expected actor assertion\n', truncated: false },
      },
    });
    const attestation = (
      result.data as {
        execution_attestation: {
          environment: { sha256: string };
          source_fingerprint: string;
          stderr: { sha256: string };
          termination: { signal: string | null };
        };
      }
    ).execution_attestation;
    expect(attestation.termination.signal).toBeNull();
    expect(attestation.environment.sha256).toMatch(/^[a-f\d]{64}$/u);
    expect(attestation.source_fingerprint).toMatch(/^[a-f\d]{64}$/u);
    expect(attestation.stderr.sha256).toMatch(/^[a-f\d]{64}$/u);
  });

  it('force-terminates proof processes at the configured timeout', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-red-timeout-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(nodePath.join(cwd, '.safeword', 'config.json'), '{"crossAgentReview":"off"}\n');
    writeFileSync(nodePath.join(cwd, 'proof.md'), 'proof hangs after expected failure\n');
    const keyRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-red-key-'));
    vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', keyRoot);
    vi.stubEnv('SAFEWORD_REVIEW_FOREGROUND_MS', '3000');

    const result = await startReviewJob({
      cwd,
      kind: 'executable-red',
      targets: ['proof.md'],
      execution: {
        argv: [
          process.execPath,
          '-e',
          "process.on('SIGTERM', () => {}); console.error('expected timeout'); setInterval(() => {}, 1000)",
        ],
        cwd: '.',
        evidenceClass: 'pure-contract',
        expectedFailure: 'expected timeout',
        timeoutMs: 25,
      },
    });

    expect(result.data).toMatchObject({
      execution_attestation: {
        timeout_ms: 25,
        expected_failure: { matched: true },
        termination: { signal: 'SIGKILL', timed_out: true },
      },
    });
  });

  it.skipIf(process.platform === 'win32')(
    'terminates descendants spawned by a timed-out proof',
    async () => {
      const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-red-descendant-'));
      const pidPath = nodePath.join(cwd, 'descendant.pid');
      let descendantPid: number | undefined;

      try {
        await executeRedProof({
          projectRoot: cwd,
          sourceFingerprint: 'f'.repeat(64),
          request: {
            argv: [
              process.execPath,
              '-e',
              `const { spawn } = require('node:child_process'); const { writeFileSync } = require('node:fs'); const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); writeFileSync(${JSON.stringify(pidPath)}, String(child.pid)); console.error('expected descendant timeout'); setInterval(() => {}, 1000);`,
            ],
            cwd: '.',
            evidenceClass: 'pure-contract',
            expectedFailure: 'expected descendant timeout',
            timeoutMs: 50,
          },
        });
        const observedPid = Number(readFileSync(pidPath, 'utf8'));
        descendantPid = observedPid;

        expect(() => process.kill(observedPid, 0)).toThrow();
      } finally {
        if (descendantPid !== undefined) {
          try {
            process.kill(descendantPid, 'SIGKILL');
          } catch {
            // The expected path already terminated the descendant.
          }
        }
      }
    },
  );
});
