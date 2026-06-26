import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadRustCandidateSkill, reviewRustCandidateSkill } from './candidate';
import {
  createRustCommandRunner,
  parseNumericFlag,
  parseRustModelFamily,
  requiredFlagValue,
  resolveCliPath,
} from './cli-utils';
import { loadRustTaskManifest, selectRustTasks, type RustTask } from './dataset';
import type { RustModelFamily } from './evaluator';
import {
  createRustModelPatchAgentAdapter,
  type RustOptimizerProvider,
  type RustProviderFetch,
} from './model-adapters';
import { rustPatchFileForTask, validateGeneratedRustPatch } from './patches';
import type { RustCommandRunner } from './runner';

export interface RustPatchAgentTaskRequest {
  prompt: string;
  repositoryUrl: string;
  checkoutRef: string;
  allowedCommands: string[];
  oracleCommand: string;
}

export interface RustPatchAgentCandidateSkill {
  id: string;
  description: string;
  text: string;
}

export interface RustPatchAgentRequest {
  candidateSkill: RustPatchAgentCandidateSkill;
  modelFamily: RustModelFamily;
  task: RustPatchAgentTaskRequest;
}

export interface RustPatchProposal {
  patch: string;
  summary: string;
  trace: string;
}

export interface RustPatchAgentAdapter {
  generatePatch(request: RustPatchAgentRequest): Promise<RustPatchProposal>;
}

export interface RustPatchGenerationInput {
  manifestPath: string;
  taskIds: string[];
  patchDir: string;
  reportPath: string;
  candidateSkillId: string;
  candidateSkillPath: string;
  modelFamily: RustModelFamily;
  adapter: RustPatchAgentAdapter;
}

export interface RustGeneratedPatchRecord {
  taskId: string;
  repositoryId: string;
  patchFile: string;
  patchSummary: string;
  agentTrace: string;
}

export interface RustPatchGenerationResult {
  schemaVersion: 'rust-language-skill-patches/v0';
  createdAt: string;
  candidateSkillId: string;
  candidateSkill: {
    id: string;
    path: string;
    description: string;
  };
  modelFamily: RustModelFamily;
  patchDir: string;
  reportPath: string;
  patchCount: number;
  patches: RustGeneratedPatchRecord[];
}

export interface RustPatchGeneratorCliDeps {
  cwd?: string;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  adapter?: RustPatchAgentAdapter;
  commandRunner?: RustCommandRunner;
  env?: Record<string, string | undefined>;
  fetch?: RustProviderFetch;
}

interface RustPatchGeneratorCliOptions {
  manifest: string;
  taskIds: string[];
  patchDir: string;
  reportPath: string;
  modelFamily: RustModelFamily;
  candidateSkillId: string;
  candidateSkillFile: string;
  fakeAgent: boolean;
  agentCommand?: string;
  agentArgs: string[];
  agentRequestDir: string;
  agentTimeoutSeconds?: number;
  maxTokens?: number;
  model?: string;
  provider?: RustOptimizerProvider;
}

interface CommandRustPatchAgentAdapterOptions {
  command: string;
  args: string[];
  requestDir: string;
  runner: RustCommandRunner;
  timeoutSeconds?: number;
}

const defaultManifestPath = fileURLToPath(new URL('../tasks/pilot.json', import.meta.url));
const defaultDistilledSkillPath = fileURLToPath(
  new URL('../candidates/distilled-rust-ownership-v1/SKILL.md', import.meta.url),
);

export function createFakeRustPatchAgentAdapter(
  proposal: RustPatchProposal | ((request: RustPatchAgentRequest) => RustPatchProposal),
): RustPatchAgentAdapter {
  return {
    generatePatch: async request => (typeof proposal === 'function' ? proposal(request) : proposal),
  };
}

export function createCommandRustPatchAgentAdapter(
  options: CommandRustPatchAgentAdapterOptions,
): RustPatchAgentAdapter {
  let requestIndex = 0;
  return {
    generatePatch: async request => {
      requestIndex += 1;
      mkdirSync(options.requestDir, { recursive: true });
      const requestPath = join(
        options.requestDir,
        `patch-request-${requestIndex}-${randomUUID()}.json`,
      );
      writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');

      const result = await options.runner.run({
        argv: [options.command, ...options.args, requestPath],
        timeoutSeconds: options.timeoutSeconds,
      });
      if (result.exitCode !== 0) {
        throw new Error(
          `patch agent command failed with exit ${result.exitCode}: ${result.stderr}`,
        );
      }

      return parsePatchProposal(result.stdout);
    },
  };
}

