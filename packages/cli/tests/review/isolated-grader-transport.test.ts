import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { isolatedBuildIdentity } from '../helpers/codex-isolated-build.js';
import { createTrustedReviewerDirectory, REVIEWER_CAPABILITIES } from '../review-fixtures.js';

const repo = path.resolve(import.meta.dirname, '../../../..');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture(bound: boolean, fault = 'ok', wrong?: 'project' | 'profile' | 'runtime') {
  const temporary = mkdtempSync(path.join(tmpdir(), 'safeword-isolated-grade-'));
  const root = realpathSync(temporary);
  roots.push(root);
  // Outside the untrusted grading project; the normal runtime still checks
  // real ownership/modes of every executable ancestor. No trust-policy mocks.
  const bin = createTrustedReviewerDirectory('grader-process-');
  roots.push(bin);
  const project = path.join(root, 'project'),
    profile = path.join(root, 'profile');
  for (const dir of [project, profile]) mkdirSync(dir);
  const installed = path.join(root, 'package');
  cpSync(path.join(repo, 'packages/cli/codex-plugin'), installed, { recursive: true });
  const runtime = path.join(installed, 'runtime/cli.js');
  const scope = { project, profile, runtime };
  const binding = { ...scope, ...(wrong && { [wrong]: path.join(root, 'foreign') }) };
  const log = path.join(bin, 'observations.jsonl');
  cpSync(
    path.join(repo, 'packages/cli/tests/fixtures/host-contract/isolated-grader-reviewer.cjs'),
    path.join(bin, 'codex'),
  );
  writeFileSync(
    path.join(bin, 'codex'),
    `#!${process.execPath}\n${readFileSync(path.join(bin, 'codex'), 'utf8')}`,
    { mode: 0o700 },
  );
  chmodSync(path.join(bin, 'codex'), 0o700);
  writeFileSync(
    path.join(bin, 'control.json'),
    JSON.stringify({ fault, log, help: REVIEWER_CAPABILITIES.codex }),
  );
  const env = {
    ...process.env,
    PATH: `${bin}:/usr/bin:/bin`,
    CODEX_HOME: profile,
    XDG_STATE_HOME: path.join(profile, 'state'),
    SAFEWORD_AGENT_RUNTIME: 'codex',
    SAFEWORD_REVIEW_FOREGROUND_MS: '10000',
    SAFEWORD_REVIEW_TIMEOUT_MS: '1200',
    SAFEWORD_REVIEW_RUN_BOUND_MS: '4000',
    SAFEWORD_NO_UPDATE_CHECK: '1',
  };
  // Resolve the pin through the REAL trusted launcher before making vendor PATH
  // hermetic. Its absolute Bun also launches workers; no real model CLI is exposed.
  const selected = spawnSync(
    path.join(repo, 'scripts/dev'),
    ['bun', '--print', 'process.execPath'],
    { cwd: project, encoding: 'utf8' },
  );
  expect(selected.status, selected.stderr).toBe(0);
  const command = (args: string[]) =>
    spawnSync(selected.stdout.trim(), [runtime, ...args], {
      cwd: project,
      env,
      encoding: 'utf8',
      timeout: 20_000,
    });
  const build = spawnSync(
    path.join(repo, 'scripts/dev'),
    [
      'bun',
      path.join(repo, 'packages/cli/tests/fixtures/host-contract/build-isolated-grader.mjs'),
      repo,
      installed,
      bound ? JSON.stringify(binding) : 'null',
    ],
    { cwd: repo, encoding: 'utf8', timeout: 30_000 },
  );
  expect(build.status, build.stderr).toBe(0);
  mkdirSync(path.join(project, '.safeword'));
  writeFileSync(
    path.join(project, '.safeword/config.json'),
    JSON.stringify({
      crossAgentReview: 'prefer',
      crossAgentReviewRoutes: { codex: [{ reviewer: 'codex', model: 'gpt-6-astra' }] },
    }),
  );
  writeFileSync(path.join(project, 'claim.json'), '{"claim":"control"}\n');
  writeFileSync(path.join(project, 'reference.md'), 'Fixed reference control.\n');
  const run = command([
    'review',
    'run',
    'quality-review',
    '--agent-handoff',
    '--json',
    '--context',
    'reference.md',
    '--',
    'claim.json',
  ]);
  expect(run.error, run.stderr).toBeUndefined();
  expect(run.stdout, run.stderr).not.toBe('');
  const result = JSON.parse(run.stdout);
  const status = command(['review', 'status', result.data.review_id, '--json']);
  return {
    root,
    project,
    profile,
    runtime,
    scope,
    log,
    command,
    result,
    status: JSON.parse(status.stdout),
    trace: existsSync(log)
      ? readFileSync(log, 'utf8')
          .trim()
          .split('\n')
          .map(line => JSON.parse(line))
      : [],
  };
}

