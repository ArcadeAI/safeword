import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { setupReconcileTest } from '../helpers.js';

const repo = nodePath.resolve(import.meta.dirname, '../../../..');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it.each(['legacy', 'native'] as const)(
  'characterizes installed %s SessionEnd cleanup without promoting its guarantee',
  async delivery => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-cleanup-behavior-'));
    roots.push(root);
    const project = nodePath.join(root, 'project');
    mkdirSync(project);
    const environment = {
      PATH: process.env.PATH,
      HOME: nodePath.join(root, 'home'),
      CLAUDE_PROJECT_DIR: project,
      CLAUDE_CONFIG_DIR: nodePath.join(root, 'config'),
      CLAUDE_PLUGIN_DATA: nodePath.join(root, 'data'),
      CLAUDE_PLUGIN_ROOT: nodePath.join(root, 'plugin'),
      SAFEWORD_SKIP_INSTALL: '1',
      SAFEWORD_NO_AUTO_UPGRADE: '1',
    };
    let manifest: Manifest;
    type Manifest = { hooks: { SessionEnd: { hooks: { command: string }[] }[] } };
    if (delivery === 'legacy') {
      // Install current schema-owned legacy assets without the public CLI's network preflight.
      const installed = await setupReconcileTest(project);
      expect(installed.result.applied).toBe(true);
      manifest = JSON.parse(
        readFileSync(nodePath.join(project, '.claude/settings.json'), 'utf8'),
      ) as Manifest;
    } else {
      cpSync(nodePath.join(repo, 'plugin'), environment.CLAUDE_PLUGIN_ROOT, { recursive: true });
      manifest = JSON.parse(
        readFileSync(nodePath.join(environment.CLAUDE_PLUGIN_ROOT, 'hooks/hooks.json'), 'utf8'),
      ) as Manifest;
    }
    const command = manifest.hooks.SessionEnd[0]?.hooks[0]?.command;
    assert.ok(command, `HOST_CONTRACT_PROOF_UNAVAILABLE: ${delivery} SessionEnd missing`);
    const namespace = nodePath.join(project, '.project');
    mkdirSync(namespace, { recursive: true });
    const old = nodePath.join(namespace, 'quality-state-old.json'),
      fresh = nodePath.join(namespace, 'quality-state-current.json'),
      unrelated = nodePath.join(namespace, 'notes.json');
    for (const file of [old, fresh, unrelated]) writeFileSync(file, '{}\n');
    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    for (const file of [old, unrelated]) utimesSync(file, past, past);
    const result = spawnSync('sh', ['-c', command], {
      cwd: project,
      env: environment,
      encoding: 'utf8',
      input: JSON.stringify({
        cwd: project,
        hook_event_name: 'SessionEnd',
        reason: 'logout',
        session_id: 'cleanup-control',
      }),
      timeout: 30_000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(old), 'ACTUAL_CLEANUP_OWNER_NOT_EXECUTED').toBe(false);
    expect(readFileSync(fresh, 'utf8')).toBe('{}\n');
    expect(readFileSync(unrelated, 'utf8')).toBe('{}\n');
  },
  90_000,
);
