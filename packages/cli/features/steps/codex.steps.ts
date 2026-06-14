import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const HOOK_PATH = nodePath.resolve(
  import.meta.dirname,
  '../../templates/hooks/codex/pre-tool-quality.ts',
);
const CLI_PATH = nodePath.resolve(import.meta.dirname, '../../dist/cli.js');
const TICKET_ID = 'ABC123';
const TEST_DEFINITIONS_PATCH = `*** Begin Patch
*** Add File: .project/tickets/${TICKET_ID}/test-definitions.md
+# Test Definitions
*** End Patch
`;
const MULTI_FILE_TEST_DEFINITIONS_PATCH = `*** Begin Patch
*** Add File: notes.md
+# Notes
*** Add File: .project/tickets/${TICKET_ID}/test-definitions.md
+# Test Definitions
*** End Patch
`;
const CUSTOM_CODEX_CONFIG = '[features]\nhooks = false\n\n# custom codex config\n';
const PERSONAS = '# Personas\n\n## Safeword Maintainer (SM)\n\n**Role:** Maintains safeword.\n';
const SPEC = [
  '# Spec: Codex Hook Adapter',
  '',
  '## Jobs To Be Done',
  '',
  '### codex-hook.SM1 - Prove edit gate reuse',
  '',
  '**Persona:** Safeword Maintainer (SM)',
  '',
  '> When I add a Codex hook path, I want it to reuse the existing phase gate, so I can trust parity work is measured.',
  '',
  '#### codex-hook.SM1.AC1 - Existing phase gate behavior is preserved',
  '',
].join('\n');

function createProject(prefix: string): string {
  const projectRoot = mkdtempSync(nodePath.join(tmpdir(), prefix));
  writeFileSync(
    nodePath.join(projectRoot, 'package.json'),
    JSON.stringify({ name: 'test-project', version: '1.0.0' }, undefined, 2),
  );
  return projectRoot;
}

function installFakeCodex(projectRoot: string, version: string): string {
  const fakeBin = nodePath.join(projectRoot, 'bin');
  mkdirSync(fakeBin, { recursive: true });
  const fakeCodex = nodePath.join(fakeBin, 'codex');
  writeFileSync(fakeCodex, `#!/usr/bin/env sh\necho "codex ${version}"\n`);
  chmodSync(fakeCodex, 0o755);
  return fakeBin;
}

