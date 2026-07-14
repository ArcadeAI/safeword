import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');

interface SafewordMdWorld extends SafewordWorld {
  contextFiles?: {
    agents?: string;
    claude?: string;
  };
  hookOutputs?: Record<string, unknown>;
  projectDirectory?: string;
  wiring?: {
    claudeSettings: string;
    cursorHooks: string;
  };
}

function createProjectDirectory(): string {
  return mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-md-hooks-'));
}

function runSafeword(projectDirectory: string, command: 'setup' | 'upgrade'): void {
  execFileSync('bun', [CLI_PATH, command], {
    cwd: projectDirectory,
    // These scenarios prove context-file behavior and hook wiring, not
    // package-manager integration. SAFEWORD_SKIP_INSTALL keeps setup/upgrade
    // hermetic: managed assets are still written, but the live devDependency
    // install is skipped so a flaky network install can't red the lane with a
    // failure the scenario name doesn't describe (ticket #493). Live install
    // coverage lives in the dedicated setup/upgrade integration lanes.
    env: {
      ...process.env,
      SAFEWORD_TEST_DISABLE_AUTO_UPGRADE: '1',
      SAFEWORD_SKIP_INSTALL: '1',
    },
    stdio: 'pipe',
  });
}

function readOptional(projectDirectory: string, relativePath: string): string | undefined {
  const absolutePath = nodePath.join(projectDirectory, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : undefined;
}

function readProjectFile(projectDirectory: string, relativePath: string): string {
  return readFileSync(nodePath.join(projectDirectory, relativePath), 'utf8');
}

function readInstalledWiring(projectDirectory: string): SafewordMdWorld['wiring'] {
  return {
    claudeSettings: readProjectFile(projectDirectory, '.claude/settings.json'),
    cursorHooks: readProjectFile(projectDirectory, '.cursor/hooks.json'),
  };
}

After(function (this: SafewordMdWorld) {
  if (this.projectDirectory === undefined) return;
  rmSync(this.projectDirectory, { recursive: true, force: true });
});

Given('a project without AGENTS.md or CLAUDE.md', function (this: SafewordMdWorld) {
  this.projectDirectory = createProjectDirectory();
});

Given(
  'a project with customer-authored AGENTS.md and CLAUDE.md files',
  function (this: SafewordMdWorld) {
    this.projectDirectory = createProjectDirectory();
    writeFileSync(
      nodePath.join(this.projectDirectory, 'AGENTS.md'),
      '# Agent notes\nCustomer only\n',
    );
    writeFileSync(
      nodePath.join(this.projectDirectory, 'CLAUDE.md'),
      '# Claude notes\nCustomer only\n',
    );
  },
);

Given(
  'a project with prior safeword-managed AGENTS.md prose and CLAUDE.md import blocks',
  function (this: SafewordMdWorld) {
    this.projectDirectory = createProjectDirectory();
    runSafeword(this.projectDirectory, 'setup');
    writeFileSync(
      nodePath.join(this.projectDirectory, 'AGENTS.md'),
      [
        '**⚠️ ALWAYS READ FIRST:** `.safeword/SAFEWORD.md`',
        '',
        'The SAFEWORD.md file contains core development patterns, workflows, and conventions.',
        'Read it BEFORE working on any task in this project.',
        '',
        '---',
        '',
        'Customer agent instructions',
        '',
      ].join('\n'),
    );
    writeFileSync(
      nodePath.join(this.projectDirectory, 'CLAUDE.md'),
      ['@./.safeword/SAFEWORD.md', '', '---', '', 'Customer Claude instructions', ''].join('\n'),
    );
  },
);

Given('each file also contains customer-authored instructions', function (this: SafewordMdWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  assert.match(readProjectFile(this.projectDirectory, 'AGENTS.md'), /Customer/);
  assert.match(readProjectFile(this.projectDirectory, 'CLAUDE.md'), /Customer/);
});

Given("safeword's generated Claude settings and Cursor hooks", function (this: SafewordMdWorld) {
  this.projectDirectory = createProjectDirectory();
  runSafeword(this.projectDirectory, 'setup');
});

Given(
  'an installed safeword project with .safeword\\/SAFEWORD.md',
  function (this: SafewordMdWorld) {
    this.projectDirectory = createProjectDirectory();
    runSafeword(this.projectDirectory, 'setup');
    assert.ok(existsSync(nodePath.join(this.projectDirectory, '.safeword/SAFEWORD.md')));
  },
);

Given("safeword's generated Claude settings", function (this: SafewordMdWorld) {
  this.projectDirectory = createProjectDirectory();
  runSafeword(this.projectDirectory, 'setup');
});

When('safeword setup installs managed assets', function (this: SafewordMdWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  this.contextFiles = {
    agents: readOptional(this.projectDirectory, 'AGENTS.md'),
    claude: readOptional(this.projectDirectory, 'CLAUDE.md'),
  };
  runSafeword(this.projectDirectory, 'setup');
});

When('safeword upgrade reconciles managed assets', function (this: SafewordMdWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  runSafeword(this.projectDirectory, 'upgrade');
});

When('the generated hook wiring is inspected', function (this: SafewordMdWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  this.wiring = readInstalledWiring(this.projectDirectory);
});

When(
  'the SAFEWORD context hook runs for Claude and Cursor modes',
  function (this: SafewordMdWorld) {
    assert.ok(this.projectDirectory, 'project directory was not created');
    const hookPath = nodePath.join(
      this.projectDirectory,
      '.safeword/hooks/session-safeword-context.ts',
    );
    this.hookOutputs = Object.fromEntries(
      ['claude', 'cursor'].map(agent => {
        const stdout = execFileSync('bun', [hookPath, `--agent=${agent}`], {
          cwd: this.projectDirectory,
          input: JSON.stringify({ cwd: this.projectDirectory }),
          encoding: 'utf8',
        });
        return [agent, JSON.parse(stdout.trim()) as unknown];
      }),
    );
  },
);

When('the SessionStart compact matcher is inspected', function (this: SafewordMdWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  this.wiring = readInstalledWiring(this.projectDirectory);
});

Then(
  'no AGENTS.md or CLAUDE.md file is created solely for a safeword reference',
  function (this: SafewordMdWorld) {
    assert.ok(this.projectDirectory, 'project directory was not created');
    assert.equal(existsSync(nodePath.join(this.projectDirectory, 'AGENTS.md')), false);
    assert.equal(existsSync(nodePath.join(this.projectDirectory, 'CLAUDE.md')), false);
  },
);

Then(
  'safeword-owned hook configuration still includes startup SAFEWORD context loading',
  function (this: SafewordMdWorld) {
    assert.ok(this.projectDirectory, 'project directory was not created');
    const wiring = readInstalledWiring(this.projectDirectory);
    assert.match(wiring.claudeSettings, /session-safeword-context\.ts/);
    assert.match(wiring.cursorHooks, /session-safeword-context\.ts/);
  },
);

Then('the customer-authored context file contents are unchanged', function (this: SafewordMdWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  assert.deepEqual(
    {
      agents: readOptional(this.projectDirectory, 'AGENTS.md'),
      claude: readOptional(this.projectDirectory, 'CLAUDE.md'),
    },
    this.contextFiles,
  );
});

Then('no safeword import or read-first prose is prepended', function (this: SafewordMdWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  assert.doesNotMatch(readProjectFile(this.projectDirectory, 'AGENTS.md'), /SAFEWORD\.md/);
  assert.doesNotMatch(
    readProjectFile(this.projectDirectory, 'CLAUDE.md'),
    /@\.\/\.safeword\/SAFEWORD\.md/,
  );
});

Then('the safeword-managed context-file blocks are removed', function (this: SafewordMdWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  assert.doesNotMatch(readProjectFile(this.projectDirectory, 'AGENTS.md'), /ALWAYS READ FIRST/);
  assert.doesNotMatch(
    readProjectFile(this.projectDirectory, 'CLAUDE.md'),
    /@\.\/\.safeword\/SAFEWORD\.md/,
  );
});

Then('the customer-authored instructions remain', function (this: SafewordMdWorld) {
  assert.ok(this.projectDirectory, 'project directory was not created');
  assert.match(readProjectFile(this.projectDirectory, 'AGENTS.md'), /Customer agent instructions/);
  assert.match(readProjectFile(this.projectDirectory, 'CLAUDE.md'), /Customer Claude instructions/);
});

Then('Claude SessionStart runs the SAFEWORD context hook', function (this: SafewordMdWorld) {
  assert.match(this.wiring?.claudeSettings ?? '', /session-safeword-context\.ts/);
});

Then('Cursor sessionStart runs the SAFEWORD context hook', function (this: SafewordMdWorld) {
  assert.match(this.wiring?.cursorHooks ?? '', /session-safeword-context\.ts/);
});

Then(
  'each output contains the SAFEWORD.md standing instructions as model-visible context',
  function (this: SafewordMdWorld) {
    const outputs = this.hookOutputs ?? {};
    assert.match(JSON.stringify(outputs.claude), /SAFEWORD Agent Instructions/);
    assert.match(JSON.stringify(outputs.cursor), /SAFEWORD Agent Instructions/);
  },
);

Then(
  "the output shape matches that agent's hook context contract",
  function (this: SafewordMdWorld) {
    const outputs = this.hookOutputs as {
      claude?: { hookSpecificOutput?: { additionalContext?: string } };
      cursor?: { additional_context?: string };
    };
    assert.equal(typeof outputs.claude?.hookSpecificOutput?.additionalContext, 'string');
    assert.equal(typeof outputs.cursor?.additional_context, 'string');
  },
);

Then('it runs the SAFEWORD context hook', function (this: SafewordMdWorld) {
  assert.match(this.wiring?.claudeSettings ?? '', /session-safeword-context\.ts/);
});

Then(
  'the compact context hook still restores active ticket context',
  function (this: SafewordMdWorld) {
    assert.ok(this.projectDirectory, 'project directory was not created');
    const compactHook = readProjectFile(
      this.projectDirectory,
      '.safeword/hooks/session-compact-context.ts',
    );
    assert.match(compactHook, /active ticket/);
  },
);
