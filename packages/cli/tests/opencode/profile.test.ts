import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { parseAgentSelection } from '../../src/cli-protocol/agent-selection.js';
/* eslint-disable import-x/no-unresolved -- Intentionally absent in the committed RED step. */
import {
  type OpenCodeIdentityV1,
  openCodeProfilePaths,
  reconcileOpenCodeProfile,
  resolveOpenCodeConfigRoot,
} from '../../src/opencode/profile.js';
/* eslint-enable import-x/no-unresolved */
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryDirectories: string[] = [];
const pluginBytes = 'export const SafewordPlugin = {}\n';

function temporaryDirectory(): string {
  const directory = createTemporaryDirectory();
  temporaryDirectories.push(directory);
  return directory;
}

function identity(): OpenCodeIdentityV1 {
  const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
  return {
    schema_version: 1,
    safeword_version: '0.79.4',
    plugin_path: 'plugins/safeword.js',
    plugin_sha256: digest(pluginBytes),
    runtime_path: '/runtime/node',
    dispatcher_path: '/runtime/safeword-dispatcher.js',
    dispatcher_sha256: digest('dispatcher'),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories) removeTemporaryDirectory(directory);
  temporaryDirectories.length = 0;
});

describe('OpenCode profile boundary', () => {
  it('TBU1.R1.S08 rejects USERPROFILE as a Unix fallback without touching the decoy', () => {
    const userProfile = temporaryDirectory();
    const decoy = nodePath.join(userProfile, '.config/opencode/decoy.txt');
    mkdirSync(nodePath.dirname(decoy), { recursive: true });
    writeFileSync(decoy, 'user bytes\n');

    expect(
      resolveOpenCodeConfigRoot({
        platform: 'unix',
        env: { USERPROFILE: userProfile },
      }),
    ).toBeUndefined();
    expect(readFileSync(decoy, 'utf8')).toBe('user bytes\n');
  });

  it('accepts explicit OpenCode selection without changing the default integrations', () => {
    expect(parseAgentSelection('opencode')).toEqual({
      ok: true,
      selection: { agents: ['opencode'] },
    });
    expect(parseAgentSelection(undefined)).toEqual({
      ok: true,
      selection: { agents: ['claude', 'codex'] },
    });
  });

  it.each([
    ['plugin', 'install'],
    ['plugin', 'uninstall'],
    ['identity', 'install'],
    ['identity', 'uninstall'],
  ] as const)('TBU1.R3.S04 preserves a colliding %s during %s', (profilePath, operation) => {
    const root = temporaryDirectory();
    const paths = openCodeProfilePaths(root);
    const collisionPath = profilePath === 'plugin' ? paths.plugin : paths.identity;
    const otherPath = profilePath === 'plugin' ? paths.identity : paths.plugin;
    mkdirSync(nodePath.dirname(collisionPath), { recursive: true });
    writeFileSync(collisionPath, 'unrecognized user bytes\n');

    const result = reconcileOpenCodeProfile({
      operation,
      root,
      pluginBytes,
      identity: identity(),
    });

    expect(result.state).toBe('action_required');
    expect(result.changed).toBe(false);
    expect(result.findings).toHaveLength(1);
    expect(readFileSync(collisionPath, 'utf8')).toBe('unrecognized user bytes\n');
    expect(existsSync(otherPath)).toBe(false);
  });
});
