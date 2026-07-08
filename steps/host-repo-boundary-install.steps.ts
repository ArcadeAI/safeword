/**
 * Acceptance steps for host-repo boundary-gate installation (ZJMZ50, #810
 * child 2). Each scenario builds a real temp host repo and shells out to the
 * real CLI — `bun packages/cli/src/cli.ts setup|upgrade|reset` — asserting on
 * hook-file bytes, printed output, and exit codes. The TB1.R4 scenarios then
 * execute the *emitted* hook files exactly the way husky's runner does
 * (`sh -e`, empty PATH) against recorder/absent/crashing binaries.
 */

import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const PROJECT_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CLI = nodePath.join(PROJECT_ROOT, 'packages/cli/src/cli.ts');

const USER_LINE = 'npx lint-staged';
const COMMIT_SHIM = 'node_modules/.bin/safeword boundary --at commit';
const PUSH_SHIM = 'node_modules/.bin/safeword boundary --at push';
const LEFTHOOK_CONFIG = 'pre-commit:\n  commands:\n    lint:\n      run: npm run lint\n';

interface InstallWorld extends SafewordWorld {
  dir?: string;
  /** Directory the CLI runs in (differs from dir in the monorepo scenario). */
  runDir?: string;
  output?: string;
  exitCode?: number;
  snapshots?: Map<string, string>;
  /** Hook under test for the emitted-shim runtime scenarios. */
  hook?: string;
  hookRunFailed?: boolean;
}

function newHost(world: InstallWorld, { git = true } = {}): string {
  const dir = mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'zjmz50-host-'));
  writeFileSync(
    nodePath.join(dir, 'package.json'),
    '{\n  "name": "host-fixture",\n  "version": "1.0.0"\n}\n',
  );
  if (git) {
    execFileSync('git', ['init', '--quiet'], { cwd: dir, stdio: 'pipe' });
  }
  world.dir = dir;
  world.runDir = dir;
  world.snapshots = new Map();
  return dir;
}

function runCliIn(world: InstallWorld, args: string[]): void {
  const result = spawnSync('bun', [CLI, ...args], {
    cwd: world.runDir ?? world.dir,
    encoding: 'utf8',
    env: { ...process.env, SAFEWORD_SKIP_INSTALL: '1', SAFEWORD_SKIP_SKILLS: '1' },
  });
  world.output = `${result.stdout}\n${result.stderr}`;
  world.exitCode = result.status ?? -1;
}

function hookPath(world: InstallWorld, hook: string): string {
  return nodePath.join(world.dir ?? '', '.husky', hook);
}

function readHook(world: InstallWorld, hook: string): string {
  return readFileSync(hookPath(world, hook), 'utf8');
}

function snapshot(world: InstallWorld, label: string, content: string): void {
  world.snapshots?.set(label, content);
}

function seedHuskyHost(world: InstallWorld): string {
  const dir = newHost(world);
  mkdirSync(nodePath.join(dir, '.husky'), { recursive: true });
  writeFileSync(hookPath(world, 'pre-commit'), `${USER_LINE}\n`);
  return dir;
}

function setupNow(world: InstallWorld): void {
  runCliIn(world, ['setup']);
  assert.equal(world.exitCode, 0, `setup failed:\n${world.output}`);
}

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

After(function (this: InstallWorld) {
  if (this.dir) rmSync(this.dir, { recursive: true, force: true });
  this.dir = undefined;
});

// ---------------------------------------------------------------- Givens

Given(
  "a husky host whose pre-commit hook runs the team's own linter",
  function (this: InstallWorld) {
    seedHuskyHost(this);
  },
);

Given('a husky host with a pre-commit hook but no pre-push hook', function (this: InstallWorld) {
  seedHuskyHost(this);
  assert.ok(!existsSync(hookPath(this, 'pre-push')));
});

Given(
  'a host carrying both a .husky directory and a lefthook config',
  function (this: InstallWorld) {
    seedHuskyHost(this);
    writeFileSync(nodePath.join(this.dir ?? '', 'lefthook.yml'), LEFTHOOK_CONFIG);
  },
);

Given("git's hooks path points outside the .husky directory", function (this: InstallWorld) {
  execFileSync('git', ['config', 'core.hooksPath', '.git/hooks'], {
    cwd: this.dir,
    stdio: 'pipe',
  });
});

Given(
  'a husky host where safeword setup has already installed the shims',
  function (this: InstallWorld) {
    seedHuskyHost(this);
    setupNow(this);
    snapshot(this, 'pre-commit', readHook(this, 'pre-commit'));
    snapshot(this, 'pre-push', readHook(this, 'pre-push'));
  },
);

