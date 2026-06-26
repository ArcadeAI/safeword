import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  loadRustCandidateSkill,
  reviewRustCandidateSkill,
  summarizeRustCandidateSkill,
  type RustCandidateSkillSummary,
} from './candidate';
import { requiredFlagValue, resolveCliPath } from './cli-utils';
import {
  feedbackForGepa,
  type RustCommandResult,
  type RustEvaluationSideInfo,
  type RustModelFamily,
  type RustTaskEvaluation,
} from './evaluator';
import type { RustRunArtifact } from './runner';

export interface RustFailedRunFeedback {
  taskId: string;
  repositoryId: string;
  modelFamily: RustModelFamily;
  candidateSkillId: string;
  score: number;
  failureReasons: string[];
  feedback: string;
}

export interface RustSkillMutationRequest {
  candidateId: string;
  baseSkill: RustCandidateSkillSummary & {
    body: string;
    text: string;
  };
  failedRuns: RustFailedRunFeedback[];
  modelFamilies: RustModelFamily[];
  sourceArtifact: string;
}

export interface RustSkillMutationProposal {
  skillMarkdown: string;
  rationale: string;
}

export interface RustSkillMutationAdapter {
  mutate(request: RustSkillMutationRequest): Promise<RustSkillMutationProposal>;
}

export interface RustOptimizeSkillInput {
  baseSkillPath: string;
  artifactPath: string;
  outputRoot: string;
  candidateId: string;
  adapter: RustSkillMutationAdapter;
}

export interface RustOptimizerResult {
  schemaVersion: 'rust-language-skill-optimization/v0';
  createdAt: string;
  candidateId: string;
  accepted: boolean;
  blockers: string[];
  failureCount: number;
  modelFamilies: RustModelFamily[];
  sourceArtifact: string;
  outputSkillPath: string;
  reportPath: string;
  rationale?: string;
  skippedReason?: string;
}

export interface RustOptimizerCliDeps {
  cwd?: string;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  adapter?: RustSkillMutationAdapter;
}

interface RustOptimizerCliOptions {
  baseSkillPath: string;
  artifactPath: string;
  outputRoot: string;
  candidateId: string;
  fakeAdapter: boolean;
}

export function createFakeRustSkillMutationAdapter(
  proposal:
    | RustSkillMutationProposal
    | ((request: RustSkillMutationRequest) => RustSkillMutationProposal),
): RustSkillMutationAdapter {
  return {
    mutate: async request => (typeof proposal === 'function' ? proposal(request) : proposal),
  };
}

export async function optimizeRustSkillCandidate(
  input: RustOptimizeSkillInput,
): Promise<RustOptimizerResult> {
  validateCandidateId(input.candidateId);
  const outputDir = join(input.outputRoot, input.candidateId);
  const outputSkillPath = join(outputDir, 'SKILL.md');
  const reportPath = join(outputDir, 'optimization-report.json');
  const failedRuns = failedRunFeedback(loadRustRunArtifacts(input.artifactPath));
  const modelFamilies = uniqueModelFamilies(failedRuns.map(run => run.modelFamily));

  mkdirSync(outputDir, { recursive: true });

  if (failedRuns.length === 0) {
    const result: RustOptimizerResult = {
      schemaVersion: 'rust-language-skill-optimization/v0',
      createdAt: new Date().toISOString(),
      candidateId: input.candidateId,
      accepted: false,
      blockers: [],
      failureCount: 0,
      modelFamilies,
      sourceArtifact: input.artifactPath,
      outputSkillPath,
      reportPath,
      skippedReason: 'no failed runs',
    };
    writeReport(reportPath, result, []);
    return result;
  }

  const baseSkill = loadRustCandidateSkill(input.baseSkillPath);
  const proposal = await input.adapter.mutate({
    candidateId: input.candidateId,
    baseSkill: {
      ...summarizeRustCandidateSkill(baseSkill),
      body: baseSkill.body,
      text: baseSkill.text,
    },
    failedRuns,
    modelFamilies,
    sourceArtifact: input.artifactPath,
  });

  writeFileSync(outputSkillPath, proposal.skillMarkdown, 'utf8');

  const blockers = reviewCandidate(outputSkillPath);
  const result: RustOptimizerResult = {
    schemaVersion: 'rust-language-skill-optimization/v0',
    createdAt: new Date().toISOString(),
    candidateId: input.candidateId,
    accepted: blockers.length === 0,
    blockers,
    failureCount: failedRuns.length,
    modelFamilies,
    sourceArtifact: input.artifactPath,
    outputSkillPath,
    reportPath,
    rationale: proposal.rationale,
  };
  writeReport(reportPath, result, failedRuns);
  return result;
}

