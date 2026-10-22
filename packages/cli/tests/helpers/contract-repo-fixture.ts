import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
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
  for (const relative of ['node_modules', 'packages/cli/node_modules'])
    symlinkSync(nodePath.join(repo, relative), nodePath.join(checkout, relative), 'dir');
  return checkout;
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
    result.status === 0 || result.status === (candidate ? 2 : 1),
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