Given('a host managing hooks with lefthook', function (this: InstallWorld) {
  const dir = newHost(this);
  writeFileSync(nodePath.join(dir, 'lefthook.yml'), LEFTHOOK_CONFIG);
  snapshot(this, 'lefthook.yml', LEFTHOOK_CONFIG);
});

Given('a host managing hooks with the pre-commit framework', function (this: InstallWorld) {
  const dir = newHost(this);
  writeFileSync(nodePath.join(dir, '.pre-commit-config.yaml'), 'repos: []\n');
  snapshot(this, '.pre-commit-config.yaml', 'repos: []\n');
});

Given('a git host with no hook manager at all', function (this: InstallWorld) {
  newHost(this);
});

Given(
  'a host with husky in its dependencies but no .husky directory',
  function (this: InstallWorld) {
    const dir = newHost(this);
    writeFileSync(
      nodePath.join(dir, 'package.json'),
      '{\n  "name": "host-fixture",\n  "version": "1.0.0",\n  "devDependencies": { "husky": "^9.1.7" }\n}\n',
    );
  },
);

Given(
  'a lefthook host whose config contains the snippet exactly as setup printed it',
  function (this: InstallWorld) {
    const dir = newHost(this);
    writeFileSync(nodePath.join(dir, 'lefthook.yml'), LEFTHOOK_CONFIG);
    setupNow(this);
    // Paste the snippet verbatim from the printed output: everything from the
    // first `pre-commit:` line through the last `run:` line of the nudge.
    const lines = (this.output ?? '').split('\n');
    const start = lines.findIndex(line => line.trim() === 'pre-commit:');
    assert.ok(start !== -1, `no printed snippet found in:\n${this.output}`);
    let end = lines.length - 1;
    while (end > start && !lines[end]?.includes('run:')) end -= 1;
    const snippet = lines.slice(start, end + 1).join('\n');
    writeFileSync(nodePath.join(dir, 'lefthook.yml'), `${snippet}\n`);
  },
);

Given(
  'a {word} hook file as emitted by setup, in a host whose safeword binary records its invocation',
  function (this: InstallWorld, hook: string) {
    emittedHookHost(this, hook);
    stubBinary(this, '#!/bin/sh\nprintf \'%s \' "$@" > safeword-invoked.txt\n');
  },
);

Given(
  'a hook file as emitted by setup, in a host with no dependencies installed',
  function (this: InstallWorld) {
    emittedHookHost(this, 'pre-commit');
    assert.ok(!existsSync(nodePath.join(this.dir ?? '', 'node_modules/.bin/safeword')));
  },
);

Given(
  'a hook file as emitted by setup, in a host whose safeword binary exits with an error',
  function (this: InstallWorld) {
    emittedHookHost(this, 'pre-commit');
    stubBinary(this, '#!/bin/sh\nexit 1\n');
  },
);

Given(
  "a husky host whose pre-commit hook carried the team's own linter line before setup",
  function (this: InstallWorld) {
    seedHuskyHost(this);
    snapshot(this, 'pre-setup', readHook(this, 'pre-commit'));
    setupNow(this);
    assert.ok(readHook(this, 'pre-commit').includes(COMMIT_SHIM));
  },
);

Given(
  'a husky host whose pre-push hook was created by setup and never edited',
  function (this: InstallWorld) {
    seedHuskyHost(this);
    setupNow(this);
    assert.ok(readHook(this, 'pre-push').includes(PUSH_SHIM));
  },
);

Given(
  'a husky host whose pre-commit hook gained a user-written line after setup',
  function (this: InstallWorld) {
    seedHuskyHost(this);
    setupNow(this);
    assert.ok(readHook(this, 'pre-commit').includes(COMMIT_SHIM));
    writeFileSync(
      hookPath(this, 'pre-commit'),
      `${readHook(this, 'pre-commit')}npm run docs-check\n`,
    );
  },
);

Given(
  'a husky host carrying a shim block from an older safeword version',
  function (this: InstallWorld) {
    seedHuskyHost(this);
    setupNow(this);
    writeFileSync(
      hookPath(this, 'pre-commit'),
      `${USER_LINE}\nnpx safeword boundary --legacy-flag || true # Safeword boundary gate: warn-only\n`,
    );
  },
);

Given(
  'a husky host where the user removed the shim block after setup',
  function (this: InstallWorld) {
    seedHuskyHost(this);
    setupNow(this);
    writeFileSync(hookPath(this, 'pre-commit'), `${USER_LINE}\n`);
  },
);

Given('a project directory that is not a git repository', function (this: InstallWorld) {
  newHost(this, { git: false });
});

