/**
 * Acceptance-lane Givens for polyglot monorepo discovery (ticket MGWZ4P).
 * Black-box: builds fixtures that declare packages with MORE THAN ONE workspace
 * manager at once (package.json workspaces + go.work + Cargo [workspace] + uv),
 * then reuses the shared `safeword generates the architecture doc` When and the
 * `root index lists the package` Thens from monorepo-coverage-honesty.steps.ts —
 * cucumber registers step definitions globally, so only the new Givens live here.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Given } from '@cucumber/cucumber';

import {
  type ArchitectureWorld,
  worldDir as dir,
  writeJson,
} from './support/architecture-fixtures.ts';

function writeFile(world: ArchitectureWorld, relativePath: string, content: string): void {
  const absolute = nodePath.join(dir(world), relativePath);
  mkdirSync(nodePath.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

/** A JS workspace package under packages/<name> with a src tree. */
function makeJsPackage(world: ArchitectureWorld, name: string): void {
  writeJson(nodePath.join(dir(world), 'packages', name, 'package.json'), { name });
  mkdirSync(nodePath.join(dir(world), 'packages', name, 'src', 'ui'), { recursive: true });
}

/** A Go module at <relativeDir> named <name>, declared by a go.work `use` line. */
function makeGoModule(world: ArchitectureWorld, relativeDir: string, name: string): void {
  writeFile(world, nodePath.join(relativeDir, 'go.mod'), `module ${name}\n\ngo 1.22\n`);
  mkdirSync(nodePath.join(dir(world), relativeDir, 'cmd', name), { recursive: true });
}

/** A Rust crate at <relativeDir> named <name>, a Cargo [workspace] member. */
function makeRustCrate(world: ArchitectureWorld, relativeDir: string, name: string): void {
  writeFile(world, nodePath.join(relativeDir, 'Cargo.toml'), `[package]\nname = "${name}"\n`);
  writeFile(world, nodePath.join(relativeDir, 'src', 'lib.rs'), '// rust\n');
  mkdirSync(nodePath.join(dir(world), relativeDir, 'src', 'engine'), { recursive: true });
}

/** A Python package at <relativeDir> named <name>, a uv workspace member. */
function makePythonPackage(world: ArchitectureWorld, relativeDir: string, name: string): void {
  writeFile(world, nodePath.join(relativeDir, 'pyproject.toml'), `[project]\nname = "${name}"\n`);
  mkdirSync(nodePath.join(dir(world), relativeDir, 'src', name), { recursive: true });
}

Given(
  /^a monorepo whose package\.json workspaces list a JS package "([^"]+)" and whose go\.work lists a Go module "([^"]+)"$/,
  function (this: ArchitectureWorld, jsName: string, goName: string) {
    writeJson(nodePath.join(dir(this), 'package.json'), {
      name: 'root',
      workspaces: ['packages/*'],
    });
    makeJsPackage(this, jsName);
    writeFile(this, 'go.work', `go 1.22\n\nuse ./services/${goName}\n`);
    makeGoModule(this, nodePath.join('services', goName), goName);
  },
);

Given(
  /^a polyglot monorepo with a Go module "([^"]+)", a Rust crate "([^"]+)", and a Python package "([^"]+)"$/,
  function (this: ArchitectureWorld, goName: string, rustName: string, pyName: string) {
    writeFile(this, 'go.work', `go 1.22\n\nuse ./${goName}\n`);
    makeGoModule(this, goName, goName);

    writeFile(this, 'Cargo.toml', `[workspace]\nmembers = ["${rustName}"]\n`);
    makeRustCrate(this, rustName, rustName);

    writeFile(this, 'pyproject.toml', `[tool.uv.workspace]\nmembers = ["${pyName}"]\n`);
    makePythonPackage(this, pyName, pyName);
  },
);
