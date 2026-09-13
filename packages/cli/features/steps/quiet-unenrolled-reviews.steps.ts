import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import type { SafewordWorld } from './world.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const PACKAGE_ROOT = nodePath.join(REPO_ROOT, 'packages/cli');

interface AccessEvent {
  operation: 'choice' | 'exists' | 'read' | 'write';
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
  beforeSnapshot?: string;
  afterSnapshot?: string;
}

const SURFACE_ARTIFACTS: Readonly<Record<string, string>> = {
  'Claude Code': 'plugin/skills/bdd/SKILL.md',
  'OpenAI Codex': 'packages/cli/codex-plugin/skills/bdd/SKILL.md',
  OpenCode: 'packages/cli/src/opencode/plugin.ts',
  Cursor: 'packages/cli/templates/cursor/rules/bdd-core.mdc',
  'Safeword CLI': 'packages/cli/dist/cli.js',
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

function filesystemSnapshot(roots: readonly string[]): string {
  const entries: string[] = [];
  const visit = (root: string, path: string): void => {
    const metadata = lstatSync(path);
    const relative = nodePath.relative(root, path) || '.';
    if (metadata.isDirectory()) {
      entries.push(`${root}:${relative}:directory:${metadata.mode & 0o777}`);
      const children = readdirSync(path).toSorted((left, right) => left.localeCompare(right));
      for (const child of children) {
        visit(root, nodePath.join(path, child));
      }
      return;
    }
    const digest = metadata.isFile()
      ? createHash('sha256').update(readFileSync(path)).digest('hex')
      : 'not-a-file';
    entries.push(`${root}:${relative}:entry:${metadata.mode & 0o777}:${digest}`);
  };
  for (const root of roots) visit(root, root);
  return entries.join('\n');
}

After(function (this: QuietEnrollmentWorld) {
  if (this.fixtureRoot !== undefined) rmSync(this.fixtureRoot, { recursive: true, force: true });
});

Given(
  'a repository with no local, enclosing, or global Safeword project context on a host with interactive input whose repository and user-global Safeword-owned paths are observed independently of Safeword',
  function (this: QuietEnrollmentWorld) {
    const fixtureRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-context-boundary-'));
    this.fixtureRoot = fixtureRoot;
    const projectRoot = nodePath.join(fixtureRoot, 'parent', 'project');
    const userDataRoot = nodePath.join(fixtureRoot, 'user-data');
    this.observerLog = nodePath.join(fixtureRoot, 'access.ndjson');
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(userDataRoot, { recursive: true });
    this.projectRoot = realpathSync(projectRoot);
    this.userDataRoot = realpathSync(userDataRoot);
    this.beforeSnapshot = filesystemSnapshot([this.projectRoot, this.userDataRoot]);
    writeFileSync(
      nodePath.join(fixtureRoot, 'observe-filesystem.mjs'),
      [
        "import fs from 'node:fs';",
        "import { syncBuiltinESMExports } from 'node:module';",
        'const log = process.env.SAFEWORD_TEST_ACCESS_LOG;',
        'const originalOpenSync = fs.openSync.bind(fs);',
        'const originalWriteSync = fs.writeSync.bind(fs);',
        'const originalCloseSync = fs.closeSync.bind(fs);',
        String.raw`const record = (operation, value) => { if (!log) return; const path = value instanceof URL ? value.pathname : Buffer.isBuffer(value) ? value.toString() : value; if (typeof path !== 'string') return; const descriptor = originalOpenSync(log, 'a'); try { originalWriteSync(descriptor, JSON.stringify({ operation, path }) + '\n'); } finally { originalCloseSync(descriptor); } };`,
        "const patchSync = (name, operation) => { if (typeof fs[name] !== 'function') return; const original = fs[name].bind(fs); fs[name] = (...args) => { record(operation, args[0]); return original(...args); }; };",
        "for (const name of ['access', 'accessSync', 'createReadStream', 'existsSync', 'glob', 'lstat', 'lstatSync', 'open', 'openSync', 'opendir', 'readFile', 'readFileSync', 'readdir', 'readdirSync', 'realpath', 'realpathSync', 'stat', 'statSync']) patchSync(name, name === 'existsSync' ? 'exists' : 'read');",
        "for (const name of ['appendFile', 'appendFileSync', 'chmod', 'chmodSync', 'copyFile', 'copyFileSync', 'cp', 'createWriteStream', 'mkdir', 'mkdirSync', 'rename', 'renameSync', 'rm', 'rmSync', 'rmdir', 'rmdirSync', 'unlink', 'unlinkSync', 'writeFile', 'writeFileSync']) patchSync(name, 'write');",
        "const patchPromise = (name, operation) => { if (typeof fs.promises[name] !== 'function') return; const original = fs.promises[name].bind(fs.promises); fs.promises[name] = async (...args) => { record(operation, args[0]); return original(...args); }; };",
        "for (const name of ['access', 'glob', 'lstat', 'open', 'opendir', 'readFile', 'readdir', 'realpath', 'stat']) patchPromise(name, 'read');",
        "for (const name of ['appendFile', 'chmod', 'copyFile', 'cp', 'mkdir', 'rename', 'rm', 'rmdir', 'unlink', 'writeFile']) patchPromise(name, 'write');",
        'const originalStdoutWrite = process.stdout.write.bind(process.stdout);',
        "process.stdout.write = (chunk, ...args) => { const output = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk); if (output.includes('ENROLLMENT_CHOICE_REQUIRED')) record('choice', 'ENROLLMENT_CHOICE_REQUIRED'); return originalStdoutWrite(chunk, ...args); };",
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
    const artifactPath = nodePath.join(REPO_ROOT, artifact);
    assert.ok(existsSync(artifactPath), `${surface} artifact is missing: ${artifactPath}`);
    this.entryPoint = entryPoint;
    this.surface = surface;
    this.proofBoundary = proofBoundary;
  },
);

When(
  'that entry point is exercised until it first needs Safeword project state',
  function (this: QuietEnrollmentWorld) {
    const surface = required(this.surface, 'surface');
    assert.equal(surface, 'Safeword CLI', `${surface} installed-artifact harness is not wired yet`);
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
        nodePath.join(REPO_ROOT, 'packages/cli/dist/cli.js'),
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
          SAFEWORD_HOST_INTERACTIVE: '1',
          XDG_DATA_HOME: userDataRoot,
        },
      },
    );
    this.result = { stdout: result.stdout, stderr: result.stderr, exitCode: result.status ?? 1 };
    this.observedAccesses = observedEvents(observerLog);
    this.afterSnapshot = filesystemSnapshot([projectRoot, userDataRoot]);
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
    const expectedPartition = nodePath.join(
      userDataRoot,
      'safeword',
      'project-contexts',
      'v1',
      createHash('sha256').update(projectRoot).digest('hex'),
    );
    const choiceIndex = (this.observedAccesses ?? []).findIndex(
      event => event.operation === 'choice',
    );
    assert.notEqual(choiceIndex, -1, 'the observer did not record the enrollment choice');
    assert.equal(
      (this.observedAccesses ?? []).filter(event => event.operation === 'choice').length,
      1,
      'the observer recorded more than one enrollment choice',
    );
    const beforeChoice = (this.observedAccesses ?? []).slice(0, choiceIndex);
    const currentMarker = nodePath.join(projectRoot, '.safeword', 'SAFEWORD.md');
    const ancestorMarkers: string[] = [];
    let ancestor = nodePath.dirname(projectRoot);
    while (true) {
      ancestorMarkers.push(nodePath.join(ancestor, '.safeword', 'SAFEWORD.md'));
      const parent = nodePath.dirname(ancestor);
      if (parent === ancestor) break;
      ancestor = parent;
    }
    const globalMarker = nodePath.join(expectedPartition, 'partition.json');
    const safewordSegment = `${nodePath.sep}.safeword${nodePath.sep}`;
    const projectSegment = `${nodePath.sep}.project${nodePath.sep}`;
    const relevantBeforeChoice = beforeChoice.filter(
      event =>
        event.path === projectRoot ||
        event.path.startsWith(userDataRoot) ||
        event.path.includes(safewordSegment) ||
        event.path.includes(projectSegment),
    );
    assert.ok(
      beforeChoice.some(event => event.path === currentMarker),
      'the current repository marker was not checked',
    );
    assert.ok(
      beforeChoice.some(event => event.path === globalMarker),
      'the exact checkout-global partition was not checked before offering setup',
    );
    for (const ancestorMarker of ancestorMarkers) {
      assert.ok(
        beforeChoice.some(event => event.path === ancestorMarker),
        `ancestor repository marker was not checked before offering setup: ${ancestorMarker}`,
      );
    }
    assert.equal(
      relevantBeforeChoice.some(event => event.operation === 'write'),
      false,
      'Safeword-owned state was mutated before the enrollment choice',
    );
    assert.equal(
      required(this.afterSnapshot, 'after filesystem snapshot'),
      required(this.beforeSnapshot, 'before filesystem snapshot'),
      'the observed repository or user-data filesystem changed before the choice returned',
    );
    const allowedChecks = new Set([projectRoot, currentMarker, ...ancestorMarkers, globalMarker]);
    const unexpectedAccesses = relevantBeforeChoice.filter(
      event => event.operation !== 'choice' && !allowedChecks.has(event.path),
    );
    assert.equal(
      unexpectedAccesses.length,
      0,
      `state outside the enrollment checks was accessed before the enrollment choice: ${JSON.stringify(unexpectedAccesses)}`,
    );
  },
);
