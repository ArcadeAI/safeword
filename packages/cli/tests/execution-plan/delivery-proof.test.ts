import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { executeDeliveryCommandProof } from '../../src/execution-plan/delivery-proof.js';

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
});
