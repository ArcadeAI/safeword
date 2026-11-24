import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  observeSmallWorkProof,
  verifySmallWorkProof,
} from '../../src/small-work/proof-observation.js';

describe('small-work proof observation', () => {
  let project: string;
  const request = {
    baselineRevision: '',
    ticket: 'R8TEST',
    contractDigest: 'a'.repeat(64),
    argv: ['bun', 'test', './retry.test.ts'],
    cwd: '.',
    target: './retry.test.ts',
    entryPoint: './retry.ts',
    inputs: [],
    expectedFailure: 'expected two attempts',
  };

  beforeEach(() => {
    project = mkdtempSync(nodePath.join(tmpdir(), 'safeword-small-proof-'));
    vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', nodePath.join(project, 'test-key'));
    writeFileSync(nodePath.join(project, 'retry.ts'), 'export const attempts = () => 1;\n');
    execFileSync('git', ['init', '-q'], { cwd: project });
    execFileSync('git', ['add', 'retry.ts'], { cwd: project });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.test',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-qm',
        'baseline',
      ],
      { cwd: project },
    );
    request.baselineRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: project,
      encoding: 'utf8',
    }).trim();
    writeFileSync(
      nodePath.join(project, 'retry.test.ts'),
      `import { test } from 'bun:test';
import { attempts } from './retry';
test('retry after a timeout', () => {
  if (attempts() !== 2) throw new Error('expected two attempts');
});\n`,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(project, { recursive: true, force: true });
  });

  it('records a real failure and binds it to the exact command and input bytes', async () => {
    const red = await observeSmallWorkProof(project, request);
    expect(red.observation.expectedFailureObserved).toBe(true);
    expect(red.run.termination.exitCode).toBe(1);
    expect(red.run.argv).toEqual(request.argv);
    expect(verifySmallWorkProof(project, request, red.observation)).toBe(true);
    expect(verifySmallWorkProof(project, { ...request, ticket: 'OTHER' }, red.observation)).toBe(
      false,
    );
    expect(
      verifySmallWorkProof(project, request, { ...red.observation, tag: '0'.repeat(64) }),
    ).toBe(false);

    writeFileSync(nodePath.join(project, 'retry.ts'), 'export const attempts = () => 2;\n');
    expect(verifySmallWorkProof(project, request, red.observation)).toBe(false);
    await expect(observeSmallWorkProof(project, request)).rejects.toThrow('pre-test baseline');
  });

  it('refuses to run a different declared test', async () => {
    await expect(
      observeSmallWorkProof(project, {
        ...request,
        argv: ['bun', 'test', './other.test.ts'],
      }),
    ).rejects.toThrow('target test in argv');
  });
});
