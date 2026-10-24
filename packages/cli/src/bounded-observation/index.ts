import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  closeSync,
  constants,
  cpSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import {
  canonical,
  deliveryTicket,
  digest,
  fixedFiles,
  gradeReport,
  profileSha256,
  purpose,
  validateCandidateContract,
} from './contract.js';
import {
  canonicalRoot,
  dependencyIdentity,
  dependencyRoots,
  git,
  requireCleanInputs,
  sourceIdentity,
} from './identity.js';
import {
  artifactDigests,
  attemptPath,
  type AttemptStart,
  type AttemptTerminal,
  openStore,
  publishRecord,
  readRecord,
  reserveAttempt,
} from './store.js';
import {
  controlledEnvironment,
  executionToolDetails,
  runtimeIdentity,
  type ToolDetails,
  toolInventory,
  toolPath,
} from './tools.js';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function currentInputs(root: string): Record<string, string> {
  requireCleanInputs(root);
  validateCandidateContract(root);
  return {
    ...sourceIdentity(root),
    ...dependencyIdentity(root),
    ...toolInventory(root).identities,
  };
}

function requireIdentical(before: Record<string, string>, after: Record<string, string>): void {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (before[key] !== after[key])
      throw new Error(`Changed input ${key}; observe the new committed candidate`);
  }
}

function prepareRelay(
  bun: string,
  clone: string,
  environment: NodeJS.ProcessEnv,
  diagnostic: string,
): void {
  const prepared = spawnSync(bun, ['run', '--cwd', 'packages/retro-relay', 'build'], {
    cwd: clone,
    env: environment,
    encoding: 'utf8',
    timeout: 60_000,
  });
  appendFileSync(
    diagnostic,
    `Fixed relay preparation (exit ${prepared.status}):\n${prepared.stdout}${prepared.stderr}\n`,
  );
  if (prepared.status !== 0)
    throw new Error(
      'Fixed relay preparation failed; restore the pinned installed dependencies and rerun',
    );
}

function signalOwnedTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (process.platform !== 'win32' && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      /* Fall back to the owned direct child if its process group has already gone. */
    }
  }
  child.kill(signal);
}

function retainedReportProblem(directory: string, cwd: string): string {
  const report = nodePath.join(directory, 'report.json');
  if (!existsSync(report)) return '';
  try {
    gradeReport(readFileSync(report), nodePath.resolve(cwd, '../..'));
    return '';
  } catch (error) {
    return `; ${errorText(error)}`;
  }
}

function runFixedLane(
  executable: string,
  argv: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
  directory: string,
): Promise<void> {
  const stdout = openSync(nodePath.join(directory, 'stdout.log'), 'wx', 0o600);
  const stderr = openSync(nodePath.join(directory, 'stderr.log'), 'wx', 0o600);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argv, {
      cwd,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let interrupted = false;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const interrupt = (): void => {
      if (interrupted) return;
      interrupted = true;
      signalOwnedTree(child, 'SIGTERM');
      escalation = setTimeout(() => {
        signalOwnedTree(child, 'SIGKILL');
      }, 5000);
    };
    process.once('SIGTERM', interrupt);
    process.once('SIGINT', interrupt);
    const timer = setTimeout(interrupt, 600_000);
    child.stdout.on('data', (bytes: Buffer) => {
      writeSync(stdout, bytes);
      fsyncSync(stdout);
    });
    child.stderr.on('data', (bytes: Buffer) => {
      writeSync(stderr, bytes);
      fsyncSync(stderr);
    });
    const finish = (): void => {
      clearTimeout(timer);
      clearTimeout(escalation);
      process.removeListener('SIGTERM', interrupt);
      process.removeListener('SIGINT', interrupt);
      closeSync(stdout);
      closeSync(stderr);
    };
    let processError: Error | undefined;
    child.once('error', error => {
      processError = error;
    });
    child.once('close', (code, signal) => {
      finish();
      if (processError !== undefined) {
        reject(processError);
        return;
      }
      if (interrupted || code !== 0 || signal !== null) {
        reject(
          new Error(
            `Fixed runner ${interrupted ? 'interrupted or timed out' : 'failed'} (exit ${code}, signal ${signal}); repair the lane and rerun${retainedReportProblem(directory, cwd)}`,
          ),
        );
      } else resolve();
    });
  });
}

