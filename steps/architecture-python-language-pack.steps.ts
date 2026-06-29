/**
 * Acceptance-lane step definitions for the Python language pack (ticket HWSEPV).
 * Black-box: builds src-layout / flat-layout / uv-workspace / mixed JS+Python fixtures
 * and drives the real `safeword architecture` CLI, asserting the docs it writes and that
 * Python dependency drift is caught via `architecture --check`. Reuses the shared
 * When/Then vocabulary and fixture helpers (steps/support/architecture-fixtures).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { Given, When } from '@cucumber/cucumber';

import {
  type ArchitectureWorld,
  runArchitecture,
  worldDir as dir,
  writeJson,
} from './support/architecture-fixtures.ts';

function writePyproject(directory: string, name: string, withDependencies = false): void {
  const dependencies = withDependencies ? 'dependencies = ["requests>=2.0"]\n' : '';
  writeFileSync(
    nodePath.join(directory, 'pyproject.toml'),
    `[project]\nname = "${name}"\n${dependencies}`,
  );
}

function writeModuleFile(directory: string, relativePath: string): void {
  const absolute = nodePath.join(directory, relativePath);
  mkdirSync(nodePath.dirname(absolute), { recursive: true });
  writeFileSync(absolute, '');
}

/** A uv-workspace Python package under packages/<name>; `module` makes it introspectable. */
function makeUvPackage(
  world: ArchitectureWorld,
  name: string,
  options: { module?: boolean } = {},
): void {
  const packageDirectory = nodePath.join(dir(world), 'packages', name);
  mkdirSync(packageDirectory, { recursive: true });
  writePyproject(packageDirectory, name);
  if (options.module) writeModuleFile(packageDirectory, nodePath.join('src', 'api.py'));
}

function writeUvWorkspace(world: ArchitectureWorld): void {
  writeFileSync(
    nodePath.join(dir(world), 'pyproject.toml'),
    '[tool.uv.workspace]\nmembers = ["packages/*"]\n',
  );
}

// --- Givens ---

Given(
  'a src-layout Python project with a package "api" and a module "db"',
  function (this: ArchitectureWorld) {
    writePyproject(dir(this), 'app');
    mkdirSync(nodePath.join(dir(this), 'src', 'api'), { recursive: true });
    writeModuleFile(dir(this), nodePath.join('src', 'db.py'));
  },
);

Given(
  /^a flat-layout Python project with a package dir "([^"]+)", a module file "([^"]+)", and a conftest\.py$/,
  function (this: ArchitectureWorld, packageName: string, moduleFile: string) {
    writePyproject(dir(this), 'app');
    writeModuleFile(dir(this), nodePath.join(packageName, '__init__.py'));
    writeModuleFile(dir(this), moduleFile);
    writeModuleFile(dir(this), 'conftest.py');
  },
);

Given(
  /^a uv workspace listing a Python package "([^"]+)" with a module$/,
  function (this: ArchitectureWorld, name: string) {
    writeUvWorkspace(this);
    makeUvPackage(this, name, { module: true });
  },
);

Given(
  /^a uv workspace with a Python package "([^"]+)" that has no modules$/,
  function (this: ArchitectureWorld, name: string) {
    writeUvWorkspace(this);
    makeUvPackage(this, name, { module: false });
  },
);

Given(
  'a src-layout Python project with a module whose architecture doc has been generated',
  function (this: ArchitectureWorld) {
    writePyproject(dir(this), 'app');
    writeModuleFile(dir(this), nodePath.join('src', 'api.py'));
    runArchitecture(this);
  },
);

Given(
  /^a monorepo whose workspaces include a JS package "([^"]+)" with a src tree and a Python package "([^"]+)" with a module$/,
  function (this: ArchitectureWorld, jsName: string, pythonName: string) {
    writeJson(nodePath.join(dir(this), 'package.json'), {
      name: 'root',
      workspaces: ['packages/*'],
    });
    const jsDirectory = nodePath.join(dir(this), 'packages', jsName);
    writeJson(nodePath.join(jsDirectory, 'package.json'), { name: jsName });
    mkdirSync(nodePath.join(jsDirectory, 'src', 'ui'), { recursive: true });
    const pythonDirectory = nodePath.join(dir(this), 'packages', pythonName);
    mkdirSync(pythonDirectory, { recursive: true });
    writePyproject(pythonDirectory, pythonName);
    writeModuleFile(pythonDirectory, nodePath.join('src', 'api.py'));
  },
);

// --- Whens ---

When('a dependency is added to its pyproject.toml', function (this: ArchitectureWorld) {
  writePyproject(dir(this), 'app', true);
});
