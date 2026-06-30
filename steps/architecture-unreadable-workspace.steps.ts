/**
 * Acceptance-lane steps for present-but-unparseable workspace managers (ticket
 * UWP4XK, GitHub #558). Black-box: builds fixtures where one workspace manager's
 * root manifest is PRESENT but unparseable (a malformed go.work, an unreadable
 * Cargo [workspace] members, a flow-style pnpm-workspace.yaml), drives the real
 * `safeword architecture` CLI, and asserts the unreadable config is SURFACED — in
 * the rendered root index and in the command output — not silently dropped. Reuses
 * the shared `root index lists the package` / `command succeeds` Thens from
 * monorepo-coverage-honesty.steps.ts (cucumber registers steps globally).
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

/** A malformed go.work: a `use` directive whose target is multi-token junk (no member dir). */
const MALFORMED_GO_WORK = 'go 1.22\n\nuse @@@ not a path @@@\n';

function writeFile(world: ArchitectureWorld, relativePath: string, content: string): void {
  const absolute = nodePath.join(dir(world), relativePath);
  mkdirSync(nodePath.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

/** A JS workspace package under packages/<name> with a src tree (a working manager). */
function makeJsPackage(world: ArchitectureWorld, name: string): void {
  writeJson(nodePath.join(dir(world), 'packages', name, 'package.json'), { name });
  mkdirSync(nodePath.join(dir(world), 'packages', name, 'src', 'ui'), { recursive: true });
}

/** A Go module at <relativeDir> named <name>, with a src layout. */
function makeGoModule(world: ArchitectureWorld, relativeDir: string, name: string): void {
  writeFile(world, nodePath.join(relativeDir, 'go.mod'), `module ${name}\n\ngo 1.22\n`);
  mkdirSync(nodePath.join(dir(world), relativeDir, 'cmd', name), { recursive: true });
}

/** A Python package at <relativeDir> named <name> with a src tree (a uv workspace member). */
function makePythonPackage(world: ArchitectureWorld, relativeDir: string, name: string): void {
  writeFile(world, nodePath.join(relativeDir, 'pyproject.toml'), `[project]\nname = "${name}"\n`);
  mkdirSync(nodePath.join(dir(world), relativeDir, 'src', name), { recursive: true });
}

// --- Givens ---

Given(
  /^a monorepo with a working JS package "([^"]+)" and a malformed go\.work$/,
  function (this: ArchitectureWorld, jsName: string) {
    writeJson(nodePath.join(dir(this), 'package.json'), {
      name: 'root',
      workspaces: ['packages/*'],
    });
    makeJsPackage(this, jsName);
    writeFile(this, 'go.work', MALFORMED_GO_WORK);
  },
);

Given(
  /^a monorepo with a Python package "([^"]+)" and a Cargo\.toml whose \[workspace\] members are unreadable$/,
  function (this: ArchitectureWorld, pyName: string) {
    // uv is the working manager; Cargo declares a [workspace] but `members` is a string,
    // not an array — present table, unparseable member list.
    writeFile(this, 'pyproject.toml', `[tool.uv.workspace]\nmembers = ["pkgs/${pyName}"]\n`);
    makePythonPackage(this, nodePath.join('pkgs', pyName), pyName);
    writeFile(this, 'Cargo.toml', '[workspace]\nmembers = "crates/*"\n');
  },
);

Given(
  /^a monorepo with a Go module "([^"]+)" and a flow-style pnpm-workspace\.yaml$/,
  function (this: ArchitectureWorld, goName: string) {
    // go.work is the working manager; package.json has no `workspaces`, so the flow-style
    // pnpm-workspace.yaml is consulted and surfaces as unreadable.
    writeJson(nodePath.join(dir(this), 'package.json'), { name: 'root' });
    writeFile(this, 'go.work', `go 1.22\n\nuse ./services/${goName}\n`);
    makeGoModule(this, nodePath.join('services', goName), goName);
    writeFile(this, 'pnpm-workspace.yaml', 'packages: ["packages/*"]\n');
  },
);

Given(
  'a project whose only workspace config is a malformed go.work',
  function (this: ArchitectureWorld) {
    writeJson(nodePath.join(dir(this), 'package.json'), { name: 'solo' });
    writeFile(this, 'go.work', MALFORMED_GO_WORK);
  },
);

Given(
  /^a monorepo with a Go module "([^"]+)" and a single-crate Cargo\.toml with no workspace table$/,
  function (this: ArchitectureWorld, goName: string) {
    writeJson(nodePath.join(dir(this), 'package.json'), { name: 'root' });
    writeFile(this, 'go.work', `go 1.22\n\nuse ./services/${goName}\n`);
    makeGoModule(this, nodePath.join('services', goName), goName);
    writeFile(this, 'Cargo.toml', '[package]\nname = "solo"\n'); // no [workspace] → absent
  },
);

// --- When (output-capturing variant; the silent one lives in monorepo-coverage-honesty) ---

When(
  'safeword refreshes the architecture doc and captures its output',
  function (this: ArchitectureWorld) {
    const result = spawnSync('bun', [CLI_PATH, 'architecture'], {
      cwd: dir(this),
      encoding: 'utf8',
      timeout: 30_000,
    });
    this.status = result.status ?? 1;
    this.output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  },
);

// --- Thens ---

Then(
  /^the root index notes "([^"]+)" as an unreadable workspace config$/,
  function (this: ArchitectureWorld, config: string) {
    const doc = rootDoc(this);
    assert.match(doc, /^## Coverage gaps/m, 'root index has no "Coverage gaps" advisory');
    assert.ok(doc.includes(config), `Coverage gaps advisory does not name ${config}`);
  },
);

Then(
  /^the output warns that "([^"]+)" is an unreadable workspace config$/,
  function (this: ArchitectureWorld, config: string) {
    const output = this.output ?? '';
    assert.match(output, /unreadable/i, 'output carries no unreadable-workspace warning');
    assert.ok(output.includes(config), `warning does not name ${config}`);
  },
);

Then('the root index has no "Coverage gaps" advisory', function (this: ArchitectureWorld) {
  assert.doesNotMatch(rootDoc(this), /^## Coverage gaps/m, 'unexpected "Coverage gaps" advisory');
});
