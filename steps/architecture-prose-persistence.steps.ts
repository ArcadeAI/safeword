/**
 * Acceptance-lane step definitions for architecture-doc prose persistence
 * (ticket JT852Q, layer A). Black-box: drives the real `safeword architecture`
 * CLI over a temp project, injects prose by replacing the placeholder on disk,
 * then asserts the prose survives a heal — the actual persistence contract,
 * without importing package internals.
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
const PLACEHOLDER = 'No description yet — awaiting prose.';

interface ProseWorld extends SafewordWorld {
  dir?: string;
  docPath?: string;
  stdout?: string;
  before?: string;
}

function dir(world: ProseWorld): string {
  if (world.dir === undefined) {
    world.dir = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'arch-prose-bdd-'));
    writeFileSync(nodePath.join(world.dir, 'package.json'), JSON.stringify({ name: 'fixture' }));
  }
  return world.dir;
}

function rootDocPath(world: ProseWorld): string {
  return nodePath.join(dir(world), '.project', 'architecture.generated.md');
}

function makeModule(world: ProseWorld, name: string, base = dir(world)): void {
  mkdirSync(nodePath.join(base, 'src', name), { recursive: true });
}

function heal(world: ProseWorld): void {
  const result = spawnSync('bun', [CLI_PATH, 'architecture'], {
    cwd: dir(world),
    encoding: 'utf8',
    timeout: 30_000,
  });
  world.stdout = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.equal(result.status, 0, `architecture exited ${result.status}: ${world.stdout}`);
}

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/** A single `### name` section's text (to its next heading or EOF). */
function sectionText(content: string, name: string): string {
  const pattern = new RegExp(`### ${name}\\n[\\s\\S]*?(?=\\n### |\\n## |$)`);
  return pattern.exec(content)?.[0] ?? '';
}

/** Replace a module's current prose (placeholder or text) with a new value, on disk. */
function setProse(path: string, from: string, to: string): void {
  writeFileSync(path, read(path).replace(from, to));
}

After(function (this: ProseWorld) {
  if (this.dir !== undefined) rmSync(this.dir, { recursive: true, force: true });
});

// --- Givens ---

Given(
  /^a generated doc where module "([^"]+)" has the description "([^"]+)"$/,
  function (this: ProseWorld, module: string, description: string) {
    makeModule(this, module);
    heal(this);
    this.docPath = rootDocPath(this);
    setProse(this.docPath, PLACEHOLDER, description);
  },
);

Given(
  /^a generated doc where module "([^"]+)" has a two-paragraph description$/,
  function (this: ProseWorld, module: string) {
    makeModule(this, module);
    heal(this);
    this.docPath = rootDocPath(this);
    setProse(this.docPath, PLACEHOLDER, 'First paragraph.\n\nSecond paragraph.');
  },
);

Given('the document is re-encoded with CRLF line endings', function (this: ProseWorld) {
  const path = this.docPath ?? rootDocPath(this);
  writeFileSync(path, read(path).replaceAll('\n', '\r\n'));
});

Given(
  /^module "([^"]+)" prose is (?:then )?deleted, leaving it empty$/,
  function (this: ProseWorld, _module: string) {
    const path = this.docPath ?? rootDocPath(this);
    setProse(path, 'Handles login and tokens.', '');
  },
);

Given(
  /^a generated doc where module "([^"]+)" is already flagged stale with the description "([^"]+)" preserved$/,
  function (this: ProseWorld, module: string, description: string) {
    makeModule(this, module);
    heal(this);
    this.docPath = rootDocPath(this);
    setProse(this.docPath, PLACEHOLDER, description);
    // A first structural change (a different module) makes `module` lag → stale.
    makeModule(this, 'legacy');
    heal(this);
  },
);

Given(
  /^a monorepo leaf package whose module "([^"]+)" has the description "([^"]+)"$/,
  function (this: ProseWorld, module: string, description: string) {
    writeFileSync(
      nodePath.join(dir(this), 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    );
    const leaf = nodePath.join(dir(this), 'packages', 'svc');
    mkdirSync(nodePath.join(leaf, 'src', module), { recursive: true });
    writeFileSync(nodePath.join(leaf, 'package.json'), JSON.stringify({ name: 'svc' }));
    heal(this);
    this.docPath = nodePath.join(leaf, 'architecture.generated.md');
    setProse(this.docPath, PLACEHOLDER, description);
  },
);

Given('a monorepo whose root index lists its packages', function (this: ProseWorld) {
  writeFileSync(
    nodePath.join(dir(this), 'package.json'),
    JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
  );
  const leaf = nodePath.join(dir(this), 'packages', 'svc');
  mkdirSync(nodePath.join(leaf, 'src', 'api'), { recursive: true });
  writeFileSync(nodePath.join(leaf, 'package.json'), JSON.stringify({ name: 'svc' }));
  heal(this);
  this.before = read(rootDocPath(this));
});

// --- Whens ---

When(
  /^a new module "([^"]+)" is added and the project is healed$/,
  function (this: ProseWorld, module: string) {
    makeModule(this, module);
    heal(this);
  },
);

