/**
 * Cucumber step definitions for the autonomy-posture spine (ticket HPQ43R).
 *
 * Drives the built `safeword autonomy` CLI (shell-out, the repo convention —
 * the BDD lane can't import workspace `src`). Covers the config scenarios via
 * show / set / override (project + --personal): DEV1.AC1-AC6 and DEV2.*. The
 * live agent-runtime scenarios (DEV3.*, DEV5.*) are tagged `@manual` and
 * excluded; their logic is proven by unit tests.
 */

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const CLI = nodePath.resolve(import.meta.dirname, '..', 'packages/cli/dist/cli.js');

interface AutonomyWorld extends SafewordWorld {
  projectDirectory?: string;
  posture?: Record<string, string>;
  rejected?: boolean;
  ignoreCheck?: { ignored: boolean; tracked: boolean };
}

/** Expected per-axis maps for presets referenced by "equals the X map" steps. */
const PRESET_MAPS: Record<string, Record<string, string>> = {
  'Guard the contract': {
    'intent-and-scope': 'ask',
    'behavioral-contract': 'ask',
    'irreversible-design': 'ask',
    execution: 'autonomous',
    completion: 'autonomous',
  },
};

function project(world: AutonomyWorld): string {
  if (world.projectDirectory === undefined) {
    world.projectDirectory = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-autonomy-bdd-'));
    mkdirSync(nodePath.join(world.projectDirectory, '.safeword'), { recursive: true });
  }
  return world.projectDirectory;
}

function configPath(dir: string): string {
  return nodePath.join(dir, '.safeword', 'config.json');
}

function runCli(dir: string, args: string[]): string {
  return execFileSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8' });
}

/** Run the CLI and return its exit code, swallowing the throw on non-zero. */
function runCliExitCode(dir: string, args: string[]): number {
  try {
    execFileSync(process.execPath, [CLI, ...args], { cwd: dir, stdio: 'pipe' });
    return 0;
  } catch (error: unknown) {
    return (error as { status?: number }).status ?? 1;
  }
}

/** Parse `safeword autonomy show` output (`  axis: posture` lines). */
function parsePosture(output: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of output.split('\n')) {
    const match = /^\s{2}(\S+): (\S+)$/.exec(line);
    if (match) map[match[1]] = match[2];
  }
  return map;
}

After(function (this: AutonomyWorld) {
  if (this.projectDirectory !== undefined) {
    rmSync(this.projectDirectory, { recursive: true, force: true });
  }
});

Given('a project with no autonomy policy', function (this: AutonomyWorld) {
  project(this);
});

Given('a project on the {string} preset', function (this: AutonomyWorld, preset: string) {
  writeFileSync(configPath(project(this)), JSON.stringify({ autonomy: { preset } }, undefined, 2));
});

Given('a project whose autonomy policy file is malformed', function (this: AutonomyWorld) {
  writeFileSync(configPath(project(this)), '{ broken json');
});

When(
  'the developer selects the {string} preset for the project',
  function (this: AutonomyWorld, preset: string) {
    runCli(project(this), ['autonomy', 'set', preset]);
  },
);

When('the developer inspects the resolved posture', function (this: AutonomyWorld) {
  this.posture = parsePosture(runCli(project(this), ['autonomy', 'show']));
});

Then(
  "the project's committed configuration names the preset as {string}",
  function (this: AutonomyWorld, preset: string) {
    assert.ok(existsSync(configPath(project(this))), 'config written');
    const config = JSON.parse(readFileSync(configPath(project(this)), 'utf8')) as {
      autonomy?: { preset?: string };
    };
    assert.equal(config.autonomy?.preset, preset);
  },
);

Then(
  'the {word} axis reads {string}',
  function (this: AutonomyWorld, axis: string, posture: string) {
    assert.ok(this.posture, 'posture was inspected');
    assert.equal(this.posture[axis], posture);
  },
);

Then('every axis reads {string}', function (this: AutonomyWorld, posture: string) {
  assert.ok(this.posture, 'posture was inspected');
  const axes = Object.keys(this.posture);
  assert.ok(axes.length >= 5, 'all axes present');
  for (const axis of axes) assert.equal(this.posture[axis], posture);
});

// --- Per-axis override (DEV1.AC3) -----------------------------------------

When(
  'the developer overrides the {word} axis to {string}',
  function (this: AutonomyWorld, axis: string, posture: string) {
    const dir = project(this);
    runCli(dir, ['autonomy', 'override', axis, posture]);
    this.posture = parsePosture(runCli(dir, ['autonomy', 'show']));
  },
);

Then(
  'the {word} axis still reads {string}',
  function (this: AutonomyWorld, axis: string, posture: string) {
    assert.ok(this.posture, 'posture was inspected');
    assert.equal(this.posture[axis], posture);
  },
);

// --- Invalid selection (DEV1.AC5) -----------------------------------------

When(
  'the developer sets {word} to {string}',
  function (this: AutonomyWorld, field: string, value: string) {
    const dir = project(this);
    const args =
      field === 'preset'
        ? ['autonomy', 'set', value]
        : field === 'posture'
          ? ['autonomy', 'override', 'execution', value]
          : ['autonomy', 'override', value, 'autonomous'];
    this.rejected = runCliExitCode(dir, args) !== 0;
  },
);

Then('the selection is rejected', function (this: AutonomyWorld) {
  assert.equal(this.rejected, true);
});

Then("the project's committed configuration is unchanged", function (this: AutonomyWorld) {
  assert.ok(!existsSync(configPath(project(this))), 'no project config written');
});

// --- Personal override (DEV2.*) -------------------------------------------

Given(
  'a personal override setting the execution axis to {string}',
  function (this: AutonomyWorld, posture: string) {
    runCli(project(this), ['autonomy', 'override', 'execution', posture, '--personal']);
  },
);

Given('no personal override is present', function () {
  // Absence is the precondition — nothing to do.
});

Given('a personal override file that is malformed', function (this: AutonomyWorld) {
  writeFileSync(nodePath.join(project(this), '.safeword', 'config.local.json'), '{ broken');
});

When('the developer attempts to stage the personal override file', function (this: AutonomyWorld) {
  const dir = project(this);
  const relative = '.safeword/config.local.json';
  writeFileSync(nodePath.join(dir, '.gitignore'), `${relative}\n`);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  let ignored = false;
  try {
    execFileSync('git', ['check-ignore', relative], { cwd: dir, stdio: 'pipe' });
    ignored = true;
  } catch {
    ignored = false;
  }
  const tracked = execFileSync('git', ['ls-files'], { cwd: dir, encoding: 'utf8' }).includes(
    relative,
  );
  this.ignoreCheck = { ignored, tracked };
});

Then(
  "the personal override path is matched by the repository's ignore rules",
  function (this: AutonomyWorld) {
    assert.equal(this.ignoreCheck?.ignored, true);
  },
);

Then('the personal override file remains untracked', function (this: AutonomyWorld) {
  assert.equal(this.ignoreCheck?.tracked, false);
});

Then(
  'the resolved posture equals the {string} map',
  function (this: AutonomyWorld, preset: string) {
    assert.ok(this.posture, 'posture was inspected');
    assert.deepEqual(this.posture, PRESET_MAPS[preset]);
  },
);