Given('a git repository whose root is above the setup directory', function (this: InstallWorld) {
  const dir = newHost(this);
  const sub = nodePath.join(dir, 'packages', 'app');
  mkdirSync(sub, { recursive: true });
  writeFileSync(
    nodePath.join(sub, 'package.json'),
    '{\n  "name": "sub-fixture",\n  "version": "1.0.0"\n}\n',
  );
  this.runDir = sub;
});

function emittedHookHost(world: InstallWorld, hook: string): void {
  const dir = newHost(world);
  mkdirSync(nodePath.join(dir, '.husky'), { recursive: true });
  runCliIn(world, ['setup']);
  assert.equal(world.exitCode, 0, `setup failed:\n${world.output}`);
  assert.ok(existsSync(hookPath(world, hook)), `setup did not emit .husky/${hook}`);
  world.hook = hook;
}

function stubBinary(world: InstallWorld, script: string): void {
  const binDirectory = nodePath.join(world.dir ?? '', 'node_modules', '.bin');
  mkdirSync(binDirectory, { recursive: true });
  const stub = nodePath.join(binDirectory, 'safeword');
  writeFileSync(stub, script);
  chmodSync(stub, 0o755);
}

// ---------------------------------------------------------------- Whens

When('safeword setup runs in the host', function (this: InstallWorld) {
  runCliIn(this, ['setup']);
});

When('safeword setup runs again in the host', function (this: InstallWorld) {
  runCliIn(this, ['setup']);
});

When('safeword upgrade runs in the host', function (this: InstallWorld) {
  runCliIn(this, ['upgrade']);
});

When('safeword reset runs in the host', function (this: InstallWorld) {
  runCliIn(this, ['reset', '--yes']);
});

function runEmittedHook(world: InstallWorld): void {
  const result = spawnSync('/bin/sh', ['-e', `.husky/${world.hook ?? 'pre-commit'}`], {
    cwd: world.dir,
    encoding: 'utf8',
    env: { PATH: '' },
  });
  world.exitCode = result.status ?? -1;
  world.hookRunFailed = result.status !== 0;
}

When("the hook runs under husky's strict shell", function (this: InstallWorld) {
  runEmittedHook(this);
});

When("the hook runs under husky's strict shell with an empty PATH", function (this: InstallWorld) {
  runEmittedHook(this);
});

// ---------------------------------------------------------------- Thens

Then("the pre-commit hook still contains the team's linter line", function (this: InstallWorld) {
  assert.ok(readHook(this, 'pre-commit').includes(USER_LINE));
});

Then('the pre-commit hook contains the boundary commit shim', function (this: InstallWorld) {
  assert.ok(readHook(this, 'pre-commit').includes(COMMIT_SHIM));
});

Then('the pre-push hook contains the boundary push shim', function (this: InstallWorld) {
  assert.ok(readHook(this, 'pre-push').includes(PUSH_SHIM));
});

Then('the pre-push hook exists and contains the boundary push shim', function (this: InstallWorld) {
  assert.ok(existsSync(hookPath(this, 'pre-push')));
  assert.ok(readHook(this, 'pre-push').includes(PUSH_SHIM));
});

Then('no boundary shim is appended to the husky hooks', function (this: InstallWorld) {
  assert.ok(!readHook(this, 'pre-commit').includes(COMMIT_SHIM));
  assert.ok(!existsSync(hookPath(this, 'pre-push')));
});

Then('the output contains the lefthook integration snippet', function (this: InstallWorld) {
  assert.ok((this.output ?? '').includes(COMMIT_SHIM), this.output);
});

Then(
  'the pre-commit and pre-push hooks are byte-identical to before',
  function (this: InstallWorld) {
    assert.equal(readHook(this, 'pre-commit'), this.snapshots?.get('pre-commit'));
    assert.equal(readHook(this, 'pre-push'), this.snapshots?.get('pre-push'));
  },
);

Then(
  'the boundary commit shim appears exactly once in the pre-commit hook',
  function (this: InstallWorld) {
    assert.equal(count(readHook(this, 'pre-commit'), COMMIT_SHIM), 1);
  },
);

Then(
  'the output contains a lefthook snippet invoking the boundary gate',
  function (this: InstallWorld) {
    assert.ok((this.output ?? '').includes('lefthook'), this.output);
    assert.ok((this.output ?? '').includes(COMMIT_SHIM), this.output);
  },
);

Then('the lefthook config file is byte-identical to before', function (this: InstallWorld) {
  const content = readFileSync(nodePath.join(this.dir ?? '', 'lefthook.yml'), 'utf8');
  assert.equal(content, this.snapshots?.get('lefthook.yml'));
});

