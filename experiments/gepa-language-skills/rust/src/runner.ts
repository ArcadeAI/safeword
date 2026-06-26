import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { RustTask } from './dataset';
import type { RustSandboxRunPlan, RustSandboxStep } from './executor';
import type { RustCandidateSkillSummary } from './candidate';
import {
  scoreRustTaskRun,
  type RustModelFamily,
  type RustSecondaryMetrics,
  type RustTaskEvaluation,
  type RustTaskRun,
} from './evaluator';

export interface RustProcessInvocation {
  argv: string[];
  timeoutSeconds?: number;
}

export interface RustProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface RustCommandRunner {
  run(invocation: RustProcessInvocation): Promise<RustProcessResult>;
}

export interface RustRunContext {
  modelFamily: RustModelFamily;
  candidateSkillId: string;
  candidateSkill?: RustCandidateSkillSummary;
  agentTrace: string;
  patchSummary: string;
  secondaryMetrics: RustSecondaryMetrics;
}

export interface RustExecutedSetupCommand extends RustProcessResult {
  stepKind: RustSandboxStep['kind'];
  argv: string[];
}

export interface RustRunArtifact {
  schemaVersion: 'rust-language-skill-run/v0';
  createdAt: string;
  taskId: string;
  repositoryId: string;
  split: RustTask['split'];
  modelFamily: RustModelFamily;
  candidateSkillId: string;
  candidateSkill?: RustCandidateSkillSummary;
  plan: RustSandboxRunPlan;
  setupResults: RustExecutedSetupCommand[];
  run: RustTaskRun;
  evaluation: RustTaskEvaluation;
}

export interface ExecuteRustSandboxRunInput {
  task: RustTask;
  plan: RustSandboxRunPlan;
  context: RustRunContext;
  commandRunner: RustCommandRunner;
}

export async function executeRustSandboxRun(
  input: ExecuteRustSandboxRunInput,
): Promise<RustRunArtifact> {
  const setupResults: RustExecutedSetupCommand[] = [];
  let dockerResult: RustProcessResult | undefined;
  let setupFailed = false;

  for (const step of input.plan.steps) {
    if (step.kind === 'docker-run') {
      if (setupFailed) continue;
      dockerResult = await input.commandRunner.run({
        argv: step.argv,
        timeoutSeconds: input.plan.docker.timeoutSeconds,
      });
      continue;
    }

    if (setupFailed && step.kind !== 'cleanup-cache') {
      continue;
    }

    for (const argv of argvForSetupStep(step)) {
      const invocation: RustProcessInvocation = {
        argv,
        timeoutSeconds: timeoutForSetupStep(step, input.plan),
      };
      const result = await input.commandRunner.run(invocation);
      setupResults.push({
        stepKind: step.kind,
        argv,
        ...result,
      });

      if (result.exitCode !== 0 && step.kind !== 'cleanup-cache') {
        setupFailed = true;
        break;
      }
    }
  }

  return buildArtifact(input, setupResults, dockerResult);
}

export function appendRustRunArtifact(path: string, artifact: RustRunArtifact): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(artifact)}\n`, 'utf8');
}

function argvForSetupStep(step: Exclude<RustSandboxStep, { kind: 'docker-run' }>): string[][] {
  if (step.kind === 'checkout') {
    return [
      ['git', 'clone', '--no-checkout', step.repositoryUrl, step.destination],
      ['git', '-C', step.destination, 'fetch', '--depth', '1', 'origin', step.ref],
      ['git', '-C', step.destination, 'checkout', '--detach', step.ref],
    ];
  }

  if (step.kind === 'copy-worktree') {
    return [
      ['rm', '-rf', step.destination],
      ['cp', '-a', `${step.source}/.`, step.destination],
    ];
  }

  if (step.kind === 'prepare-cache') {
    return [
      ['mkdir', '-p', step.path],
      ['rm', '-f', join(step.path, 'prefetch.cid'), join(step.path, 'oracle.cid')],
      ['docker', 'volume', 'rm', '-f', step.volumeName],
      ['docker', 'volume', 'create', step.volumeName],
      [
        'docker',
        'run',
        '--rm',
        '--network',
        'none',
        '--mount',
        `type=volume,source=${step.volumeName},target=/workspace/cache`,
        step.image,
        '/bin/bash',
        '-c',
        'mkdir -p /workspace/cache/cargo-home /workspace/cache/target && chown -R 1000:1000 /workspace/cache',
      ],
    ];
  }

  if (step.kind === 'dependency-prefetch') {
    return [step.argv];
  }

  if (step.kind === 'cleanup-cache') {
    return [['docker', 'volume', 'rm', '-f', step.volumeName]];
  }

  return [['git', '-C', step.cwd, 'apply', step.patchFile]];
}

function timeoutForSetupStep(
  step: Exclude<RustSandboxStep, { kind: 'docker-run' }>,
  plan: RustSandboxRunPlan,
): number {
  if (step.kind === 'dependency-prefetch') {
    return plan.prefetch?.timeoutSeconds ?? plan.docker.timeoutSeconds;
  }
  return plan.docker.timeoutSeconds;
}

function buildArtifact(
  input: ExecuteRustSandboxRunInput,
  setupResults: RustExecutedSetupCommand[],
  dockerResult: RustProcessResult | undefined,
): RustRunArtifact {
  const commandResults = dockerResult
    ? [
        {
          kind: input.task.oracle.kind,
          command: input.task.oracle.command,
          exitCode: dockerResult.exitCode,
          stdout: dockerResult.stdout,
          stderr: dockerResult.stderr,
          durationMs: dockerResult.durationMs,
          required: true,
        },
      ]
    : [];
  const totalSetupMs = setupResults.reduce((sum, result) => sum + result.durationMs, 0);
  const failedSetup = setupResults.find(result => result.exitCode !== 0);
  const diagnostics = failedSetup
    ? [`setup failed during ${failedSetup.stepKind}: ${failedSetup.argv.join(' ')}`]
    : [];
  const run: RustTaskRun = {
    task: input.task,
    modelFamily: input.context.modelFamily,
    candidateSkillId: input.context.candidateSkillId,
    agentTrace: input.context.agentTrace,
    patchSummary: input.context.patchSummary,
    commandResults,
    timings: {
      totalMs: totalSetupMs + (dockerResult?.durationMs ?? 0),
      commandMs: dockerResult?.durationMs ?? 0,
    },
    diagnostics,
    secondaryMetrics: input.context.secondaryMetrics,
  };

  return {
    schemaVersion: 'rust-language-skill-run/v0',
    createdAt: new Date().toISOString(),
    taskId: input.task.id,
    repositoryId: input.task.repository.id,
    split: input.task.split,
    modelFamily: input.context.modelFamily,
    candidateSkillId: input.context.candidateSkillId,
    ...(input.context.candidateSkill ? { candidateSkill: input.context.candidateSkill } : {}),
    plan: input.plan,
    setupResults,
    run,
    evaluation: scoreRustTaskRun(run),
  };
}