When('the project is healed', function (this: ProseWorld) {
  makeModule(this, 'billing'); // a structural change forces the writing heal
  heal(this);
});

When('the project is healed twice with no structural change', function (this: ProseWorld) {
  this.before = read(this.docPath ?? rootDocPath(this));
  heal(this);
  heal(this);
});

When(
  /^the project's shape changes so module "([^"]+)" stamp lags, and it is healed$/,
  function (this: ProseWorld, _module: string) {
    makeModule(this, 'billing');
    heal(this);
  },
);

When('a new module is added to that leaf and the project is healed', function (this: ProseWorld) {
  mkdirSync(nodePath.join(dir(this), 'packages', 'svc', 'src', 'worker'), { recursive: true });
  heal(this);
});

When('the project is healed with no structural change', function (this: ProseWorld) {
  heal(this);
});

// --- Thens ---

Then('the heal writes the document', function (this: ProseWorld) {
  assert.match(this.stdout ?? '', /\b(created|healed|regenerated)\b/);
});

Then(
  /^module "([^"]+)" still shows exactly "([^"]+)"$/,
  function (this: ProseWorld, module: string, description: string) {
    const section = sectionText(read(this.docPath ?? rootDocPath(this)), module);
    assert.ok(section.includes(description), `expected "${description}" in ${module} section`);
    assert.ok(!section.includes(PLACEHOLDER), `${module} unexpectedly shows the placeholder`);
  },
);

Then(
  /^module "([^"]+)" shows exactly "([^"]+)"$/,
  function (this: ProseWorld, module: string, expected: string) {
    const section = sectionText(read(this.docPath ?? rootDocPath(this)), module);
    assert.ok(section.includes(expected), `expected "${expected}" in ${module} section`);
  },
);

Then('module {string} is flagged stale', function (this: ProseWorld, module: string) {
  assert.match(sectionText(read(this.docPath ?? rootDocPath(this)), module), /⚠ stale/);
});

Then(
  /^module "([^"]+)" carries exactly one stale marker$/,
  function (this: ProseWorld, module: string) {
    const section = sectionText(read(this.docPath ?? rootDocPath(this)), module);
    assert.equal(section.match(/⚠ stale/g)?.length ?? 0, 1);
  },
);

Then(
  /^module "([^"]+)" still shows its full two-paragraph description$/,
  function (this: ProseWorld, module: string) {
    const section = sectionText(read(this.docPath ?? rootDocPath(this)), module);
    assert.ok(section.includes('First paragraph.'), 'first paragraph lost');
    assert.ok(section.includes('Second paragraph.'), 'second paragraph lost');
  },
);

Then('the second heal reports unchanged', function (this: ProseWorld) {
  assert.match(this.stdout ?? '', /unchanged/);
});

Then('the document is byte-identical to before the heals', function (this: ProseWorld) {
  assert.equal(read(this.docPath ?? rootDocPath(this)), this.before);
});

Then(
  /^the leaf's module "([^"]+)" still shows exactly "([^"]+)"$/,
  function (this: ProseWorld, module: string, description: string) {
    assert.ok(read(this.docPath ?? '').includes(description), `leaf ${module} prose lost`);
  },
);

Then('the root index is left unchanged', function (this: ProseWorld) {
  assert.equal(read(rootDocPath(this)), this.before);
});