export async function generateRustCandidatePatches(
  input: RustPatchGenerationInput,
): Promise<RustPatchGenerationResult> {
  const candidateSkillReview = reviewRustCandidateSkill(input.candidateSkillPath);
  if (candidateSkillReview.skill.id !== input.candidateSkillId) {
    throw new Error(
      `candidateSkillId must match candidate skill file name: ${input.candidateSkillId} != ${candidateSkillReview.skill.id}`,
    );
  }
  if (!candidateSkillReview.review.accepted) {
    throw new Error(
      `candidate skill failed review: ${candidateSkillReview.review.blockers.join('; ')}`,
    );
  }

  const candidateSkill = loadRustCandidateSkill(input.candidateSkillPath);
  const tasks = selectRustTasks(loadRustTaskManifest(input.manifestPath), input.taskIds);
  const patches: RustGeneratedPatchRecord[] = [];

  mkdirSync(input.patchDir, { recursive: true });
  for (const task of tasks) {
    const proposal = await input.adapter.generatePatch({
      candidateSkill: {
        id: candidateSkill.id,
        description: candidateSkill.metadata.description,
        text: candidateSkill.text,
      },
      modelFamily: input.modelFamily,
      task: taskRequest(task),
    });
    validateGeneratedRustPatch(task.id, proposal.patch);

    const patchFile = rustPatchFileForTask(input.patchDir, task.id);
    writeFileSync(patchFile, proposal.patch, 'utf8');
    patches.push({
      taskId: task.id,
      repositoryId: task.repository.id,
      patchFile,
      patchSummary: proposal.summary,
      agentTrace: proposal.trace,
    });
  }

  const result: RustPatchGenerationResult = {
    schemaVersion: 'rust-language-skill-patches/v0',
    createdAt: new Date().toISOString(),
    candidateSkillId: input.candidateSkillId,
    candidateSkill: {
      id: candidateSkill.id,
      path: candidateSkill.path,
      description: candidateSkill.metadata.description,
    },
    modelFamily: input.modelFamily,
    patchDir: input.patchDir,
    reportPath: input.reportPath,
    patchCount: patches.length,
    patches,
  };
  writeReport(input.reportPath, result);
  return result;
}