export async function observeBoundedDelivery(cwd: string): Promise<AttemptTerminal> {
  const root = canonicalRoot(cwd);
  const store = openStore(root, true);
  const { id, directory } = reserveAttempt(store);
  const workPrefix = nodePath.join(tmpdir(), 'safeword-bounded-');
  const work = realpathSync(mkdtempSync(workPrefix));
  const clone = nodePath.join(work, 'candidate');
  const report = nodePath.join(directory, 'report.json');
  const command = {
    public_argv: ['proof', 'observe-bounded-delivery'],
    runner_argv: [
      'bun',
      'run',
      'test',
      ...fixedFiles,
      '--no-cache',
      '--retry=0',
      '--reporter=json',
      `--outputFile=${report}`,
    ],
  };
  let start: AttemptStart = {
    schema_version: 1,
    purpose,
    authority: 'execution-only',
    ticket: deliveryTicket,
    root,
    attempt_id: id,
    candidate_commit: git(root, ['rev-parse', 'HEAD']).trim(),
    profile_sha256: profileSha256,
    runtime_sha256: runtimeIdentity(),
    inputs: {},
    command,
    clone,
    started_at: new Date().toISOString(),
  };
  let published = false;
  const diagnostic = nodePath.join(directory, 'diagnostic.log');
  appendFileSync(diagnostic, 'Reserved execution-only observation; preflight beginning.\n', {
    mode: 0o600,
  });
  const oldMask = process.umask(0o077);
  let resolvedTools: Record<string, ToolDetails> = {};
  let executionEnvironment: NodeJS.ProcessEnv = {};
  try {
    start = { ...start, inputs: currentInputs(root) };
    publishRecord(store, directory, 'start', start);
    published = true;
    appendFileSync(diagnostic, 'Inputs bound; preparing an independent committed clone.\n');
    const tools = toolInventory(root);
    const bin = nodePath.join(work, 'bin');
    const home = nodePath.join(work, 'home');
    const temporary = nodePath.join(work, 'tmp');
    const probeHome = nodePath.join(work, 'version-probes');
    for (const path of [bin, home, temporary, probeHome]) mkdirSync(path, { mode: 0o700 });
    const environment = controlledEnvironment(tools, bin, home, temporary);
    environment.PATH = [
      bin,
      nodePath.join(clone, 'packages/cli/node_modules/.bin'),
      nodePath.join(clone, 'node_modules/.bin'),
    ].join(nodePath.delimiter);
    executionEnvironment = environment;
    const copied = spawnSync(
      toolPath(tools, 'git'),
      [
        '-c',
        'core.hooksPath=/dev/null',
        'clone',
        '--no-local',
        '--no-hardlinks',
        '--no-checkout',
        '--no-recurse-submodules',
        '--',
        root,
        clone,
      ],
      { encoding: 'utf8', env: environment, timeout: 60_000 },
    );
    if (copied.status !== 0) throw new Error(`Candidate clone failed: ${copied.stderr}`);
    git(clone, ['checkout', '--detach', start.candidate_commit]);
    requireIdentical(sourceIdentity(root), sourceIdentity(clone));
    for (const relative of dependencyRoots(root)) {
      cpSync(nodePath.join(root, relative), nodePath.join(clone, relative), {
        recursive: true,
        verbatimSymlinks: true,
        mode: constants.COPYFILE_FICLONE,
      });
    }
    requireIdentical(dependencyIdentity(root), dependencyIdentity(clone));
    resolvedTools = executionToolDetails(tools, root, clone, environment, probeHome);
    const cloneInputs = sourceIdentity(clone);
    const cloneDependencies = dependencyIdentity(clone);
    prepareRelay(toolPath(tools, 'bun'), clone, environment, diagnostic);
    appendFileSync(
      diagnostic,
      'Running the fixed eleven-file lane plus registration; no qualification authority.\n',
    );
    await runFixedLane(
      toolPath(tools, 'bun'),
      command.runner_argv.slice(1),
      nodePath.join(clone, 'packages/cli'),
      environment,
      directory,
    );
    const bytes = readFileSync(report);
    const results = gradeReport(bytes, clone);
    requireIdentical(cloneInputs, sourceIdentity(clone));
    requireIdentical(cloneDependencies, dependencyIdentity(clone));
    requireIdentical(start.inputs, currentInputs(root));
    if (
      git(root, ['rev-parse', 'HEAD']).trim() !== start.candidate_commit ||
      git(clone, ['rev-parse', 'HEAD']).trim() !== start.candidate_commit
    ) {
      throw new Error('Candidate advanced during execution; rerun on a stable committed candidate');
    }
    appendFileSync(
      diagnostic,
      'Complete passing required results and unchanged identities; publishing execution-only observation.\n',
    );
    const terminal: AttemptTerminal = {
      ...start,
      status: 'observed',
      tools: resolvedTools,
      execution_environment: executionEnvironment,
      finished_at: new Date().toISOString(),
      report_path: report,
      report_sha256: digest(bytes),
      artifacts: artifactDigests(directory),
      case_results: results,
    };
    publishRecord(store, directory, 'terminal', terminal);
    return terminal;
  } catch (error) {
    const problem = errorText(error);
    appendFileSync(diagnostic, `${problem}\n`);
    if (!published) publishRecord(store, directory, 'start', start);
    const terminal: AttemptTerminal = {
      ...start,
      status: problem.includes('interrupted') ? 'interrupted' : 'refused',
      tools: resolvedTools,
      execution_environment: executionEnvironment,
      finished_at: new Date().toISOString(),
      problem,
      report_path: report,
      report_sha256: existsSync(report) ? digest(readFileSync(report)) : '',
      artifacts: artifactDigests(directory),
      case_results: [],
    };
    publishRecord(store, directory, 'terminal', terminal);
    return terminal;
  } finally {
    process.umask(oldMask);
    rmSync(work, { recursive: true, force: true });
  }
}

