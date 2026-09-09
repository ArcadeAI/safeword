import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { startReviewJob } from '../../src/review/job.js';
import { executeRedProof } from '../../src/review/red-execution.js';

afterEach(() => vi.unstubAllEnvs());

function processCanStillRun(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }

  if (process.platform !== 'linux') return true;

  try {
    const status = readFileSync(`/proc/${pid}/status`, 'utf8');
    const state = /^State:\s+([A-Z])/m.exec(status)?.[1];
    return state !== 'Z' && state !== 'X';
  } catch {
    return false;
  }
}

describe('trusted executable RED observation', () => {
  it('does not expose review-worker secrets to the proof process', async () => {
    const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-red-environment-'));
    vi.stubEnv('SAFEWORD_REVIEW_JOB_ID', 'private-job-id');
    vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', '/private/review-key-root');

    const result = await executeRedProof({
      projectRoot: cwd,
      sourceFingerprint: 'f'.repeat(64),
      request: {
        scenario: 'Scenario: actor boundary',
        ledger: '.project/tickets/TST/test-definitions.md',
        argv: [
          process.execPath,
          '-e',
          "if (process.env.SAFEWORD_REVIEW_JOB_ID || process.env.SAFEWORD_REVIEW_KEY_ROOT) process.exit(2); console.error('expected isolated failure'); process.exit(1)",
        ],
        cwd: '.',
        evidenceClass: 'pure-contract',
        expectedFailure: 'expected isolated failure',
        timeoutMs: 1000,
      },
    });

    expect(result).toMatchObject({
      expected_failure: { matched: true },
      termination: { exit_code: 1, timed_out: false },
    });
  });

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
        scenario: 'Scenario: actor boundary',
        ledger: '.project/tickets/TST/test-definitions.md',
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
        scenario: 'Scenario: actor boundary',
        ledger: '.project/tickets/TST/test-definitions.md',
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
            scenario: 'Scenario: actor boundary',
            ledger: '.project/tickets/TST/test-definitions.md',
            argv: [
              process.execPath,
              '-e',
              `const { spawn } = require('node:child_process'); const { writeFileSync } = require('node:fs'); const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); writeFileSync(${JSON.stringify(pidPath)}, String(child.pid)); console.error('expected descendant timeout'); setInterval(() => {}, 1000);`,
            ],
            cwd: '.',
            evidenceClass: 'pure-contract',
            expectedFailure: 'expected descendant timeout',
            // This test needs the parent to start and record the descendant before
            // the executor kills the process group. The deadline is not the behavior
            // under test; the adjacent test covers exact short-timeout attestation.
            timeoutMs: 1000,
          },
        });
        const observedPid = Number(readFileSync(pidPath, 'utf8'));
        expect(Number.isSafeInteger(observedPid) && observedPid > 0).toBe(true);
        descendantPid = observedPid;

        await vi.waitFor(() => {
          expect(processCanStillRun(observedPid)).toBe(false);
        });
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
