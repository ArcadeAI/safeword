import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

interface SpikeWorkflowWorld {
  projectDirectory?: string;
  setupResult?: { status: number | null; stdout: string; stderr: string };
  spikeSkill?: string;
  missingCharterField?: string;
  uncertaintyKind?: string;
  spikeShape?: string;
  spikeResult?: string;
}

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts');
const SPIKE_SKILL_PATH = nodePath.join(REPO_ROOT, 'packages/cli/templates/skills/spike/SKILL.md');

After(function (this: SpikeWorkflowWorld) {
  if (this.projectDirectory !== undefined) {
    rmSync(this.projectDirectory, { recursive: true, force: true });
  }
});

Given('a validated feature with a build-only kill risk', function (this: SpikeWorkflowWorld) {
  this.spikeSkill = readFileSync(SPIKE_SKILL_PATH, 'utf8');
});

When('the maintainer invokes the spike action', function (this: SpikeWorkflowWorld) {
  assert.ok(this.spikeSkill, 'spike skill was not loaded');
});

Then(
  'the experiment requires a question, hypothesis, kill criterion, proof, and budget',
  function (this: SpikeWorkflowWorld) {
    assert.ok(this.spikeSkill);
    for (const field of ['Question', 'Hypothesis', 'Kill criterion', 'Proof', 'Budget']) {
      assert.match(this.spikeSkill, new RegExp(`\\*\\*${field}\\*\\*`));
    }
  },
);

Given(/^the uncertainty is (.+)$/, function (this: SpikeWorkflowWorld, kind: string) {
  this.uncertaintyKind = kind;
  this.spikeSkill = readFileSync(SPIKE_SKILL_PATH, 'utf8');
});

When('the maintainer considers a spike', function (this: SpikeWorkflowWorld) {
  assert.ok(this.uncertaintyKind);
});

Then('the workflow directs the maintainer to {word}', function (this: SpikeWorkflowWorld, route) {
  const expected: Record<string, RegExp> = {
    research: /documentation or code[^\n]*→ research it/i,
    elicit: /user-only knowledge[^\n]*→ `?\/elicit`?/i,
    'figure-it-out': /researchable alternatives[^\n]*→ `?\/figure-it-out`?/i,
  };
  assert.match(this.spikeSkill ?? '', expected[route] ?? /this-pattern-must-not-match/);
});

Then('no experimental code begins', function (this: SpikeWorkflowWorld) {
  assert.match(
    this.spikeSkill ?? '',
    /Otherwise route the uncertainty before writing experimental code/i,
  );
});

Given(/^a proposed spike contains (.+)$/, function (this: SpikeWorkflowWorld, shape: string) {
  this.spikeShape = shape;
  this.spikeSkill = readFileSync(SPIKE_SKILL_PATH, 'utf8');
});

When('the workflow bounds the experiment', function (this: SpikeWorkflowWorld) {
  assert.ok(this.spikeShape);
});

Then(/^it (.+)$/, function (this: SpikeWorkflowWorld, outcome: string) {
  const expected: Record<string, RegExp> = {
    'creates one experiment': /Default to one experiment, one worker/i,
    'permits only those variants to fan out':
      /parallel worktrees only for independent comparison variants/i,
    'rejects the proposal as production implementation':
      /Reject feature-wide component work[\s\S]*production implementation/i,
  };
  assert.match(this.spikeSkill ?? '', expected[outcome] ?? /this-pattern-must-not-match/);
});

Given(
  /^a bounded spike has reached a (VALIDATED|PARTIAL|INVALIDATED) result$/,
  function (this: SpikeWorkflowWorld, result: string) {
    this.spikeResult = result;
    this.spikeSkill = readFileSync(SPIKE_SKILL_PATH, 'utf8');
  },
);

When('the maintainer distills the experiment', function (this: SpikeWorkflowWorld) {
  assert.ok(this.spikeResult);
});

Then(
  'impl-plan.md records its evidence, shortcuts, decisions, and production consequences',
  function (this: SpikeWorkflowWorld) {
    const skill = this.spikeSkill ?? '';
    assert.match(skill, /VALIDATED[\s\S]*PARTIAL[\s\S]*INVALIDATED/);
    for (const field of ['Evidence', 'Useful shortcuts', 'Decision', 'Production consequences']) {
      assert.match(skill, new RegExp(`- ${field}:`));
    }
    assert.match(skill, /Distill[\s\S]*`impl-plan\.md`/i);
  },
);

Given('its experiment charter is missing the {word}', function (this: SpikeWorkflowWorld, field) {
  this.missingCharterField = field;
});

Given('its experiment charter is missing the kill criterion', function (this: SpikeWorkflowWorld) {
  this.missingCharterField = 'kill criterion';
});

Then('no proof command runs', function (this: SpikeWorkflowWorld) {
  assert.ok(this.spikeSkill);
  assert.match(this.spikeSkill, /If any field is missing[\s\S]*Do not[\s\S]*run a proof command/i);
});

Then('the workflow identifies the missing {word}', function (this: SpikeWorkflowWorld, field) {
  assert.equal(this.missingCharterField, field);
  assert.match(this.spikeSkill ?? '', /name (?:the missing field|it)/i);
});

Then('the workflow identifies the missing kill criterion', function (this: SpikeWorkflowWorld) {
  assert.equal(this.missingCharterField, 'kill criterion');
  assert.match(this.spikeSkill ?? '', /name (?:the missing field|it)/i);
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
