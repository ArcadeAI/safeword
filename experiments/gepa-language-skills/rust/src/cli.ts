import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { reviewRustCandidateSkill, summarizeRustCandidateSkill } from './candidate';
import {
  applyCommonRustCliFlag,
  createRustCommandRunner,
  emptyRustSecondaryMetrics,
  requiredFlagValue,
  resolveCliPath,
} from './cli-utils';
import { loadRustTaskManifest } from './dataset';
import { buildRustSandboxRunPlan } from './executor';
import type { RustModelFamily, RustSecondaryMetrics } from './evaluator';
import { appendRustRunArtifact, executeRustSandboxRun, type RustCommandRunner } from './runner';

export type RustExperimentCliMode = 'dry-run' | 'live';

export interface RustExperimentCliDeps {
  cwd?: string;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  commandRunnerFactory?: (mode: RustExperimentCliMode) => RustCommandRunner;
}

interface RustExperimentCliOptions {
  mode: RustExperimentCliMode;
  manifest: string;
  taskId?: string;
  patchFile?: string;
  runRoot: string;
  runId?: string;
  artifact: string;
  modelFamily: RustModelFamily;
  candidateSkillId: string;
  candidateSkillFile?: string;
  agentTrace: string;
  patchSummary: string;
  secondaryMetrics: RustSecondaryMetrics;
}

const defaultManifestPath = fileURLToPath(new URL('../tasks/pilot.json', import.meta.url));

export async function runRustExperimentCli(
  argv: string[],
  deps: RustExperimentCliDeps = {},
): Promise<number> {
  const cwd = deps.cwd ?? process.cwd();
  const stdout = deps.stdout ?? (line => console.log(line));
  const stderr = deps.stderr ?? (line => console.error(line));

  try {
    const options = parseArgs(argv, cwd);
    if (!options.patchFile && options.candidateSkillId !== 'no-skill') {
      throw new Error('--patch-file is required for candidate skill runs');
    }
    const candidateSkillReview = options.candidateSkillFile
      ? reviewRustCandidateSkill(options.candidateSkillFile)
      : undefined;
    if (
      candidateSkillReview &&
      options.candidateSkillId !== 'no-skill' &&
      candidateSkillReview.skill.id !== options.candidateSkillId
    ) {
      throw new Error(
        `--candidate-skill-id must match candidate skill file name: ${options.candidateSkillId} != ${candidateSkillReview.skill.id}`,
      );
    }
    if (candidateSkillReview && !candidateSkillReview.review.accepted) {
      throw new Error(
        `candidate skill failed review: ${candidateSkillReview.review.blockers.join('; ')}`,
      );
    }

    const tasks = loadRustTaskManifest(options.manifest);
    const task = options.taskId
      ? tasks.find(candidate => candidate.id === options.taskId)
      : tasks[0];
    if (!task) {
      throw new Error(`task not found: ${options.taskId ?? '<first task>'}`);
    }

    const runId = options.runId ?? `${task.id}-${randomUUID()}`;
    const plan = buildRustSandboxRunPlan({
      task,
      runRoot: options.runRoot,
      runId,
      patchFile: options.patchFile,
    });
    const commandRunner = createRustCommandRunner(options.mode, deps.commandRunnerFactory);
    const artifact = await executeRustSandboxRun({
      task,
      plan,
      context: {
        modelFamily: options.modelFamily,
        candidateSkillId: options.candidateSkillId,
        ...(candidateSkillReview
          ? { candidateSkill: summarizeRustCandidateSkill(candidateSkillReview.skill) }
          : {}),
        agentTrace: options.agentTrace,
        patchSummary: options.patchSummary,
        secondaryMetrics: options.secondaryMetrics,
      },
      commandRunner,
    });

    appendRustRunArtifact(options.artifact, artifact);
    stdout(`mode: ${options.mode}`);
    stdout(`task: ${task.id}`);
    stdout(`wrote artifact: ${options.artifact}`);
    return artifact.evaluation.acceptable ? 0 : 1;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function parseArgs(argv: string[], cwd: string): RustExperimentCliOptions {
  const options: RustExperimentCliOptions = {
    mode: 'dry-run',
    manifest: defaultManifestPath,
    runRoot: resolveCliPath(cwd, `${tmpdir()}/safeword-rust-runs`),
    artifact: resolveCliPath(cwd, 'artifacts/rust-runs.jsonl'),
    modelFamily: 'gpt-codex',
    candidateSkillId: 'no-skill',
    agentTrace: 'No agent trace supplied.',
    patchSummary: 'No patch summary supplied.',
    secondaryMetrics: emptyRustSecondaryMetrics(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.mode = 'dry-run';
      continue;
    }
    if (arg === '--live') {
      options.mode = 'live';
      continue;
    }
    if (arg === '--help') {
      throw new Error(helpText());
    }

    const value = requiredFlagValue(argv, index, arg);
    index += 1;

    switch (arg) {
      case '--task-id':
        options.taskId = value;
        break;
      case '--patch-file':
        options.patchFile = resolveCliPath(cwd, value);
        break;
      case '--run-id':
        options.runId = value;
        break;
      default:
        if (!applyCommonRustCliFlag(options, arg, value, cwd)) {
          throw new Error(`unknown argument: ${arg}`);
        }
    }
  }

  return options;
}

function helpText(): string {
  return [
    'Usage: bun src/cli.ts [--patch-file PATCH] [--task-id TASK] [--dry-run|--live]',
    '',
    'Defaults to --dry-run and candidate no-skill. Candidate skill ids require --patch-file.',
    'Use --candidate-skill-file to review and record candidate skill text.',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runRustExperimentCli(process.argv.slice(2));
}
