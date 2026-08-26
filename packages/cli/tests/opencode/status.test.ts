import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  installOpenCodeProfile,
  observeOpenCodeProfile,
  type OpenCodeIdentityV1,
  openCodeProfilePaths,
} from '../../src/opencode/profile.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = createTemporaryDirectory();
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe('OpenCode status evidence', () => {
  it('TBU1.R2.S10 invalidates prior activation after marker-resolution failure', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    mkdirSync(paths.activation, { recursive: true });
    mkdirSync(paths.conformance, { recursive: true });
    writeFileSync(
      nodePath.join(paths.activation, `${'a'.repeat(64)}.json`),
      `${JSON.stringify({
        schema_version: 1,
        safeword_version: identity.safeword_version,
        plugin_sha256: identity.plugin_sha256,
        project_sha256: 'a'.repeat(64),
        event: 'plugin_load',
        observed_at: new Date().toISOString(),
      })}\n`,
    );
    writeFileSync(
      nodePath.join(paths.conformance, `1.18.23-${identity.plugin_sha256}.json`),
      `${JSON.stringify({
        schema_version: 1,
        safeword_version: identity.safeword_version,
        opencode_version: '1.18.23',
        platform: process.platform,
        arch: process.arch,
        plugin_sha256: identity.plugin_sha256,
        command_catalogue: true,
        agent_catalogue: true,
        denial: true,
        control: true,
        checked_at: new Date().toISOString(),
        result: 'passed',
      })}\n`,
    );
    writeFileSync(
      paths.profileError,
      `${JSON.stringify({
        schema_version: 1,
        safeword_version: identity.safeword_version,
        plugin_sha256: identity.plugin_sha256,
        error_code: 'marker_resolution_failed',
        observed_at: new Date().toISOString(),
      })}\n`,
    );

    const result = observeOpenCodeProfile(root);

    expect(result.state).toBe('action_required');
    expect(result.data).toMatchObject({ installed: true, activated: false, pre_tool: 'block' });
    expect(result.nextActions).toEqual([
      {
        command: 'safeword install --agents=opencode',
        mutates: true,
        requiresHuman: true,
      },
    ]);
  });
});