export async function runRustOptimizerCli(
  argv: string[],
  deps: RustOptimizerCliDeps = {},
): Promise<number> {
  const cwd = deps.cwd ?? process.cwd();
  const stdout = deps.stdout ?? (line => console.log(line));
  const stderr = deps.stderr ?? (line => console.error(line));

  try {
    const options = parseArgs(argv, cwd);
    const adapter =
      deps.adapter ?? (options.fakeAdapter ? fakeCliAdapter(options.candidateId) : undefined);
    if (!adapter) {
      throw new Error('--fake-adapter is required until a real model adapter is configured');
    }

    const result = await optimizeRustSkillCandidate({
      baseSkillPath: options.baseSkillPath,
      artifactPath: options.artifactPath,
      outputRoot: options.outputRoot,
      candidateId: options.candidateId,
      adapter,
    });

    stdout(`candidate: ${result.candidateId}`);
    stdout(`accepted: ${result.accepted}`);
    stdout(`wrote skill: ${result.outputSkillPath}`);
    stdout(`wrote report: ${result.reportPath}`);
    return result.accepted ? 0 : 1;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function failedRunFeedback(artifacts: RustRunArtifact[]): RustFailedRunFeedback[] {
  return artifacts
    .filter(artifact => !artifact.evaluation.acceptable)
    .map(artifact => ({
      taskId: artifact.taskId,
      repositoryId: artifact.repositoryId,
      modelFamily: artifact.modelFamily,
      candidateSkillId: artifact.candidateSkillId,
      score: artifact.evaluation.score,
      failureReasons: artifact.evaluation.failureReasons,
      feedback: feedbackForGepa(artifact.evaluation),
    }));
}

function loadRustRunArtifacts(path: string): RustRunArtifact[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => parseRustRunArtifact(path, index + 1, line));
}

function parseRustRunArtifact(path: string, lineNumber: number, line: string): RustRunArtifact {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch (error) {
    throw new Error(
      `invalid JSON in Rust run artifact ${path}:${lineNumber}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!isRustRunArtifact(parsed)) {
    throw new Error(`invalid Rust run artifact ${path}:${lineNumber}`);
  }
  return parsed;
}

function isRustRunArtifact(value: unknown): value is RustRunArtifact {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    schemaVersion?: unknown;
    evaluation?: unknown;
    taskId?: unknown;
    repositoryId?: unknown;
    modelFamily?: unknown;
    candidateSkillId?: unknown;
  };

  return (
    candidate.schemaVersion === 'rust-language-skill-run/v0' &&
    typeof candidate.taskId === 'string' &&
    typeof candidate.repositoryId === 'string' &&
    isRustTaskEvaluation(candidate.evaluation) &&
    (candidate.modelFamily === 'claude-opus' || candidate.modelFamily === 'gpt-codex') &&
    typeof candidate.candidateSkillId === 'string'
  );
}

function isRustTaskEvaluation(value: unknown): value is RustTaskEvaluation {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    score?: unknown;
    acceptable?: unknown;
    failureReasons?: unknown;
    commandResults?: unknown;
    sideInfo?: unknown;
  };
  return (
    typeof candidate.score === 'number' &&
    typeof candidate.acceptable === 'boolean' &&
    Array.isArray(candidate.failureReasons) &&
    candidate.failureReasons.every(reason => typeof reason === 'string') &&
    Array.isArray(candidate.commandResults) &&
    candidate.commandResults.every(isRustCommandResult) &&
    isRustEvaluationSideInfo(candidate.sideInfo)
  );
}

function isRustCommandResult(value: unknown): value is RustCommandResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    kind?: unknown;
    command?: unknown;
    exitCode?: unknown;
    stdout?: unknown;
    stderr?: unknown;
    durationMs?: unknown;
    required?: unknown;
  };

  return (
    typeof candidate.kind === 'string' &&
    typeof candidate.command === 'string' &&
    typeof candidate.exitCode === 'number' &&
    typeof candidate.stdout === 'string' &&
    typeof candidate.stderr === 'string' &&
    typeof candidate.durationMs === 'number' &&
    (candidate.required === undefined || typeof candidate.required === 'boolean')
  );
}

function isRustEvaluationSideInfo(value: unknown): value is RustEvaluationSideInfo {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    task?: { id?: unknown; prompt?: unknown; repository?: { id?: unknown }; split?: unknown };
    modelFamily?: unknown;
    candidateSkillId?: unknown;
    agentTrace?: unknown;
    patchSummary?: unknown;
    timings?: { totalMs?: unknown; commandMs?: unknown };
    diagnostics?: unknown;
  };

  return (
    typeof candidate.task?.id === 'string' &&
    typeof candidate.task.prompt === 'string' &&
    typeof candidate.task.repository?.id === 'string' &&
    (candidate.task.split === 'train' ||
      candidate.task.split === 'validation' ||
      candidate.task.split === 'heldout') &&
    (candidate.modelFamily === 'claude-opus' || candidate.modelFamily === 'gpt-codex') &&
    typeof candidate.candidateSkillId === 'string' &&
    typeof candidate.agentTrace === 'string' &&
    typeof candidate.patchSummary === 'string' &&
    typeof candidate.timings?.totalMs === 'number' &&
    typeof candidate.timings.commandMs === 'number' &&
    Array.isArray(candidate.diagnostics) &&
    candidate.diagnostics.every(diagnostic => typeof diagnostic === 'string')
  );
}

function reviewCandidate(path: string): string[] {
  try {
    return reviewRustCandidateSkill(path).review.blockers;
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

function writeReport(
  path: string,
  result: RustOptimizerResult,
  failedRuns: RustFailedRunFeedback[],
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...result, failedRuns }, null, 2)}\n`, 'utf8');
}

function uniqueModelFamilies(modelFamilies: RustModelFamily[]): RustModelFamily[] {
  return [...new Set(modelFamilies)].sort((left, right) => left.localeCompare(right));
}

function validateCandidateId(candidateId: string): void {
  if (!/^[a-z0-9-]{1,64}$/.test(candidateId)) {
    throw new Error('--candidate-id must be lowercase letters, digits, or hyphens');
  }
}

function parseArgs(argv: string[], cwd: string): RustOptimizerCliOptions {
  const options: Partial<RustOptimizerCliOptions> = {
    fakeAdapter: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      throw new Error(helpText());
    }
    if (arg === '--fake-adapter') {
      options.fakeAdapter = true;
      continue;
    }

    const value = requiredFlagValue(argv, index, arg);
    index += 1;

    switch (arg) {
      case '--base-skill-file':
        options.baseSkillPath = resolveCliPath(cwd, value);
        break;
      case '--artifact':
        options.artifactPath = resolveCliPath(cwd, value);
        break;
      case '--output-root':
        options.outputRoot = resolveCliPath(cwd, value);
        break;
      case '--candidate-id':
        options.candidateId = value;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!options.baseSkillPath) throw new Error('--base-skill-file is required');
  if (!options.artifactPath) throw new Error('--artifact is required');
  if (!options.outputRoot) throw new Error('--output-root is required');
  if (!options.candidateId) throw new Error('--candidate-id is required');
  return options as RustOptimizerCliOptions;
}

function fakeCliAdapter(candidateId: string): RustSkillMutationAdapter {
  return createFakeRustSkillMutationAdapter({
    skillMarkdown: [
      '---',
      `name: ${candidateId}`,
      'description: Candidate Rust guidance for general code changes.',
      '---',
      '',
      '# Rust',
      '',
      'Prefer compiler diagnostics, small local changes, and workspace-aware verification.',
      '',
    ].join('\n'),
    rationale: 'Fake adapter scaffold generated deterministic Rust guidance.',
  });
}

function helpText(): string {
  return [
    'Usage: bun src/optimize.ts --base-skill-file SKILL.md --artifact RUNS.jsonl --output-root DIR --candidate-id ID [--fake-adapter]',
    '',
    'Builds a new Rust skill candidate from failed run artifacts. Real model adapters are not wired yet.',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runRustOptimizerCli(process.argv.slice(2));
}
