import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  expectHookAllow,
  expectHookDeny,
  initGitRepo,
  setupReconcileTest,
  writeGateConfig,
} from '../helpers.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function manualTransition(config: string | false) {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-design-option-control-'));
  roots.push(root);
  initGitRepo(root);
  const commit = spawnSync(
    'git',
    [
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '--allow-empty',
      '-qm',
      'private option control',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(commit.status, 0, commit.stderr);
  const setup = await setupReconcileTest(root);
  expect(setup.result.applied).toBe(true);
  writeGateConfig(root, {
    designApprovalGate: false,
    reviewGate: false,
    selfReport: { capture: false, file: false, surface: false },
  });
  if (config !== false) writeFileSync(nodePath.join(root, '.safeword/config.json'), config);
  const directory = nodePath.join(root, '.project/tickets/OPT124-design-control');
  mkdirSync(directory, { recursive: true });
  const content =
    '---\nid: OPT124\ntype: feature\nstatus: in_progress\nphase: plan-implementation\n---\n# Private control\n';
  writeFileSync(nodePath.join(directory, 'ticket.md'), content);
  writeFileSync(nodePath.join(directory, 'spec.md'), '# Private spec\n');
  writeFileSync(
    nodePath.join(directory, 'impl-plan.md'),
    '# Impl Plan\n\n**Status:** planned\n\n## Approach\n\nOne synthetic slice.\n\n## Decisions\n\nUse existing owners.\n\n## Design alignment\n\nskip: no configured principles\n\n## Known deviations\n\nskip: none\n\n## Assessment triggers\n\nRevisit if inputs change.\n',
  );
  const manifest = JSON.parse(readFileSync(nodePath.join(root, '.claude/settings.json'), 'utf8'));
  const hook = manifest.hooks.PreToolUse.flatMap(
    (row: { hooks: { command: string }[] }) => row.hooks,
  ).find((row: { command: string }) => row.command.includes('/pre-tool-quality.ts'));
  assert.ok(hook, 'Installed pre-action binding missing');
  const result = spawnSync('sh', ['-c', hook.command], {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      HOME: nodePath.join(root, 'private-home'),
      XDG_CONFIG_HOME: nodePath.join(root, 'private-config'),
      CLAUDE_PROJECT_DIR: root,
      SAFEWORD_NO_AUTO_UPGRADE: '1',
      SAFEWORD_SKIP_INSTALL: '1',
      SAFEWORD_PLUGIN_CLI: nodePath.resolve(import.meta.dirname, '../../dist/cli.js'),
    },
    input: JSON.stringify({
      cwd: root,
      hook_event_name: 'PreToolUse',
      session_id: 'design-option-control',
      tool_name: 'Write',
      tool_input: {
        file_path: nodePath.join(directory, 'ticket.md'),
        content: content.replace('phase: plan-implementation', 'phase: plan-execution'),
      },
    }),
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal ?? undefined, undefined);
  return result;
}

it('allows the installed manual planning transition when design approval is disabled', async () => {
  expectHookAllow(await manualTransition(false));
}, 120_000);

it('denies the installed manual transition with actionable recovery for invalid gate configuration', async () => {
  expectHookDeny(
    await manualTransition('{invalid'),
    'Repair the configuration before approving the plan',
  );
}, 120_000);
