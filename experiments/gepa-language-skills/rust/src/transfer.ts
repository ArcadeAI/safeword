import type { RustModelFamily, RustTaskEvaluation } from './evaluator';

export interface RustAggregateGroup {
  repositoryId: string;
  modelFamily: RustModelFamily;
  averageScore: number;
  taskCount: number;
}

export interface RustAggregateScore {
  groups: RustAggregateGroup[];
  macroAverage: number;
  rawTaskAverage: number;
  byModelFamily: Partial<Record<RustModelFamily, number>>;
  byRepository: Record<string, number>;
}

export interface HeldoutGateInput {
  baseline: RustTaskEvaluation[];
  candidate: RustTaskEvaluation[];
  modelFamilies: RustModelFamily[];
  tolerance?: number;
}

export interface HeldoutRegression {
  modelFamily: RustModelFamily;
  baselineScore: number;
  candidateScore: number;
}

export interface HeldoutCoverageGap {
  repositoryId: string;
  modelFamily: RustModelFamily;
  missing: 'baseline' | 'candidate';
}

export interface HeldoutGateResult {
  accepted: boolean;
  regressions: HeldoutRegression[];
  missingCoverage: HeldoutCoverageGap[];
  baselineHeldout: RustAggregateScore;
  candidateHeldout: RustAggregateScore;
}

export interface CandidateSkillReview {
  accepted: boolean;
  blockers: string[];
}

const PILOT_REPOSITORIES = [
  'sharkdp/fd',
  'clap-rs/clap',
  'tokio-rs/tokio',
  'BurntSushi/ripgrep',
  'rustls/rustls',
  'rust-lang/cargo',
  'rust-lang/rust-analyzer',
] as const;

const EVAL_AWARE_PATTERNS: Array<[string, RegExp]> = [
  ['train', /\btrain\b/i],
  ['validation', /\bvalidation\b/i],
  ['heldout', /\bheldout\b/i],
  ['expected defect count', /expected defect counts?/i],
  ['fixture regularity', /fixture regularity/i],
  ['GEPA', /\bGEPA\b/i],
  ['optimizer', /\boptimizer\b/i],
  ['mutation', /\bmutation\b/i],
  ['Pareto', /\bPareto\b/i],
];

const SANDBOX_ESCAPE_PATTERNS: Array<[string, RegExp]> = [
  ['--privileged', /--privileged\b/i],
  ['docker socket', /(?:docker\.sock|\/var\/run\/docker\.sock)/i],
  ['host network', /--network\s+host\b/i],
  ['docker daemon mount', /mount\s+.*docker\s+daemon/i],
  ['disable sandbox', /\b(?:disable|bypass)\s+(?:the\s+)?sandbox\b/i],
];

const LANGUAGE_IRRELEVANT_PATTERNS: Array<[string, RegExp]> = [
  ['go test', /\bgo\s+test\b/i],
  ['gofmt', /\bgofmt\b/i],
  ['go modules', /\bgo\.mod\b/i],
  ['npm', /\bnpm\s+(?:install|test|run)\b/i],
  ['pytest', /\bpytest\b/i],
  ['pip', /\bpip\s+install\b/i],
];

export function aggregateRustScores(evaluations: RustTaskEvaluation[]): RustAggregateScore {
  const grouped = new Map<string, { total: number; count: number; group: RustAggregateGroup }>();

  for (const evaluation of evaluations) {
    const repositoryId = evaluation.sideInfo.task.repository.id;
    const modelFamily = evaluation.sideInfo.modelFamily;
    const key = `${repositoryId}\0${modelFamily}`;
    const existing =
      grouped.get(key) ??
      ({
        total: 0,
        count: 0,
        group: {
          repositoryId,
          modelFamily,
          averageScore: 0,
          taskCount: 0,
        },
      } satisfies { total: number; count: number; group: RustAggregateGroup });

    existing.total += evaluation.score;
    existing.count += 1;
    existing.group.taskCount = existing.count;
    existing.group.averageScore = roundScore(existing.total / existing.count);
    grouped.set(key, existing);
  }

  const groups = [...grouped.values()]
    .map(entry => entry.group)
    .sort((left, right) =>
      left.repositoryId === right.repositoryId
        ? left.modelFamily.localeCompare(right.modelFamily)
        : left.repositoryId.localeCompare(right.repositoryId),
    );

  return {
    groups,
    macroAverage: average(groups.map(group => group.averageScore)),
    rawTaskAverage: average(evaluations.map(evaluation => evaluation.score)),
    byModelFamily: averageGroupsByModel(groups),
    byRepository: averageGroupsByRepository(groups),
  };
}

export function evaluateHeldoutGate(input: HeldoutGateInput): HeldoutGateResult {
  const tolerance = input.tolerance ?? 0;
  const baselineHeldout = aggregateRustScores(
    heldoutForModels(input.baseline, input.modelFamilies),
  );
  const candidateHeldout = aggregateRustScores(
    heldoutForModels(input.candidate, input.modelFamilies),
  );
  const missingCoverage = findHeldoutCoverageGaps(input);
  const regressions: HeldoutRegression[] = [];

  for (const modelFamily of input.modelFamilies) {
    const baselineScore = baselineHeldout.byModelFamily[modelFamily] ?? 0;
    const candidateScore = candidateHeldout.byModelFamily[modelFamily] ?? 0;
    if (candidateScore + tolerance < baselineScore) {
      regressions.push({ modelFamily, baselineScore, candidateScore });
    }
  }

  return {
    accepted: regressions.length === 0 && missingCoverage.length === 0,
    regressions,
    missingCoverage,
    baselineHeldout,
    candidateHeldout,
  };
}

