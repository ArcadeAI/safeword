/* eslint-disable complexity, unicorn/prefer-switch -- Defect fixtures read most clearly as one ordered discriminator. */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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
  filesystemSnapshot?: string;
  secondFilesystemSnapshot?: string;
  configurationSnapshot?: string;
}

function snapshotConfig(root: string): string {
  return JSON.stringify(
    ['.safeword/config.json', '.safeword/config.local.json'].map(relative => {
      const path = join(root, relative);
      try {
        return [relative, readFileSync(path).toString('base64')];
      } catch {
        return [relative, 'absent'];
      }
    }),
  );
}

function snapshotFilesystem(root: string): string {
  const entries: { path: string; kind: string; mode: number; bytes?: string; target?: string }[] =
    [];
  const visit = (directory: string): void => {
    const names = readdirSync(directory).toSorted((left, right) => left.localeCompare(right));
    for (const name of names) {
      const path = join(directory, name);
      const relative = nodePath.relative(root, path);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        entries.push({
          path: relative,
          kind: 'symlink',
          mode: stat.mode,
          target: readlinkSync(path),
        });
      } else if (stat.isDirectory()) {
        entries.push({ path: relative, kind: 'directory', mode: stat.mode });
        visit(path);
      } else {
        entries.push({
          path: relative,
          kind: stat.isFile() ? 'file' : 'other',
          mode: stat.mode,
          bytes: stat.isFile() ? readFileSync(path).toString('base64') : undefined,
        });
      }
    }
  };
  visit(root);
  return JSON.stringify(entries);
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
  writeFileSync(join(directory, '.gitignore'), '.safeword/config.local.json\n');
  const personalDirectory = join(directory, '.safeword');
  mkdirSync(personalDirectory, { recursive: true });
  return join(personalDirectory, 'config.local.json');
}

function writePersonalPreference(directory: string, mode: 'local' | 'remote-preferred'): void {
  writeFileSync(initializePrivateConfig(directory), JSON.stringify({ testExecution: mode }));
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
    this.configurationSnapshot = snapshotConfig(directory);
  },
);

Given(
  'the project and personal preferences are local and no remote provider is installed',
  function (this: TestExecutionWorld) {
    const directory = project(this);
    writeProjectPreference(directory, 'local');
    writePersonalPreference(directory, 'local');
    this.expectedExit = 17;
    writeRunnableProject(directory, this.expectedExit);
    this.configurationSnapshot = snapshotConfig(directory);
  },
);

Given(
  /^the project default is remote-preferred, this worktree's `personal\/config\.json` contains the exact minimal schema selecting (local|remote-preferred), remote availability is (not installed), and the real test plan exits (\d+)$/u,
  function (
    this: TestExecutionWorld,
    mode: 'local' | 'remote-preferred',
    _availability: 'not installed',
    exit: string,
  ) {
    const directory = project(this);
    writeProjectPreference(directory, 'remote-preferred');
    writePersonalPreference(directory, mode);
    this.expectedExit = Number(exit);
    writeRunnableProject(directory, this.expectedExit);
    this.configurationSnapshot = snapshotConfig(directory);
  },
);

Given(
  /^worktree A has `\.safeword\/config\.local\.json` selecting local and worktree B has its own path selecting remote-preferred$/u,
  function (this: TestExecutionWorld) {
    writePersonalPreference(project(this), 'local');
    this.secondDirectory = mkdtempSync(join(tmpdir(), 'safeword-test-execution-bdd-b-'));
    writePersonalPreference(this.secondDirectory, 'remote-preferred');
    this.filesystemSnapshot = snapshotFilesystem(project(this));
    this.secondFilesystemSnapshot = snapshotFilesystem(this.secondDirectory);
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
      writeFileSync(path, '{"testExecution":"local","testExecution":"local"}');
    else if (defect === 'unknown object key')
      writeFileSync(path, '{"testExecution":"local","extra":true}');
    else if (defect === 'unsupported schema version')
      writeFileSync(path, '{"schemaVersion":2,"testExecution":"local"}');
    else if (defect === 'unsupported execution mode')
      writeFileSync(path, '{"testExecution":"remote"}');
    else if (defect === 'a missing required schema field') writeFileSync(path, '{}');
    else if (defect === 'a schema field with the wrong JSON value type')
      writeFileSync(path, '{"testExecution":true}');
    else if (defect === 'extra nested structure')
      writeFileSync(path, '{"testExecution":{"mode":"local"}}');
    else if (defect === 'a directory') mkdirSync(path);
    else if (defect === 'a symlink') {
      const target = join(directory, 'outside.json');
      writeFileSync(target, '{"testExecution":"local"}');
      symlinkSync(target, path);
    } else if (defect === 'a hard link') {
      const target = join(directory, 'outside.json');
      writeFileSync(target, '{"testExecution":"local"}');
      linkSync(target, path);
    } else if (defect === 'a file outside the project Safeword directory') {
      rmSync(join(directory, '.safeword'), { recursive: true });
      const outside = mkdtempSync(join(tmpdir(), 'safeword-personal-outside-'));
      writeFileSync(join(outside, 'config.local.json'), '{"testExecution":"local"}');
      symlinkSync(outside, join(directory, '.safeword'));
    } else {
      writeFileSync(path, '{"testExecution":"local"}');
      writeFileSync(join(directory, '.gitignore'), '');
    }
    this.filesystemSnapshot = snapshotFilesystem(directory);
  },
);