export function verifyBoundedDelivery(
  cwd: string,
  id: string,
): AttemptTerminal & { current: boolean } {
  const root = canonicalRoot(cwd);
  const store = openStore(root, false);
  const directory = attemptPath(store, id);
  const start = readRecord(store, directory, 'start', root, id);
  if (!existsSync(nodePath.join(directory, 'terminal.json'))) {
    throw new Error(
      `Attempt ${id} is incomplete; liveness unknown. Retained diagnostics: ${directory}. Retry with a new observation`,
    );
  }
  const terminal = readRecord(store, directory, 'terminal', root, id) as AttemptTerminal;
  for (const [key, value] of Object.entries(start)) {
    if (canonical(value) !== canonical(terminal[key as keyof AttemptTerminal]))
      throw new Error(`Mixed attempt identity ${key}`);
  }
  if (canonical(terminal.artifacts) !== canonical(artifactDigests(directory)))
    throw new Error(
      'Altered report or diagnostics; preserve this attempt and run a new observation',
    );
  if (terminal.status !== 'observed')
    throw new Error(
      `Attempt ${id} is ${terminal.status}: ${terminal.problem}; retain it and run a new observation`,
    );
  if (terminal.report_path !== nodePath.join(directory, 'report.json'))
    throw new Error('Foreign report path');
  const bytes = readFileSync(terminal.report_path);
  if (
    digest(bytes) !== terminal.report_sha256 ||
    canonical(gradeReport(bytes, terminal.clone)) !== canonical(terminal.case_results)
  ) {
    throw new Error(
      'Altered or incomplete required results; preserve the attempt and observe again',
    );
  }
  requireIdentical(terminal.inputs, currentInputs(root));
  if (terminal.runtime_sha256 !== runtimeIdentity())
    throw new Error('Changed observer runtime; run a new observation');
  return { ...terminal, current: true };
}
