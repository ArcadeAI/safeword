import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  parseOpenCodeActivation,
  parseOpenCodeConformance,
  parseOpenCodeProfileError,
} from '../../src/opencode/evidence.js';
import { parseOpenCodeIdentity } from '../../src/opencode/identity.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const hash = 'a'.repeat(64);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe('bounded OpenCode profile records', () => {
  it('accepts an exact versioned identity and rejects extra data', () => {
    const identity = {
      schema_version: 1,
      safeword_version: '0.79.4',
      plugin_path: 'plugins/safeword.js',
      plugin_sha256: hash,
      runtime_path: '/runtime/node',
      dispatcher_path: '/runtime/dispatcher.js',
      dispatcher_sha256: hash,
    };

    expect(parseOpenCodeIdentity(identity)).toEqual(identity);
    expect(parseOpenCodeIdentity({ ...identity, project_path: '/secret/project' })).toBeUndefined();
  });

  it('accepts bounded activation and enforces call-bound identifiers', () => {
    const activation = {
      schema_version: 1,
      safeword_version: '0.79.4',
      plugin_sha256: hash,
      project_sha256: hash,
      opencode_version: '1.18.23',
      event: 'pre_tool',
      session_id_sha256: hash,
      call_id_sha256: hash,
      observed_at: '2026-08-26T12:00:00.000Z',
    };

    expect(parseOpenCodeActivation(activation)).toEqual(activation);
    expect(parseOpenCodeActivation({ ...activation, call_id_sha256: undefined })).toBeUndefined();
    expect(parseOpenCodeActivation({ ...activation, command: 'secret' })).toBeUndefined();
  });

  it('accepts only bounded conformance fields', () => {
    const conformance = {
      schema_version: 1,
      safeword_version: '0.79.4',
      opencode_version: '1.18.23',
      platform: 'linux',
      arch: 'arm64',
      plugin_sha256: hash,
      dispatcher_sha256: hash,
      command_catalogue: true,
      agent_catalogue: true,
      denial: true,
      control: true,
      checked_at: '2026-08-26T12:00:00.000Z',
      result: 'passed',
    };

    expect(parseOpenCodeConformance(conformance)).toEqual(conformance);
    expect(parseOpenCodeConformance({ ...conformance, prompt: 'secret' })).toBeUndefined();
  });

  it('persists one exact passing conformance record without execution content', async () => {
    const root = createTemporaryDirectory();
    temporaryDirectories.push(root);
    const directory = nodePath.join(root, 'safeword', 'conformance-v1');
    const sensitive = {
      bearer_token: 'bearer-sensitive-sentinel',
      prompt: 'prompt-sensitive-sentinel',
      command: 'command-sensitive-sentinel',
      environment: 'environment-sensitive-sentinel',
      temporary_path: '/tmp/path-sensitive-sentinel',
    };
    const conformance = {
      schema_version: 1,
      safeword_version: '0.79.4',
      opencode_version: '1.18.23',
      platform: 'linux',
      arch: 'arm64',
      plugin_sha256: hash,
      dispatcher_sha256: hash,
      command_catalogue: true,
      agent_catalogue: true,
      denial: true,
      control: true,
      checked_at: '2026-08-26T12:00:00.000Z',
      result: 'passed',
    };
    const evidenceModule: Record<string, unknown> = await import('../../src/opencode/evidence.js');

    expect(evidenceModule.writePassingOpenCodeConformance).toBeTypeOf('function');
    const writeEvidence = evidenceModule.writePassingOpenCodeConformance;
    if (typeof writeEvidence !== 'function') throw new Error('Missing conformance writer');
    expect(() => writeEvidence(directory, { ...conformance, ...sensitive })).toThrow();
    expect(writeEvidence(directory, conformance)).toBe(
      nodePath.join(directory, `1.18.23-${hash}.json`),
    );

    expect(readdirSync(directory)).toEqual([`1.18.23-${hash}.json`]);
    const persisted = readFileSync(nodePath.join(directory, `1.18.23-${hash}.json`), 'utf8');
    expect(JSON.parse(persisted)).toEqual(conformance);
    for (const sentinel of Object.values(sensitive)) expect(persisted).not.toContain(sentinel);
  });

  it('accepts only the bounded marker-resolution error', () => {
    const profileError = {
      schema_version: 1,
      safeword_version: '0.79.4',
      plugin_sha256: hash,
      error_code: 'marker_resolution_failed',
      observed_at: '2026-08-26T12:00:00.000Z',
    };

    expect(parseOpenCodeProfileError(profileError)).toEqual(profileError);
    expect(parseOpenCodeProfileError({ ...profileError, error: 'EACCES /secret' })).toBeUndefined();
  });
});
