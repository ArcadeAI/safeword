/* eslint-disable unicorn/no-null -- null explicitly models an unavailable host observation */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CODEX_PLUGIN_HOOK_EVENTS,
  codexActivationIsPending,
  type CodexHostProcessIdentity,
  codexProofPath,
  codexSessionProofIsCurrent,
  currentCodexPluginIdentity,
  observeCodexHookProof,
  recordCodexHookProof,
  writeCodexActivationMarker,
} from '../../src/codex-plugin/profile-proof.js';

const OLD_HOST: CodexHostProcessIdentity = {
  pid: 100,
  started_at: '2026-08-02T08:00:00.000Z',
};
const RESTARTED_HOST: CodexHostProcessIdentity = {
  pid: 200,
  started_at: '2026-08-02T09:00:00.000Z',
};
const OTHER_OLD_HOST: CodexHostProcessIdentity = {
  pid: 300,
  started_at: '2026-08-02T08:15:00.000Z',
};

describe('Codex profile hook proof', () => {
  const directories: string[] = [];

  function createProfileFixture(): { codexHome: string; environment: { CODEX_HOME: string } } {
    const codexHome = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-profile-'));
    directories.push(codexHome);
    return { codexHome, environment: { CODEX_HOME: codexHome } };
  }

  afterEach(() => {
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
    directories.length = 0;
  });

  it('never accepts an interrupted event proof as current', () => {
    const { codexHome, environment } = createProfileFixture();

    expect(() =>
      recordCodexHookProof('session-start', environment, new Date('2026-07-28T00:00:00.000Z'), {
        beforeRename: () => {
          throw new Error('simulated interruption');
        },
      }),
    ).toThrow('simulated interruption');

    expect(existsSync(codexProofPath(environment))).toBe(false);
    expect(observeCodexHookProof(environment).status).toBe('missing');
    expect(readdirSync(nodePath.join(codexHome, 'safeword'))).toEqual(['hook-proof-v2']);
  });

  it.each([
    ['package version', { plugin_version: '0.0.0-stale' }, 'stale'],
    ['hook manifest digest', { manifest_sha256: '0'.repeat(64) }, 'stale'],
    ['proof schema', { schema_version: 2 }, 'malformed'],
    ['missing fields', { recorded_at: undefined }, 'malformed'],
  ])('rejects proof with changed %s', (_case, override, expectedStatus) => {
    const { environment } = createProfileFixture();
    const proofPath = codexProofPath(environment);
    mkdirSync(nodePath.dirname(proofPath), { recursive: true });
    writeFileSync(
      proofPath,
      JSON.stringify({
        schema_version: 1,
        event: 'session-start',
        ...currentCodexPluginIdentity(),
        recorded_at: '2026-07-28T00:00:00.000Z',
        ...override,
      }),
    );

    expect(observeCodexHookProof(environment).status).toBe(expectedStatus);
  });

  it('rejects malformed proof JSON', () => {
    const { environment } = createProfileFixture();
    const proofPath = codexProofPath(environment);
    mkdirSync(nodePath.dirname(proofPath), { recursive: true });
    writeFileSync(proofPath, '{"schema_version":');

    expect(observeCodexHookProof(environment).status).toBe('malformed');
  });

  it('requires current identity-bound proof from every packaged hook event', () => {
    const { environment } = createProfileFixture();

    recordCodexHookProof('session-start', environment);
    const partial = observeCodexHookProof(environment);
    expect(partial.status).toBe('partial');
    expect(partial.events).toEqual(['session-start']);
    expect(partial.missing_events).toEqual(
      CODEX_PLUGIN_HOOK_EVENTS.filter(event => event !== 'session-start'),
    );

    for (const event of partial.missing_events) {
      recordCodexHookProof(event, environment);
    }
    expect(observeCodexHookProof(environment).status).toBe('current');
  });

  it('binds SessionStart proof to one canonical project and Codex task', () => {
    const { codexHome, environment } = createProfileFixture();
    const project = nodePath.join(codexHome, 'project');
    const otherProject = nodePath.join(codexHome, 'other-project');
    mkdirSync(project);
    mkdirSync(otherProject);

    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:00:00.000Z'), {
      projectDirectory: project,
      sessionId: 'task-a',
    });

    expect(codexSessionProofIsCurrent(project, 'task-a', environment)).toBe(true);
    expect(codexSessionProofIsCurrent(project, 'task-b', environment)).toBe(false);
    expect(codexSessionProofIsCurrent(otherProject, 'task-a', environment)).toBe(false);
  });

  it('invalidates task proof when the profile plugin is reinstalled', () => {
    const { codexHome, environment } = createProfileFixture();
    const project = nodePath.join(codexHome, 'project');
    mkdirSync(project);
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:00:00.000Z'), {
      projectDirectory: project,
      sessionId: 'task-a',
    });

    writeCodexActivationMarker(environment, new Date('2026-08-02T09:01:00.000Z'), {
      activeHosts: [],
    });

    expect(codexSessionProofIsCurrent(project, 'task-a', environment)).toBe(false);
  });

  it('invalidates proof that predates a new installation', () => {
    const { environment } = createProfileFixture();
    for (const event of CODEX_PLUGIN_HOOK_EVENTS) {
      recordCodexHookProof(event, environment, new Date('2026-08-02T08:30:00.000Z'));
    }
    expect(observeCodexHookProof(environment).status).toBe('current');

    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-rc2',
      activeHosts: [OLD_HOST],
    });

    expect(observeCodexHookProof(environment).status).toBe('missing');
  });

  it('fails closed while a malformed canonical activation marker exists', () => {
    const { codexHome, environment } = createProfileFixture();
    const markerPath = nodePath.join(codexHome, 'safeword/activation-pending-v2.json');
    mkdirSync(nodePath.dirname(markerPath), { recursive: true });
    writeFileSync(markerPath, '{"schema_version":');

    expect(codexActivationIsPending(environment)).toBe(true);
  });

  it('does not accept a new task from the same Codex app-server as activation', () => {
    const { codexHome, environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-rc2',
      activeHosts: [OLD_HOST],
    });

    recordCodexHookProof('session-start', environment, new Date('2026-08-02T08:55:00.000Z'), {
      currentHost: OLD_HOST,
    });

    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(true);
    expect(observeCodexHookProof(environment).status).toBe('partial');
  });

  it.each([
    {
      name: 'a non-SessionStart event',
      event: 'pre-tool-use' as const,
      now: new Date('2026-08-02T09:01:00.000Z'),
      current: RESTARTED_HOST,
    },
    {
      name: 'an unavailable current host',
      event: 'session-start' as const,
      now: new Date('2026-08-02T09:01:00.000Z'),
      current: null,
    },
    {
      name: 'a SessionStart timestamp before installation',
      event: 'session-start' as const,
      now: new Date('2026-08-02T08:50:00.000Z'),
      current: RESTARTED_HOST,
    },
  ])('does not activate from $name', ({ event, now, current }) => {
    const { codexHome, environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-rc2',
      activeHosts: [OLD_HOST],
    });

    recordCodexHookProof(event, environment, now, { currentHost: current });

    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(true);
  });

  it('does not activate while another install-time Codex app-server is still running', () => {
    const { codexHome, environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-rc2',
      activeHosts: [OLD_HOST, OTHER_OLD_HOST],
    });

    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      hostObservation: {
        available: true,
        current: RESTARTED_HOST,
        running: [OTHER_OLD_HOST, RESTARTED_HOST],
      },
    });

    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(true);
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-current-v1.json'))).toBe(false);
  });

  it('does not clear activation when the install-time host observation was unavailable', () => {
    const { codexHome, environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-unknown-hosts',
      activeHosts: null,
    });

    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      currentHost: RESTARTED_HOST,
    });

    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(true);
    expect(observeCodexHookProof(environment)).toMatchObject({
      status: 'partial',
      activation_id: 'activation-unknown-hosts',
    });
  });

  it('accepts SessionStart only after the Codex app-server has restarted', () => {
    const { codexHome, environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-rc2',
      activeHosts: [OLD_HOST],
    });

    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      currentHost: RESTARTED_HOST,
    });

    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(false);
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-current-v1.json'))).toBe(true);
    expect(observeCodexHookProof(environment)).toMatchObject({
      status: 'partial',
      activation_id: 'activation-rc2',
    });
  });
});
