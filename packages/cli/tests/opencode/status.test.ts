import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  installOpenCodeProfile,
  observeOpenCodeProfile,
  type OpenCodeIdentityV1,
  type OpenCodeProfilePaths,
  openCodeProfilePaths,
} from '../../src/opencode/profile.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = createTemporaryDirectory();
  temporaryDirectories.push(directory);
  return directory;
}

function writeActivationEvidence(
  paths: OpenCodeProfilePaths,
  identity: OpenCodeIdentityV1,
  event: 'plugin_load' | 'pre_tool',
  opencodeVersion?: string,
): void {
  mkdirSync(paths.activation, { recursive: true });
  writeFileSync(
    nodePath.join(paths.activation, `${'a'.repeat(64)}.json`),
    `${JSON.stringify({
      schema_version: 1,
      safeword_version: identity.safeword_version,
      plugin_sha256: identity.plugin_sha256,
      project_sha256: 'a'.repeat(64),
      event,
      ...(opencodeVersion !== undefined && { opencode_version: opencodeVersion }),
      ...(event === 'pre_tool' && {
        session_id_sha256: 'b'.repeat(64),
        call_id_sha256: 'c'.repeat(64),
      }),
      observed_at: new Date().toISOString(),
    })}\n`,
  );
}

function writePassingEvidence(
  paths: OpenCodeProfilePaths,
  identity: OpenCodeIdentityV1,
  event: 'plugin_load' | 'pre_tool' | false = 'plugin_load',
): void {
  mkdirSync(paths.conformance, { recursive: true });
  if (event !== false) writeActivationEvidence(paths, identity, event);
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
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe('OpenCode status evidence', () => {
  it('NTB1.R2.S03 does not call an untested stable OpenCode version supported', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    writeActivationEvidence(paths, identity, 'pre_tool', '1.18.24');

    const result = observeOpenCodeProfile(root);

    expect(result.state).toBe('action_required');
    expect(result.data).toEqual({
      installed: true,
      activated: true,
      pre_tool: 'block',
      conformant: false,
    });
    expect(result.nextActions).toEqual([
      {
        command: 'safeword conformance --agents=opencode',
        mutates: true,
        requiresHuman: true,
      },
    ]);
  });

  it('NTB1.R3.S03 does not claim protection without activation evidence', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    writePassingEvidence(paths, identity, false);

    const result = observeOpenCodeProfile(root);

    expect(result.state).toBe('action_required');
    expect(result.data).toEqual({
      installed: true,
      activated: false,
      pre_tool: 'block',
      conformant: true,
    });
    expect(result.nextActions).toEqual([
      {
        kind: 'human',
        instruction: 'Fully restart OpenCode, then reopen this project.',
        mutates: false,
        requiresHuman: true,
      },
    ]);
  });

  it('NTB1.R1.S01 reports independent healthy protection dimensions', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    writePassingEvidence(paths, identity, 'pre_tool');

    const result = observeOpenCodeProfile(root);

    expect(result.state).toBe('healthy');
    expect(result.data).toEqual({
      installed: true,
      activated: true,
      pre_tool: 'block',
      conformant: true,
    });
    expect(result.nextActions).toEqual([]);
  });

  it('NTB1.R2.S01 reports one consistent fully uninstalled summary', () => {
    const result = observeOpenCodeProfile(temporaryDirectory());

    expect(result.state).toBe('action_required');
    expect(result.data).toEqual({
      installed: false,
      activated: false,
      pre_tool: 'unavailable',
      conformant: false,
    });
    expect(result.nextActions).toEqual([
      {
        command: 'safeword install --agents=opencode',
        mutates: true,
        requiresHuman: true,
      },
    ]);
  });

  it('TBU1.R2.S10 invalidates prior activation after marker-resolution failure', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    writePassingEvidence(paths, identity);
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

  it('TBU1.R2.S13 prioritizes an unavailable dispatcher over passing evidence', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const installedIdentity = JSON.parse(
      readFileSync(paths.identity, 'utf8'),
    ) as OpenCodeIdentityV1;
    const identity: OpenCodeIdentityV1 = {
      ...installedIdentity,
      dispatcher_path: nodePath.join(root, 'pruned-dispatcher.js'),
    };
    writeFileSync(paths.identity, `${JSON.stringify(identity)}\n`);
    writePassingEvidence(paths, identity);

    const result = observeOpenCodeProfile(root);

    expect(result.state).toBe('action_required');
    expect(result.findings).toMatchObject([{ code: 'OPENCODE_DISPATCHER_UNAVAILABLE' }]);
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
