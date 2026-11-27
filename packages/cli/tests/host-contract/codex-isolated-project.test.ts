import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { provisionIsolatedGrade } from '../helpers/codex-isolated-project.js';
import { workflowGitReadiness } from '../helpers/codex-workflow-git.js';
import { REVIEWER_CAPABILITIES } from '../review-fixtures.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
it('provisions a fresh valid Git grade with owned credentials, bound build and exact normal route', () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'isolated-project-control-'));
  const root = realpathSync(temporary);
  roots.push(root);
  const source = path.join(root, 'source-profile');
  mkdirSync(source);
  // Opaque non-credential bytes; this test never dispatches a model.
  const auth = '{"nonreceipt":"controlled-copy-only"}\n';
  writeFileSync(path.join(source, 'auth.json'), auth, { mode: 0o600 });
  const first = provisionIsolatedGrade(root, source);
  const second = provisionIsolatedGrade(root, source);
  expect(first.buildIdentity).toBe(second.buildIdentity);
  expect(first.project).not.toBe(second.project);
  expect(first.profile).not.toBe(second.profile);
  workflowGitReadiness(first.project, path.join(first.artifacts, 'test-git.json'));
  expect(first.binding).toEqual({
    project: first.project,
    profile: first.profile,
    runtime: path.join(first.installed, 'runtime/cli.js'),
  });
  expect(first.environment.CODEX_HOME).toBe(first.profile);
  expect(first.environment.SAFEWORD_REVIEW_KEY_ROOT).toBe(path.join(first.profile, 'state'));
  const config = readFileSync(path.join(first.project, '.safeword/config.json'), 'utf8');
  expect(JSON.parse(config)).toEqual({
    crossAgentReview: 'prefer',
    crossAgentReviewRoutes: {
      codex: [{ reviewer: 'codex', model: 'gpt-6-astra' }],
    },
  });
  expect(readFileSync(path.join(first.profile, 'auth.json'), 'utf8')).toBe(auth);
  expect(readFileSync(path.join(source, 'auth.json'), 'utf8')).toBe(auth);
  expect(statSync(path.join(first.profile, 'auth.json')).mode & 0o777).toBe(0o600);
  first.cleanupCredentials();
  second.cleanupCredentials();
  expect(existsSync(path.join(first.profile, 'auth.json'))).toBe(false);
  expect(existsSync(path.join(second.profile, 'auth.json'))).toBe(false);
  expect(readFileSync(path.join(source, 'auth.json'), 'utf8')).toBe(auth);
}, 30_000);

it.each([
  { foreground: '65000', budget: '4000', unsafe: false },
  { foreground: '10000', budget: '12000', unsafe: true },
  { foreground: '580000', budget: '570000', unsafe: true },
  { foreground: '4500', budget: '4000', unsafe: true },
])(
  'dispatches bound CLI with a coherent wait budget, %j',
  ({ foreground, budget, unsafe }) => {
    const repo = path.resolve(import.meta.dirname, '../../../..');
    const temporary = mkdtempSync(path.join(tmpdir(), 'isolated-dispatch-control-'));
    const root = realpathSync(temporary);
    roots.push(root);
    const authProfile = path.join(root, 'auth');
    mkdirSync(authProfile);
    writeFileSync(path.join(authProfile, 'auth.json'), '{"nonreceipt":"opaque-control"}');
    const f = provisionIsolatedGrade(root, authProfile);
    const bin = mkdtempSync(path.join(repo, 'node_modules/grader-dispatch-'));
    roots.push(bin);
    const stub = readFileSync(
      path.join(repo, 'packages/cli/tests/fixtures/host-contract/isolated-grader-reviewer.cjs'),
      'utf8',
    );
    writeFileSync(path.join(bin, 'codex'), `#!${process.execPath}\n${stub}`);
    chmodSync(path.join(bin, 'codex'), 0o700);
    writeFileSync(
      path.join(bin, 'control.json'),
      JSON.stringify({ fault: 'ok', help: REVIEWER_CAPABILITIES.codex }),
    );
    const selected = spawnSync(
      path.join(repo, 'scripts/dev'),
      ['bun', '--print', 'process.execPath'],
      { encoding: 'utf8' },
    );
    expect(selected.status).toBe(0);
    const probe = path.join(
      repo,
      'packages/cli/tests/fixtures/host-contract/dispatch-isolated-claim.mjs',
    );
    const trustState = process.env.XDG_STATE_HOME ?? path.join(homedir(), '.local/state');
    const miseState = process.env.MISE_STATE_DIR ?? path.join(trustState, 'mise');
    const run = spawnSync(
      selected.stdout.trim(),
      [
        probe,
        JSON.stringify({
          project: f.project,
          profile: f.profile,
          installed: f.installed,
          artifacts: f.artifacts,
          bun: selected.stdout.trim(),
        }),
      ],
      {
        cwd: f.project,
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          ...f.environment,
          MISE_STATE_DIR: miseState,
          PATH: `${bin}:/usr/bin:/bin`,
          NODE_ENV: 'development',
          XDG_STATE_HOME: path.join(f.profile, 'state'),
          SAFEWORD_REVIEW_FOREGROUND_MS: foreground,
          SAFEWORD_REVIEW_TIMEOUT_MS: '1200',
          SAFEWORD_REVIEW_RUN_BOUND_MS: budget,
        },
      },
    );
    if (unsafe) {
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain('unsafe isolated review wait budget');
      expect(existsSync(path.join(bin, 'observations.jsonl'))).toBe(false);
      f.cleanupCredentials();
      return;
    }
    expect(run.status, run.stderr).toBe(0);
    const result = JSON.parse(run.stdout);
    expect(result.accepted).toBe(true);
    expect(result.provenance).toMatchObject({
      actual_reviewer: 'codex',
      independence: 'degraded',
      confirmed_reviewer_model: { provider: 'openai', model: 'gpt-6-astra' },
    });
    const trace = readFileSync(path.join(bin, 'observations.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    expect(trace.find(row => row.args)?.args[0]).toBe('app-server');
    const packet = trace.find(row => row.packet).packet;
    expect(packet.logical_files).toEqual([{ path: 'claim.json', content: '{"claim":true}\n' }]);
    expect(packet.context_files[0].path).toBe('reference.md');
    expect(statSync(path.join(f.profile, 'state/safeword/review-integrity.key')).mode & 0o777).toBe(
      0o600,
    );
    f.cleanupCredentials();
  },
  40_000,
);

it('retains no copied auth when provisioning fails', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'isolated-provision-failure-'));
  roots.push(root);
  const source = path.join(root, 'missing-auth');
  mkdirSync(source);
  expect(() => provisionIsolatedGrade(root, source)).toThrow('ENOENT');
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' });
  expect(files.some(file => file.endsWith('auth.json'))).toBe(false);
}, 30_000);
