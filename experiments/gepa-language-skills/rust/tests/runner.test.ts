import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadRustTaskManifest } from '../src/dataset';
import { buildRustSandboxRunPlan } from '../src/executor';
import {
  appendRustRunArtifact,
  executeRustSandboxRun,
  type RustProcessInvocation,
  type RustProcessResult,
} from '../src/runner';

const repoRoot = join(import.meta.dirname, '../../../..');
const pilotManifestPath = join(repoRoot, 'experiments/gepa-language-skills/rust/tasks/pilot.json');

const runContext = {
  modelFamily: 'gpt-codex' as const,
  candidateSkillId: 'no-skill',
  agentTrace: 'Agent inspected the failing Rust task and produced a patch.',
  patchSummary: 'Candidate patch updates filesystem traversal behavior.',
  secondaryMetrics: {
    diffLines: 8,
    durationMs: 1200,
    lintWarnings: 0,
    testQuality: 0.8,
  },
};

const okResult = (stdout = ''): RustProcessResult => ({
  exitCode: 0,
  stdout,
  stderr: '',
  durationMs: 10,
});

function fixtureRun() {
  const manifestTask = loadRustTaskManifest(pilotManifestPath)[0];
  const task = {
    ...manifestTask,
    sandbox: {
      ...manifestTask.sandbox,
      network: 'none' as const,
    },
  };
  const plan = buildRustSandboxRunPlan({
    task,
    runRoot: '/tmp/safeword-rust-runs',
    runId: 'run-001',
    patchFile: '/tmp/candidate.patch',
  });
  return { task, plan };
}

function baselineFixtureRun() {
  const manifestTask = loadRustTaskManifest(pilotManifestPath)[0];
  const task = {
    ...manifestTask,
    sandbox: {
      ...manifestTask.sandbox,
      network: 'none' as const,
    },
  };
  const plan = buildRustSandboxRunPlan({
    task,
    runRoot: '/tmp/safeword-rust-runs',
    runId: 'run-baseline',
  });
  return { task, plan };
}

function prefetchFixtureRun() {
  const task = loadRustTaskManifest(pilotManifestPath)[0];
  const plan = buildRustSandboxRunPlan({
    task,
    runRoot: '/tmp/safeword-rust-runs',
    runId: 'run-prefetch',
    patchFile: '/tmp/candidate.patch',
  });
  return { task, plan };
}

function fakeRunner(finalResult: RustProcessResult = okResult('cargo ok'), finalCallIndex = 12) {
  const calls: RustProcessInvocation[] = [];
  return {
    calls,
    commandRunner: {
      run: async (invocation: RustProcessInvocation) => {
        calls.push(invocation);
        return calls.length === finalCallIndex ? finalResult : okResult();
      },
    },
  };
}

