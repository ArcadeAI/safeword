/**
 * Acceptance-lane step definitions for monorepo coverage honesty (ticket
 * ZRW21K). Black-box: builds pnpm / npm / mixed-layout fixtures and drives the
 * real `safeword architecture` CLI, asserting which docs appear and what the
 * derived root index says — the actual coverage contract — without importing
 * package internals.
 */

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');

interface CoverageWorld extends SafewordWorld {
  dir?: string;
  status?: number;
}

function dir(world: CoverageWorld): string {
  world.dir ??= mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'arch-coverage-bdd-'));
  return world.dir;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(nodePath.dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

/** A workspace package under packages/<name>, optionally with a src/ module. */
function makePackage(world: CoverageWorld, name: string, options: { src?: boolean } = {}): void {
  const packageDir = nodePath.join(dir(world), 'packages', name);
  writeJson(nodePath.join(packageDir, 'package.json'), { name });
  if (options.src) mkdirSync(nodePath.join(packageDir, 'src', 'ui'), { recursive: true });
}

function writePnpmWorkspace(world: CoverageWorld, globs: string[]): void {
  const body = ['packages:', ...globs.map(glob => `  - "${glob}"`)].join('\n');
  writeFileSync(nodePath.join(dir(world), 'pnpm-workspace.yaml'), `${body}\n`);
}

function rootDoc(world: CoverageWorld): string {
  const path = nodePath.join(dir(world), '.project', 'architecture.generated.md');
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function leafDocExists(world: CoverageWorld, name: string): boolean {
  return existsSync(nodePath.join(dir(world), 'packages', name, 'architecture.generated.md'));
}

/** A `### name` package section of the root index (to its next heading or EOF). */
function packageSection(world: CoverageWorld, name: string): string {
  const chunk = rootDoc(world)
    .split('\n### ')
    .find(part => part.startsWith(`${name}\n`));
  return chunk === undefined ? '' : `### ${chunk.split('\n## ')[0]}`;
}

After(function (this: CoverageWorld) {
  if (this.dir !== undefined) rmSync(this.dir, { recursive: true, force: true });
});

// --- Givens ---

Given(
  /^a pnpm monorepo whose pnpm-workspace\.yaml lists a package "([^"]+)" with a src tree$/,
  function (this: CoverageWorld, name: string) {
    writeJson(nodePath.join(dir(this), 'package.json'), { name: 'root' });
    writePnpmWorkspace(this, ['packages/*']);
    makePackage(this, name, { src: true });
  },
);

Given(
  'a single-repo project with a src tree and no workspace config',
  function (this: CoverageWorld) {
    writeJson(nodePath.join(dir(this), 'package.json'), { name: 'solo' });
    mkdirSync(nodePath.join(dir(this), 'src', 'core'), { recursive: true });
  },
);

Given(
  /^an npm monorepo whose package\.json workspaces list a package "([^"]+)" with a src tree$/,
  function (this: CoverageWorld, name: string) {
    writeJson(nodePath.join(dir(this), 'package.json'), {
      name: 'root',
      workspaces: ['packages/*'],
    });
    makePackage(this, name, { src: true });
  },
);

Given(
  /^a monorepo whose package\.json workspaces list "([^"]+)" and whose pnpm-workspace\.yaml lists "([^"]+)"$/,
  function (this: CoverageWorld, npmName: string, pnpmName: string) {
    writeJson(nodePath.join(dir(this), 'package.json'), {
      name: 'root',
      workspaces: ['packages/*'],
    });
    writePnpmWorkspace(this, ['apps/*']);
    makePackage(this, npmName, { src: true });
    writeJson(nodePath.join(dir(this), 'apps', pnpmName, 'package.json'), { name: pnpmName });
    mkdirSync(nodePath.join(dir(this), 'apps', pnpmName, 'src', 'ui'), { recursive: true });
  },
);

Given(
  'a pnpm monorepo whose pnpm-workspace.yaml uses unparseable flow-style packages',
  function (this: CoverageWorld) {
    writeJson(nodePath.join(dir(this), 'package.json'), { name: 'root' });
    writeFileSync(nodePath.join(dir(this), 'pnpm-workspace.yaml'), 'packages: ["packages/*"]\n');
    makePackage(this, 'web', { src: true });
  },
);

Given(
  /^a pnpm monorepo with a package "([^"]+)" that has no src tree$/,
  function (this: CoverageWorld, name: string) {
    writeJson(nodePath.join(dir(this), 'package.json'), { name: 'root' });
    writePnpmWorkspace(this, ['packages/*']);
    makePackage(this, name, { src: false });
  },
);

