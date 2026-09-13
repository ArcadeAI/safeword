import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  captureDeliveryProofSubject,
  currentDeliveryProofSubject,
  executeDeliveryCommandProof,
} from '../../src/execution-plan/delivery-proof.js';

function git(cwd: string, args: readonly string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function committedProject(): { projectRoot: string; revision: string } {
  const projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-delivery-subject-'));
  git(projectRoot, ['init', '--quiet']);
  git(projectRoot, ['config', 'user.email', 'proof@example.com']);
  git(projectRoot, ['config', 'user.name', 'Proof Test']);
  writeFileSync(nodePath.join(projectRoot, 'source.ts'), 'export const value = 1;\n');
  writeFileSync(nodePath.join(projectRoot, 'execution-plan.md'), '# Execution Plan\n');
  git(projectRoot, ['add', 'source.ts', 'execution-plan.md']);
  git(projectRoot, ['commit', '--quiet', '-m', 'initial']);
  return { projectRoot, revision: git(projectRoot, ['rev-parse', 'HEAD']) };
}

describe('Delivery command proof', () => {
  it('executes only the retained argv directly with closed non-TTY stdin', async () => {
    const projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-delivery-proof-'));
    const retainedPath = nodePath.join(projectRoot, 'retained.txt');
    const substitutePath = nodePath.join(projectRoot, 'substitute.txt');
    const specification = {
      id: 'retained-proof',
      method: 'command' as const,
      scope: 'integration' as const,
      boundary: 'real child process',
      qualifiesAs: 'real_boundary' as const,
      currency: 'current_required' as const,
      invocation: {
        type: 'command' as const,
        cwd: '.',
        argv: [
          process.execPath,
          '-e',
          "const { writeFileSync } = require('node:fs'); if (process.stdin.isTTY) process.exit(2); process.stdin.resume(); process.stdin.on('end', () => writeFileSync('retained.txt', 'retained'));",
        ],
      },
    };

    const result = await executeDeliveryCommandProof({
      projectRoot,
      specification,
      ...({
        argv: [
          process.execPath,
          '-e',
          `require('node:fs').writeFileSync(${JSON.stringify(substitutePath)}, 'substitute')`,
        ],
      } as Record<string, unknown>),
    });

    expect(result).toMatchObject({
      argv: specification.invocation.argv,
      cwd: '.',
      termination: { exitCode: 0, timedOut: false },
      stdout: { bytes: 0, sha256: expect.stringMatching(/^[a-f\d]{64}$/u) },
      stderr: { bytes: 0, sha256: expect.stringMatching(/^[a-f\d]{64}$/u) },
    });
    expect(readFileSync(retainedPath, 'utf8')).toBe('retained');
    expect(existsSync(substitutePath)).toBe(false);
  });

  it('requires a clean contribution subject but permits Execution Plan progress', () => {
    const { projectRoot, revision } = committedProject();
    writeFileSync(nodePath.join(projectRoot, 'execution-plan.md'), '# Execution Plan\nprogress\n');

    expect(
      captureDeliveryProofSubject({ projectRoot, executionPlanPath: 'execution-plan.md' }),
    ).toEqual({ ok: true, revision });

    writeFileSync(nodePath.join(projectRoot, 'source.ts'), 'export const value = 2;\n');
    expect(
      captureDeliveryProofSubject({ projectRoot, executionPlanPath: 'execution-plan.md' }),
    ).toMatchObject({ ok: false, code: 'proof_subject_dirty' });
  });

  it('keeps proof current across a plan-only commit and stales it on any source change', () => {
    const { projectRoot, revision } = committedProject();
    writeFileSync(nodePath.join(projectRoot, 'execution-plan.md'), '# Execution Plan\nreceipt\n');
    git(projectRoot, ['add', 'execution-plan.md']);
    git(projectRoot, ['commit', '--quiet', '-m', 'record proof']);

    expect(
      currentDeliveryProofSubject({
        projectRoot,
        executionPlanPath: 'execution-plan.md',
        producingRevision: revision,
      }),
    ).toMatchObject({ ok: true, current: true });

    writeFileSync(nodePath.join(projectRoot, 'source.ts'), 'export const value = 2;\n');
    git(projectRoot, ['add', 'source.ts']);
    git(projectRoot, ['commit', '--quiet', '-m', 'change source']);
    expect(
      currentDeliveryProofSubject({
        projectRoot,
        executionPlanPath: 'execution-plan.md',
        producingRevision: revision,
      }),
    ).toMatchObject({ ok: true, current: false });
  });
});
