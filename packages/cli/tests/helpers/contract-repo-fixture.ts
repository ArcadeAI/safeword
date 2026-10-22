import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

const repo = nodePath.resolve(import.meta.dirname, '../../../..');

function run(program: string, args: string[], cwd: string) {
  const result = spawnSync(program, args, {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(
    result.error,
    undefined,
    `HOST_CONTRACT_PROOF_UNAVAILABLE: ${result.error?.message}`,
  );
  assert.equal(
    result.signal ?? undefined,
    undefined,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: repository process signalled',
  );
  return result;
}

function overlayTrackedFiles(checkout: string, paths: string, remove: boolean): void {
  for (const relative of paths.split('\0')) {
    if (relative === '') continue;
    const target = nodePath.join(checkout, relative);
    rmSync(target, { recursive: true, force: true });
    if (!remove) {
      mkdirSync(nodePath.dirname(target), { recursive: true });
      cpSync(nodePath.join(repo, relative), target, { recursive: true });
    }
  }
}

function overlayTrackedChanges(checkout: string): void {
  for (const [filter, remove] of [
    ['D', true],
    ['ACMT', false],
  ] as const) {
    const changed = run(
      'git',
      ['diff', '--no-renames', '--name-only', `--diff-filter=${filter}`, 'HEAD', '-z'],
      repo,
    );
    assert.equal(changed.status, 0);
    overlayTrackedFiles(checkout, changed.stdout, remove);
  }
}

/** Real tracked repository plus current source under test, with no shared writes. */
export function createContractRepoFixture(): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-contract-repository-'));
  const checkout = nodePath.join(directory, 'repository');
  mkdirSync(checkout);
  const archive = nodePath.join(directory, 'repository.tar');
  assert.equal(run('git', ['archive', 'HEAD', '--output', archive], repo).status, 0);
  assert.equal(run('tar', ['-xf', archive, '-C', checkout], repo).status, 0);
  for (const relative of [
    'packages/cli/src',
    'packages/cli/scripts',
    'packages/cli/templates',
    'packages/opencode-v2-plugin/src',
    'scripts',
  ])
    cpSync(nodePath.join(repo, relative), nodePath.join(checkout, relative), {
      recursive: true,
    });
  overlayTrackedChanges(checkout);
  for (const relative of ['node_modules', 'packages/cli/node_modules'])
    symlinkSync(nodePath.join(repo, relative), nodePath.join(checkout, relative), 'dir');
  return checkout;
}

function validIncompleteReport(status: number | null, stdout: string): boolean {
  if (status !== 3) return false;
  const report = JSON.parse(stdout) as { state?: string; errors?: unknown[] };
  return report.state === 'action_required' && report.errors?.length === 0;
}

/** Use today's required repository check until its contract-aware successor exists. */
export function runContractRepoCheck(directory: string) {
  const entrypoint = 'packages/cli/scripts/check-host-contract.ts';
  const candidate = existsSync(nodePath.join(directory, entrypoint));
  const result = run(
    'bun',
    candidate ? [entrypoint, '--json'] : ['scripts/parity-check.ts', '--mode=all'],
    directory,
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.ok(
    result.status === 0 ||
      result.status === (candidate ? 2 : 1) ||
      (candidate && validIncompleteReport(result.status, result.stdout)),
    `HOST_CONTRACT_PROOF_UNAVAILABLE: repository checker failed outside its result boundary\n${output}`,
  );
  return {
    status: result.status,
    output,
    entrypoint: candidate ? entrypoint : 'scripts/parity-check.ts',
  };
}

export function fixtureSource(directory: string, path: string): string {
  return readFileSync(nodePath.join(directory, path), 'utf8');
}
