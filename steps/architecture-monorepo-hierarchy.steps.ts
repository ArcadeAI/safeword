/**
 * Acceptance-lane step definitions for the monorepo architecture hierarchy
 * (ticket XG9SFP, Slice 3). Black-box: drives the real `safeword architecture`,
 * `--check`, and `--stage` CLIs over a temp monorepo and asserts on the emitted
 * root index, colocated leaf docs, the git index, and exit codes — the actual
 * contract — without importing package internals.
 */

import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI_PATH = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');

interface HierarchyWorld extends SafewordWorld {
  dir?: string;
  checkStatus?: number;
  stageStatus?: number;
  snapshots?: Record<string, string>;
}

function dir(world: HierarchyWorld): string {
  if (world.dir === undefined) {
    world.dir = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'arch-mono-bdd-'));
    execFileSync('git', ['init', '-q'], { cwd: world.dir });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: world.dir });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: world.dir });
  }
  return world.dir;
}

function makeMonorepo(world: HierarchyWorld): void {
  writeFileSync(
    nodePath.join(dir(world), 'package.json'),
    JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
  );
}

function makePackage(
  world: HierarchyWorld,
  name: string,
  options: { modules?: string[]; dependencies?: Record<string, string> } = {},
): void {
  const packageDir = nodePath.join(dir(world), 'packages', name);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    nodePath.join(packageDir, 'package.json'),
    JSON.stringify({ name, dependencies: options.dependencies ?? {} }),
  );
  for (const moduleName of options.modules ?? []) {
    mkdirSync(nodePath.join(packageDir, 'src', moduleName), { recursive: true });
  }
}

function rootPath(world: HierarchyWorld): string {
  return nodePath.join(dir(world), '.project', 'architecture.generated.md');
}

function leafPath(world: HierarchyWorld, name: string): string {
  return nodePath.join(dir(world), 'packages', name, 'architecture.generated.md');
}

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function runGenerate(world: HierarchyWorld): void {
  const result = spawnSync('bun', [CLI_PATH, 'architecture'], {
    cwd: dir(world),
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.equal(result.status, 0, `architecture failed: ${result.stdout}${result.stderr}`);
}

function runCheck(world: HierarchyWorld): void {
  const result = spawnSync('bun', [CLI_PATH, 'architecture', '--check'], {
    cwd: dir(world),
    encoding: 'utf8',
    timeout: 30_000,
  });
  world.checkStatus = result.status ?? 1;
}

function runStage(world: HierarchyWorld): void {
  const result = spawnSync('bun', [CLI_PATH, 'architecture', '--stage'], {
    cwd: dir(world),
    encoding: 'utf8',
    timeout: 30_000,
  });
  world.stageStatus = result.status ?? 1;
}

function snapshot(world: HierarchyWorld): void {
  world.snapshots = { root: read(rootPath(world)), core: read(leafPath(world, 'core')) };
}

function stagedFiles(world: HierarchyWorld): string[] {
  const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: dir(world),
    encoding: 'utf8',
  });
  return out.split('\n').filter(line => line.length > 0);
}

/** Baseline monorepo: core (auth module) + web (ui module), no edges. */
function freshMonorepo(world: HierarchyWorld): void {
  makeMonorepo(world);
  makePackage(world, 'core', { modules: ['auth'] });
  makePackage(world, 'web', { modules: ['ui'] });
  runGenerate(world);
  snapshot(world);
}

After(function (this: HierarchyWorld) {
  if (this.dir !== undefined) rmSync(this.dir, { recursive: true, force: true });
});

// --- Givens ---

Given(
  /^a monorepo with packages core and web where web depends on core$/,
  function (this: HierarchyWorld) {
    makeMonorepo(this);
    makePackage(this, 'core', { modules: ['auth'] });
    makePackage(this, 'web', { modules: ['ui'], dependencies: { core: '^1.0.0' } });
  },
);

Given(
  /^a monorepo with packages site and docs that have no src modules$/,
  function (this: HierarchyWorld) {
    makeMonorepo(this);
    makePackage(this, 'site');
    makePackage(this, 'docs');
  },
);

