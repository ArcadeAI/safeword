/* eslint-disable unicorn/prefer-switch -- Defect fixtures read most clearly as one ordered discriminator. */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { linkSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const CLI_PATH = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const { join } = nodePath;

interface TestExecutionWorld extends SafewordWorld {
  secondDirectory?: string;
  secondResult?: SafewordWorld['result'];
  expectedExit?: number;
}

function project(world: TestExecutionWorld): string {
  if (world.temporaryDirectory === '') {
    world.temporaryDirectory = mkdtempSync(join(tmpdir(), 'safeword-test-execution-bdd-'));
  }
  return world.temporaryDirectory;
}

function writeProjectPreference(directory: string, mode: 'local' | 'remote-preferred'): void {
  mkdirSync(join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    join(directory, '.safeword', 'config.json'),
    JSON.stringify({ testExecution: mode }),
  );
}

function initializePrivateConfig(directory: string): string {
  spawnSync('git', ['init', '--quiet'], { cwd: directory });
  writeFileSync(join(directory, '.gitignore'), '.project/personal/\n');
  const personalDirectory = join(directory, '.project', 'personal');
  mkdirSync(personalDirectory, { recursive: true });
  return join(personalDirectory, 'config.json');
}

function writePersonalPreference(directory: string, mode: 'local' | 'remote-preferred'): void {
  writeFileSync(
    initializePrivateConfig(directory),
    JSON.stringify({ schemaVersion: 1, testExecution: mode }),
  );
}

function writeRunnableProject(directory: string, exitCode = 0): void {
  const command = String.raw`node -e "require('node:fs').appendFileSync('runs.log','run\n');process.exit(${String(exitCode)})"`;
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'test-execution-bdd-project',
      private: true,
      packageManager: 'npm@11.0.0',
      scripts: { 'test:done': command, 'test:ci': command },
    }),
  );
}

