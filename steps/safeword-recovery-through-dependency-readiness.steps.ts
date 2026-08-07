import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { formatParityDriftFailure } from '../packages/cli/src/parity.js';
import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const PRE_TOOL_DEPENDENCY_READINESS = nodePath.join(
  PROJECT_ROOT,
  '.safeword/hooks/pre-tool-dependency-readiness.ts',
);

interface DependencyRecoveryWorld extends SafewordWorld {
  projectDirectory?: string;
  driftedFile?: string;
  parityMessage?: string;
}

function createBunProject(readiness: string): string {
  const directory = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-recovery-'));
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(directory, 'package.json'),
    JSON.stringify({ name: 'recovery-fixture', packageManager: 'bun@1.3.14' }),
  );
  writeFileSync(nodePath.join(directory, 'bun.lock'), '# lockfile\n');
  if (readiness === 'stale') {
    const installArtifact = nodePath.join(directory, 'node_modules');
    mkdirSync(installArtifact);
    utimesSync(installArtifact, new Date(0), new Date(0));
  }
  return directory;
}

function invokeGuard(world: DependencyRecoveryWorld, command: string): void {
  assert.ok(world.projectDirectory, 'dependency-readiness fixture was not created');
  const result = spawnSync('bun', [PRE_TOOL_DEPENDENCY_READINESS], {
    cwd: world.projectDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: world.projectDirectory },
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  });
  world.result = {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 0,
  };
}

After(function (this: DependencyRecoveryWorld) {
  if (this.projectDirectory === undefined) return;
  rmSync(this.projectDirectory, { recursive: true, force: true });
});

Given(
  'project dependency readiness is {word}',
  function (this: DependencyRecoveryWorld, readiness: string) {
    assert.match(readiness, /^(missing|stale)$/);
    this.projectDirectory = createBunProject(readiness);
  },
);

When('the builder invokes {string}', function (this: DependencyRecoveryWorld, command: string) {
  invokeGuard(this, command);
});

When(
  'the builder invokes this shell command:',
  function (this: DependencyRecoveryWorld, command: string) {
    invokeGuard(this, command);
  },
);

Then('the dependency-readiness guard allows the command', function (this: DependencyRecoveryWorld) {
  assert.equal(this.result.exitCode, 0, this.result.stderr);
  assert.equal(this.result.stdout.trim(), '');
});

Then(
  'the dependency-readiness guard denies the command with its install recovery',
  function (this: DependencyRecoveryWorld) {
    assert.equal(this.result.exitCode, 0, this.result.stderr);
    const output = JSON.parse(this.result.stdout) as {
      hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string };
    };
    assert.equal(output.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(output.hookSpecificOutput?.permissionDecisionReason ?? '', /bun ci/);
  },
);

Given(
  'the release parity check found drift in {string}',
  function (this: DependencyRecoveryWorld, driftedFile: string) {
    this.driftedFile = driftedFile;
  },
);

When('it reports that drift to the maintainer', function (this: DependencyRecoveryWorld) {
  assert.ok(this.driftedFile, 'no parity drift was recorded');
  this.parityMessage = formatParityDriftFailure([`${this.driftedFile} differs from its template`]);
});

Then('the report names the drifted file', function (this: DependencyRecoveryWorld) {
  assert.ok(this.driftedFile, 'no parity drift was recorded');
  assert.ok((this.parityMessage ?? '').includes(this.driftedFile));
});

Then(
  'its recovery guidance names {string}',
  function (this: DependencyRecoveryWorld, command: string) {
    assert.match(this.parityMessage ?? '', new RegExp(command.replaceAll('/', '\\/')));
  },
);

Then(
  'its recovery guidance does not name {string}',
  function (this: DependencyRecoveryWorld, command: string) {
    assert.ok(!(this.parityMessage ?? '').includes(command));
  },
);