describe('executeRustSandboxRun', () => {
  it('runs checkout, worktree copy, patch application, and Docker oracle in order', async () => {
    const { task, plan } = fixtureRun();
    const { calls, commandRunner } = fakeRunner();

    const artifact = await executeRustSandboxRun({
      task,
      plan,
      context: runContext,
      commandRunner,
    });

    expect(calls.map(call => call.argv)).toEqual([
      ['git', 'clone', '--no-checkout', task.repository.url, plan.paths.source],
      ['git', '-C', plan.paths.source, 'fetch', '--depth', '1', 'origin', task.repository.ref],
      ['git', '-C', plan.paths.source, 'checkout', '--detach', task.repository.ref],
      ['rm', '-rf', plan.paths.worktree],
      ['cp', '-a', `${plan.paths.source}/.`, plan.paths.worktree],
      ['mkdir', '-p', plan.paths.cache],
      ['rm', '-f', join(plan.paths.cache, 'prefetch.cid'), join(plan.paths.cache, 'oracle.cid')],
      ['docker', 'volume', 'rm', '-f', 'safeword-rust-run-001-cache'],
      ['docker', 'volume', 'create', 'safeword-rust-run-001-cache'],
      [
        'docker',
        'run',
        '--rm',
        '--network',
        'none',
        '--mount',
        'type=volume,source=safeword-rust-run-001-cache,target=/workspace/cache',
        plan.docker.argv[plan.docker.argv.indexOf('/bin/bash') - 1],
        '/bin/bash',
        '-c',
        'mkdir -p /workspace/cache/cargo-home /workspace/cache/target && chown -R 1000:1000 /workspace/cache',
      ],
      ['git', '-C', plan.paths.worktree, 'apply', '/tmp/candidate.patch'],
      plan.docker.argv,
      ['docker', 'volume', 'rm', '-f', 'safeword-rust-run-001-cache'],
    ]);
    expect(calls.every(call => call.timeoutSeconds === 900)).toBe(true);
    expect(artifact.run.commandResults).toEqual([
      {
        kind: task.oracle.kind,
        command: task.oracle.command,
        exitCode: 0,
        stdout: 'cargo ok',
        stderr: '',
        durationMs: 10,
        required: true,
      },
    ]);
    expect(artifact.evaluation.passedCorrectness).toBe(true);
    expect(artifact.evaluation.sideInfo.candidateSkillId).toBe('no-skill');
  });

  it('runs dependency prefetch before applying a candidate patch', async () => {
    const { task, plan } = prefetchFixtureRun();
    const calls: RustProcessInvocation[] = [];
    const commandRunner = {
      run: async (invocation: RustProcessInvocation) => {
        calls.push(invocation);
        return calls.length === 13 ? okResult('cargo ok') : okResult();
      },
    };

    const artifact = await executeRustSandboxRun({
      task,
      plan,
      context: runContext,
      commandRunner,
    });

    expect(calls.map(call => call.argv)).toEqual([
      ['git', 'clone', '--no-checkout', task.repository.url, plan.paths.source],
      ['git', '-C', plan.paths.source, 'fetch', '--depth', '1', 'origin', task.repository.ref],
      ['git', '-C', plan.paths.source, 'checkout', '--detach', task.repository.ref],
      ['rm', '-rf', plan.paths.worktree],
      ['cp', '-a', `${plan.paths.source}/.`, plan.paths.worktree],
      ['mkdir', '-p', plan.paths.cache],
      ['rm', '-f', join(plan.paths.cache, 'prefetch.cid'), join(plan.paths.cache, 'oracle.cid')],
      ['docker', 'volume', 'rm', '-f', 'safeword-rust-run-prefetch-cache'],
      ['docker', 'volume', 'create', 'safeword-rust-run-prefetch-cache'],
      [
        'docker',
        'run',
        '--rm',
        '--network',
        'none',
        '--mount',
        'type=volume,source=safeword-rust-run-prefetch-cache,target=/workspace/cache',
        plan.docker.argv[plan.docker.argv.indexOf('/bin/bash') - 1],
        '/bin/bash',
        '-c',
        'mkdir -p /workspace/cache/cargo-home /workspace/cache/target && chown -R 1000:1000 /workspace/cache',
      ],
      plan.prefetch?.argv,
      ['git', '-C', plan.paths.worktree, 'apply', '/tmp/candidate.patch'],
      plan.docker.argv,
      ['docker', 'volume', 'rm', '-f', 'safeword-rust-run-prefetch-cache'],
    ]);
    expect(calls.every(call => call.timeoutSeconds === 900)).toBe(true);
    expect(artifact.setupResults.map(result => result.stepKind)).toContain('dependency-prefetch');
    expect(artifact.run.commandResults[0].stdout).toBe('cargo ok');
  });

  it('cleans up the Docker cache volume when dependency prefetch fails', async () => {
    const { task, plan } = prefetchFixtureRun();
    const calls: RustProcessInvocation[] = [];
    const commandRunner = {
      run: async (invocation: RustProcessInvocation) => {
        calls.push(invocation);
        if (calls.length === 11) {
          return {
            exitCode: 1,
            stdout: '',
            stderr: 'fetch failed',
            durationMs: 10,
          };
        }
        return okResult();
      },
    };

    const artifact = await executeRustSandboxRun({
      task,
      plan,
      context: runContext,
      commandRunner,
    });

    expect(calls.map(call => call.argv)).toEqual([
      ['git', 'clone', '--no-checkout', task.repository.url, plan.paths.source],
      ['git', '-C', plan.paths.source, 'fetch', '--depth', '1', 'origin', task.repository.ref],
      ['git', '-C', plan.paths.source, 'checkout', '--detach', task.repository.ref],
      ['rm', '-rf', plan.paths.worktree],
      ['cp', '-a', `${plan.paths.source}/.`, plan.paths.worktree],
      ['mkdir', '-p', plan.paths.cache],
      ['rm', '-f', join(plan.paths.cache, 'prefetch.cid'), join(plan.paths.cache, 'oracle.cid')],
      ['docker', 'volume', 'rm', '-f', 'safeword-rust-run-prefetch-cache'],
      ['docker', 'volume', 'create', 'safeword-rust-run-prefetch-cache'],
      [
        'docker',
        'run',
        '--rm',
        '--network',
        'none',
        '--mount',
        'type=volume,source=safeword-rust-run-prefetch-cache,target=/workspace/cache',
        plan.docker.argv[plan.docker.argv.indexOf('/bin/bash') - 1],
        '/bin/bash',
        '-c',
        'mkdir -p /workspace/cache/cargo-home /workspace/cache/target && chown -R 1000:1000 /workspace/cache',
      ],
      plan.prefetch?.argv,
      ['docker', 'volume', 'rm', '-f', 'safeword-rust-run-prefetch-cache'],
    ]);
    expect(artifact.run.commandResults).toEqual([]);
    expect(artifact.run.diagnostics).toEqual([
      `setup failed during dependency-prefetch: ${plan.prefetch?.argv.join(' ')}`,
    ]);
    expect(artifact.evaluation.passedCorrectness).toBe(false);
  });

  it('runs a no-patch baseline without invoking git apply', async () => {
    const { task, plan } = baselineFixtureRun();
    const { calls, commandRunner } = fakeRunner(okResult('cargo ok'), 11);

    const artifact = await executeRustSandboxRun({
      task,
      plan,
      context: {
        ...runContext,
        candidateSkillId: 'no-skill',
        patchSummary: 'No candidate patch applied.',
      },
      commandRunner,
    });

    expect(calls.map(call => call.argv)).toEqual([
      ['git', 'clone', '--no-checkout', task.repository.url, plan.paths.source],
      ['git', '-C', plan.paths.source, 'fetch', '--depth', '1', 'origin', task.repository.ref],
      ['git', '-C', plan.paths.source, 'checkout', '--detach', task.repository.ref],
      ['rm', '-rf', plan.paths.worktree],
      ['cp', '-a', `${plan.paths.source}/.`, plan.paths.worktree],
      ['mkdir', '-p', plan.paths.cache],
      ['rm', '-f', join(plan.paths.cache, 'prefetch.cid'), join(plan.paths.cache, 'oracle.cid')],
      ['docker', 'volume', 'rm', '-f', 'safeword-rust-run-baseline-cache'],
      ['docker', 'volume', 'create', 'safeword-rust-run-baseline-cache'],
      [
        'docker',
        'run',
        '--rm',
        '--network',
        'none',
        '--mount',
        'type=volume,source=safeword-rust-run-baseline-cache,target=/workspace/cache',
        plan.docker.argv[plan.docker.argv.indexOf('/bin/bash') - 1],
        '/bin/bash',
        '-c',
        'mkdir -p /workspace/cache/cargo-home /workspace/cache/target && chown -R 1000:1000 /workspace/cache',
      ],
      plan.docker.argv,
      ['docker', 'volume', 'rm', '-f', 'safeword-rust-run-baseline-cache'],
    ]);
    expect(calls.every(call => call.timeoutSeconds === 900)).toBe(true);
    expect(calls.flatMap(call => call.argv)).not.toContain('apply');
    expect(artifact.plan.patch).toEqual({ kind: 'none' });
    expect(artifact.evaluation.passedCorrectness).toBe(true);
  });
});

describe('appendRustRunArtifact', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('appends one replayable JSON line for a completed run', async () => {
    const { task, plan } = fixtureRun();
    const { commandRunner } = fakeRunner();
    const artifact = await executeRustSandboxRun({
      task,
      plan,
      context: runContext,
      commandRunner,
    });

    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-run-'));
    const artifactPath = join(tempDir, 'runs', 'rust-runs.jsonl');
    appendRustRunArtifact(artifactPath, artifact);

    const lines = readFileSync(artifactPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]) as unknown).toMatchObject({
      schemaVersion: 'rust-language-skill-run/v0',
      taskId: task.id,
      repositoryId: task.repository.id,
      split: task.split,
      modelFamily: 'gpt-codex',
      candidateSkillId: 'no-skill',
      run: {
        commandResults: [{ stdout: 'cargo ok' }],
      },
      evaluation: {
        passedCorrectness: true,
      },
    });
  });
});
