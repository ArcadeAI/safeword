import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { observeLifecycleStatus } from '../../src/lifecycle/status.js';
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
  observedAt = new Date().toISOString(),
  projectSha256 = 'a'.repeat(64),
): void {
  mkdirSync(paths.activation, { recursive: true });
  writeFileSync(
    nodePath.join(paths.activation, `${projectSha256}-${event}.json`),
    `${JSON.stringify({
      schema_version: 1,
      safeword_version: identity.safeword_version,
      plugin_sha256: identity.plugin_sha256,
      project_sha256: projectSha256,
      event,
      ...(event === 'pre_tool' && {
        session_id_sha256: 'b'.repeat(64),
        call_id_sha256: 'c'.repeat(64),
      }),
      observed_at: observedAt,
    })}\n`,
  );
}

function writePassingEvidence(
  paths: OpenCodeProfilePaths,
  identity: OpenCodeIdentityV1,
  event: 'plugin_load' | 'pre_tool' | false = 'plugin_load',
): void {
  if (event !== false) writeActivationEvidence(paths, identity, event);
  writeConformanceEvidence(paths, identity);
}

function writeConformanceEvidence(
  paths: OpenCodeProfilePaths,
  identity: OpenCodeIdentityV1,
  overrides: Readonly<Record<string, unknown>> = {},
): void {
  mkdirSync(paths.conformance, { recursive: true });
  const evidence = {
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
    ...overrides,
  };
  writeFileSync(
    nodePath.join(paths.conformance, `${evidence.opencode_version}-${evidence.plugin_sha256}.json`),
    `${JSON.stringify(evidence)}\n`,
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe('OpenCode status evidence', () => {
  it('NTB1.R1.S02 describes the non-blocking stop boundary as observational', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    writePassingEvidence(paths, identity, 'pre_tool');

    const result = observeOpenCodeProfile(root);

    expect(result.state).toBe('healthy');
    expect(result.findings).toContainEqual({
      code: 'OPENCODE_STOP_OBSERVATIONAL',
      message: 'OpenCode stop events are observed but cannot block the session from stopping.',
      severity: 'info',
    });
    expect(result.nextActions).toEqual([]);
  });

  it.each([
    ['schema version', { schema_version: 2 }],
    ['Safeword version', { safeword_version: '0.0.0' }],
    ['OpenCode version', { opencode_version: '1.18.24' }],
    ['plugin hash', { plugin_sha256: 'd'.repeat(64) }],
    ['platform', { platform: process.platform === 'darwin' ? 'linux' : 'darwin' }],
    ['architecture', { arch: process.arch === 'arm64' ? 'x64' : 'arm64' }],
  ])('TBU1.R4 rejects conformance when %s differs', (_dimension, overrides) => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    writePassingEvidence(paths, identity, 'pre_tool');
    expect(observeOpenCodeProfile(root, { opencodeVersion: '1.18.23' }).state).toBe('healthy');

    rmSync(paths.conformance, { recursive: true });
    writeConformanceEvidence(paths, identity, overrides);
    const result = observeOpenCodeProfile(root, { opencodeVersion: '1.18.23' });

    expect(result.state).toBe('action_required');
    expect(result.data).toMatchObject({ conformant: false });
    expect(result.nextActions).toEqual([
      {
        command: 'safeword conformance --agents=opencode',
        mutates: true,
        requiresHuman: true,
      },
    ]);
  });

  it.each([
    ['7 days and 1 second old', { observed_at: '2026-08-19T11:59:59.000Z' }],
    ['malformed', '{'],
    ['future dated', { observed_at: '2026-08-26T12:00:01.000Z' }],
    ['project mismatched', { project_sha256: 'd'.repeat(64) }],
    ['plugin mismatched', { plugin_sha256: 'e'.repeat(64) }],
    ['schema mismatched', { schema_version: 2 }],
    ['Safeword mismatched', { safeword_version: '0.0.0' }],
  ])('NTB1.R3.S01 keeps %s activation evidence non-current', (state, invalid) => {
    const root = temporaryDirectory();
    const projectDirectory = nodePath.join(root, 'project');
    mkdirSync(projectDirectory);
    const projectHash = createHash('sha256').update(realpathSync(projectDirectory)).digest('hex');
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    writePassingEvidence(paths, identity, false);
    const now = Date.parse('2026-08-26T12:00:00.000Z');
    const valid = {
      schema_version: 1,
      safeword_version: identity.safeword_version,
      plugin_sha256: identity.plugin_sha256,
      project_sha256: projectHash,
      event: 'pre_tool',
      session_id_sha256: 'b'.repeat(64),
      call_id_sha256: 'c'.repeat(64),
      observed_at: new Date(now).toISOString(),
    };
    mkdirSync(paths.activation, { recursive: true });
    const activationPath = nodePath.join(paths.activation, `${projectHash}-pre_tool.json`);
    writeFileSync(activationPath, `${JSON.stringify(valid)}\n`);
    expect(observeOpenCodeProfile(root, { now, projectDirectory }).state).toBe('healthy');

    const invalidPath =
      state === 'project mismatched'
        ? nodePath.join(paths.activation, `${'d'.repeat(64)}-pre_tool.json`)
        : activationPath;
    if (invalidPath !== activationPath) rmSync(activationPath);
    writeFileSync(
      invalidPath,
      typeof invalid === 'string' ? invalid : `${JSON.stringify({ ...valid, ...invalid })}\n`,
    );
    const result = observeOpenCodeProfile(root, { now, projectDirectory });

    expect(result.state).toBe('action_required');
    expect(result.data).toMatchObject({ activated: false, conformant: true });
    expect(result.nextActions).toEqual([
      {
        kind: 'human',
        instruction: 'Fully restart OpenCode, then reopen this project.',
        mutates: false,
        requiresHuman: true,
      },
    ]);
  });

  it('NTB1.R3.S02 accepts activation at the exact seven-day boundary', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    writePassingEvidence(paths, identity, false);
    const now = Date.parse('2026-08-26T12:00:00.000Z');
    writeActivationEvidence(
      paths,
      identity,
      'pre_tool',
      new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    );

    const result = observeOpenCodeProfile(root, { now });

    expect(result.state).toBe('healthy');
    expect(result.data).toMatchObject({ activated: true });
    expect(result.nextActions).toEqual([]);
  });

  it('NTB1.R2.S03 does not call an untested stable OpenCode version supported', () => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    writePassingEvidence(paths, identity, 'pre_tool');

    const result = observeOpenCodeProfile(root, { opencodeVersion: '1.18.24' });

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

  it('NTB1.R1.S01 keeps all protection dimensions in the public status envelope', async () => {
    const root = temporaryDirectory();
    const project = temporaryDirectory();
    const bin = temporaryDirectory();
    const executable = nodePath.join(bin, 'opencode');
    writeFileSync(executable, "#!/bin/sh\nprintf '1.18.23\\n'\n");
    chmodSync(executable, 0o755);
    const paths = openCodeProfilePaths(root);
    expect(installOpenCodeProfile(root).state).toBe('changed');
    const identity = JSON.parse(readFileSync(paths.identity, 'utf8')) as OpenCodeIdentityV1;
    const projectSha256 = createHash('sha256').update(realpathSync(project)).digest('hex');
    writeActivationEvidence(paths, identity, 'pre_tool', undefined, projectSha256);
    writeConformanceEvidence(paths, identity);

    const result = await observeLifecycleStatus(project, ['opencode'], {
      OPENCODE_CONFIG_DIR: root,
      PATH: bin,
    });
    const surfaces = (
      result.data as { readonly surfaces: readonly { name: string; data?: unknown }[] }
    ).surfaces;

    expect(surfaces.find(surface => surface.name === 'opencode')?.data).toEqual({
      installed: true,
      activated: true,
      pre_tool: 'block',
      conformant: true,
    });
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
