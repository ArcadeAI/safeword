import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

interface SpikeWorkflowWorld {
  projectDirectory?: string;
  setupResult?: { status: number | null; stdout: string; stderr: string };
}

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts');

After(function (this: SpikeWorkflowWorld) {
  if (this.projectDirectory !== undefined) {
    rmSync(this.projectDirectory, { recursive: true, force: true });
  }
});

Given('a project without Claude or Cursor spike artifacts', function (this: SpikeWorkflowWorld) {
  this.projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-spike-'));
  writeFileSync(
    nodePath.join(this.projectDirectory, 'package.json'),
    JSON.stringify({ name: 'spike-fixture', private: true }, undefined, 2),
  );
  assert.equal(existsSync(nodePath.join(this.projectDirectory, '.claude/skills/spike')), false);
  assert.equal(
    existsSync(nodePath.join(this.projectDirectory, '.cursor/commands/spike.md')),
    false,
  );
});

When(
  'the maintainer runs the real safeword setup CLI entry point',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.projectDirectory);
    const result = spawnSync('bun', [CLI_PATH, 'setup', '--yes'], {
      cwd: this.projectDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        SAFEWORD_NO_AUTO_UPGRADE: '1',
        SAFEWORD_SKIP_INSTALL: '1',
        SAFEWORD_TEST_DISABLE_AUTO_UPGRADE: '1',
      },
      timeout: 60_000,
    });
    this.setupResult = {
      status: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  },
);

Then(
  'the installed Claude Code and Cursor artifacts each expose a manual spike action',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.projectDirectory);
    assert.equal(
      this.setupResult?.status,
      0,
      `${this.setupResult?.stdout ?? ''}\n${this.setupResult?.stderr ?? ''}`,
    );
    assert.equal(
      existsSync(nodePath.join(this.projectDirectory, '.claude/skills/spike/SKILL.md')),
      true,
      'Claude Code spike skill was not installed',
    );
    assert.equal(
      existsSync(nodePath.join(this.projectDirectory, '.cursor/commands/spike.md')),
      true,
      'Cursor spike command was not installed',
    );
  },
);

Then(
  'both actions require the same charter, isolation, and evidence-distillation contract',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.projectDirectory);
    const claudeSkill = readFileSync(
      nodePath.join(this.projectDirectory, '.claude/skills/spike/SKILL.md'),
      'utf8',
    );
    const cursorCommand = readFileSync(
      nodePath.join(this.projectDirectory, '.cursor/commands/spike.md'),
      'utf8',
    );

    for (const contract of ['## Charter', '## Isolation', '## Evidence distillation']) {
      assert.ok(claudeSkill.toLowerCase().includes(contract.toLowerCase()), contract);
    }
    assert.ok(cursorCommand.includes('.claude/skills/spike/SKILL.md'), cursorCommand);
  },
);
