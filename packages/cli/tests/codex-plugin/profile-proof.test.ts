import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  codexProofPath,
  currentCodexPluginIdentity,
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

  it.each([
    ['package version', { plugin_version: '0.0.0-stale' }, 'stale'],
    ['hook manifest digest', { manifest_sha256: '0'.repeat(64) }, 'stale'],
    ['proof schema', { schema_version: 2 }, 'malformed'],
    ['missing fields', { recorded_at: undefined }, 'malformed'],
  ])('rejects proof with changed %s', (_case, override, expectedStatus) => {
    const codexHome = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-profile-'));
    directories.push(codexHome);
    const environment = { CODEX_HOME: codexHome };
    const proofPath = codexProofPath(environment);
    mkdirSync(nodePath.dirname(proofPath), { recursive: true });
    writeFileSync(
      proofPath,
      JSON.stringify({
        schema_version: 1,
        ...currentCodexPluginIdentity(),
        recorded_at: '2026-07-28T00:00:00.000Z',
        ...override,
      }),
    );

    expect(observeCodexHookProof(environment).status).toBe(expectedStatus);
  });

  it('rejects malformed proof JSON', () => {
    const codexHome = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-profile-'));
    directories.push(codexHome);
    const environment = { CODEX_HOME: codexHome };
    const proofPath = codexProofPath(environment);
    mkdirSync(nodePath.dirname(proofPath), { recursive: true });
    writeFileSync(proofPath, '{"schema_version":');

    expect(observeCodexHookProof(environment).status).toBe('malformed');
  });
});
