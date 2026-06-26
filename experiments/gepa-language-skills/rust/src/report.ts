import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseRustModelFamily, resolveCliPath } from './cli-utils';
import type { RustModelFamily, RustTaskEvaluation } from './evaluator';
import type { RustRunArtifact } from './runner';
import { rustScoreGroupKey } from './score-key';
import {
  aggregateRustScores,
  evaluateHeldoutGate,
  type HeldoutGateResult,
  type RustAggregateScore,
} from './transfer';

export interface RustComparisonDelta {
  repositoryId: string;
  modelFamily: RustModelFamily;
  baselineScore: number;
  candidateScore: number;
  delta: number;
}

export interface RustMatrixComparisonReport {
  schemaVersion: 'rust-language-skill-comparison/v0';
  createdAt: string;
  baselineArtifact: string;
  candidateArtifact: string;
  modelFamilies: RustModelFamily[];
  baseline: RustAggregateScore;
  candidate: RustAggregateScore;
  deltas: RustComparisonDelta[];
  heldoutGate: HeldoutGateResult;
}

export interface RustComparisonInput {
  baselinePath: string;
  candidatePath: string;
  modelFamilies: RustModelFamily[];
}

export interface RustReportCliDeps {
  cwd?: string;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

interface RustReportCliOptions extends RustComparisonInput {
  outputPath: string;
}

const defaultModelFamilies: RustModelFamily[] = ['claude-opus', 'gpt-codex'];

export function compareRustRunArtifacts(input: RustComparisonInput): RustMatrixComparisonReport {
  const baselineEvaluations = loadRustRunEvaluations(input.baselinePath);
  const candidateEvaluations = loadRustRunEvaluations(input.candidatePath);
  const baseline = aggregateRustScores(baselineEvaluations);
  const candidate = aggregateRustScores(candidateEvaluations);
  const heldoutGate = evaluateHeldoutGate({
    baseline: baselineEvaluations,
    candidate: candidateEvaluations,
    modelFamilies: input.modelFamilies,
  });

  return {
    schemaVersion: 'rust-language-skill-comparison/v0',
    createdAt: new Date().toISOString(),
    baselineArtifact: input.baselinePath,
    candidateArtifact: input.candidatePath,
    modelFamilies: input.modelFamilies,
    baseline,
    candidate,
    deltas: buildDeltas(baseline, candidate),
    heldoutGate,
  };
}

export async function runRustReportCli(
  argv: string[],
  deps: RustReportCliDeps = {},
): Promise<number> {
  const cwd = deps.cwd ?? process.cwd();
  const stdout = deps.stdout ?? (line => console.log(line));
  const stderr = deps.stderr ?? (line => console.error(line));

  try {
    const options = parseArgs(argv, cwd);
    const report = compareRustRunArtifacts(options);
    mkdirSync(dirname(options.outputPath), { recursive: true });
    writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    stdout(`heldout gate: ${report.heldoutGate.accepted ? 'accepted' : 'rejected'}`);
    stdout(`wrote report: ${options.outputPath}`);
    return report.heldoutGate.accepted ? 0 : 1;
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function loadRustRunEvaluations(path: string): RustTaskEvaluation[] {
  return loadRustRunArtifacts(path).map(artifact => artifact.evaluation);
}

function loadRustRunArtifacts(path: string): RustRunArtifact[] {
  const text = readFileSync(path, 'utf8');
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => parseRustRunArtifact(path, index + 1, line));
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
  };

  return (
    candidate.schemaVersion === 'rust-language-skill-run/v0' &&
    isRustTaskEvaluation(candidate.evaluation)
  );
}

function isRustTaskEvaluation(value: unknown): value is RustTaskEvaluation {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    score?: unknown;
    sideInfo?: {
      task?: { repository?: { id?: unknown }; split?: unknown };
      modelFamily?: unknown;
    };
  };

  return (
    typeof candidate.score === 'number' &&
    (candidate.sideInfo?.modelFamily === 'claude-opus' ||
      candidate.sideInfo?.modelFamily === 'gpt-codex') &&
    typeof candidate.sideInfo?.task?.repository?.id === 'string' &&
    (candidate.sideInfo.task.split === 'train' ||
      candidate.sideInfo.task.split === 'validation' ||
      candidate.sideInfo.task.split === 'heldout')
  );
}

function buildDeltas(
  baseline: RustAggregateScore,
  candidate: RustAggregateScore,
): RustComparisonDelta[] {
  const baselineGroups = groupScoresByKey(baseline);
  const candidateGroups = groupScoresByKey(candidate);
  const keys = [...new Set([...baselineGroups.keys(), ...candidateGroups.keys()])].sort();

  return keys.map(key => {
    const baselineGroup = baselineGroups.get(key);
    const candidateGroup = candidateGroups.get(key);
    const repositoryId = baselineGroup?.repositoryId ?? candidateGroup?.repositoryId;
    const modelFamily = baselineGroup?.modelFamily ?? candidateGroup?.modelFamily;
    if (!repositoryId || !modelFamily) {
      throw new Error(`comparison group key could not be resolved: ${key}`);
    }

    const baselineScore = baselineGroup?.averageScore ?? 0;
    const candidateScore = candidateGroup?.averageScore ?? 0;
    return {
      repositoryId,
      modelFamily,
      baselineScore,
      candidateScore,
      delta: roundScore(candidateScore - baselineScore),
    };
  });
}

function groupScoresByKey(
  aggregate: RustAggregateScore,
): Map<string, { repositoryId: string; modelFamily: RustModelFamily; averageScore: number }> {
  const groups = new Map<
    string,
    { repositoryId: string; modelFamily: RustModelFamily; averageScore: number }
  >();
  for (const group of aggregate.groups) {
    groups.set(rustScoreGroupKey(group.repositoryId, group.modelFamily), {
      repositoryId: group.repositoryId,
      modelFamily: group.modelFamily,
      averageScore: group.averageScore,
    });
  }
  return groups;
}

function parseArgs(argv: string[], cwd: string): RustReportCliOptions {
  const options: Partial<RustReportCliOptions> & { modelFamilies: RustModelFamily[] } = {
    modelFamilies: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      throw new Error(helpText());
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${arg} requires a value`);
    }
    index += 1;

    switch (arg) {
      case '--baseline':
        options.baselinePath = resolveCliPath(cwd, value);
        break;
      case '--candidate':
        options.candidatePath = resolveCliPath(cwd, value);
        break;
      case '--output':
        options.outputPath = resolveCliPath(cwd, value);
        break;
      case '--model-family':
        options.modelFamilies.push(parseRustModelFamily(value));
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!options.baselinePath) throw new Error('--baseline is required');
  if (!options.candidatePath) throw new Error('--candidate is required');
  if (!options.outputPath) throw new Error('--output is required');
  if (options.modelFamilies.length === 0) {
    options.modelFamilies = [...defaultModelFamilies];
  }

  return options as RustReportCliOptions;
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function helpText(): string {
  return [
    'Usage: bun src/report.ts --baseline BASELINE.jsonl --candidate CANDIDATE.jsonl --output REPORT.json',
    '',
    'Compares Rust run artifacts, reports per repository/model deltas, and evaluates the held-out gate.',
    'Repeat --model-family to limit the held-out gate. Defaults to claude-opus and gpt-codex.',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runRustReportCli(process.argv.slice(2));
}