function createConfiguredProject(projectRoot: string): void {
  mkdirSync(nodePath.join(projectRoot, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(projectRoot, '.safeword/version'), '0.5.0');
  writeFileSync(nodePath.join(projectRoot, '.safeword/SAFEWORD.md'), '# Old content');

  mkdirSync(nodePath.join(projectRoot, '.claude'), { recursive: true });
  writeFileSync(
    nodePath.join(projectRoot, '.claude/settings.json'),
    JSON.stringify({ hooks: {} }, undefined, 2),
  );
  writeFileSync(nodePath.join(projectRoot, 'AGENTS.md'), '.safeword/SAFEWORD.md\n\n# Agents');
}

function runSafeword(projectRoot: string, args: string[], options: { fakeCodexBin?: string } = {}) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(options.fakeCodexBin
        ? { PATH: `${options.fakeCodexBin}${nodePath.delimiter}${process.env.PATH ?? ''}` }
        : {}),
      SAFEWORD_NO_MODIFY: '1',
      SAFEWORD_SKIP_INSTALL: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

function assertCliSuccess(result: { stdout: string; stderr: string; exitCode: number }): void {
  assert.equal(result.exitCode, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function createCodexHookTicketDirectory(projectRoot: string): string {
  const ticketDirectory = nodePath.join(projectRoot, '.project', 'tickets', TICKET_ID);
  mkdirSync(ticketDirectory, { recursive: true });
  return ticketDirectory;
}

function createIncompleteCodexHookTicket(projectRoot: string): void {
  const ticketDirectory = createCodexHookTicketDirectory(projectRoot);
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      `id: ${TICKET_ID}`,
      'type: feature',
      'phase: define-behavior',
      'status: in_progress',
      '---',
      '',
    ].join('\n'),
  );
}

function createCompleteCodexHookTicket(projectRoot: string): void {
  const ticketDirectory = createCodexHookTicketDirectory(projectRoot);
  writeFileSync(
    nodePath.join(ticketDirectory, 'ticket.md'),
    [
      '---',
      `id: ${TICKET_ID}`,
      'type: feature',
      'phase: define-behavior',
      'status: in_progress',
      'scope:',
      '  - prove the Codex hook adapter',
      'out_of_scope:',
      '  - full Codex config generation',
      'done_when:',
      '  - the adapter gates edits',
      '---',
      '',
    ].join('\n'),
  );
  writeFileSync(nodePath.join(ticketDirectory, 'dimensions.md'), 'skip: one obvious dimension');
  writeFileSync(nodePath.join(ticketDirectory, 'spec.md'), SPEC);

  const projectDirectory = nodePath.join(projectRoot, '.project');
  mkdirSync(projectDirectory, { recursive: true });
  writeFileSync(nodePath.join(projectDirectory, 'personas.md'), PERSONAS);
}

function runCodexHook(
  projectRoot: string,
  options: { command?: string; fallbackMode?: boolean } = {},
) {
  const result = spawnSync('bun', [HOOK_PATH], {
    cwd: projectRoot,
    input: JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'apply_patch',
      tool_input: {
        command: options.command ?? TEST_DEFINITIONS_PATCH,
      },
    }),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectRoot,
      ...(options.fallbackMode ? { SAFEWORD_CODEX_DENY_MODE: 'exit-code' } : {}),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

function assertFileExists(projectRoot: string, relativePath: string): void {
  assert.ok(existsSync(nodePath.join(projectRoot, relativePath)), `${relativePath} should exist`);
}

function assertCodexBaselineWarning(
  result: { stdout: string; stderr: string },
  version: string,
  baseline: string,
): void {
  const output = `${result.stdout}\n${result.stderr}`;
  assert.ok(output.includes(`Codex ${version} is below safeword`), output);
  assert.ok(output.includes(baseline), output);
}

Given('a project has no Codex-specific safeword assets', function (this: SafewordWorld) {
  this.temporaryDirectory = createProject('safeword-codex-setup-');
});

Given(
  /^a project has Codex CLI version `([^`]+)` on PATH$/,
  function (this: SafewordWorld, version: string) {
    this.temporaryDirectory = createProject('safeword-codex-version-');
    this.fakeCodexBin = installFakeCodex(this.temporaryDirectory, version);
  },
);

Given(
  /^a configured project has Codex CLI version `([^`]+)` on PATH$/,
  function (this: SafewordWorld, version: string) {
    this.temporaryDirectory = createProject('safeword-codex-version-upgrade-');
    createConfiguredProject(this.temporaryDirectory);
    this.fakeCodexBin = installFakeCodex(this.temporaryDirectory, version);
  },
);

When('safeword setup reconciles the project', function (this: SafewordWorld) {
  this.result = runSafeword(this.temporaryDirectory, ['setup', '--yes', '--no-modify'], {
    fakeCodexBin: this.fakeCodexBin,
  });
  assertCliSuccess(this.result);
});

Then(
  /^the project has `AGENTS\.md`, `\.codex\/config\.toml`, and `\.agents\/skills` safeword skill files$/,
  function (this: SafewordWorld) {
    assertFileExists(this.temporaryDirectory, 'AGENTS.md');
    assertFileExists(this.temporaryDirectory, '.codex/config.toml');
    assertFileExists(this.temporaryDirectory, '.agents/skills/bdd/SKILL.md');
    assertFileExists(this.temporaryDirectory, '.agents/skills/figure-it-out/SKILL.md');
  },
);

Then(
  /^setup warns that Codex `([^`]+)` is below the required `([^`]+)` baseline$/,
  function (this: SafewordWorld, version: string, baseline: string) {
    assertCodexBaselineWarning(this.result, version, baseline);
  },
);

Then(
  /^upgrade warns that Codex `([^`]+)` is below the required `([^`]+)` baseline$/,
  function (this: SafewordWorld, version: string, baseline: string) {
    assertCodexBaselineWarning(this.result, version, baseline);
  },
);

Given('safeword setup generated project-local Codex config', function (this: SafewordWorld) {
  this.temporaryDirectory = createProject('safeword-codex-config-');
  this.result = runSafeword(this.temporaryDirectory, ['setup', '--yes', '--no-modify'], {
    fakeCodexBin: this.fakeCodexBin,
  });
  assertCliSuccess(this.result);
});

Then(
  /^safeword tells the user to run `\/hooks` before relying on Codex gates$/,
  function (this: SafewordWorld) {
    const output = `${this.result.stdout}\n${this.result.stderr}`;
    assert.ok(output.includes('/hooks'), output);
    assert.ok(output.includes('trust safeword project hooks'), output);
  },
);

When('the config is inspected', function (this: SafewordWorld) {
  this.result = {
    stdout: readFileSync(nodePath.join(this.temporaryDirectory, '.codex/config.toml'), 'utf8'),
    stderr: '',
    exitCode: 0,
  };
});

Then(
  /^hooks are enabled and supported edit\/shell calls point at `\.safeword\/hooks\/codex\/pre-tool-quality\.ts`$/,
  function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 0);
    assert.ok(this.result.stdout.includes('[features]'));
    assert.ok(this.result.stdout.includes('hooks = true'));
    assert.ok(this.result.stdout.includes('[[hooks.PreToolUse]]'));
    assert.ok(this.result.stdout.includes('apply_patch'));
    assert.ok(this.result.stdout.includes('.safeword/hooks/codex/pre-tool-quality.ts'));
  },
);