export async function runRustPatchGeneratorCli(
  argv: string[],
  deps: RustPatchGeneratorCliDeps = {},
): Promise<number> {
  const cwd = deps.cwd ?? process.cwd();
  const stdout = deps.stdout ?? (line => console.log(line));
  const stderr = deps.stderr ?? (line => console.error(line));

  try {
    const options = parseArgs(argv, cwd);
    const adapter = createCliPatchAgentAdapter(options, deps);
    if (!adapter) {
      throw new Error('--fake-agent, --agent-command, or --provider openai|anthropic is required');
    }

    const result = await generateRustCandidatePatches({
      manifestPath: options.manifest,
      taskIds: options.taskIds,
      patchDir: options.patchDir,
      reportPath: options.reportPath,
      candidateSkillId: options.candidateSkillId,
      candidateSkillPath: options.candidateSkillFile,
      modelFamily: options.modelFamily,
      adapter,
    });

    stdout(`candidate: ${result.candidateSkillId}`);
    stdout(`model family: ${result.modelFamily}`);
    stdout(`patches: ${result.patchCount}`);
    stdout(`wrote patches: ${result.patchDir}`);
    stdout(`wrote report: ${result.reportPath}`);
    return 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function createCliPatchAgentAdapter(
  options: RustPatchGeneratorCliOptions,
  deps: RustPatchGeneratorCliDeps,
): RustPatchAgentAdapter | undefined {
  if (deps.adapter) return deps.adapter;
  if (options.fakeAgent) return fakeCliPatchAgentAdapter();
  if (options.provider) {
    return createRustModelPatchAgentAdapter(options.provider, {
      env: deps.env,
      fetch: deps.fetch,
      maxTokens: options.maxTokens,
      model: options.model,
    });
  }
  if (!options.agentCommand) return undefined;
  return createCommandRustPatchAgentAdapter({
    command: options.agentCommand,
    args: options.agentArgs,
    requestDir: options.agentRequestDir,
    runner: deps.commandRunner ?? createRustCommandRunner('live'),
    timeoutSeconds: options.agentTimeoutSeconds,
  });
}

function fakeCliPatchAgentAdapter(): RustPatchAgentAdapter {
  return createFakeRustPatchAgentAdapter({
    patch: [
      'diff --git a/src/lib.rs b/src/lib.rs',
      'index 1111111..2222222 100644',
      '--- a/src/lib.rs',
      '+++ b/src/lib.rs',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
      '',
    ].join('\n'),
    summary: 'Fake patch agent generated a diff-shaped Rust patch.',
    trace: 'Fake patch agent used the selected Rust skill guidance.',
  });
}

function parseArgs(argv: string[], cwd: string): RustPatchGeneratorCliOptions {
  const options: RustPatchGeneratorCliOptions = {
    manifest: defaultManifestPath,
    taskIds: [],
    patchDir: resolveCliPath(cwd, 'patches/rust-distilled-ownership-v1'),
    reportPath: resolveCliPath(cwd, 'artifacts/rust-patch-generation.json'),
    modelFamily: 'gpt-codex',
    candidateSkillId: 'distilled-rust-ownership-v1',
    candidateSkillFile: defaultDistilledSkillPath,
    fakeAgent: false,
    agentArgs: [],
    agentRequestDir: resolveCliPath(cwd, `${tmpdir()}/safeword-rust-patch-requests`),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--fake-agent') {
      options.fakeAgent = true;
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
      case '--report':
        options.reportPath = resolveCliPath(cwd, value);
        break;
      case '--manifest':
        options.manifest = resolveCliPath(cwd, value);
        break;
      case '--model-family':
        options.modelFamily = parseRustModelFamily(value);
        break;
      case '--provider':
        options.provider = parseProvider(value);
        break;
      case '--model':
        options.model = value;
        break;
      case '--max-tokens':
        options.maxTokens = parseNumericFlag(arg, value);
        break;
      case '--candidate-skill-id':
        options.candidateSkillId = value;
        break;
      case '--candidate-skill-file':
        options.candidateSkillFile = resolveCliPath(cwd, value);
        break;
      case '--agent-command':
        options.agentCommand = value;
        break;
      case '--agent-arg':
        options.agentArgs.push(value);
        break;
      case '--agent-request-dir':
        options.agentRequestDir = resolveCliPath(cwd, value);
        break;
      case '--agent-timeout-seconds':
        options.agentTimeoutSeconds = parseNumericFlag(arg, value);
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  return options;
}

function parseProvider(value: string): RustOptimizerProvider {
  if (value === 'openai' || value === 'anthropic') return value;
  throw new Error('--provider must be openai or anthropic');
}

function taskRequest(task: RustTask): RustPatchAgentTaskRequest {
  return {
    prompt: task.prompt,
    repositoryUrl: task.repository.url,
    checkoutRef: task.repository.ref,
    allowedCommands: task.commands,
    oracleCommand: task.oracle.command,
  };
}

function parsePatchProposal(text: string): RustPatchProposal {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `patch agent returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('patch agent returned a non-object response');
  }
  const candidate = parsed as { patch?: unknown; summary?: unknown; trace?: unknown };
  if (typeof candidate.patch !== 'string' || candidate.patch.trim() === '') {
    throw new Error('patch agent response is missing patch');
  }
  if (typeof candidate.summary !== 'string' || candidate.summary.trim() === '') {
    throw new Error('patch agent response is missing summary');
  }
  if (typeof candidate.trace !== 'string' || candidate.trace.trim() === '') {
    throw new Error('patch agent response is missing trace');
  }

  return {
    patch: candidate.patch,
    summary: candidate.summary,
    trace: candidate.trace,
  };
}

function writeReport(path: string, result: RustPatchGenerationResult): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function helpText(): string {
  return [
    'Usage: bun src/patch-generator.ts [--task-id TASK...] [--patch-dir DIR] [--fake-agent|--agent-command CMD|--provider openai|anthropic]',
    '',
    'Generates matrix-ready Rust patch files for a reviewed candidate skill.',
    'Patch files are named <task-id>.patch inside --patch-dir.',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runRustPatchGeneratorCli(process.argv.slice(2));
}
