import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { equivalentClaudeInstallations } from '../../src/claude-plugin/status.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe('Claude effective installation selection', () => {
  it('accepts identical project and user entries that share one verified payload', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-shared-payload-'));
    roots.push(root);
    const payload = nodePath.join(root, 'payload');
    mkdirSync(payload);
    const plugin = {
      id: 'safeword@safeword',
      version: '0.73.0',
      enabled: true,
      installPath: payload,
    };
    expect(
      equivalentClaudeInstallations([
        { scope: 'user', health: 'current', plugin: { ...plugin, scope: 'user' } },
        {
          scope: 'project',
          health: 'current',
          plugin: { ...plugin, scope: 'project', projectPath: root },
        },
      ]),
    ).toBe(true);
  });

  it('rejects overlap that resolves to different payloads', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'claude-distinct-payloads-'));
    roots.push(root);
    const userPayload = nodePath.join(root, 'user');
    const projectPayload = nodePath.join(root, 'project');
    mkdirSync(userPayload);
    mkdirSync(projectPayload);
    expect(
      equivalentClaudeInstallations([
        {
          scope: 'user',
          health: 'current',
          plugin: {
            id: 'safeword@safeword',
            version: '0.73.0',
            enabled: true,
            installPath: userPayload,
          },
        },
        {
          scope: 'project',
          health: 'current',
          plugin: {
            id: 'safeword@safeword',
            version: '0.73.0',
            enabled: true,
            installPath: projectPayload,
          },
        },
      ]),
    ).toBe(false);
  });
});
