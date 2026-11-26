/* eslint-disable unicorn/no-top-level-assignment-in-function -- Private fixture lifecycle is owned by Vitest hooks. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const baseline = 'f48275b5e616010f3ce76bf5baf7329603f9ac57';
const emitter = 'packages/cli/src/host-contract/owner-inventory.ts';
let directory: string, controller: string, candidate: string;
function git(...args: string[]) {
  const result = spawnSync(
    'git',
    ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
    {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'fixture',
        GIT_AUTHOR_EMAIL: 'fixture@invalid',
        GIT_COMMITTER_NAME: 'fixture',
        GIT_COMMITTER_EMAIL: 'fixture@invalid',
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function commit(...paths: string[]) {
  if (paths.length > 0) git('add', '--', ...paths);
  git('commit', '--allow-empty', '-qm', 'private owner-current control');
  return git('rev-parse', 'HEAD');
}
function check(revision = candidate, preload?: string) {
  const result = spawnSync(
    'bun',
    [
      ...(preload ? ['--preload', preload] : []),
      nodePath.join(controller, 'packages/cli/scripts/check-host-contract.ts'),
      '--owner-delta',
      '--baseline',
      baseline,
      '--candidate',
      revision,
      '--json',
    ],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, XDG_STATE_HOME: nodePath.join(directory, 'private-state') },
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal ?? undefined, undefined);
  const report = JSON.parse(result.stdout);
  expect(report.errors, result.stderr).toEqual([]);
  expect(result.status).toBe(report.state === 'healthy' ? 0 : 2);
  return { status: result.status, report };
}
function rejected(result: ReturnType<typeof check>, code: string) {
  expect(result.status).toBe(2);
  expect(result.report.findings).toContainEqual(expect.objectContaining({ code }));
  expect(result.report.data.owner_delta.outcome).toBe('failed');
  expect(result.report.data.inventory_complete).toBe(false);
  expect(result.report.data.admission_eligible).toBe(false);
}
beforeAll(() => {
  controller = createContractRepoFixture({ generated: false });
  directory = createContractRepoFixture();
  const history = nodePath.join(directory, '.git');
  assert.ok(lstatSync(history).isSymbolicLink());
  rmSync(history); // Remove only this fixture's read-only history link.
  const clone = `${directory}-history`;
  const result = spawnSync(
    'git',
    [
      'clone',
      '--shared',
      '--no-checkout',
      '-q',
      nodePath.resolve(import.meta.dirname, '../../../..'),
      clone,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  renameSync(nodePath.join(clone, '.git'), history);
  rmSync(clone, { recursive: true, force: true });
  git('read-tree', 'HEAD');
  git('add', '-A', '--', '.', ':!node_modules', ':!packages/cli/node_modules');
  candidate = commit();
}, 60_000);
afterAll(() => {
  rmSync(nodePath.dirname(controller), { recursive: true, force: true });
  rmSync(nodePath.dirname(directory), { recursive: true, force: true });
});
beforeEach(() => {
  // This is independent private metadata, never the shared history link.
  assert.equal(lstatSync(nodePath.join(directory, '.git')).isSymbolicLink(), false);
  git('reset', '--mixed', candidate);
});

it('binds the exact candidate inputs without importing candidate code, and repairs', () => {
  const path = nodePath.join(directory, 'packages/cli/scripts/check-host-contract.ts');
  const original = readFileSync(path, 'utf8');
  const marker = nodePath.join(nodePath.dirname(directory), 'candidate-executed');
  writeFileSync(
    path,
    `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'executed'); throw new Error('unchecked candidate');`,
  );
  const foreign = commit('packages/cli/scripts/check-host-contract.ts');
  writeFileSync(path, original); // The executing trusted controller stays original.
  rejected(check(foreign), 'OWNER_CAPTURE_CURRENT_INPUT_MISMATCH');
  expect(existsSync(marker)).toBe(false);
  expect(check().status).toBe(0);
}, 120_000);

it('detects an agent removed from both candidate lists using the reviewed checker', () => {
  const releases = 'packages/cli/src/lifecycle/host-releases.json';
  const targets = 'packages/cli/tests/fixtures/host-contract/targets.json';
  const checker = 'packages/cli/scripts/check-host-contract.ts';
  const releasePath = nodePath.join(directory, releases);
  const targetPath = nodePath.join(directory, targets);
  const checkerPath = nodePath.join(directory, checker);
  const originals = new Map(
    [releasePath, targetPath, checkerPath].map(path => [path, readFileSync(path, 'utf8')]),
  );
  const declarations = JSON.parse(readFileSync(releasePath, 'utf8'));
  const expected = JSON.parse(readFileSync(targetPath, 'utf8'));
  const missing = expected.targets.find((row: { agent: string }) => row.agent === 'codex');
  assert.ok(missing);
  delete declarations.codex;
  expected.targets = expected.targets.filter((row: { agent: string }) => row.agent !== 'codex');
  const marker = nodePath.join(nodePath.dirname(directory), 'candidate-checker-ran');
  try {
    writeFileSync(releasePath, JSON.stringify(declarations));
    writeFileSync(targetPath, JSON.stringify(expected));
    writeFileSync(
      checkerPath,
      `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'ran');`,
    );
    const result = check(commit(releases, targets, checker));
    rejected(result, 'HOST_CONTRACT_TARGET_UNDECLARED');
    expect(result.report.findings).toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_TARGET_UNDECLARED',
        message: `codex:${missing.version}:CLI:native`,
      }),
    );
    expect(existsSync(marker)).toBe(false);
  } finally {
    for (const [path, original] of originals) writeFileSync(path, original);
  }
}, 120_000);

it('requires the candidate handler declarations to match the reviewed modules', () => {
  const relative = 'packages/cli/src/lifecycle/integrations.ts';
  const path = nodePath.join(directory, relative);
  const original = readFileSync(path, 'utf8');
  try {
    writeFileSync(
      path,
      original.replace(
        'export const CURRENT_HOST_RELEASES = hostReleases;',
        'export const CURRENT_HOST_RELEASES = {};',
      ),
    );
    const result = check(commit(relative));
    rejected(result, 'HOST_CONTRACT_REVIEWED_MODULE_MISMATCH');
    expect(result.report.findings).toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_REVIEWED_MODULE_MISMATCH',
        message: relative,
      }),
    );
  } finally {
    writeFileSync(path, original);
  }
}, 120_000);

it.each([
  [
    'extra link',
    'if (owner) links.push(owner);',
    "if (owner) links.push(owner); links.push('behavior:session.quality-state-cleanup');",
    'HOST_CONTRACT_GRAPH_LINK_EXTRA',
  ],
  [
    'wrong owner',
    'return { identity, owner, facets: [...new Set(links)] };',
    "return { identity, owner: 'packages/cli/templates/SAFEWORD.md', facets: [...new Set(links)] };",
    'HOST_CONTRACT_GRAPH_OWNER_MISMATCH',
  ],
  [
    'duplicate registration',
    '  validateGraph(\n',
    '  registrations.push(registrations[0]!);\n  validateGraph(\n',
    'HOST_CONTRACT_GRAPH_REGISTRATION_DUPLICATE',
  ],
  [
    'duplicate source',
    '  validateGraph(\n',
    '  nodes.push(nodes[0]!);\n  validateGraph(\n',
    'HOST_CONTRACT_GRAPH_NODE_DUPLICATE',
  ],
  [
    'foreign lane',
    '    applicable,\n    reason,',
    '    applicable: false,\n    reason,',
    'HOST_CONTRACT_GRAPH_LANE_LINK_MISSING',
  ],
  [
    'missing semantic link',
    'behaviors.map(row => `behavior:${row.behavior_id}`)',
    '[]',
    'HOST_CONTRACT_GRAPH_LINK_MISSING',
  ],
] as const)(
  'refuses to seal a passing current graph with %s, then repairs',
  (_name, from, to, code) => {
    const path = nodePath.join(controller, emitter);
    const original = readFileSync(path, 'utf8');
    expect(original).toContain(from);
    writeFileSync(
      path,
      original.replace(from, () => to),
    );
    try {
      rejected(check(), code);
    } finally {
      writeFileSync(path, original);
    }
    expect(check().status).toBe(0);
  },
  120_000,
);

it('revalidates actual input bytes after the real graph subprocess before publication', () => {
  const path = nodePath.join(directory, 'README.md');
  const original = readFileSync(path);
  const parent = nodePath.dirname(directory);
  const receipt = nodePath.join(parent, 'child-exit.json');
  const preload = nodePath.join(parent, 'change-after-child.mjs');
  // Substitute only the external process boundary. Execute the real checker;
  // after it returns, change owned input bytes before the controller resumes.
  writeFileSync(
    preload,
    String.raw`
import cp from 'node:child_process';
import {mock} from 'bun:test';
import {appendFileSync,writeFileSync} from 'node:fs';
const original = cp.spawnSync;
mock.module('node:child_process', () => ({...cp, spawnSync(program,args,options) {
  const result = original(program,args,options);
  if (args?.[0] === 'packages/cli/scripts/check-host-contract.ts' && args?.[1] === '--json') {
    writeFileSync(${JSON.stringify(receipt)}, JSON.stringify({status:result.status}));
    appendFileSync(${JSON.stringify(path)}, '\nchanged during capture\n');
  }
  return result;
}}));
`,
  );
  try {
    rejected(check(candidate, preload), 'OWNER_CAPTURE_CURRENT_INPUT_MISMATCH');
    expect(JSON.parse(readFileSync(receipt, 'utf8'))).toEqual({ status: 0 });
  } finally {
    writeFileSync(path, original);
  }
  expect(check().status).toBe(0);
}, 120_000);

it('the ordinary repository check rejects stale generated output and accepts the repair', () => {
  const relative = 'plugin/runtime/cli.js';
  const path = nodePath.join(directory, relative);
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, `${original}\n// stale private bundle\n`);
  try {
    const result = runContractRepoCheck(directory);
    expect(result.status).toBe(2);
    expect(result.output).toContain('HOST_CONTRACT_GENERATED_OUTPUT_STALE');
  } finally {
    writeFileSync(path, original);
  }
  expect(runContractRepoCheck(directory).status).toBe(0);
}, 120_000);