it('confirms only the owned bound quality-review through real status', () => {
  const f = fixture(true);
  expect(
    f.status.data.confirmed_reviewer_model,
    JSON.stringify({ status: f.status, trace: f.trace }),
  ).toEqual({
    provider: 'openai',
    model: 'gpt-6-astra',
  });
  expect(f.status.data.status).toBe('approved');
  expect(f.trace.find(row => row.args)?.args[0]).toBe('app-server');
}, 30_000);

it('keeps normal customer quality-review exec and unconfirmed', () => {
  const f = fixture(false);
  expect(f.status.data.status).toBe('approved');
  expect(f.status.data.confirmed_reviewer_model).toBeUndefined();
  expect(f.trace.find(row => row.args)?.args[0]).toBe('exec');
  expect(() => isolatedBuildIdentity(readFileSync(f.runtime, 'utf8'), f.scope)).toThrow(
    'unique binding',
  );
}, 30_000);

it('keeps two bound builds equivalent only outside the unique binding literal', () => {
  const a = fixture(true),
    b = fixture(true);
  const first = readFileSync(a.runtime, 'utf8'),
    second = readFileSync(b.runtime, 'utf8');
  expect(first).not.toBe(second);
  const identity = isolatedBuildIdentity(first, a.scope);
  expect(isolatedBuildIdentity(second, b.scope)).toBe(identity);
  expect(isolatedBuildIdentity(`${second}\n// changed compiler output`, b.scope)).not.toBe(
    identity,
  );
  expect(() => isolatedBuildIdentity(second, a.scope)).toThrow('unique binding');
  expect(() =>
    isolatedBuildIdentity(`${second}\n${JSON.stringify(JSON.stringify(b.scope))}`, b.scope),
  ).toThrow('unique binding');
}, 30_000);

it.each(['project', 'profile', 'runtime'] as const)(
  'terminates a wrong %s binding with an owned-scope diagnostic',
  wrong => {
    const f = fixture(true, 'ok', wrong);
    expect(f.status.data.status).not.toBe('approved');
    expect(f.status.data.confirmed_reviewer_model).toBeUndefined();
    expect(f.trace).toEqual([]);
    expect(JSON.stringify(f.status)).toContain('bound project, profile, and runtime');
    expect(JSON.stringify(f.status)).not.toContain('Update Codex');
  },
  30_000,
);

it('dispatches the actual claim/context/schema read-only and removes its ephemeral home', () => {
  const f = fixture(true);
  const launch = f.trace.find(row => row.args);
  expect(launch.args).toEqual(['app-server', '--stdio', '--config', 'mcp_servers={}']);
  expect(launch.home).not.toBe(f.profile);
  expect(existsSync(launch.home)).toBe(false);
  const thread = f.trace.find(row => row.method === 'thread/start');
  expect(thread.params).toMatchObject({
    ephemeral: true,
    sandbox: 'read-only',
    approvalPolicy: 'never',
    model: 'gpt-6-astra',
  });
  expect(thread.params.cwd).not.toBe(f.project);
  const turn = f.trace.find(row => row.method === 'turn/start');
  expect(turn.params.outputSchema.required).toContain('dispatch_id');
  const packet = f.trace.find(row => row.packet).packet;
  expect(packet.kind).toBe('quality-review');
  expect(JSON.stringify(packet)).toContain('Fixed reference control.');
  expect(JSON.stringify(packet)).toContain('control');
  expect(turn.params.input[0].text).toContain(JSON.stringify(packet));
}, 30_000);

it.each(['unsupported', 'mismatch', 'reroute', 'missing-model'])(
  'keeps %s transport unqualified',
  fault => {
    const f = fixture(true, fault);
    expect(f.status.data.status).toBe('approved');
    expect(f.status.data.confirmed_reviewer_model).toBeUndefined();
    expect(f.trace.find(row => row.args)?.args[0]).toBe(
      fault === 'unsupported' ? 'exec' : 'app-server',
    );
  },
  30_000,
);

it.each([
  'foreign',
  'duplicate-start',
  'missing-turn',
  'invalid',
  'bad-schema',
  'process',
  'timeout',
])(
  'does not qualify %s process evidence and cleans up every ephemeral home',
  fault => {
    const f = fixture(true, fault);
    expect(f.status.data.confirmed_reviewer_model).toBeUndefined();
    for (const launch of f.trace) {
      if (launch.args?.[0] !== 'app-server') continue;
      expect(existsSync(launch.home)).toBe(false);
    }
    // Existing unsupported-process fallback may yield an unconfirmed review;
    // it cannot authenticate a model merely from the requested route.
    expect(f.trace.some(row => row.args?.[0] === 'app-server')).toBe(true);
  },
  30_000,
);
