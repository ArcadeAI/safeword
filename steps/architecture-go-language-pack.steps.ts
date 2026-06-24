/**
 * Acceptance-lane step definitions for the Go language pack (ticket ZD70P1).
 * Black-box: builds single-repo Go, go.work monorepo, and mixed JS+Go fixtures and
 * drives the real `safeword architecture` CLI, asserting the docs it writes and
 * that Go dependency drift is caught via `architecture --check`. Reuses the shared
 * When/Then vocabulary and fixture helpers (steps/support/architecture-fixtures).
 */

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  type ArchitectureWorld,
  CLI_PATH,
  rootDoc,
  worldDir as dir,
  writeJson,
} from './support/architecture-fixtures.ts';

const GO_LAYOUT_DIRECTORIES = ['cmd', 'internal', 'pkg'];

function writeGoModule(directory: string, modulePath: string): void {
  writeFileSync(nodePath.join(directory, 'go.mod'), `module ${modulePath}\n\ngo 1.22\n`);
}

function makeLayout(directory: string): void {
  for (const layoutDirectory of GO_LAYOUT_DIRECTORIES) {
    mkdirSync(nodePath.join(directory, layoutDirectory), { recursive: true });
  }
}

/** A single-repo Go project at the world root: go.mod + cmd/internal/pkg. */
function makeSingleRepoGo(world: ArchitectureWorld): void {
  const root = dir(world);
  writeGoModule(root, 'example.com/app');
  makeLayout(root);
}

/** A Go workspace package under packages/<name>; `layout` controls introspectability. */
function makeGoPackage(world: ArchitectureWorld, name: string, options: { layout: boolean }): void {
  const packageDirectory = nodePath.join(dir(world), 'packages', name);
  mkdirSync(packageDirectory, { recursive: true });
  // The module directive IS the package's identity in the root index; use the bare
  // name so scenarios can refer to it directly (the full-path case is unit-tested).
  writeGoModule(packageDirectory, name);
  if (options.layout) {
    makeLayout(packageDirectory);
  } else {
    writeFileSync(nodePath.join(packageDirectory, 'main.go'), 'package main\n');
  }
}

function writeGoWork(world: ArchitectureWorld, body: string): void {
  writeFileSync(nodePath.join(dir(world), 'go.work'), body);
}

function runArchitecture(world: ArchitectureWorld, args: string[] = []): void {
  const result = spawnSync('bun', [CLI_PATH, 'architecture', ...args], {
    cwd: dir(world),
    encoding: 'utf8',
    timeout: 30_000,
  });
  world.status = result.status ?? 1;
}

// --- Givens ---

Given(
  'a single-repo Go project with cmd, internal, and pkg directories',
  function (this: ArchitectureWorld) {
    makeSingleRepoGo(this);
  },
);

Given(
  'a single-repo Go project with cmd, internal, and pkg directories whose architecture doc has been generated',
  function (this: ArchitectureWorld) {
    makeSingleRepoGo(this);
    runArchitecture(this);
  },
);

Given(
  /^a go\.work monorepo listing a Go package "([^"]+)" with a cmd\/internal\/pkg layout$/,
  function (this: ArchitectureWorld, name: string) {
    writeGoWork(this, `go 1.22\n\nuse ./packages/${name}\n`);
    makeGoPackage(this, name, { layout: true });
  },
);

Given(
  /^a go\.work monorepo with a Go package "([^"]+)" that has only top-level Go files$/,
  function (this: ArchitectureWorld, name: string) {
    writeGoWork(this, `go 1.22\n\nuse ./packages/${name}\n`);
    makeGoPackage(this, name, { layout: false });
  },
);

Given(
  /^a go\.work monorepo listing a Go package "([^"]+)" with a cmd\/internal\/pkg layout alongside an unreadable use entry$/,
  function (this: ArchitectureWorld, name: string) {
    // A valid `use` line plus one junk line a working parser skips — proves
    // partial-skip, not total-degrade (scenario-gate review note).
    writeGoWork(this, `go 1.22\n\nuse (\n\t./packages/${name}\n\t@@@ not a path @@@\n)\n`);
    makeGoPackage(this, name, { layout: true });
  },
);

Given(
  /^a monorepo whose workspaces include a JS package "([^"]+)" with a src tree and a Go package "([^"]+)" with a cmd\/internal\/pkg layout$/,
  function (this: ArchitectureWorld, jsName: string, goName: string) {
    writeJson(nodePath.join(dir(this), 'package.json'), {
      name: 'root',
      workspaces: ['packages/*'],
    });
    const jsDirectory = nodePath.join(dir(this), 'packages', jsName);
    writeJson(nodePath.join(jsDirectory, 'package.json'), { name: jsName });
    mkdirSync(nodePath.join(jsDirectory, 'src', 'ui'), { recursive: true });
    makeGoPackage(this, goName, { layout: true });
  },
);

// --- Whens ---

When('a require is added to its go.mod', function (this: ArchitectureWorld) {
  const goModPath = nodePath.join(dir(this), 'go.mod');
  writeFileSync(
    goModPath,
    'module example.com/app\n\ngo 1.22\n\nrequire github.com/new/dep v1.0.0\n',
  );
});

When('safeword checks the architecture doc', function (this: ArchitectureWorld) {
  runArchitecture(this, ['--check']);
});

// --- Thens ---

Then(/^the doc lists the module "([^"]+)"$/, function (this: ArchitectureWorld, name: string) {
  assert.match(rootDoc(this), new RegExp(`^### ${name}$`, 'm'), `doc does not list module ${name}`);
});

Then('safeword reports the architecture doc is stale', function (this: ArchitectureWorld) {
  assert.notEqual(
    this.status,
    0,
    'expected architecture --check to report the doc stale (nonzero)',
  );
});