function runCli(world: TestExecutionWorld, command: string, directory = project(world)): void {
  const argv = command.trim().split(/\s+/u);
  const help = argv.includes('--help');
  const completed = spawnSync(
    process.execPath,
    [CLI_PATH, ...argv, ...(help ? [] : ['--json', '--no-input']), '--cwd', directory],
    {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, SAFEWORD_NO_UPDATE_CHECK: '1' },
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  world.result = {
    stdout: completed.stdout,
    stderr: completed.stderr,
    exitCode: completed.status ?? 1,
  };
}

function resultData(world: TestExecutionWorld): Record<string, unknown> {
  const envelope = JSON.parse(world.result.stdout) as { data?: Record<string, unknown> };
  return envelope.data ?? {};
}

function resultEnvelope(world: TestExecutionWorld): Record<string, unknown> {
  return JSON.parse(world.result.stdout) as Record<string, unknown>;
}

After(function (this: TestExecutionWorld) {
  if (this.temporaryDirectory !== '')
    rmSync(this.temporaryDirectory, { recursive: true, force: true });
  if (this.secondDirectory !== undefined)
    rmSync(this.secondDirectory, { recursive: true, force: true });
});

Given(
  /^the project default and optional personal preference are (.+)$/u,
  function (this: TestExecutionWorld, preferences: string) {
    const directory = project(this);
    writeProjectPreference(directory, 'remote-preferred');
    if (preferences.includes('and personal'))
      writePersonalPreference(directory, 'remote-preferred');
    this.expectedExit = preferences.includes('no personal') ? 23 : 0;
    writeRunnableProject(directory, this.expectedExit);
  },
);

Given(
  'the project and personal preferences are local and no remote provider is installed',
  function (this: TestExecutionWorld) {
    const directory = project(this);
    writeProjectPreference(directory, 'local');
    writePersonalPreference(directory, 'local');
    writeRunnableProject(directory);
  },
);

Given(
  /^the project default is remote-preferred and this worktree's `personal\/config\.json` contains (.+)$/u,
  function (this: TestExecutionWorld, description: string) {
    const directory = project(this);
    writeProjectPreference(directory, 'remote-preferred');
    writePersonalPreference(
      directory,
      description.includes('remote-preferred') ? 'remote-preferred' : 'local',
    );
    writeRunnableProject(directory);
  },
);

Given(
  /^worktree A has `<namespace-root>\/personal\/config\.json` selecting local and worktree B has its own path selecting remote-preferred$/u,
  function (this: TestExecutionWorld) {
    writePersonalPreference(project(this), 'local');
    this.secondDirectory = mkdtempSync(join(tmpdir(), 'safeword-test-execution-bdd-b-'));
    writePersonalPreference(this.secondDirectory, 'remote-preferred');
  },
);

Given(
  /^the resolved personal configuration path is (.+)$/u,
  function (this: TestExecutionWorld, defect: string) {
    const directory = project(this);
    const path = initializePrivateConfig(directory);
    writeRunnableProject(directory);
    if (defect === 'malformed JSON') writeFileSync(path, '{ bad json');
    else if (defect === 'duplicate object key')
      writeFileSync(path, '{"schemaVersion":1,"testExecution":"local","testExecution":"local"}');
    else if (defect === 'unknown object key')
      writeFileSync(path, '{"schemaVersion":1,"testExecution":"local","extra":true}');
    else if (defect === 'unsupported schema version')
      writeFileSync(path, '{"schemaVersion":2,"testExecution":"local"}');
    else if (defect === 'unsupported execution mode')
      writeFileSync(path, '{"schemaVersion":1,"testExecution":"remote"}');
    else if (defect === 'a directory') mkdirSync(path);
    else if (defect === 'a symlink') {
      const target = join(directory, 'outside.json');
      writeFileSync(target, '{"schemaVersion":1,"testExecution":"local"}');
      symlinkSync(target, path);
    } else if (defect === 'a hard link') {
      const target = join(directory, 'outside.json');
      writeFileSync(target, '{"schemaVersion":1,"testExecution":"local"}');
      linkSync(target, path);
    } else if (defect === 'a file outside the resolved namespace root') {
      rmSync(join(directory, '.project', 'personal'), { recursive: true });
      const outside = mkdtempSync(join(tmpdir(), 'safeword-personal-outside-'));
      writeFileSync(join(outside, 'config.json'), '{"schemaVersion":1,"testExecution":"local"}');
      symlinkSync(outside, join(directory, '.project', 'personal'));
    } else {
      writeFileSync(path, '{"schemaVersion":1,"testExecution":"local"}');
      writeFileSync(join(directory, '.gitignore'), '');
    }
  },
);

Given(
  'the resolved personal configuration path contains malformed JSON',
  function (this: TestExecutionWorld) {
    const path = initializePrivateConfig(project(this));
    writeFileSync(path, '{ bad json');
  },
);

Given(
  'no command override or personal preference exists and remote execution is not installed',
  function (this: TestExecutionWorld) {
    project(this);
  },
);

Given(
  /^(project|personal) selects remote-preferred and no remote provider is installed$/u,
  function (this: TestExecutionWorld, source: 'project' | 'personal') {
    const directory = project(this);
    if (source === 'project') writeProjectPreference(directory, 'remote-preferred');
    else writePersonalPreference(directory, 'remote-preferred');
    writeRunnableProject(directory);
  },
);

Given('a configured project has no remote provider installed', function (this: TestExecutionWorld) {
  writeRunnableProject(project(this));
});

When(
  /^the contributor runs `safeword ([^`]+)`(?: without an override)?$/u,
  function (this: TestExecutionWorld, command: string) {
    runCli(this, command);
  },
);

When('each contributor asks for test-execution status', function (this: TestExecutionWorld) {
  runCli(this, 'project test-execution status');
  const first = this.result;
  assert.ok(this.secondDirectory);
  runCli(this, 'project test-execution status', this.secondDirectory);
  this.secondResult = this.result;
  this.result = first;
});

When(
  /^the contributor requests `safeword ([^`]+)`$/u,
  function (this: TestExecutionWorld, command: string) {
    runCli(this, command);
  },
);

Then(
  /^Safeword reports command as the winning source, sends no dispatch, runs the real (?:test|verify) plan once, returns its (\d+) exit, and leaves project and personal configuration unchanged$/u,
  function (this: TestExecutionWorld, exit: string) {
    assert.equal(this.result.exitCode, Number(exit));
    const data = resultData(this);
    assert.deepEqual(data.effective, { mode: 'local', source: 'command' });
    assert.deepEqual(data.dispatch, { attempted: false });
    assert.equal(data.executed, 1);
  },
);

Then(
  'Safeword reports command as the winning source, proves no dispatch occurred, and runs the real test plan once',
  function (this: TestExecutionWorld) {
    assert.equal(this.result.exitCode, 0);
    const data = resultData(this);
    assert.deepEqual(data.effective, { mode: 'remote-preferred', source: 'command' });
    assert.deepEqual(data.dispatch, { attempted: false });
    assert.equal(data.executed, 1);
  },
);

Then(
  'Safeword reports personal as the winning source, sends no dispatch, and runs the real test plan once',
  function (this: TestExecutionWorld) {
    assert.equal(this.result.exitCode, 0);
    const data = resultData(this);
    assert.equal((data.effective as { source?: string }).source, 'personal');
    assert.deepEqual(data.dispatch, { attempted: false });
    assert.equal(data.executed, 1);
  },
);

Then(
  'worktree A reports its exact A path and local effective mode, worktree B reports its exact B path and remote-preferred effective mode, and neither process reads the other path',
  function (this: TestExecutionWorld) {
    assert.ok(this.secondResult);
    const first = JSON.parse(this.result.stdout) as { data: { effective: { mode: string } } };
    const second = JSON.parse(this.secondResult.stdout) as {
      data: { effective: { mode: string } };
    };
    assert.equal(first.data.effective.mode, 'local');
    assert.equal(second.data.effective.mode, 'remote-preferred');
    assert.match(this.result.stdout, /\.project\/personal\/config\.json/u);
    assert.match(this.secondResult.stdout, /\.project\/personal\/config\.json/u);
  },
);

Then(
  /^Safeword exits with `SAFEWORD_TEST_EXECUTION_INVALID`, names the personal origin, (?:executes no plan, sends no dispatch, and changes no project configuration|and changes no project, personal, ignore or other filesystem bytes)$/u,
  function (this: TestExecutionWorld) {
    assert.equal(this.result.exitCode, 1);
    assert.match(this.result.stdout, /SAFEWORD_TEST_EXECUTION_INVALID/u);
    assert.match(this.result.stdout, /personal.*config\.json/u);
    assert.doesNotMatch(this.result.stdout, /"executed":1/u);
  },
);

Then(
  'status lists command, personal, project and built-in scopes in highest-first order, identifies built-in local as the winner, reports remote execution as not installed, and changes no files',
  function (this: TestExecutionWorld) {
    assert.equal(this.result.exitCode, 0);
    const data = resultData(this) as {
      effective: { mode: string; source: string };
      remote: { available: boolean };
      scopes: { source: string }[];
    };
    assert.deepEqual(data.effective, { mode: 'local', source: 'built-in' });
    assert.equal(data.remote.available, false);
    assert.deepEqual(
      data.scopes.map(scope => scope.source),
      ['command', 'personal', 'project', 'built-in'],
    );
  },
);

Then(
  /^Safeword reports that remote execution is unavailable before dispatch, runs the real (?:test|verify) plan once, and returns that plan's exit result$/u,
  function (this: TestExecutionWorld) {
    assert.equal(this.result.exitCode, 0);
    const data = resultData(this);
    assert.deepEqual(data.dispatch, { attempted: false });
    assert.deepEqual(data.fallback, {
      used: true,
      execution: 'local',
      reason: 'remote-unavailable',
    });
    assert.equal(data.executed, 1);
  },
);

Then(
  /^help exits zero and exposes only `local` and `remote-preferred` execution values$/u,
  function (this: TestExecutionWorld) {
    assert.equal(this.result.exitCode, 0);
    assert.match(this.result.stdout, /local or remote-preferred/u);
  },
);

Then(
  /^it exits with `SAFEWORD_TEST_EXECUTION_INVALID` before plan execution or mutation$/u,
  function (this: TestExecutionWorld) {
    assert.equal(this.result.exitCode, 1);
    const envelope = resultEnvelope(this);
    assert.match(this.result.stdout, /SAFEWORD_TEST_EXECUTION_INVALID/u);
    assert.deepEqual(envelope.effects, {
      files: [],
      packages: [],
      configuration: [],
      network: [],
      destructive: [],
    });
  },
);
