/**
 * Acceptance-lane step definitions for architecture-doc staleness enforcement
 * (ticket FPV0E4, Slice 2). Black-box: drives the real `safeword architecture
 * --stage` (commit-time auto-fix) and `--check` (CI backstop) CLIs over a temp
 * git project and asserts on the git index and exit codes — the actual
 * enforcement contract — without importing package internals.
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
const DOC_RELATIVE = '.project/architecture.generated.md';

interface EnforcementWorld extends SafewordWorld {
  dir?: string;
  stageStatus?: number;
  checkStatus?: number;
  docBefore?: string;
}

function dir(world: EnforcementWorld): string {
  if (world.dir === undefined) {
    world.dir = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'arch-enforce-bdd-'));
    execFileSync('git', ['init', '-q'], { cwd: world.dir });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: world.dir });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: world.dir });
    writeFileSync(nodePath.join(world.dir, 'package.json'), JSON.stringify({ name: 'fixture' }));
  }
  return world.dir;
}

function documentPath(world: EnforcementWorld): string {
  return nodePath.join(dir(world), DOC_RELATIVE);
}

function makeModule(world: EnforcementWorld, name: string): void {
  mkdirSync(nodePath.join(dir(world), 'src', name), { recursive: true });
}

function writeEnforcementConfig(world: EnforcementWorld, enabled: boolean): void {
  mkdirSync(nodePath.join(dir(world), '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(dir(world), '.safeword', 'config.json'),
    JSON.stringify({ architectureDocEnforcement: enabled }),
  );
}

/** Generate a fresh, safeword-owned doc on disk (the "committed current" state). */
function generateDocument(world: EnforcementWorld): void {
  const result = spawnSync('bun', [CLI_PATH, 'architecture'], {
    cwd: dir(world),
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.equal(result.status, 0, `seed architecture failed: ${result.stdout}${result.stderr}`);
}

function readDocument(world: EnforcementWorld): string {
  const path = documentPath(world);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function stagedFiles(world: EnforcementWorld): string[] {
  const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: dir(world),
    encoding: 'utf8',
  });
  return out.split('\n').filter(line => line.length > 0);
}

function runStage(world: EnforcementWorld): void {
  const result = spawnSync('bun', [CLI_PATH, 'architecture', '--stage'], {
    cwd: dir(world),
    encoding: 'utf8',
    timeout: 30_000,
  });
  world.stageStatus = result.status ?? 1;
}

function runCheck(world: EnforcementWorld): void {
  const result = spawnSync('bun', [CLI_PATH, 'architecture', '--check'], {
    cwd: dir(world),
    encoding: 'utf8',
    timeout: 30_000,
  });
  world.checkStatus = result.status ?? 1;
}

/** Set up a stale safeword-owned doc: fresh doc, then a structural change. */
function makeStale(world: EnforcementWorld): void {
  makeModule(world, 'auth');
  generateDocument(world);
  world.docBefore = readDocument(world);
  makeModule(world, 'billing');
}

/** Map a feature `<state>` phrase to the on-disk doc/project state it describes. */
function setUpDocState(world: EnforcementWorld, state: string): void {
  if (state.includes('uncreated')) {
    makeModule(world, 'auth'); // modules but no doc
  } else if (state.includes('stale')) {
    makeStale(world);
  } else if (state.includes('corrupt')) {
    makeModule(world, 'auth');
    generateDocument(world);
    writeFileSync(
      documentPath(world),
      '---\ngenerator: safeword-architecture\n---\n\n# fingerprint gone\n',
    );
  } else if (state.includes('unchanged') || state.includes('fresh')) {
    makeModule(world, 'auth');
    generateDocument(world);
  } else if (state.includes('noop')) {
    // no modules, no doc
  } else if (state.includes('foreign')) {
    mkdirSync(nodePath.dirname(documentPath(world)), { recursive: true });
    writeFileSync(documentPath(world), '# Our Architecture\n\nHand-written, no marker.\n');
  } else {
    throw new Error(`Unknown doc state: ${state}`);
  }
}

After(function (this: EnforcementWorld) {
  if (this.dir !== undefined) rmSync(this.dir, { recursive: true, force: true });
});

// --- Givens: doc/project state ---

Given(
  /^a project whose committed architecture doc is (.+)$/,
  function (this: EnforcementWorld, state: string) {
    setUpDocState(this, state);
  },
);

Given(
  /^a committed architecture doc that is (.+)$/,
  function (this: EnforcementWorld, state: string) {
    setUpDocState(this, state);
  },
);

Given(
  /^(?:the|a) committed architecture doc (?:is )?behind the current shape$/,
  function (this: EnforcementWorld) {
    makeStale(this);
  },
);

Given('an unrelated file is already staged for commit', function (this: EnforcementWorld) {
  writeFileSync(nodePath.join(dir(this), 'NOTES.md'), 'unrelated work\n');
  execFileSync('git', ['add', '--', 'NOTES.md'], { cwd: dir(this) });
});

Given('an architecture doc with no safeword generator marker', function (this: EnforcementWorld) {
  makeModule(this, 'auth');
  mkdirSync(nodePath.dirname(documentPath(this)), { recursive: true });
  const foreign = '# Our Architecture\n\nHand-written, no marker.\n';
  writeFileSync(documentPath(this), foreign);
  this.docBefore = foreign;
});

Given("the project's structure has since changed", function (this: EnforcementWorld) {
  makeModule(this, 'billing');
});

Given('a repository with no safeword config file', function (this: EnforcementWorld) {
  dir(this); // fresh temp repo carries no .safeword/config.json — default-on applies
});

Given(
  /^a project with architectureDocEnforcement (?:disabled|set to false)$/,
  function (this: EnforcementWorld) {
    writeEnforcementConfig(this, false);
  },
);

Given(
  /^architectureDocEnforcement config is (.+)$/,
  function (this: EnforcementWorld, config: string) {
    if (config.includes('false') || config.includes('opt-out')) {
      writeEnforcementConfig(this, false);
    }
    // "absent (default-on)" → write nothing; default-on applies.
  },
);

// --- Whens ---

When('the agent commits the project', function (this: EnforcementWorld) {
  runStage(this);
});

When('the architecture check runs', function (this: EnforcementWorld) {
  runCheck(this);
});

// --- Thens: commit surface (git index) ---

Then(
  /^a freshly-generated architecture doc carrying the current shape-fingerprint is staged in that commit$/,
  function (this: EnforcementWorld) {
    assert.ok(stagedFiles(this).includes(DOC_RELATIVE), 'doc was not staged');
    assert.match(readDocument(this), /fingerprint: \S+/);
  },
);

Then('the commit is not blocked', function (this: EnforcementWorld) {
  assert.equal(this.stageStatus, 0, 'stage hook blocked the commit');
});

Then('the architecture doc is not staged', function (this: EnforcementWorld) {
  assert.ok(!stagedFiles(this).includes(DOC_RELATIVE), 'doc was unexpectedly staged');
});

Then('the unrelated staged change is still part of the commit', function (this: EnforcementWorld) {
  assert.ok(stagedFiles(this).includes('NOTES.md'), 'unrelated staged change was lost');
});

Then(
  'the regenerated architecture doc is also part of the commit',
  function (this: EnforcementWorld) {
    assert.ok(stagedFiles(this).includes(DOC_RELATIVE), 'regenerated doc was not staged');
  },
);

Then('the foreign doc is left untouched', function (this: EnforcementWorld) {
  assert.equal(readDocument(this), this.docBefore, 'foreign doc was modified');
  assert.ok(!stagedFiles(this).includes(DOC_RELATIVE), 'foreign doc was staged');
});

Then(/^the stale doc is (.+)$/, function (this: EnforcementWorld, result: string) {
  if (result.includes('regenerated and staged')) {
    assert.ok(stagedFiles(this).includes(DOC_RELATIVE), 'doc was not staged');
    assert.notEqual(readDocument(this), this.docBefore, 'doc was not regenerated');
  } else {
    // "left unchanged and not staged"
    assert.ok(!stagedFiles(this).includes(DOC_RELATIVE), 'doc was staged despite opt-out');
    assert.equal(readDocument(this), this.docBefore, 'doc was regenerated despite opt-out');
  }
});

// --- Thens: CI surface (exit code) ---

Then('the check fails', function (this: EnforcementWorld) {
  assert.notEqual(this.checkStatus, 0, 'check passed but should have failed');
});

Then('the check exits non-zero', function (this: EnforcementWorld) {
  assert.notEqual(this.checkStatus, 0, 'check passed but should have failed');
});

Then('the check exits zero', function (this: EnforcementWorld) {
  assert.equal(this.checkStatus, 0, 'check failed but should have passed');
});