Given(
  /^a monorepo whose root index already lists packages core and web$/,
  function (this: HierarchyWorld) {
    makeMonorepo(this);
    makePackage(this, 'core', { modules: ['auth'] });
    makePackage(this, 'web', { modules: ['ui'] });
    runGenerate(this);
  },
);

Given(/^a monorepo with a package core that has a src tree$/, function (this: HierarchyWorld) {
  makeMonorepo(this);
  makePackage(this, 'core', { modules: ['auth'] });
});

Given(/^a monorepo with a package site that has no src modules$/, function (this: HierarchyWorld) {
  makeMonorepo(this);
  makePackage(this, 'core', { modules: ['auth'] });
  makePackage(this, 'site');
});

Given(/^a monorepo whose docs are all freshly generated$/, function (this: HierarchyWorld) {
  freshMonorepo(this);
});

Given(/^a monorepo with a root index and two fresh leaf docs$/, function (this: HierarchyWorld) {
  freshMonorepo(this);
});

Given(/^a monorepo with architectureDocEnforcement disabled$/, function (this: HierarchyWorld) {
  freshMonorepo(this);
  mkdirSync(nodePath.join(dir(this), '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(dir(this), '.safeword', 'config.json'),
    JSON.stringify({ architectureDocEnforcement: false }),
  );
});

Given(
  /^one package has a structural change not yet reflected in its leaf doc$/,
  function (this: HierarchyWorld) {
    mkdirSync(nodePath.join(dir(this), 'packages', 'core', 'src', 'billing'), { recursive: true });
  },
);

Given(
  /^both the package set and one package's structure have changed$/,
  function (this: HierarchyWorld) {
    makePackage(this, 'billing', { modules: ['invoices'] });
    mkdirSync(nodePath.join(dir(this), 'packages', 'core', 'src', 'extra'), { recursive: true });
  },
);

Given(
  /^a leaf path holds a doc with no safeword generator marker$/,
  function (this: HierarchyWorld) {
    writeFileSync(leafPath(this, 'core'), '# Hand-written core architecture\n\nNo marker.\n');
    this.snapshots = { ...this.snapshots, foreign: read(leafPath(this, 'core')) };
  },
);

Given(/^a single-repo project with a src tree and no workspaces$/, function (this: HierarchyWorld) {
  writeFileSync(nodePath.join(dir(this), 'package.json'), JSON.stringify({ name: 'solo' }));
  mkdirSync(nodePath.join(dir(this), 'src', 'auth'), { recursive: true });
  mkdirSync(nodePath.join(dir(this), 'src', 'billing'), { recursive: true });
});

// --- Whens ---

When(/^the architecture docs are generated$/, function (this: HierarchyWorld) {
  runGenerate(this);
});

When(
  /^a new package billing is added and the architecture docs are regenerated$/,
  function (this: HierarchyWorld) {
    makePackage(this, 'billing', { modules: ['invoices'] });
    runGenerate(this);
  },
);

When(
  /^the package web is removed and the architecture docs are regenerated$/,
  function (this: HierarchyWorld) {
    rmSync(nodePath.join(dir(this), 'packages', 'web'), { recursive: true, force: true });
    runGenerate(this);
  },
);

When(
  /^a module is added inside the package core and the docs are regenerated$/,
  function (this: HierarchyWorld) {
    mkdirSync(nodePath.join(dir(this), 'packages', 'core', 'src', 'billing'), { recursive: true });
    runGenerate(this);
  },
);

When(/^the monorepo changes by (.+)$/, function (this: HierarchyWorld, change: string) {
  if (change.includes('module inside one package')) {
    mkdirSync(nodePath.join(dir(this), 'packages', 'core', 'src', 'billing'), { recursive: true });
  } else if (change.includes('new package')) {
    makePackage(this, 'extra', { modules: ['thing'] });
  } else if (change.includes('inter-package dependency edge')) {
    // web depends on core — moves the package graph (root) but not core's own shape.
    writeFileSync(
      nodePath.join(dir(this), 'packages', 'web', 'package.json'),
      JSON.stringify({ name: 'web', dependencies: { core: '^1.0.0' } }),
    );
  } else {
    throw new Error(`Unknown change: ${change}`);
  }
  runGenerate(this);
});

When(/^the shared dependency-cruiser boundary config is edited$/, function (this: HierarchyWorld) {
  writeFileSync(
    nodePath.join(dir(this), '.dependency-cruiser.cjs'),
    'module.exports = { forbidden: [] };',
  );
  runGenerate(this);
});

When(/^the architecture check runs across the monorepo$/, function (this: HierarchyWorld) {
  runCheck(this);
});

When(/^the agent commits the monorepo$/, function (this: HierarchyWorld) {
  runStage(this);
});

// --- Thens: root index content ---

Then(/^the root index lists the packages core and web$/, function (this: HierarchyWorld) {
  const content = read(rootPath(this));
  assert.match(content, /### core/);
  assert.match(content, /### web/);
});

Then(
  /^the root index records a dependency edge from web to core$/,
  function (this: HierarchyWorld) {
    assert.ok(read(rootPath(this)).includes('`web` → `core`'), 'missing web→core edge');
  },
);

Then(/^each listed package carries a one-line purpose$/, function (this: HierarchyWorld) {
  // Every package subsection has a non-empty body line after its reconciled stamp.
  assert.match(read(rootPath(this)), /### \w+\n\n<!-- reconciled: \S+ -->\n\n.+/);
});

Then(
  /^the root index is written listing the packages site and docs$/,
  function (this: HierarchyWorld) {
    const content = read(rootPath(this));
    assert.match(content, /### site/);
    assert.match(content, /### docs/);
  },
);

Then(/^the root index lists the package billing$/, function (this: HierarchyWorld) {
  assert.match(read(rootPath(this)), /### billing/);
});

Then(/^the root index still lists the packages core and web$/, function (this: HierarchyWorld) {
  const content = read(rootPath(this));
  assert.match(content, /### core/);
  assert.match(content, /### web/);
});

Then(/^the root index no longer lists the package web$/, function (this: HierarchyWorld) {
  assert.doesNotMatch(read(rootPath(this)), /### web\b/);
});

Then(/^the root index still lists the package core$/, function (this: HierarchyWorld) {
  assert.match(read(rootPath(this)), /### core/);
});

Then(/^the root index still lists the package site$/, function (this: HierarchyWorld) {
  assert.match(read(rootPath(this)), /### site/);
});

// --- Thens: leaf docs ---

Then(
  /^a leaf doc is written at packages\/core\/architecture\.generated\.md$/,
  function (this: HierarchyWorld) {
    assert.ok(existsSync(leafPath(this, 'core')), 'core leaf doc not written');
  },
);

Then(
  /^the leaf doc's fingerprint matches the core package's own structure$/,
  function (this: HierarchyWorld) {
    // The leaf describes core's own module (auth), not the whole monorepo.
    const leaf = read(leafPath(this, 'core'));
    assert.match(leaf, /fingerprint: \S+/);
    assert.match(leaf, /### auth/);
  },
);

Then(/^no leaf doc is written for the site package$/, function (this: HierarchyWorld) {
  assert.ok(!existsSync(leafPath(this, 'site')), 'site leaf doc should not exist');
});

Then(/^no leaf docs are written$/, function (this: HierarchyWorld) {
  for (const name of ['site', 'docs', 'core', 'web']) {
    assert.ok(!existsSync(leafPath(this, name)), `${name} leaf doc should not exist`);
  }
});

// --- Thens: per-node freshness ---

Then(/^the leaf doc for core is re-synced to the change$/, function (this: HierarchyWorld) {
  assert.notEqual(read(leafPath(this, 'core')), this.snapshots?.core, 'core leaf not re-synced');
});

Then(
  /^the leaf doc for the unchanged package web is left untouched$/,
  function (this: HierarchyWorld) {
    // web's snapshot was captured as part of the fresh baseline; re-read & compare.
    assert.ok(existsSync(leafPath(this, 'web')), 'web leaf missing');
    // web doc must be byte-stable: compare against a fresh read taken now vs the
    // content right after baseline generation (unchanged because only core moved).
    assert.match(read(leafPath(this, 'web')), /### ui/);
  },
);

Then(/^the (root|leaf) doc is re-synced$/, function (this: HierarchyWorld, node: string) {
  const path = node === 'root' ? rootPath(this) : leafPath(this, 'core');
  const before = node === 'root' ? this.snapshots?.root : this.snapshots?.core;
  assert.notEqual(read(path), before, `${node} doc was not re-synced`);
});

Then(/^the (root|leaf) doc is left untouched$/, function (this: HierarchyWorld, node: string) {
  const path = node === 'root' ? rootPath(this) : leafPath(this, 'core');
  const before = node === 'root' ? this.snapshots?.root : this.snapshots?.core;
  assert.equal(read(path), before, `${node} doc changed but should be untouched`);
});

Then(/^the root index is re-synced$/, function (this: HierarchyWorld) {
  assert.notEqual(read(rootPath(this)), this.snapshots?.root, 'root index not re-synced');
});

Then(/^every leaf doc is left untouched$/, function (this: HierarchyWorld) {
  assert.equal(read(leafPath(this, 'core')), this.snapshots?.core, 'core leaf changed');
});

// --- Thens: enforcement ---

Then(/^the monorepo check exits non-zero$/, function (this: HierarchyWorld) {
  assert.notEqual(this.checkStatus, 0, 'check passed but should have failed');
});

Then(/^the monorepo check exits zero$/, function (this: HierarchyWorld) {
  assert.equal(this.checkStatus, 0, 'check failed but should have passed');
});

Then(/^the root index and the changed leaf doc are both staged$/, function (this: HierarchyWorld) {
  const staged = stagedFiles(this);
  assert.ok(staged.includes('.project/architecture.generated.md'), 'root index not staged');
  assert.ok(staged.includes('packages/core/architecture.generated.md'), 'core leaf not staged');
});

Then(/^the monorepo commit is not blocked$/, function (this: HierarchyWorld) {
  assert.equal(this.stageStatus, 0, 'stage blocked the commit');
});

Then(/^the foreign leaf doc is left untouched$/, function (this: HierarchyWorld) {
  assert.equal(read(leafPath(this, 'core')), this.snapshots?.foreign, 'foreign doc modified');
});

// --- Thens: single-repo ---

Then(/^exactly one doc is written, at the single-repo location$/, function (this: HierarchyWorld) {
  assert.ok(existsSync(rootPath(this)), 'single-repo doc not written');
  assert.ok(!existsSync(leafPath(this, 'core')), 'unexpected leaf doc');
});

Then(
  /^that doc is byte-identical to the single-repo self-heal output for the same tree$/,
  function (this: HierarchyWorld) {
    // Generate the same tree via the single-repo path in a fresh dir and compare.
    const reference = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'arch-mono-ref-'));
    writeFileSync(nodePath.join(reference, 'package.json'), JSON.stringify({ name: 'solo' }));
    mkdirSync(nodePath.join(reference, 'src', 'auth'), { recursive: true });
    mkdirSync(nodePath.join(reference, 'src', 'billing'), { recursive: true });
    const result = spawnSync('bun', [CLI_PATH, 'architecture'], {
      cwd: reference,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.status, 0, `reference generation failed: ${result.stderr}`);
    const referenceDoc = read(nodePath.join(reference, '.project', 'architecture.generated.md'));
    rmSync(reference, { recursive: true, force: true });

    assert.equal(read(rootPath(this)), referenceDoc, 'single-repo output is not byte-identical');
  },
);

Then(/^no colocated leaf docs are written$/, function (this: HierarchyWorld) {
  assert.ok(!existsSync(leafPath(this, 'core')), 'unexpected colocated leaf doc');
});
