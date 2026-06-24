/**
 * Acceptance-lane step definitions for the Rust language pack (ticket YKFA5X).
 * Black-box: builds single-crate Rust, Cargo workspace, and mixed JS+Rust fixtures and
 * drives the real `safeword architecture` CLI, asserting the docs it writes and that
 * Cargo dependency drift is caught via `architecture --check`. Reuses the shared
 * When/Then vocabulary and fixture helpers (steps/support/architecture-fixtures).
 */

import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import {
  type ArchitectureWorld,
  rootDoc,
  runArchitecture,
  worldDir as dir,
  writeJson,
} from './support/architecture-fixtures.ts';

function writeCargo(directory: string, name: string, withDependencies = false): void {
  const dependencies = withDependencies ? '\n[dependencies]\nserde = "1.0"\n' : '';
  writeFileSync(
    nodePath.join(directory, 'Cargo.toml'),
    `[package]\nname = "${name}"\n${dependencies}`,
  );
}

function writeModuleFile(directory: string, name: string): void {
  mkdirSync(nodePath.join(directory, 'src'), { recursive: true });
  writeFileSync(nodePath.join(directory, 'src', `${name}.rs`), '// rust\n');
}

/** A Rust crate under packages/<name>; `module` adds a `src/<module>.rs` file (introspectable). */
function makeCrate(
  world: ArchitectureWorld,
  name: string,
  options: { module?: string; rootOnly?: boolean } = {},
): void {
  const crateDirectory = nodePath.join(dir(world), 'packages', name);
  mkdirSync(crateDirectory, { recursive: true });
  writeCargo(crateDirectory, name);
  if (options.rootOnly) writeModuleFile(crateDirectory, 'lib');
  if (options.module !== undefined) writeModuleFile(crateDirectory, options.module);
}

// Crates live under packages/<name> (not crates/) so the shared colocated-leaf-doc
// assertions, which look in packages/<name>, work — Cargo is indifferent to the dir name.
function writeWorkspace(world: ArchitectureWorld): void {
  writeFileSync(nodePath.join(dir(world), 'Cargo.toml'), '[workspace]\nmembers = ["packages/*"]\n');
}

// --- Givens ---

Given(
  'a single-crate Rust project with a module file "config", a module dir "handlers", and a lib.rs root',
  function (this: ArchitectureWorld) {
    writeCargo(dir(this), 'app');
    writeModuleFile(dir(this), 'lib');
    writeModuleFile(dir(this), 'config');
    mkdirSync(nodePath.join(dir(this), 'src', 'handlers'), { recursive: true });
  },
);

Given(
  /^a Cargo workspace listing a crate "([^"]+)" with a src module file$/,
  function (this: ArchitectureWorld, name: string) {
    writeWorkspace(this);
    makeCrate(this, name, { module: 'config' });
  },
);

Given(
  /^a Cargo workspace with a crate "([^"]+)" that has only a lib.rs root$/,
  function (this: ArchitectureWorld, name: string) {
    writeWorkspace(this);
    makeCrate(this, name, { rootOnly: true });
  },
);

Given(
  'a single-crate Rust project with a src module file whose architecture doc has been generated',
  function (this: ArchitectureWorld) {
    writeCargo(dir(this), 'app');
    writeModuleFile(dir(this), 'config');
    runArchitecture(this);
  },
);

Given(
  /^a monorepo whose workspaces include a JS package "([^"]+)" with a src tree and a Rust crate "([^"]+)" with a src module file$/,
  function (this: ArchitectureWorld, jsName: string, rustName: string) {
    writeJson(nodePath.join(dir(this), 'package.json'), {
      name: 'root',
      workspaces: ['packages/*'],
    });
    const jsDirectory = nodePath.join(dir(this), 'packages', jsName);
    writeJson(nodePath.join(jsDirectory, 'package.json'), { name: jsName });
    mkdirSync(nodePath.join(jsDirectory, 'src', 'ui'), { recursive: true });
    const rustDirectory = nodePath.join(dir(this), 'packages', rustName);
    mkdirSync(rustDirectory, { recursive: true });
    writeCargo(rustDirectory, rustName);
    writeModuleFile(rustDirectory, 'config');
  },
);

// --- Whens ---

When('a dependency is added to its Cargo.toml', function (this: ArchitectureWorld) {
  writeCargo(dir(this), 'app', true);
});

// --- Thens ---

Then(
  /^the doc does not list the module "([^"]+)"$/,
  function (this: ArchitectureWorld, name: string) {
    assert.doesNotMatch(
      rootDoc(this),
      new RegExp(`^### ${name}$`, 'm'),
      `doc unexpectedly lists module ${name}`,
    );
  },
);
