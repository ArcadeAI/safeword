import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  acquireCodexProfileLock,
  releaseCodexProfileLock,
} from '../../src/codex-plugin/profile-lock.js';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

function profile(): NodeJS.ProcessEnv {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-profile-lock-'));
  directories.push(directory);
  return { CODEX_HOME: directory };
}

describe('Codex profile enrollment lock', () => {
  it('permits only the owner to release a live lock', () => {
    const environment = profile();
    const owner = acquireCodexProfileLock(environment, { owner: 'owner-a' });

    expect(owner?.owner).toBe('owner-a');
    if (owner === undefined) throw new Error('Expected owner-a to acquire the profile lock.');
    expect(acquireCodexProfileLock(environment, { owner: 'owner-b' })).toBeUndefined();
    expect(releaseCodexProfileLock({ ...owner, owner: 'owner-b' })).toBe(false);
    expect(readFileSync(nodePath.join(owner.path, 'owner.json'), 'utf8')).toContain('owner-a');
    expect(releaseCodexProfileLock(owner)).toBe(true);
  });

  it('recovers an expired lock before acquiring ownership', () => {
    const environment = profile();
    const stale = acquireCodexProfileLock(environment, { owner: 'stale', now: () => 1 });
    expect(stale).toBeDefined();
    if (stale === undefined) throw new Error('Expected stale owner to acquire the profile lock.');
    writeFileSync(
      nodePath.join(stale.path, 'owner.json'),
      `${JSON.stringify({ owner: 'stale', acquired_at: 1 })}\n`,
    );

    const recovered = acquireCodexProfileLock(environment, {
      owner: 'current',
      now: () => 1_000_000,
      maxAgeMs: 100,
    });

    expect(recovered?.owner).toBe('current');
    if (recovered === undefined) throw new Error('Expected current owner to recover the lock.');
    expect(releaseCodexProfileLock(recovered)).toBe(true);
  });
});