Given(
  'the resolved personal configuration path contains malformed JSON',
  function (this: TestExecutionWorld) {
    const path = initializePrivateConfig(project(this));
    writeFileSync(path, '{ bad json');
    writeRunnableProject(project(this));
    this.filesystemSnapshot = snapshotFilesystem(project(this));
  },
);

Given(
  'no command override or personal preference exists and remote execution is not installed',
  function (this: TestExecutionWorld) {
    project(this);
  },
);

Given(
  /^the project default is local, no command or personal preference exists, and the real test plan exits (\d+)$/u,
  function (this: TestExecutionWorld, exit: string) {
    const directory = project(this);
    writeProjectPreference(directory, 'local');
    this.expectedExit = Number(exit);
    writeRunnableProject(directory, this.expectedExit);
    this.configurationSnapshot = snapshotConfig(directory);
  },
);

Given(
  /^(project|personal) selects remote-preferred and no remote provider is installed$/u,
  function (this: TestExecutionWorld, source: 'project' | 'personal') {
    const directory = project(this);
    if (source === 'project') writeProjectPreference(directory, 'remote-preferred');
    else writePersonalPreference(directory, 'remote-preferred');
    this.expectedExit = source === 'project' ? 19 : 23;
    writeRunnableProject(directory, this.expectedExit);
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
    assert.equal(snapshotConfig(project(this)), this.configurationSnapshot);
  },
);

Then(
  /^Safeword reports command as the winning source, proves no dispatch occurred, runs the real test plan once, returns its exact (\d+) exit, and leaves project and personal configuration unchanged$/u,
  function (this: TestExecutionWorld, exit: string) {
    assert.equal(this.result.exitCode, Number(exit));
    const data = resultData(this);
    assert.deepEqual(data.effective, { mode: 'remote-preferred', source: 'command' });
    assert.deepEqual(data.dispatch, { attempted: false });
    assert.equal(data.executed, 1);
    assert.equal(snapshotConfig(project(this)), this.configurationSnapshot);
  },
);

Then(
  /^Safeword reports personal as the winning source, (selects local without fallback and sends no dispatch|reports remote unavailability before dispatch and falls back locally), runs the real test plan once, returns its exact (\d+) exit, and leaves project and personal configuration unchanged$/u,
  function (this: TestExecutionWorld, outcome: string, exit: string) {
    assert.equal(this.result.exitCode, Number(exit));
    const data = resultData(this);
    assert.equal((data.effective as { source?: string }).source, 'personal');
    assert.deepEqual(data.dispatch, { attempted: false });
    assert.equal((data.fallback as { used?: boolean }).used, outcome.startsWith('reports remote'));
    assert.equal(data.executed, 1);
    assert.equal(snapshotConfig(project(this)), this.configurationSnapshot);
  },
);

Then(
  'each worktree reports its own canonical local-config path and effective mode, neither process reads the other path, and both status requests leave both worktrees unchanged',
  function (this: TestExecutionWorld) {
    assert.ok(this.secondResult);
    assert.ok(this.secondDirectory);
    const first = JSON.parse(this.result.stdout) as { data: { effective: { mode: string } } };
    const second = JSON.parse(this.secondResult.stdout) as {
      data: { effective: { mode: string } };
    };
    assert.equal(first.data.effective.mode, 'local');
    assert.equal(second.data.effective.mode, 'remote-preferred');
    assert.match(this.result.stdout, /\.project\/personal\/config\.json/u);
    assert.match(this.secondResult.stdout, /\.project\/personal\/config\.json/u);
    assert.equal(snapshotFilesystem(project(this)), this.filesystemSnapshot);
    assert.equal(snapshotFilesystem(this.secondDirectory), this.secondFilesystemSnapshot);
  },
);

Then(
  /^Safeword exits with `SAFEWORD_TEST_EXECUTION_INVALID`, names the personal origin, (?:executes no plan, sends no dispatch, and|and) changes no project, personal, ignore or other filesystem bytes$/u,
  function (this: TestExecutionWorld) {
    assert.equal(this.result.exitCode, 1);
    assert.match(this.result.stdout, /SAFEWORD_TEST_EXECUTION_INVALID/u);
    assert.match(this.result.stdout, /personal.*config\.json/u);
    assert.doesNotMatch(this.result.stdout, /"executed":1/u);
    assert.equal(snapshotFilesystem(project(this)), this.filesystemSnapshot);
  },
);

Then(
  'status lists command, personal, project and built-in scopes in highest-first order with command `not applicable`, the canonical personal and project origins, and built-in origin; identifies exact effective mode local and source built-in; reports remote execution as not installed; and changes no files',
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
    assert.match(this.result.stdout, /not applicable/u);
    assert.match(this.result.stdout, /\.project\/personal\/config\.json/u);
    assert.match(this.result.stdout, /\.safeword\/config\.json/u);
  },
);

Then(
  /^Safeword reports project as the winning local source, sends no dispatch, runs the real test plan once, returns its exact (\d+) exit, and leaves project and personal configuration unchanged$/u,
  function (this: TestExecutionWorld, exit: string) {
    assert.equal(this.result.exitCode, Number(exit));
    const data = resultData(this);
    assert.deepEqual(data.effective, { mode: 'local', source: 'project' });
    assert.deepEqual(data.dispatch, { attempted: false });
    assert.equal(data.executed, 1);
    assert.equal(snapshotConfig(project(this)), this.configurationSnapshot);
  },
);

Then(
  /^Safeword reports that remote execution is unavailable before dispatch, runs the real (?:test|verify) plan once, and returns that plan's exact (\d+) exit$/u,
  function (this: TestExecutionWorld, exit: string) {
    assert.equal(this.result.exitCode, Number(exit));
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
