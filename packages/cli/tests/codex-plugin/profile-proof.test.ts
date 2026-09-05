/* eslint-disable unicorn/no-null -- null explicitly models an unavailable host observation */

import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { CodexHostProcessObservation } from '../../src/codex-plugin/host-process.js';
import {
  CODEX_PLUGIN_HOOK_EVENTS,
  codexActivationIsPending,
  codexActivationRestartIsProven,
  codexActivationRestartWasObserved,
  type CodexHostProcessIdentity,
  codexProofPath,
  codexSessionProofIsCurrent,
  currentCodexPluginIdentity,
  observeCodexHookProof,
  observeCodexSessionProof,
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

  function onlySessionProofPath(codexHome: string): string {
    const root = nodePath.join(codexHome, 'safeword/session-proof-v1');
    const project = nodePath.join(root, readdirSync(root)[0] ?? 'missing');
    return nodePath.join(project, readdirSync(project)[0] ?? 'missing');
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
    ['proof schema', { schema_version: 1 }, 'malformed'],
    ['missing fields', { recorded_at: undefined }, 'malformed'],
  ])('rejects proof with changed %s', (_case, override, expectedStatus) => {
    const { environment } = createProfileFixture();
    const proofPath = codexProofPath(environment);
    mkdirSync(nodePath.dirname(proofPath), { recursive: true });
    writeFileSync(
      proofPath,
      JSON.stringify({
        schema_version: 2,
        event: 'session-start',
        ...currentCodexPluginIdentity(),
        activation_id: null,
        recorded_at: '2026-07-28T00:00:00.000Z',
        ...override,
      }),
      { mode: 0o600 },
    );

    expect(observeCodexHookProof(environment).status).toBe(expectedStatus);
  });

  it('rejects malformed proof JSON', () => {
    const { environment } = createProfileFixture();
    const proofPath = codexProofPath(environment);
    mkdirSync(nodePath.dirname(proofPath), { recursive: true });
    writeFileSync(proofPath, '{"schema_version":', { mode: 0o600 });

    expect(observeCodexHookProof(environment).status).toBe('malformed');
  });

  it.each(['symlink', 'hardlink', 'permissive-mode'] as const)(
    'rejects %s substitution of cleanup-authorizing proof',
    attack => {
      const { codexHome, environment } = createProfileFixture();
      for (const event of CODEX_PLUGIN_HOOK_EVENTS) {
        recordCodexHookProof(event, environment, new Date(), {
          projectDirectory: codexHome,
          sessionId: 'current-task',
        });
      }
      const proofPath = codexProofPath(environment, 'stop');
      if (attack === 'symlink') {
        const target = `${proofPath}.target`;
        renameSync(proofPath, target);
        symlinkSync(target, proofPath);
      } else if (attack === 'hardlink') {
        linkSync(proofPath, `${proofPath}.alias`);
      } else {
        chmodSync(proofPath, 0o644);
      }

      expect(
        observeCodexHookProof(environment, {
          projectDirectory: codexHome,
          sessionId: 'current-task',
        }).status,
      ).toBe('malformed');
    },
  );

  it('accepts private same-user proof when POSIX permission metadata is unavailable', () => {
    const { environment } = createProfileFixture();
    for (const event of CODEX_PLUGIN_HOOK_EVENTS) recordCodexHookProof(event, environment);
    chmodSync(codexProofPath(environment, 'stop'), 0o644);
    const getuidDescriptor = Object.getOwnPropertyDescriptor(process, 'getuid');
    Object.defineProperty(process, 'getuid', { configurable: true, value: undefined });
    try {
      expect(observeCodexHookProof(environment).status).toBe('current');
    } finally {
      if (getuidDescriptor === undefined) delete (process as { getuid?: unknown }).getuid;
      else Object.defineProperty(process, 'getuid', getuidDescriptor);
    }
  });

  it('treats an empty CODEX_HOME as unset instead of writing relative proof paths', () => {
    expect(codexProofPath({ CODEX_HOME: '  ' })).toBe(
      nodePath.join(homedir(), '.codex/safeword/hook-proof-v2/session-start.json'),
    );
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

  it('requires every cleanup-authorizing event from the same canonical project and task', () => {
    const { codexHome, environment } = createProfileFixture();
    const project = nodePath.join(codexHome, 'project');
    const otherProject = nodePath.join(codexHome, 'other-project');
    mkdirSync(project);
    mkdirSync(otherProject);
    for (const event of CODEX_PLUGIN_HOOK_EVENTS) {
      recordCodexHookProof(event, environment, new Date(), {
        projectDirectory: project,
        sessionId: 'task-a',
      });
    }

    expect(
      observeCodexHookProof(environment, { projectDirectory: project, sessionId: 'task-a' }).status,
    ).toBe('current');
    expect(
      observeCodexHookProof(environment, {
        projectDirectory: otherProject,
        sessionId: 'task-a',
      }).status,
    ).toBe('stale');
    expect(
      observeCodexHookProof(environment, { projectDirectory: project, sessionId: 'task-b' }).status,
    ).toBe('stale');
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

  it('treats a legacy task proof as observed history rather than current authority', () => {
    const { codexHome, environment } = createProfileFixture();
    const project = nodePath.join(codexHome, 'project');
    mkdirSync(project);
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:00:00.000Z'), {
      projectDirectory: project,
      sessionId: 'legacy-task',
    });
    const proofRoot = nodePath.join(codexHome, 'safeword/session-proof-v1');
    const projectProofDirectory = nodePath.join(proofRoot, readdirSync(proofRoot)[0] ?? 'missing');
    const proofPath = nodePath.join(
      projectProofDirectory,
      readdirSync(projectProofDirectory)[0] ?? 'missing',
    );
    const currentProof = JSON.parse(readFileSync(proofPath, 'utf8')) as Record<string, unknown>;
    const { activation_id: _activationId, ...legacyProof } = currentProof;
    writeFileSync(proofPath, JSON.stringify({ ...legacyProof, schema_version: 1 }));

    expect(observeCodexSessionProof(project, 'legacy-task', environment).status).toBe(
      'prior-observed',
    );
    expect(codexSessionProofIsCurrent(project, 'legacy-task', environment)).toBe(false);
  });

  it('preserves task proof as a prior observed runtime when the profile plugin is reinstalled', () => {
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
    expect(observeCodexSessionProof(project, 'task-a', environment)).toMatchObject({
      status: 'prior-observed',
      plugin_version: currentCodexPluginIdentity().plugin_version,
      recorded_at: '2026-08-02T09:00:00.000Z',
    });
  });

  it('does not trust a writable task proof as prior-runtime evidence', () => {
    const { codexHome, environment } = createProfileFixture();
    const project = nodePath.join(codexHome, 'project');
    mkdirSync(project);
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:00:00.000Z'), {
      projectDirectory: project,
      sessionId: 'task-a',
    });
    const proofRoot = nodePath.join(codexHome, 'safeword/session-proof-v1');
    const projectProofName = readdirSync(proofRoot)[0];
    expect(projectProofName).toBeDefined();
    const projectProofDirectory = nodePath.join(proofRoot, projectProofName ?? 'missing');
    const proofName = readdirSync(projectProofDirectory)[0];
    expect(proofName).toBeDefined();
    const proofPath = nodePath.join(projectProofDirectory, proofName ?? 'missing');
    chmodSync(proofPath, 0o644);
    writeCodexActivationMarker(environment, new Date('2026-08-02T09:01:00.000Z'), {
      activeHosts: [],
    });

    expect(observeCodexSessionProof(project, 'task-a', environment)).toMatchObject({
      status: 'untrusted',
      plugin_version: null,
    });
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
    expect(observeCodexHookProof(environment).status).toBe('stale');
  });

  it('observes a completed app restart without mutating the pending activation marker', () => {
    const { codexHome, environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-completed',
      activeHosts: [OLD_HOST],
    });

    expect(
      codexActivationRestartWasObserved(environment, new Date('2026-08-02T09:01:00.000Z'), {
        hostObservation: { available: true, current: RESTARTED_HOST, running: [RESTARTED_HOST] },
      }),
    ).toBe(true);
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(true);
  });

  it.each<[string, CodexHostProcessObservation]>([
    ['the installing host is current', { available: true, current: OLD_HOST, running: [OLD_HOST] }],
    [
      'an installing host is still running',
      { available: true, current: RESTARTED_HOST, running: [OLD_HOST, RESTARTED_HOST] },
    ],
    ['process observation is unavailable', { available: false, current: null, running: [] }],
  ])('does not report restart completion when %s', (_name, hostObservation) => {
    const { environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-incomplete',
      activeHosts: [OLD_HOST],
    });

    expect(
      codexActivationRestartWasObserved(environment, new Date('2026-08-02T09:01:00.000Z'), {
        hostObservation,
      }),
    ).toBe(false);
  });

  it('retains the current Codex host when process discovery returns an empty running set', () => {
    const { codexHome, environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-empty-running',
      hostObservation: { available: true, current: OLD_HOST, running: [] },
    });

    const markerPath = nodePath.join(codexHome, 'safeword/activation-pending-v2.json');
    expect(JSON.parse(readFileSync(markerPath, 'utf8'))).toMatchObject({
      host_observation: 'observed',
      active_hosts: [OLD_HOST],
    });

    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      hostObservation: { available: true, current: OLD_HOST, running: [] },
    });

    expect(existsSync(markerPath)).toBe(true);
  });

  it('activates from a host started after an observed empty install-time host set', () => {
    const { codexHome, environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-no-host',
      hostObservation: { available: true, current: null, running: [] },
    });

    const markerPath = nodePath.join(codexHome, 'safeword/activation-pending-v2.json');
    expect(JSON.parse(readFileSync(markerPath, 'utf8'))).toMatchObject({
      host_observation: 'observed',
      active_hosts: [],
    });
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      currentHost: RESTARTED_HOST,
    });

    expect(existsSync(markerPath)).toBe(false);
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-current-v1.json'))).toBe(true);
    expect(codexActivationRestartIsProven(environment)).toBe(true);
  });

  it('does not activate an observed empty host set from a host that predates installation', () => {
    const { codexHome, environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-no-host',
      hostObservation: { available: true, current: null, running: [] },
    });

    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      currentHost: OLD_HOST,
    });

    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(true);
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-current-v1.json'))).toBe(false);
  });

  it('does not activate from an unobserved host that predates installation', () => {
    const { codexHome, environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-racy-host-scan',
      activeHosts: [OLD_HOST],
    });

    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      hostObservation: {
        available: true,
        current: OTHER_OLD_HOST,
        running: [OTHER_OLD_HOST],
      },
    });

    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(true);
    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-current-v1.json'))).toBe(false);
  });

  it('bounds retained task proof history while keeping the newest task', () => {
    const { codexHome, environment } = createProfileFixture();
    const project = nodePath.join(codexHome, 'project');
    const otherProject = nodePath.join(codexHome, 'other-project');
    mkdirSync(project);
    mkdirSync(otherProject);
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T08:59:00.000Z'), {
      projectDirectory: otherProject,
      sessionId: 'other-task',
    });
    const proofRoot = nodePath.join(codexHome, 'safeword/session-proof-v1');
    const emptyProjectDirectory = nodePath.join(proofRoot, 'empty-project');
    mkdirSync(emptyProjectDirectory);

    for (let index = 0; index < 258; index += 1) {
      recordCodexHookProof(
        'session-start',
        environment,
        new Date(Date.UTC(2026, 7, 2, 9, 0, index)),
        { projectDirectory: project, sessionId: `task-${index}` },
      );
    }

    const retainedProofs = readdirSync(proofRoot, { withFileTypes: true }).flatMap(entry =>
      readdirSync(nodePath.join(proofRoot, entry.name)),
    );
    expect(retainedProofs).toHaveLength(257);
    // An empty sibling may belong to a concurrent writer. It stays until the
    // bounded project cap can evict it without racing that write.
    expect(existsSync(emptyProjectDirectory)).toBe(true);
    expect(observeCodexSessionProof(project, 'task-257', environment).status).toBe('current');
    expect(observeCodexSessionProof(otherProject, 'other-task', environment).status).toBe(
      'current',
    );
  });

  it('bounds retained project histories without evicting the active project', () => {
    const { codexHome, environment } = createProfileFixture();
    for (let index = 0; index < 66; index += 1) {
      const project = nodePath.join(codexHome, `project-${index}`);
      mkdirSync(project);
      recordCodexHookProof('session-start', environment, new Date(Date.UTC(2026, 7, 2, 9, index)), {
        projectDirectory: project,
        sessionId: `task-${index}`,
      });
    }

    const proofRoot = nodePath.join(codexHome, 'safeword/session-proof-v1');
    expect(readdirSync(proofRoot)).toHaveLength(64);
    expect(
      observeCodexSessionProof(nodePath.join(codexHome, 'project-65'), 'task-65', environment)
        .status,
    ).toBe('current');
    expect(
      observeCodexSessionProof(nodePath.join(codexHome, 'project-0'), 'task-0', environment).status,
    ).toBe('missing');
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
      status: 'stale',
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
    expect(codexActivationRestartIsProven(environment)).toBe(true);
    expect(observeCodexHookProof(environment)).toMatchObject({
      status: 'partial',
      activation_id: 'activation-rc2',
    });
  });

  it('does not assemble current cleanup proof from pre-restart hook executions', () => {
    const { codexHome, environment } = createProfileFixture();
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-aggregate-restart',
      activeHosts: [OLD_HOST],
    });
    for (const [index, event] of CODEX_PLUGIN_HOOK_EVENTS.entries()) {
      recordCodexHookProof(event, environment, new Date(`2026-08-02T08:${55 + index}:00.000Z`), {
        currentHost: OLD_HOST,
      });
    }

    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      currentHost: RESTARTED_HOST,
    });

    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-current-v1.json'))).toBe(true);
    expect(observeCodexHookProof(environment)).toMatchObject({
      status: 'partial',
      events: ['session-start'],
      missing_events: ['pre-tool-use', 'post-tool-use', 'user-prompt-submit', 'stop'],
    });
  });

  it('does not promote activation-pending task proof after the restart receipt', () => {
    const { codexHome, environment } = createProfileFixture();
    const project = nodePath.join(codexHome, 'project');
    mkdirSync(project);
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-pending-task',
      activeHosts: [OLD_HOST],
    });
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T08:55:00.000Z'), {
      currentHost: OLD_HOST,
      projectDirectory: project,
      sessionId: 'pending-task',
    });
    expect(observeCodexSessionProof(project, 'pending-task', environment).status).toBe(
      'activation-pending',
    );

    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      currentHost: RESTARTED_HOST,
      projectDirectory: project,
      sessionId: 'restarted-task',
    });

    expect(observeCodexSessionProof(project, 'pending-task', environment).status).toBe(
      'prior-observed',
    );
    expect(observeCodexSessionProof(project, 'restarted-task', environment).status).toBe('current');
  });

  it('does not promote a pre-install task proof after a same-version restart', () => {
    const { codexHome, environment } = createProfileFixture();
    const project = nodePath.join(codexHome, 'project');
    mkdirSync(project);
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T08:30:00.000Z'), {
      projectDirectory: project,
      sessionId: 'old-task',
    });
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-same-version',
      activeHosts: [OLD_HOST],
    });
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      currentHost: RESTARTED_HOST,
      projectDirectory: project,
      sessionId: 'restarted-task',
    });

    expect(observeCodexSessionProof(project, 'old-task', environment).status).toBe(
      'prior-observed',
    );
    expect(observeCodexSessionProof(project, 'restarted-task', environment).status).toBe('current');
  });

  it('keeps an older plugin identity prior-observed after the marker is retired', () => {
    const { codexHome, environment } = createProfileFixture();
    const project = nodePath.join(codexHome, 'project');
    mkdirSync(project);
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T08:30:00.000Z'), {
      projectDirectory: project,
      sessionId: 'old-task',
    });
    const oldProofPath = onlySessionProofPath(codexHome);
    const oldProof = JSON.parse(readFileSync(oldProofPath, 'utf8')) as Record<string, unknown>;
    writeFileSync(
      oldProofPath,
      JSON.stringify({
        ...oldProof,
        plugin_version: '0.77.0',
        manifest_sha256: '0'.repeat(64),
      }),
    );
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-upgrade',
      activeHosts: [OLD_HOST],
    });
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      currentHost: RESTARTED_HOST,
      projectDirectory: project,
      sessionId: 'restarted-task',
    });

    expect(existsSync(nodePath.join(codexHome, 'safeword/activation-pending-v2.json'))).toBe(false);
    expect(observeCodexSessionProof(project, 'old-task', environment)).toMatchObject({
      status: 'prior-observed',
      plugin_version: '0.77.0',
    });
    expect(codexSessionProofIsCurrent(project, 'old-task', environment)).toBe(false);
  });

  it('never promotes task proof through a permission-widened activation receipt', () => {
    const { codexHome, environment } = createProfileFixture();
    const project = nodePath.join(codexHome, 'project');
    mkdirSync(project);
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-untrusted-receipt',
      activeHosts: [OLD_HOST],
    });
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      currentHost: RESTARTED_HOST,
      projectDirectory: project,
      sessionId: 'task-a',
    });
    const receiptPath = nodePath.join(codexHome, 'safeword/activation-current-v1.json');
    chmodSync(receiptPath, 0o644);

    expect(observeCodexSessionProof(project, 'task-a', environment).status).toBe('prior-observed');
    expect(codexSessionProofIsCurrent(project, 'task-a', environment)).toBe(false);
  });

  it('distinguishes trusted proof waiting on activation from malformed proof', () => {
    const { codexHome, environment } = createProfileFixture();
    const project = nodePath.join(codexHome, 'project');
    mkdirSync(project);
    writeCodexActivationMarker(environment, new Date('2026-08-02T08:52:42.000Z'), {
      activationId: 'activation-pending-proof',
      activeHosts: [OLD_HOST],
    });
    recordCodexHookProof('session-start', environment, new Date('2026-08-02T09:01:00.000Z'), {
      currentHost: OLD_HOST,
      projectDirectory: project,
      sessionId: 'task-a',
    });

    expect(observeCodexSessionProof(project, 'task-a', environment).status).toBe(
      'activation-pending',
    );
  });
});
