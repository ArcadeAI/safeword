/**
 * Cucumber step definitions for the autonomy-posture spine (ticket HPQ43R).
 *
 * Drives the built `safeword autonomy` CLI (shell-out, the repo convention —
 * the BDD lane can't import workspace `src`). Covers the show/set scenarios
 * (DEV1.AC1/AC2/AC4/AC6). Scenarios needing CLI verbs not yet built (per-axis
 * override, personal override) or live agent-runtime behavior are tagged
 * `@manual` and excluded; their logic is proven by unit tests.
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
}

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
