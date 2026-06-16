import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

/** Mirror of the resolver's PlanEntry shape (kept local so this step file has no runtime src import). */
interface PlanEntry {
  language: string;
  cwd: string;
  command: string;
  runner: string;
  available: boolean;
}

interface TestPlanWorld extends SafewordWorld {
  root?: string;
  /** `SAFEWORD_FAKE_TOOLS` value; defaults to "all". */
  fakeTools?: string;
  plan?: PlanEntry[];
  cliStdout?: string;
}

const DEFAULT_CONTENT: Record<string, string> = {
  'go.mod': 'module example\n',
  'go.work': 'go 1.22\n',
  'Cargo.toml': '[package]\nname = "x"\nversion = "0.1.0"\n',
  'pyproject.toml': '[project]\nname = "x"\n',
  'tox.ini': '[tox]\nenvlist = py3\n',
  'uv.lock': '',
  'poetry.lock': '',
  'pnpm-lock.yaml': '',
  'requirements.txt': '',
};

function ensureRoot(world: TestPlanWorld): string {
  world.root ??= mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'safeword-test-plan-bdd-'));
  return world.root;
}

function write(world: TestPlanWorld, rel: string, content: string): void {
  const abs = nodePath.join(ensureRoot(world), rel);
  mkdirSync(nodePath.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

/** Write a manifest by name using sensible default content. */
function seed(world: TestPlanWorld, name: string): void {
  write(world, name, DEFAULT_CONTENT[name] ?? '');
}

/** Run the real CLI from source via bun, capturing its JSON plan deterministically. */
function runPlan(world: TestPlanWorld, kind: 'test' | 'build'): void {
  const cliPath = nodePath.join(process.cwd(), 'packages/cli/src/cli.ts');
  const target = ensureRoot(world);
  // Run from the repo root (valid package.json) and point the CLI at the temp
  // repo via the [dir] arg — so a malformed temp package.json can't trip the
  // bun runtime before the CLI's own (catching) resolver reads it.
  world.cliStdout = execFileSync('bun', [cliPath, 'test-plan', target, '--kind', kind, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, SAFEWORD_FAKE_TOOLS: world.fakeTools ?? 'all' },
  });
  world.plan = JSON.parse(world.cliStdout) as PlanEntry[];
}

function findEntry(world: TestPlanWorld, language: string): PlanEntry | undefined {
  return world.plan?.find(planEntry => planEntry.language === language);
}

After(function (this: TestPlanWorld) {
  if (this.root !== undefined) rmSync(this.root, { force: true, recursive: true });
});

// --- Given: repo shapes ---

Given(
  'a repo with a root {string} script and a {string}',
  function (this: TestPlanWorld, script: string, file: string) {
    write(this, 'package.json', JSON.stringify({ scripts: { [script]: 'echo run' } }));
    seed(this, file);
  },
);

Given(
  'a repo with a {string} and a {string}',
  function (this: TestPlanWorld, a: string, b: string) {
    seed(this, a);
    seed(this, b);
  },
);

Given(
  'a repo with a {string} and a {string} with an empty scripts object',
  function (this: TestPlanWorld, manifest: string, _pkg: string) {
    seed(this, manifest);
    write(this, 'package.json', JSON.stringify({ scripts: {} }));
  },
);

Given(
  'a repo with a {string} and a {string} containing invalid JSON',
  function (this: TestPlanWorld, manifest: string, _pkg: string) {
    seed(this, manifest);
    write(this, 'package.json', '{ this is not valid json');
  },
);

Given('a repo with no recognized language manifest', function (this: TestPlanWorld) {
  write(this, 'README.md', '# hi\n');
});

Given('a Python repo with a {string}', function (this: TestPlanWorld, file: string) {
  seed(this, 'pyproject.toml');
  seed(this, file);
});

Given('a Python repo with no pytest configuration', function (this: TestPlanWorld) {
  write(this, 'pyproject.toml', '[project]\nname = "x"\n');
});

Given(
  'a Python repo with a {string} and pytest configured',
  function (this: TestPlanWorld, file: string) {
    write(this, 'pyproject.toml', '[tool.pytest.ini_options]\nminversion = "7.0"\n');
    seed(this, file);
  },
);

Given('a Rust repo', function (this: TestPlanWorld) {
  seed(this, 'Cargo.toml');
});

Given('a Go repo with a {string}', function (this: TestPlanWorld, file: string) {
  seed(this, 'go.mod');
  seed(this, file);
});

Given('a repo with a {string}', function (this: TestPlanWorld, file: string) {
  seed(this, file);
});

Given(
  'a repo with a {string} and no root manifest',
  function (this: TestPlanWorld, nestedPath: string) {
    write(this, nestedPath, DEFAULT_CONTENT[nodePath.basename(nestedPath)] ?? '[project]\n');
  },
);

Given(
  'a repo with a {string} only under {string}',
  function (this: TestPlanWorld, file: string, dir: string) {
    write(this, nodePath.join(dir, 'dep', file), DEFAULT_CONTENT[file] ?? '');
  },
);

Given(
  'a repo with a {string}, a {string}, and a root "build" script',
  function (this: TestPlanWorld, a: string, b: string) {
    seed(this, a);
    seed(this, b);
    write(this, 'package.json', JSON.stringify({ scripts: { build: 'tsup' } }));
  },
);

Given(
  'a repo with a {string} and a {string} with no "build" script',
  function (this: TestPlanWorld, manifest: string, _pkg: string) {
    seed(this, manifest);
    write(this, 'package.json', JSON.stringify({ scripts: { test: 'vitest' } }));
  },
);

// --- Given: toolchain availability (drives the SAFEWORD_FAKE_TOOLS seam) ---

Given('only the {string} toolchain is installed', function (this: TestPlanWorld, tool: string) {
  this.fakeTools = `only:${tool}`;
});

Given(
  'the {string} and {string} toolchains are installed',
  function (this: TestPlanWorld, a: string, b: string) {
    this.fakeTools = `only:${a},${b}`;
  },
);

Given('the {string} toolchain is not installed', function (this: TestPlanWorld, tool: string) {
  this.fakeTools = `none:${tool}`;
});

// --- When ---

When('I request the test plan', function (this: TestPlanWorld) {
  runPlan(this, 'test');
});

When('I request the build plan', function (this: TestPlanWorld) {
  runPlan(this, 'build');
});

When('I run the test-plan CLI as JSON', function (this: TestPlanWorld) {
  runPlan(this, 'test');
});

// --- Then ---

Then('the plan includes a {string} entry', function (this: TestPlanWorld, language: string) {
  assert.ok(findEntry(this, language), `expected a ${language} entry`);
});

Then('the plan has no {string} entry', function (this: TestPlanWorld, language: string) {
  assert.equal(findEntry(this, language), undefined, `unexpected ${language} entry`);
});

Then('the plan has exactly {int} entries', function (this: TestPlanWorld, count: number) {
  assert.equal(this.plan?.length, count);
});

Then('the plan is empty', function (this: TestPlanWorld) {
  assert.deepEqual(this.plan, []);
});

Then(
  'the {string} entry command is {string}',
  function (this: TestPlanWorld, language: string, command: string) {
    assert.equal(findEntry(this, language)?.command, command);
  },
);

Then('the {string} entry is marked unavailable', function (this: TestPlanWorld, language: string) {
  assert.equal(findEntry(this, language)?.available, false);
});

Then(
  'the output is a JSON array containing an entry with language {string}',
  function (this: TestPlanWorld, language: string) {
    const parsed = JSON.parse(this.cliStdout ?? '') as PlanEntry[];
    assert.ok(Array.isArray(parsed), 'output is not a JSON array');
    assert.ok(
      parsed.some(planEntry => planEntry.language === language),
      `no ${language} entry in CLI output`,
    );
  },
);

Then(
  'that entry has a non-empty "command" and a boolean "available"',
  function (this: TestPlanWorld) {
    const planEntry = (JSON.parse(this.cliStdout ?? '') as PlanEntry[])[0];
    assert.ok(planEntry && planEntry.command.length > 0, 'command is empty');
    assert.equal(typeof planEntry.available, 'boolean');
  },
);
