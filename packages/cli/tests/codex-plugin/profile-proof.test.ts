import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  codexProofPath,
  observeCodexHookProof,
  recordCodexHookProof,
} from '../../src/codex-plugin/profile-proof.js';

describe('Codex profile hook proof', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
    directories.length = 0;
  });

  it('never accepts or leaves a partial proof when the durable write is interrupted', () => {
    const codexHome = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-profile-'));
    directories.push(codexHome);
    const environment = { CODEX_HOME: codexHome };

    expect(() =>
      recordCodexHookProof(environment, new Date('2026-07-28T00:00:00.000Z'), {
        beforeRename: () => {
          throw new Error('simulated interruption');
        },
      }),
    ).toThrow('simulated interruption');

    expect(existsSync(codexProofPath(environment))).toBe(false);
    expect(observeCodexHookProof(environment).status).toBe('missing');
    expect(readdirSync(nodePath.join(codexHome, 'safeword'))).toEqual([]);
  });
});
