import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { setTimeout as pollDelay } from 'node:timers/promises';

import { fixedRunnerTimeoutMs } from '../../src/bounded-observation/contract.js';
import {
  createObserverCandidate,
  type ObserverCandidate,
  type ObserverCommand,
  type ObserverOutput,
  reviewedObserverMapping,
} from './bounded-observation.js';
import {
  candidateGit,
  commitChangedInput,
  requiredSource,
} from './bounded-observation-currency.js';

interface ProcessExit {
  code: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface PausedObservation {
  candidate: ObserverCandidate;
  marker: string;
  release: string;
  child: ChildProcess;
  completed: Promise<ProcessExit>;
  exited(): boolean;
}

function launch(candidate: ObserverCandidate, marker: string, release: string): PausedObservation {
  const child = spawn(
    'bun',
    [
      '--no-env-file',
      'packages/cli/src/cli.ts',
      'proof',
      'observe-bounded-delivery',
      '--json',
      '--no-input',
    ],
    { cwd: candidate.root, env: candidate.environment, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stdout = '';
  let stderr = '';
  let error: Error | undefined;
  let exited = false;
  child.stdout.on('data', (bytes: Buffer) => {
    stdout += bytes.toString();
  });
  child.stderr.on('data', (bytes: Buffer) => {
    stderr += bytes.toString();
  });
  child.once('error', problem => {
    error = problem;
  });
  const completed = new Promise<ProcessExit>(resolve => {
    child.once('close', code => {
      exited = true;
      resolve({ code, stdout, stderr, error });
    });
  });
  return { candidate, marker, release, child, completed, exited: () => exited };
}

async function waitForPause(run: PausedObservation): Promise<void> {
  const deadline = Date.now() + fixedRunnerTimeoutMs + 60_000;
  while (!existsSync(run.marker)) {
    if (run.exited()) {
      const exit = await run.completed;
      throw new Error(
        `Observer exited before the controlled pause: ${exit.stderr}${exit.stdout.slice(0, 2000)}`,
      );
    }
    assert.ok(Date.now() < deadline, 'The real fixed assertion must reach its controlled pause');
    // Poll an observable marker rather than assuming a delay means the runner started.
    await pollDelay(25);
  }
}

export async function pauseObservation(): Promise<PausedObservation> {
  const candidate = createObserverCandidate();
  let run: PausedObservation | undefined;
  try {
    const marker = nodePath.join(candidate.directory, 'assertion-entered');
    const release = nodePath.join(candidate.directory, 'assertion-release');
    const path = nodePath.join(candidate.root, requiredSource);
    const original = readFileSync(path, 'utf8');
    const declaration =
      "it('asks every phase to check both omissions and overreach against accepted authority', () => {";
    assert.equal(original.split(declaration).length, 2);
    const paused = `${declaration.replace('() =>', 'async () =>')}
    const observerFs = await import('node:fs/promises');
    await observerFs.writeFile(${JSON.stringify(marker)}, 'entered');
    const observerDeadline = Date.now() + 45_000;
    while (true) {
      try { await observerFs.access(${JSON.stringify(release)}); break; }
      catch {
        if (Date.now() > observerDeadline) throw new Error('Controlled pause was not released');
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
`;
    writeFileSync(
      path,
      original.replace(declaration, () => paused),
    );
    commitChangedInput(candidate);
    run = launch(candidate, marker, release);
    await waitForPause(run);
    return run;
  } catch (error) {
    if (run !== undefined) {
      run.child.kill('SIGTERM');
      await run.completed;
    }
    candidate.dispose();
    throw error;
  }
}

export function releaseObservation(run: PausedObservation): void {
  writeFileSync(run.release, 'released');
}

export async function finishObservation(run: PausedObservation): Promise<ObserverCommand> {
  const exit = await run.completed;
  assert.equal(exit.error, undefined, String(exit.error));
  assert.ok(
    exit.stdout.startsWith('{'),
    `Observer must emit a complete JSON result: ${exit.stderr}`,
  );
  return {
    exitCode: exit.code,
    stdout: exit.stdout,
    stderr: exit.stderr,
    output: JSON.parse(exit.stdout) as ObserverOutput,
  };
}

export function advancePausedCandidate(run: PausedObservation): void {
  candidateGit(run.candidate, [
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'commit.gpgsign=false',
    '-c',
    'user.name=SYNTHETIC_OBSERVER',
    '-c',
    'user.email=observer@example.invalid',
    'commit',
    '--quiet',
    '--allow-empty',
    '-m',
    'Controlled mid-run candidate advance',
  ]);
  run.candidate.commit = candidateGit(run.candidate, ['rev-parse', 'HEAD']);
}

export async function disposePausedObservation(run: PausedObservation): Promise<void> {
  if (!run.exited()) {
    releaseObservation(run);
    run.child.kill('SIGTERM');
    await run.completed;
  }
  run.candidate.dispose();
}

export function attemptBytes(result: ObserverCommand): Record<string, Buffer> {
  const report = result.output.data?.report_path;
  assert.ok(report);
  const directory = nodePath.dirname(report);
  return Object.fromEntries(
    readdirSync(directory).map(name => [name, readFileSync(nodePath.join(directory, name))]),
  );
}

export function failedRunnerCandidate(): ObserverCandidate {
  const candidate = createObserverCandidate();
  try {
    const path = nodePath.join(
      candidate.root,
      'packages/cli/scripts/run-vitest-with-build-lock.mjs',
    );
    appendFileSync(path, '\n// Controlled post-report process failure.\nprocess.exitCode = 1;\n');
    commitChangedInput(candidate);
    return candidate;
  } catch (error) {
    candidate.dispose();
    throw error;
  }
}

export function expectPassingReportOnFailedRunner(result: ObserverCommand): void {
  assert.equal(result.exitCode, 2);
  assert.equal(result.output.data?.status, 'refused');
  const data = result.output.data;
  const report = JSON.parse(readFileSync(data.report_path, 'utf8')) as {
    success: boolean;
    numFailedTests: number;
    testResults: { name: string; assertionResults: { fullName: string; status: string }[] }[];
  };
  assert.equal(report.success, true, 'This control requires a real complete passing report');
  assert.equal(report.numFailedTests, 0);
  const requiredAssertions = reviewedObserverMapping.cases.flatMap(row => row.required_assertions);
  for (const required of requiredAssertions) {
    const matches = report.testResults
      .filter(file => file.name.endsWith(required.file))
      .flatMap(file =>
        file.assertionResults.filter(assertion => assertion.fullName === required.full_name),
      );
    assert.equal(matches.length, 1, required.full_name);
    assert.equal(matches[0]?.status, 'passed', required.full_name);
  }
  const message = result.output.errors?.map(error => error.message).join('\n') ?? '';
  assert.match(message, /Fixed runner failed/iu);
  assert.match(message, /repair.*rerun/iu);
  const path = nodePath.join(nodePath.dirname(data.report_path), 'diagnostic.log');
  assert.match(readFileSync(path, 'utf8'), /Fixed runner failed/iu);
}
