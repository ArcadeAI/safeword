import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import {
  createObserverCandidate,
  type ObserverCandidate,
  type ObserverCommand,
  type ObserverOutput,
} from './bounded-observation.js';
import { commitChangedInput } from './bounded-observation-currency.js';

export interface UnmappedDistribution {
  candidate: ObserverCandidate;
  entry: string;
  missingCase: string;
}

/** Build a disposable distribution with a missing shipped row; leave project census intact. */
export function createUnmappedDistribution(): UnmappedDistribution {
  const candidate = createObserverCandidate();
  try {
    const path = nodePath.join(candidate.root, 'packages/cli/src/bounded-observation/profile.json');
    const profile = JSON.parse(readFileSync(path, 'utf8')) as { cases: { case_id: string }[] };
    assert.equal(profile.cases.length, 37);
    const missing = profile.cases.shift();
    assert.ok(missing);
    writeFileSync(path, JSON.stringify(profile));
    commitChangedInput(candidate);
    const entry = 'packages/cli/dist/bounded-profile-probe.js';
    const built = spawnSync(
      'bun',
      [
        '--no-env-file',
        'build',
        'packages/cli/src/cli.ts',
        '--target=bun',
        '--packages=external',
        `--outfile=${entry}`,
      ],
      { cwd: candidate.root, env: candidate.environment, encoding: 'utf8', timeout: 60_000 },
    );
    assert.equal(built.error, undefined);
    assert.equal(built.status, 0, built.stdout + built.stderr);
    return { candidate, entry, missingCase: missing.case_id };
  } catch (error) {
    candidate.dispose();
    throw error;
  }
}

export function runUnmappedDistribution(distribution: UnmappedDistribution): ObserverCommand {
  const { candidate, entry } = distribution;
  const result = spawnSync(
    'bun',
    ['--no-env-file', entry, 'proof', 'observe-bounded-delivery', '--json', '--no-input'],
    {
      cwd: candidate.root,
      env: candidate.environment,
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  assert.equal(result.error, undefined, String(result.error));
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output: JSON.parse(result.stdout) as ObserverOutput,
  };
}

export function expectNamedUnmappedCase(
  distribution: UnmappedDistribution,
  result: ObserverCommand,
): void {
  assert.equal(result.exitCode, 2);
  assert.equal(result.output.data?.status, 'refused');
  assert.equal(result.output.data.authority, 'execution-only');
  const message = result.output.errors?.map(error => error.message).join('\n') ?? '';
  assert.ok(
    message.includes(distribution.missingCase),
    `Unmapped-case refusal must name the exact case identity: ${message}`,
  );
  assert.match(message, /review.*complete.*mapping/iu);
  assert.equal(existsSync(result.output.data.report_path), false);
  const diagnosticPath = nodePath.join(
    nodePath.dirname(result.output.data.report_path),
    'diagnostic.log',
  );
  assert.equal(
    readFileSync(diagnosticPath, 'utf8').includes('preparing an independent committed clone'),
    false,
  );
}
