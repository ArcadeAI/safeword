import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
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
import { loadRustTaskManifest, type RustTask } from './dataset';
import { buildRustSandboxRunPlan } from './executor';
import type { RustModelFamily, RustSecondaryMetrics } from './evaluator';
import { rustPatchFileForTask, validateRustPatchFile } from './patches';
import { appendRustRunArtifact, executeRustSandboxRun, type RustCommandRunner } from './runner';

export type RustMatrixCliMode = 'dry-run' | 'live';

export interface RustMatrixCliDeps {
  cwd?: string;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  commandRunnerFactory?: (mode: RustMatrixCliMode) => RustCommandRunner;
}

interface RustMatrixCliOptions {
  mode: RustMatrixCliMode;
  manifest: string;
  taskIds: string[];
  patchDir: string;
  runRoot: string;
  runPrefix: string;
  artifact: string;
  modelFamily: RustModelFamily;
  candidateSkillId: string;
  candidateSkillFile: string;
  agentTrace: string;
  patchSummary: string;
  secondaryMetrics: RustSecondaryMetrics;
}

const defaultManifestPath = fileURLToPath(new URL('../tasks/pilot.json', import.meta.url));
const defaultHumanSeedSkillPath = fileURLToPath(
  new URL('../candidates/human-seed-rust/SKILL.md', import.meta.url),
);

export async function runRustMatrixCli(
  argv: string[],
  deps: RustMatrixCliDeps = {},
): Promise<number> {
  const cwd = deps.cwd ?? process.cwd();
  const stdout = deps.stdout ?? (line => console.log(line));
  const stderr = deps.stderr ?? (line => console.error(line));

  try {
    const options = parseArgs(argv, cwd);
    const candidateSkillReview = reviewRustCandidateSkill(options.candidateSkillFile);
    if (candidateSkillReview.skill.id !== options.candidateSkillId) {
      throw new Error(
        `--candidate-skill-id must match candidate skill file name: ${options.candidateSkillId} != ${candidateSkillReview.skill.id}`,
      );
    }
    if (!candidateSkillReview.review.accepted) {
      throw new Error(
        `candidate skill failed review: ${candidateSkillReview.review.blockers.join('; ')}`,
      );
    }

    const tasks = selectTasks(loadRustTaskManifest(options.manifest), options.taskIds);
    const patchFilesByTask = collectPatchFiles(options.patchDir, tasks);
    const commandRunner = createRustCommandRunner(options.mode, deps.commandRunnerFactory);
    const candidateSkill = summarizeRustCandidateSkill(candidateSkillReview.skill);
    let failedCount = 0;

    stdout(`mode: ${options.mode}`);
    stdout(`candidate: ${options.candidateSkillId}`);
    stdout(`tasks: ${tasks.length}`);

    for (const task of tasks) {
      const patchFile = patchFilesByTask.get(task.id);
      if (!patchFile) throw new Error(`missing preflight patch entry for task ${task.id}`);

      const plan = buildRustSandboxRunPlan({
        task,
        runRoot: options.runRoot,
        runId: `${options.runPrefix}-${task.id}`,
        patchFile,
      });
      const artifact = await executeRustSandboxRun({
        task,
        plan,
        context: {
          modelFamily: options.modelFamily,
          candidateSkillId: options.candidateSkillId,
          candidateSkill,
          agentTrace: options.agentTrace,
          patchSummary: options.patchSummary,
          secondaryMetrics: options.secondaryMetrics,
        },
        commandRunner,
      });

      appendRustRunArtifact(options.artifact, artifact);
      if (!artifact.evaluation.acceptable) failedCount += 1;
      stdout(
        `${task.id}: ${artifact.evaluation.acceptable ? 'accepted' : 'rejected'} score=${artifact.evaluation.score}`,
      );
    }

    stdout(`wrote artifact: ${options.artifact}`);
    return failedCount === 0 ? 0 : 1;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function parseArgs(argv: string[], cwd: string): RustMatrixCliOptions {
  const options: RustMatrixCliOptions = {
    mode: 'dry-run',
    manifest: defaultManifestPath,
    taskIds: [],
    patchDir: resolveCliPath(cwd, 'patches/rust-human-seed'),
    runRoot: resolveCliPath(cwd, `${tmpdir()}/safeword-rust-runs`),
    runPrefix: `matrix-${randomUUID()}`,
    artifact: resolveCliPath(cwd, 'artifacts/rust-matrix.jsonl'),
    modelFamily: 'gpt-codex',
    candidateSkillId: 'human-seed-rust',
    candidateSkillFile: defaultHumanSeedSkillPath,
    agentTrace: 'Candidate matrix run.',
    patchSummary: 'Candidate patch from matrix patch directory.',
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
        options.taskIds.push(value);
        break;
      case '--patch-dir':
        options.patchDir = resolveCliPath(cwd, value);
        break;
      case '--run-prefix':
        options.runPrefix = value;
        break;
      default:
        if (!applyCommonRustCliFlag(options, arg, value, cwd)) {
          throw new Error(`unknown argument: ${arg}`);
        }
    }
  }

  return options;
}

function selectTasks(tasks: RustTask[], taskIds: string[]): RustTask[] {
  if (taskIds.length === 0) return tasks;

  const selected: RustTask[] = [];
  for (const taskId of taskIds) {
    const task = tasks.find(candidate => candidate.id === taskId);
    if (!task) {
      throw new Error(`task not found: ${taskId}`);
    }
    selected.push(task);
  }

  return selected;
}

function collectPatchFiles(patchDir: string, tasks: RustTask[]): Map<string, string> {
  const patchFilesByTask = new Map<string, string>();
  for (const task of tasks) {
    const patchFile = rustPatchFileForTask(patchDir, task.id);
    if (!existsSync(patchFile)) {
      throw new Error(`missing patch for task ${task.id}: ${patchFile}`);
    }
    validateRustPatchFile(task.id, patchFile);
    patchFilesByTask.set(task.id, patchFile);
  }
  return patchFilesByTask;
}

function helpText(): string {
  return [
    'Usage: bun src/matrix.ts [--patch-dir DIR] [--task-id TASK...] [--dry-run|--live]',
    '',
    'Runs a reviewed candidate skill against one or more Rust pilot tasks.',
    'Patch files must be named <task-id>.patch inside --patch-dir.',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runRustMatrixCli(process.argv.slice(2));
}