Then('no husky hook files are created', function (this: InstallWorld) {
  assert.ok(!existsSync(hookPath(this, 'pre-commit')));
  assert.ok(!existsSync(hookPath(this, 'pre-push')));
});

Then(
  'the output contains a pre-commit local-hook snippet invoking the boundary gate',
  function (this: InstallWorld) {
    assert.ok((this.output ?? '').includes('repo: local'), this.output);
    assert.ok((this.output ?? '').includes(COMMIT_SHIM.replace(' || true', '')), this.output);
  },
);

Then('the pre-commit config file is byte-identical to before', function (this: InstallWorld) {
  const content = readFileSync(nodePath.join(this.dir ?? '', '.pre-commit-config.yaml'), 'utf8');
  assert.equal(content, this.snapshots?.get('.pre-commit-config.yaml'));
});

Then('the output recommends husky with the steps to adopt it', function (this: InstallWorld) {
  assert.ok((this.output ?? '').includes('husky init'), this.output);
});

Then('nothing is written under the git hooks directory', function (this: InstallWorld) {
  assert.ok(!existsSync(nodePath.join(this.dir ?? '', '.git', 'hooks', 'pre-commit')));
});

Then('no husky directory is created', function (this: InstallWorld) {
  assert.ok(!existsSync(nodePath.join(this.dir ?? '', '.husky')));
});

Then('the output recommends completing the husky setup', function (this: InstallWorld) {
  assert.match(this.output ?? '', /husky init/i);
});

Then('the upgrade completes successfully', function (this: InstallWorld) {
  assert.equal(this.exitCode, 0, this.output);
});

Then('the output contains no lefthook integration snippet', function (this: InstallWorld) {
  assert.ok(!(this.output ?? '').includes(COMMIT_SHIM), this.output);
});

Then(
  'the boundary gate was invoked at the {word} boundary',
  function (this: InstallWorld, boundary: string) {
    const recorded = readFileSync(nodePath.join(this.dir ?? '', 'safeword-invoked.txt'), 'utf8');
    assert.ok(recorded.includes(`boundary --at ${boundary}`), recorded);
  },
);

Then('the hook exits successfully', function (this: InstallWorld) {
  assert.equal(this.exitCode, 0);
  assert.equal(this.hookRunFailed, false);
});

Then(
  'the pre-commit hook is byte-identical to its pre-setup content',
  function (this: InstallWorld) {
    assert.equal(readHook(this, 'pre-commit'), this.snapshots?.get('pre-setup'));
  },
);

Then('the pre-push hook file no longer exists', function (this: InstallWorld) {
  assert.ok(!existsSync(hookPath(this, 'pre-push')));
});

Then('the user-written line survives in the pre-commit hook', function (this: InstallWorld) {
  assert.ok(readHook(this, 'pre-commit').includes('npm run docs-check'));
});

Then('the boundary shims are gone from the pre-commit hook', function (this: InstallWorld) {
  assert.ok(!readHook(this, 'pre-commit').includes(COMMIT_SHIM));
});

Then('the pre-commit hook contains the current shim exactly once', function (this: InstallWorld) {
  assert.equal(count(readHook(this, 'pre-commit'), COMMIT_SHIM), 1);
});

Then('no stale shim content remains', function (this: InstallWorld) {
  assert.ok(!readHook(this, 'pre-commit').includes('--legacy-flag'));
});

Then('the pre-commit hook contains the boundary commit shim again', function (this: InstallWorld) {
  assert.ok(readHook(this, 'pre-commit').includes(COMMIT_SHIM));
});

Then('setup completes successfully', function (this: InstallWorld) {
  assert.equal(this.exitCode, 0, this.output);
});

Then('no husky hook files are written', function (this: InstallWorld) {
  assert.ok(!existsSync(hookPath(this, 'pre-commit')));
  assert.ok(!existsSync(hookPath(this, 'pre-push')));
});

Then('the output contains no hook integration nudge', function (this: InstallWorld) {
  assert.ok(!(this.output ?? '').includes('safeword boundary'), this.output);
  assert.ok(!/hook manager|husky init/i.test(this.output ?? ''), this.output);
});

Then('no husky hook files are written beneath the setup directory', function (this: InstallWorld) {
  const sub = this.runDir ?? '';
  assert.ok(!existsSync(nodePath.join(sub, '.husky', 'pre-commit')));
  assert.ok(!existsSync(nodePath.join(sub, '.husky', 'pre-push')));
});

Then(
  'the output notes that git hooks belong at the repository root',
  function (this: InstallWorld) {
    assert.match(this.output ?? '', /repository root/i);
  },
);
