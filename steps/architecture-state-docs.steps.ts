/**
 * Acceptance-lane step definitions for the architecture state-document feature
 * (ticket QD5DTT, Slice 1). Black-box: drives the real `safeword architecture`
 * CLI over a temp-dir project and asserts on the generated document, so the
 * feature is executable end-to-end without importing package internals.
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

interface ArchitectureWorld extends SafewordWorld {
  dir?: string;
  stdout?: string;
  fingerprintBefore?: string;
  fingerprintAfter?: string;
}

function dir(world: ArchitectureWorld): string {
  world.dir ??= mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'arch-bdd-'));
  return world.dir;
}

function documentPath(world: ArchitectureWorld): string {
  // No config in the temp project → default namespace root `.project`.
  return nodePath.join(dir(world), '.project', 'architecture.md');
}

function makeModule(world: ArchitectureWorld, name: string): void {
  mkdirSync(nodePath.join(dir(world), 'src', name), { recursive: true });
}

function runArchitecture(world: ArchitectureWorld): void {
  const result = spawnSync('bun', [CLI_PATH, 'architecture'], {
    cwd: dir(world),
    encoding: 'utf8',
    timeout: 30_000,
  });
  world.stdout = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  assert.equal(result.status, 0, `safeword architecture exited ${result.status}: ${world.stdout}`);
}

function readDocument(world: ArchitectureWorld): string {
  const path = documentPath(world);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function fingerprintOf(content: string): string {
  return /fingerprint: (\S+)/.exec(content)?.[1] ?? '';
}

After(function (this: ArchitectureWorld) {
  if (this.dir !== undefined) rmSync(this.dir, { recursive: true, force: true });
});

// --- Rule: the skeleton reflects the real project ---

Given(
  /^a project whose src\/ contains exactly the modules auth and billing$/,
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    makeModule(this, 'billing');
  },
);

Given('a single-repo TypeScript project', function (this: ArchitectureWorld) {
  makeModule(this, 'auth');
});

Given(
  /^a project with a stray script at scripts\/build\.ts outside src\/$/,
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    mkdirSync(nodePath.join(dir(this), 'scripts'), { recursive: true });
    writeFileSync(nodePath.join(dir(this), 'scripts', 'build.ts'), 'export {};\n');
  },
);

Given('a project that has no src directory', function (this: ArchitectureWorld) {
  dir(this);
});

Given(/^a project whose src\/ exists but contains no modules$/, function (this: ArchitectureWorld) {
  mkdirSync(nodePath.join(dir(this), 'src'), { recursive: true });
});

Given(
  'a project with a module containing a malformed source file',
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    writeFileSync(nodePath.join(dir(this), 'src', 'auth', 'broken.ts'), 'function ( { <<< invalid');
  },
);

When('the architecture doc is generated', function (this: ArchitectureWorld) {
  runArchitecture(this);
});

Then('the doc lists exactly auth and billing, with no others', function (this: ArchitectureWorld) {
  const content = readDocument(this);
  assert.match(content, /### auth/);
  assert.match(content, /### billing/);
  assert.equal(/^### /gm.exec(content) ? content.match(/^### /gm)?.length : 0, 2);
});

Then(
  /^each module's reference points to its real path \(src\/auth, src\/billing\)$/,
  function (this: ArchitectureWorld) {
    const content = readDocument(this);
    assert.match(content, /src\/auth/);
    assert.match(content, /src\/billing/);
  },
);

Then('every skeleton node has a non-empty one-line purpose', function (this: ArchitectureWorld) {
  // Each module section carries a `path` — purpose line: every `### name` is followed by a non-empty em-dash purpose.
  const content = readDocument(this);
  for (const section of content.split(/^### /m).slice(1)) {
    assert.match(section, /—\s*\S+/);
  }
});

Then(/^scripts\/build\.ts does not appear as a skeleton node$/, function (this: ArchitectureWorld) {
  assert.doesNotMatch(readDocument(this), /### (scripts|build\.ts)/);
});

Then('a minimal skeleton is produced without error', function (this: ArchitectureWorld) {
  assert.match(this.stdout ?? '', /created|unchanged/i);
  assert.ok(existsSync(documentPath(this)));
});

Then('an empty skeleton is produced without error', function (this: ArchitectureWorld) {
  assert.ok(existsSync(documentPath(this)));
  assert.doesNotMatch(readDocument(this), /^### /m);
});

Then('the module is still listed in the skeleton', function (this: ArchitectureWorld) {
  assert.match(readDocument(this), /### auth/);
});

// --- Rule: stale prose is visibly flagged ---

Given(
  'a doc whose prose section is stamped with the current skeleton fingerprint',
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    runArchitecture(this); // creates an owned doc whose section stamp matches current.
  },
);

Given(
  'a doc whose prose section describes a node that still exists',
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    runArchitecture(this);
  },
);

Given(
  'that section is stamped with an older skeleton fingerprint',
  function (this: ArchitectureWorld) {
    // Move the structure so the existing section's stamp falls behind.
    makeModule(this, 'billing');
  },
);

Given(
  'a doc with a drifted-stamp prose section describing a module that no longer exists',
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    makeModule(this, 'billing');
    runArchitecture(this);
    rmSync(nodePath.join(dir(this), 'src', 'billing'), { recursive: true, force: true });
  },
);

Given(
  'a project with a module that has no prose in the doc yet',
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    runArchitecture(this);
    makeModule(this, 'billing'); // a brand-new node with no prior section.
  },
);

When('the doc is reconciled', function (this: ArchitectureWorld) {
  runArchitecture(this);
});

Then('that prose section carries no staleness marker', function (this: ArchitectureWorld) {
  assert.doesNotMatch(readDocument(this), /stale/i);
});

Then('that prose section is marked stale', function (this: ArchitectureWorld) {
  assert.match(readDocument(this), /⚠ stale/);
});

Then('that prose section is flagged as orphaned', function (this: ArchitectureWorld) {
  assert.match(readDocument(this), /orphaned/i);
});

Then('it is not labelled merely stale', function (this: ArchitectureWorld) {
  // The orphaned section carries the orphaned marker, not a stale one.
  const orphanSection = readDocument(this)
    .split(/^### /m)
    .find(section => section.startsWith('billing'));
  assert.ok(orphanSection !== undefined && /orphaned/i.test(orphanSection));
});

Then(
  'the new node is emitted with a purpose placeholder awaiting prose',
  function (this: ArchitectureWorld) {
    const billing = readDocument(this)
      .split(/^### /m)
      .find(section => section.startsWith('billing'));
    assert.ok(billing !== undefined && /—\s*\S+/.test(billing));
  },
);

Then('the new node is not marked stale', function (this: ArchitectureWorld) {
  const billing = readDocument(this)
    .split(/^### /m)
    .find(section => section.startsWith('billing'));
  assert.ok(billing !== undefined && !/stale/i.test(billing));
});

// --- Rule: structural facts self-heal at session start ---

Given(
  "a doc whose recorded fingerprint differs from the project's current shape",
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    runArchitecture(this);
    makeModule(this, 'billing');
  },
);

Given(
  "a doc whose recorded fingerprint matches the project's current shape",
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    runArchitecture(this);
  },
);

Given('a project that has no architecture doc', function (this: ArchitectureWorld) {
  makeModule(this, 'auth');
});

Given(
  'a doc whose frontmatter fingerprint is missing or corrupt',
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    runArchitecture(this);
    writeFileSync(
      documentPath(this),
      '---\ngenerator: safeword-architecture\n---\n\n# fingerprint corrupted\n',
    );
  },
);

Given(
  'a structural change was committed with no agent in the loop',
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    runArchitecture(this);
    makeModule(this, 'billing');
  },
);

When('a session starts', function (this: ArchitectureWorld) {
  runArchitecture(this);
});

Then("the doc's skeleton matches the current shape", function (this: ArchitectureWorld) {
  assert.match(readDocument(this), /### billing/);
});

Then(
  "the recorded fingerprint equals the current shape's fingerprint",
  function (this: ArchitectureWorld) {
    // The heal re-stamped the frontmatter; a follow-up run is a no-op (unchanged).
    runArchitecture(this);
    assert.match(this.stdout ?? '', /unchanged/i);
  },
);

Then('the doc is left unchanged', function (this: ArchitectureWorld) {
  assert.match(this.stdout ?? '', /unchanged/i);
});

Then(
  'an architecture doc is created from the current structure',
  function (this: ArchitectureWorld) {
    assert.match(this.stdout ?? '', /created/i);
    assert.match(readDocument(this), /### auth/);
  },
);

Then('the skeleton is regenerated from the current structure', function (this: ArchitectureWorld) {
  assert.match(this.stdout ?? '', /regenerated/i);
  assert.match(readDocument(this), /### auth/);
});

Then('the doc is not left silently unreconciled', function (this: ArchitectureWorld) {
  assert.notEqual(fingerprintOf(readDocument(this)), '');
});

Then('the skeleton is re-synced to the change', function (this: ArchitectureWorld) {
  assert.match(readDocument(this), /### billing/);
});

Then('any prose left behind by the change is flagged', function (this: ArchitectureWorld) {
  assert.match(readDocument(this), /⚠ stale/);
});

// --- Rule: the fingerprint captures shape, not noise ---

Given(
  "a doc whose fingerprint matches the project's current shape",
  function (this: ArchitectureWorld) {
    makeModule(this, 'auth');
    writeFileSync(
      nodePath.join(dir(this), 'package.json'),
      JSON.stringify({ dependencies: { 'left-pad': '1.0.0' } }),
    );
    writeFileSync(
      nodePath.join(dir(this), '.dependency-cruiser.cjs'),
      "module.exports = { forbidden: [{ name: 'a' }] };\n",
    );
    mkdirSync(nodePath.join(dir(this), 'db'), { recursive: true });
    writeFileSync(nodePath.join(dir(this), 'db', 'schema.sql'), 'CREATE TABLE t (id int);\n');
    runArchitecture(this);
    this.fingerprintBefore = fingerprintOf(readDocument(this));
  },
);

When(/^the project changes by (.+)$/, function (this: ArchitectureWorld, change: string) {
  applyChange(this, change);
  runArchitecture(this);
  this.fingerprintAfter = fingerprintOf(readDocument(this));
});

Then(/^the fingerprint (.+)$/, function (this: ArchitectureWorld, result: string) {
  if (result === 'differs from the recorded fingerprint') {
    assert.notEqual(this.fingerprintAfter, this.fingerprintBefore);
  } else {
    assert.equal(this.fingerprintAfter, this.fingerprintBefore);
  }
});

function applyChange(world: ArchitectureWorld, change: string): void {
  const base = dir(world);
  const changes: Record<string, () => void> = {
    'adding a top-level module': () => makeModule(world, 'billing'),
    'adding a dependency': () =>
      writeFileSync(
        nodePath.join(base, 'package.json'),
        JSON.stringify({ dependencies: { 'left-pad': '1.0.0', 'right-pad': '1.0.0' } }),
      ),
    'changing a dependency-cruiser boundary rule': () =>
      writeFileSync(
        nodePath.join(base, '.dependency-cruiser.cjs'),
        "module.exports = { forbidden: [{ name: 'b' }] };\n",
      ),
    'adding a schema file': () =>
      writeFileSync(nodePath.join(base, 'db', 'extra.sql'), 'CREATE TABLE u (id int);\n'),
    'bumping only a dependency version': () =>
      writeFileSync(
        nodePath.join(base, 'package.json'),
        JSON.stringify({ dependencies: { 'left-pad': '2.0.0' } }),
      ),
    'editing only a comment in a source file': () =>
      writeFileSync(nodePath.join(base, 'src', 'auth', 'index.ts'), '// changed\nexport {};\n'),
  };

  const apply = changes[change];
  if (apply === undefined) throw new Error(`Unhandled change: ${change}`);
  apply();
}