Given(
  /^a configured project already has a custom `\.codex\/config\.toml`$/,
  function (this: SafewordWorld) {
    this.temporaryDirectory = createProject('safeword-codex-upgrade-');
    createConfiguredProject(this.temporaryDirectory);
    mkdirSync(nodePath.join(this.temporaryDirectory, '.codex'), { recursive: true });
    writeFileSync(
      nodePath.join(this.temporaryDirectory, '.codex/config.toml'),
      CUSTOM_CODEX_CONFIG,
    );
  },
);

Given(/^a configured project has no `\.codex\/config\.toml`$/, function (this: SafewordWorld) {
  this.temporaryDirectory = createProject('safeword-codex-upgrade-missing-config-');
  createConfiguredProject(this.temporaryDirectory);
});

When('safeword upgrade reconciles the project', function (this: SafewordWorld) {
  this.result = runSafeword(
    this.temporaryDirectory,
    ['upgrade', '--no-migrate-namespace', '--no-modify'],
    { fakeCodexBin: this.fakeCodexBin },
  );
  assertCliSuccess(this.result);
});

Then(
  /^the existing Codex config content is preserved while missing `\.agents\/skills` assets are created$/,
  function (this: SafewordWorld) {
    const codexConfig = readFileSync(
      nodePath.join(this.temporaryDirectory, '.codex/config.toml'),
      'utf8',
    );
    assert.equal(codexConfig, CUSTOM_CODEX_CONFIG);
    assertFileExists(this.temporaryDirectory, '.agents/skills/bdd/SKILL.md');
    assertFileExists(this.temporaryDirectory, '.agents/skills/figure-it-out/SKILL.md');
  },
);

Given(
  'a feature ticket is missing one or more safeword intake prerequisites',
  function (this: SafewordWorld) {
    this.temporaryDirectory = createProject('safeword-codex-hook-missing-');
    createIncompleteCodexHookTicket(this.temporaryDirectory);
  },
);

When(
  /^a supported Codex edit call attempts to create that ticket's `test-definitions\.md`$/,
  function (this: SafewordWorld) {
    this.result = runCodexHook(this.temporaryDirectory);
  },
);

When(
  /^a supported Codex multi-file edit call attempts to create another file and that ticket's `test-definitions\.md`$/,
  function (this: SafewordWorld) {
    this.result = runCodexHook(this.temporaryDirectory, {
      command: MULTI_FILE_TEST_DEFINITIONS_PATCH,
    });
  },
);

Then(
  'the Codex adapter denies the call with the existing phase-gate reason',
  function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 0);
    assert.ok(this.result.stdout.includes('"permissionDecision":"deny"'));
    assert.ok(this.result.stdout.includes('scope'));
  },
);

Given(
  'a feature ticket has scope, out_of_scope, done_when, dimensions, a resolving JTBD, and an Acceptance Criterion',
  function (this: SafewordWorld) {
    this.temporaryDirectory = createProject('safeword-codex-hook-complete-');
    createCompleteCodexHookTicket(this.temporaryDirectory);
  },
);

Then('the Codex adapter allows the call without a denial payload', function (this: SafewordWorld) {
  assert.equal(this.result.exitCode, 0);
  assert.equal(this.result.stdout.trim(), '');
  assert.equal(this.result.stderr.trim(), '');
});

Given(
  'the same missing-intake condition that produces a JSON denial',
  function (this: SafewordWorld) {
    this.temporaryDirectory = createProject('safeword-codex-hook-fallback-');
    createIncompleteCodexHookTicket(this.temporaryDirectory);
  },
);

When('the Codex adapter is run in exit-code fallback mode', function (this: SafewordWorld) {
  this.result = runCodexHook(this.temporaryDirectory, { fallbackMode: true });
});

Then(
  'it exits with code 2 and writes the blocking reason to stderr',
  function (this: SafewordWorld) {
    assert.equal(this.result.exitCode, 2);
    assert.ok(this.result.stderr.includes('scope'));
    assert.equal(this.result.stdout.trim(), '');
  },
);

After(function (this: SafewordWorld) {
  this.fakeCodexBin = undefined;
  if (this.temporaryDirectory !== '') {
    rmSync(this.temporaryDirectory, { recursive: true, force: true });
  }
});
