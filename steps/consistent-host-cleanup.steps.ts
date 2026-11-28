import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { readHistoricalTemplate } from '../packages/cli/tests/helpers/git-history.js';
import type { SafewordWorld } from './world.js';

const plugin = path.resolve(import.meta.dirname, '../plugin');
const conflict = '.claude/agents/safeword-retro-filer.md';
const owned = '.claude/skills/bdd/DISCOVERY.md';
const authored = 'A customer-owned change.\n';

interface CleanupWorld extends SafewordWorld {
  cleanup?: { root: string; project: string; linked: boolean; advisory?: string };
}

After(function (this: CleanupWorld) {
  if (this.cleanup) rmSync(this.cleanup.root, { recursive: true, force: true });
});

Given(
  'ownership of a legacy framework path is {string}',
  function (this: CleanupWorld, ownership: string) {
    assert.ok(['user-modified', 'unverifiable'].includes(ownership));
    const root = mkdtempSync(path.join(tmpdir(), 'safeword-cleanup-ownership-'));
    const project = path.join(root, 'project');
    this.cleanup = { root, project, linked: ownership === 'unverifiable' };
    for (const directory of [
      'home',
      'profile',
      'project/.safeword',
      path.dirname('project/' + conflict),
      path.dirname('project/' + owned),
    ]) {
      mkdirSync(path.join(root, directory), { recursive: true });
    }
    execFileSync('git', ['init', '-q', project]);
    writeFileSync(path.join(project, '.safeword/SAFEWORD.md'), 'Disposable project.\n');
    writeFileSync(path.join(project, owned), readHistoricalTemplate('0.72.0', owned));
    const target = path.join(project, conflict);
    if (this.cleanup.linked) {
      const outside = path.join(root, 'customer-note');
      writeFileSync(outside, authored);
      symlinkSync(outside, target);
    } else writeFileSync(target, authored);
  },
);

When('migration plans its cleanup', function (this: CleanupWorld) {
  assert.ok(this.cleanup);
  const { project, root } = this.cleanup;
  const manifest = JSON.parse(readFileSync(path.join(plugin, 'hooks/hooks.json'), 'utf8'));
  const [{ command }] = manifest.hooks.UserPromptSubmit[0].hooks;
  const event = {
    hook_event_name: 'UserPromptSubmit',
    cwd: project,
    session_id: randomUUID(),
    prompt: 'Hello',
  };
  const stdout = execFileSync('/bin/sh', ['-c', command], {
    cwd: project,
    encoding: 'utf8',
    timeout: 12_000,
    input: JSON.stringify(event),
    env: {
      PATH: process.env.PATH,
      HOME: path.join(root, 'home'),
      CLAUDE_CONFIG_DIR: path.join(root, 'profile'),
      CLAUDE_PROJECT_DIR: project,
      CLAUDE_PLUGIN_ROOT: plugin,
    },
  });
  this.cleanup.advisory = JSON.parse(stdout).hookSpecificOutput.additionalContext;
});

Then(
  'the existing content is preserved with a concrete conflict recovery action',
  function (this: CleanupWorld) {
    assert.ok(this.cleanup);
    const { project, root, linked, advisory } = this.cleanup;
    assert.ok(advisory?.includes(conflict));
    assert.match(advisory, /Review those paths/u);
    const target = path.join(project, conflict);
    if (linked) assert.equal(readlinkSync(target), path.join(root, 'customer-note'));
    assert.equal(readFileSync(target, 'utf8'), authored);
    assert.equal(existsSync(path.join(project, owned)), false);
  },
);
