import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const PACKAGE_ROOT = nodePath.join(REPO_ROOT, 'packages/cli');

interface AccessEvent {
  operation: 'exists' | 'read';
  path: string;
}

interface QuietEnrollmentWorld extends SafewordWorld {
  fixtureRoot?: string;
  projectRoot?: string;
  userDataRoot?: string;
  observerLog?: string;
  surface?: string;
  entryPoint?: string;
  proofBoundary?: string;
  observedAccesses?: AccessEvent[];
}

const SURFACE_ARTIFACTS: Readonly<Record<string, string>> = {
  'Claude Code': 'plugin/skills/bdd/SKILL.md',
  'OpenAI Codex': 'packages/cli/codex-plugin/skills/bdd/SKILL.md',
  OpenCode: 'packages/cli/src/opencode/plugin.ts',
  Cursor: 'packages/cli/templates/cursor/rules/bdd-core.mdc',
  'Safeword CLI': 'packages/cli/dist/cli.js',
};

const SURFACE_RUNTIMES: Readonly<Record<string, string>> = {
  'Claude Code': 'packages/cli/src/cli.ts',
  'OpenAI Codex': 'packages/cli/src/cli.ts',
  OpenCode: 'packages/cli/src/cli.ts',
  Cursor: 'packages/cli/src/cli.ts',
  'Safeword CLI': 'packages/cli/src/cli.ts',
};

function required(value: string | undefined, label: string): string {
  assert.ok(value, `${label} must be initialized`);
  return value;
}

function observedEvents(path: string): AccessEvent[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as AccessEvent);
}

After(function (this: QuietEnrollmentWorld) {
  if (this.fixtureRoot !== undefined) rmSync(this.fixtureRoot, { recursive: true, force: true });
});

Given(
  'a repository with no local, enclosing, or global Safeword project context on a host with interactive input whose repository and user-global Safeword-owned paths are observed independently of Safeword',
  function (this: QuietEnrollmentWorld) {
    const fixtureRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-context-boundary-'));
    this.fixtureRoot = fixtureRoot;
    this.projectRoot = nodePath.join(fixtureRoot, 'parent', 'project');
    this.userDataRoot = nodePath.join(fixtureRoot, 'user-data');
    this.observerLog = nodePath.join(fixtureRoot, 'access.ndjson');
    mkdirSync(this.projectRoot, { recursive: true });
    writeFileSync(
      nodePath.join(fixtureRoot, 'observe-filesystem.mjs'),
      [
        "import fs from 'node:fs';",
        "import { syncBuiltinESMExports } from 'node:module';",
        'const log = process.env.SAFEWORD_TEST_ACCESS_LOG;',
        'const originalAppendFileSync = fs.appendFileSync.bind(fs);',
        'const originalExistsSync = fs.existsSync.bind(fs);',
        'const originalReadFileSync = fs.readFileSync.bind(fs);',
        String.raw`const record = (operation, value) => { if (log && typeof value === 'string') originalAppendFileSync(log, JSON.stringify({ operation, path: value }) + '\n'); };`,
        "fs.existsSync = value => { record('exists', value); return originalExistsSync(value); };",
        "fs.readFileSync = (...args) => { record('read', args[0]); return originalReadFileSync(...args); };",
        'syncBuiltinESMExports();',
      ].join('\n'),
    );
  },
);

Given(
  /^(.+) on (Claude Code|OpenAI Codex|OpenCode|Cursor|Safeword CLI) is loaded under (.+) and is not an explicit install, status, doctor, plan, or uninstall command$/u,
  function (
    this: QuietEnrollmentWorld,
    entryPoint: string,
    surface: string,
    proofBoundary: string,
  ) {
    const artifact = SURFACE_ARTIFACTS[surface];
    assert.ok(artifact, `unsupported surface ${surface}`);
    assert.equal(
      proofBoundary === 'a real command process' || existsSync(nodePath.join(REPO_ROOT, artifact)),
      true,
    );
    this.entryPoint = entryPoint;
    this.surface = surface;
    this.proofBoundary = proofBoundary;
  },
);

When(
  'that entry point is exercised until it first needs Safeword project state',
  function (this: QuietEnrollmentWorld) {
    const surface = required(this.surface, 'surface');
    const runtime = required(SURFACE_RUNTIMES[surface], `${surface} runtime`);
    const projectRoot = required(this.projectRoot, 'project root');
    const userDataRoot = required(this.userDataRoot, 'user data root');
    const observerLog = required(this.observerLog, 'observer log');
    const preload = nodePath.join(
      required(this.fixtureRoot, 'fixture root'),
      'observe-filesystem.mjs',
    );
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        nodePath.join(REPO_ROOT, runtime),
        'project',
        'record-skill-invocation',
        '--cwd',
        projectRoot,
        'bdd',
        'session-1',
        '--json',
      ],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_OPTIONS: `--import=${preload}`,
          SAFEWORD_TEST_ACCESS_LOG: observerLog,
          XDG_DATA_HOME: userDataRoot,
        },
      },
    );
    this.result = { stdout: result.stdout, stderr: result.stderr, exitCode: result.status ?? 1 };
    this.observedAccesses = observedEvents(observerLog);
  },
);

Then(
  'exactly one plain-language setup choice appears after only read-only checks of the current marker, ancestor markers, and checkout-global partition and before the independent observer records any Safeword-owned write or any other state read',
  function (this: QuietEnrollmentWorld) {
    assert.ok(
      [0, 2].includes(this.result.exitCode),
      `unexpected command exit ${this.result.exitCode}: ${this.result.stderr}`,
    );
    const envelope = JSON.parse(this.result.stdout) as {
      findings: { code: string; message: string }[];
    };
    assert.equal(envelope.findings.length, 1);
    assert.equal(envelope.findings[0]?.code, 'ENROLLMENT_CHOICE_REQUIRED');
    assert.match(envelope.findings[0]?.message ?? '', /set up this project/iu);

    const projectRoot = required(this.projectRoot, 'project root');
    const userDataRoot = required(this.userDataRoot, 'user data root');
    const relevant = (this.observedAccesses ?? []).filter(
      event => event.path.startsWith(projectRoot) || event.path.startsWith(userDataRoot),
    );
    assert.ok(
      relevant.some(event => event.path === nodePath.join(projectRoot, '.safeword/SAFEWORD.md')),
      'the current repository marker was not checked',
    );
    assert.ok(
      relevant.some(event => event.path.startsWith(userDataRoot)),
      'the exact checkout-global partition was not checked before offering setup',
    );
    assert.equal(
      relevant.some(event => event.operation === 'read' && event.path.includes('.project')),
      false,
      'project state was read before the enrollment choice',
    );
  },
);