export function reviewCandidateSkill(candidateText: string): CandidateSkillReview {
  const blockers = new Set<string>();

  for (const repository of PILOT_REPOSITORIES) {
    if (candidateText.toLowerCase().includes(repository.toLowerCase())) {
      blockers.add(`repo memorization: ${repository}`);
    }
  }

  for (const command of hardCodedCorpusCommands(candidateText)) {
    blockers.add(`hard-coded corpus command: ${command}`);
  }

  for (const [label, pattern] of EVAL_AWARE_PATTERNS) {
    if (pattern.test(candidateText)) {
      blockers.add(`eval-aware text: ${label}`);
    }
  }

  for (const [label, pattern] of SANDBOX_ESCAPE_PATTERNS) {
    if (pattern.test(candidateText)) {
      blockers.add(`sandbox escape suggestion: ${label}`);
    }
  }

  for (const [label, pattern] of LANGUAGE_IRRELEVANT_PATTERNS) {
    if (pattern.test(candidateText)) {
      blockers.add(`language-irrelevant text: ${label}`);
    }
  }

  return {
    accepted: blockers.size === 0,
    blockers: [...blockers],
  };
}

function findHeldoutCoverageGaps(input: HeldoutGateInput): HeldoutCoverageGap[] {
  const baselineKeys = heldoutCoverageByKey(input.baseline, input.modelFamilies);
  const candidateKeys = heldoutCoverageByKey(input.candidate, input.modelFamilies);
  const gaps: HeldoutCoverageGap[] = [];

  for (const modelFamily of input.modelFamilies) {
    if (![...baselineKeys.values()].some(key => key.modelFamily === modelFamily)) {
      gaps.push({ repositoryId: '*', modelFamily, missing: 'baseline' });
    }
    if (![...candidateKeys.values()].some(key => key.modelFamily === modelFamily)) {
      gaps.push({ repositoryId: '*', modelFamily, missing: 'candidate' });
    }
  }

  for (const key of [...new Set([...baselineKeys.keys(), ...candidateKeys.keys()])].sort()) {
    const baseline = baselineKeys.get(key);
    const candidate = candidateKeys.get(key);
    const coverage = baseline ?? candidate;
    if (!coverage) continue;

    if (!baseline) {
      gaps.push({
        repositoryId: coverage.repositoryId,
        modelFamily: coverage.modelFamily,
        missing: 'baseline',
      });
    }
    if (!candidate) {
      gaps.push({
        repositoryId: coverage.repositoryId,
        modelFamily: coverage.modelFamily,
        missing: 'candidate',
      });
    }
  }

  return gaps;
}

function heldoutCoverageByKey(
  evaluations: RustTaskEvaluation[],
  modelFamilies: RustModelFamily[],
): Map<string, { repositoryId: string; modelFamily: RustModelFamily }> {
  const models = new Set(modelFamilies);
  const coverage = new Map<string, { repositoryId: string; modelFamily: RustModelFamily }>();
  for (const evaluation of evaluations) {
    const task = evaluation.sideInfo.task;
    const modelFamily = evaluation.sideInfo.modelFamily;
    if (task.split !== 'heldout' || !models.has(modelFamily)) continue;

    const repositoryId = task.repository.id;
    coverage.set(`${repositoryId}\0${modelFamily}`, { repositoryId, modelFamily });
  }
  return coverage;
}

function heldoutForModels(
  evaluations: RustTaskEvaluation[],
  modelFamilies: RustModelFamily[],
): RustTaskEvaluation[] {
  const models = new Set(modelFamilies);
  return evaluations.filter(
    evaluation =>
      evaluation.sideInfo.task.split === 'heldout' && models.has(evaluation.sideInfo.modelFamily),
  );
}

function averageGroupsByModel(
  groups: RustAggregateGroup[],
): Partial<Record<RustModelFamily, number>> {
  const byModel = new Map<RustModelFamily, number[]>();
  for (const group of groups) {
    const scores = byModel.get(group.modelFamily) ?? [];
    scores.push(group.averageScore);
    byModel.set(group.modelFamily, scores);
  }

  const result: Partial<Record<RustModelFamily, number>> = {};
  for (const [modelFamily, scores] of byModel) {
    result[modelFamily] = average(scores);
  }
  return result;
}

function averageGroupsByRepository(groups: RustAggregateGroup[]): Record<string, number> {
  const byRepository = new Map<string, number[]>();
  for (const group of groups) {
    const scores = byRepository.get(group.repositoryId) ?? [];
    scores.push(group.averageScore);
    byRepository.set(group.repositoryId, scores);
  }

  const result: Record<string, number> = {};
  for (const [repositoryId, scores] of byRepository) {
    result[repositoryId] = average(scores);
  }
  return result;
}

function hardCodedCorpusCommands(candidateText: string): string[] {
  return [
    ...candidateText.matchAll(
      /\bcargo\s+(?:test|check|clippy|bench)\s+(?:--locked\s+)?-p\s+(?:cargo|rust-analyzer|fd|ripgrep|clap|tokio|rustls)\b/gi,
    ),
    ...candidateText.matchAll(/\bcargo\s+(?:test|check|clippy|bench)\s+--manifest-path\s+\S+/gi),
  ].map(([match]) => match.trim().replace(/\s+/g, ' '));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return roundScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}