Given(
  /^a pnpm monorepo with a package "([^"]+)" that has a src tree and a package "([^"]+)" that has no src tree$/,
  function (this: CoverageWorld, withSrc: string, withoutSrc: string) {
    writeJson(nodePath.join(dir(this), 'package.json'), { name: 'root' });
    writePnpmWorkspace(this, ['packages/*']);
    makePackage(this, withSrc, { src: true });
    makePackage(this, withoutSrc, { src: false });
  },
);

// --- When ---

When('safeword generates the architecture doc', function (this: CoverageWorld) {
  const result = spawnSync('bun', [CLI_PATH, 'architecture'], {
    cwd: dir(this),
    encoding: 'utf8',
    timeout: 30_000,
  });
  this.status = result.status ?? 1;
});

// --- Thens ---

Then('the command succeeds', function (this: CoverageWorld) {
  assert.equal(this.status, 0, 'architecture command failed');
});

Then(/^a root index lists the package "([^"]+)"$/, function (this: CoverageWorld, name: string) {
  assert.match(rootDoc(this), /^## Packages/m, 'doc is not a root index');
  assert.ok(packageSection(this, name).length > 0, `root index does not list ${name}`);
});

Then(/^the root index lists the package "([^"]+)"$/, function (this: CoverageWorld, name: string) {
  assert.ok(packageSection(this, name).length > 0, `root index does not list ${name}`);
});

Then(
  /^the root index does not list the package "([^"]+)"$/,
  function (this: CoverageWorld, name: string) {
    assert.equal(packageSection(this, name).length, 0, `root index unexpectedly lists ${name}`);
  },
);

Then(
  /^the package "([^"]+)" has its own colocated leaf doc$/,
  function (this: CoverageWorld, name: string) {
    assert.ok(leafDocExists(this, name), `leaf doc missing for ${name}`);
  },
);

Then(
  /^the package "([^"]+)" has no colocated leaf doc$/,
  function (this: CoverageWorld, name: string) {
    assert.ok(!leafDocExists(this, name), `unexpected leaf doc for ${name}`);
  },
);

Then(
  'the generated doc is a single-repo module doc, not a package root index',
  function (this: CoverageWorld) {
    const content = rootDoc(this);
    assert.match(content, /^## Modules/m, 'expected a single-repo "## Modules" doc');
    assert.doesNotMatch(content, /^## Packages/m, 'unexpectedly rendered a package root index');
  },
);

Then('no colocated leaf docs are generated', function (this: CoverageWorld) {
  // No architecture.generated.md under any candidate package directory.
  assert.ok(
    !['web', 'svc', 'core', 'api'].some(name => leafDocExists(this, name)),
    'unexpected colocated leaf doc',
  );
});

Then(
  /^the package "([^"]+)" is marked "([^"]+)" in the root index$/,
  function (this: CoverageWorld, name: string, marker: string) {
    assert.match(packageSection(this, name), new RegExp(marker.replaceAll(' ', '\\s+')));
  },
);

Then(
  /^the package "([^"]+)" is not marked "([^"]+)" in the root index$/,
  function (this: CoverageWorld, name: string, marker: string) {
    assert.doesNotMatch(packageSection(this, name), new RegExp(marker.replaceAll(' ', '\\s+')));
  },
);

Then(
  /^the package "([^"]+)" line does not show the "([^"]+)" placeholder$/,
  function (this: CoverageWorld, name: string, _placeholderHint: string) {
    assert.doesNotMatch(packageSection(this, name), /awaiting prose/);
  },
);
