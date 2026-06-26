import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  compareRustRunArtifacts,
  runRustReportCli,
  type RustMatrixComparisonReport,
} from '../src/report';
import type { RustModelFamily, RustTaskEvaluation } from '../src/evaluator';

describe('compareRustRunArtifacts', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('compares baseline and candidate JSONL by repository and model family', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-report-'));
    const baselinePath = join(tempDir, 'baseline.jsonl');
    const candidatePath = join(tempDir, 'candidate.jsonl');
    writeJsonl(baselinePath, [
      artifact({
        taskId: 'cargo-gpt-baseline',
        repositoryId: 'rust-lang/cargo',
        modelFamily: 'gpt-codex',
        split: 'heldout',
        candidateSkillId: 'no-skill',
        score: 0.8,
      }),
      artifact({
        taskId: 'ra-opus-baseline',
        repositoryId: 'rust-lang/rust-analyzer',
        modelFamily: 'claude-opus',
        split: 'heldout',
        candidateSkillId: 'no-skill',
        score: 0.5,
      }),
      artifact({
        taskId: 'fd-gpt-baseline',
        repositoryId: 'sharkdp/fd',
        modelFamily: 'gpt-codex',
        split: 'train',
        candidateSkillId: 'no-skill',
        score: 0.4,
      }),
    ]);
    writeJsonl(candidatePath, [
      artifact({
        taskId: 'cargo-gpt-candidate',
        repositoryId: 'rust-lang/cargo',
        modelFamily: 'gpt-codex',
        split: 'heldout',
        candidateSkillId: 'human-seed-rust',
        score: 0.9,
      }),
      artifact({
        taskId: 'ra-opus-candidate',
        repositoryId: 'rust-lang/rust-analyzer',
        modelFamily: 'claude-opus',
        split: 'heldout',
        candidateSkillId: 'human-seed-rust',
        score: 0.45,
      }),
      artifact({
        taskId: 'fd-gpt-candidate',
        repositoryId: 'sharkdp/fd',
        modelFamily: 'gpt-codex',
        split: 'train',
        candidateSkillId: 'human-seed-rust',
        score: 0.6,
      }),
    ]);

    const report = compareRustRunArtifacts({
      baselinePath,
      candidatePath,
      modelFamilies: ['claude-opus', 'gpt-codex'],
    });

    expect(report).toMatchObject({
      schemaVersion: 'rust-language-skill-comparison/v0',
      baselineArtifact: baselinePath,
      candidateArtifact: candidatePath,
      modelFamilies: ['claude-opus', 'gpt-codex'],
      heldoutGate: {
        accepted: false,
        regressions: [
          {
            modelFamily: 'claude-opus',
            baselineScore: 0.5,
            candidateScore: 0.45,
          },
        ],
      },
    });
    expect(report.baseline.macroAverage).toBe(0.567);
    expect(report.candidate.macroAverage).toBe(0.65);
    expect(report.deltas).toEqual(
      expect.arrayContaining([
        {
          repositoryId: 'rust-lang/cargo',
          modelFamily: 'gpt-codex',
          baselineScore: 0.8,
          candidateScore: 0.9,
          delta: 0.1,
        },
        {
          repositoryId: 'rust-lang/rust-analyzer',
          modelFamily: 'claude-opus',
          baselineScore: 0.5,
          candidateScore: 0.45,
          delta: -0.05,
        },
        {
          repositoryId: 'sharkdp/fd',
          modelFamily: 'gpt-codex',
          baselineScore: 0.4,
          candidateScore: 0.6,
          delta: 0.2,
        },
      ]),
    );
  });

  it('treats missing candidate groups as zero-score regressions', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-report-missing-'));
    const baselinePath = join(tempDir, 'baseline.jsonl');
    const candidatePath = join(tempDir, 'candidate.jsonl');
    writeJsonl(baselinePath, [
      artifact({
        taskId: 'cargo-gpt-baseline',
        repositoryId: 'rust-lang/cargo',
        modelFamily: 'gpt-codex',
        split: 'heldout',
        candidateSkillId: 'no-skill',
        score: 0.8,
      }),
    ]);
    writeJsonl(candidatePath, []);

    const report = compareRustRunArtifacts({
      baselinePath,
      candidatePath,
      modelFamilies: ['gpt-codex'],
    });

    expect(report.deltas).toEqual([
      {
        repositoryId: 'rust-lang/cargo',
        modelFamily: 'gpt-codex',
        baselineScore: 0.8,
        candidateScore: 0,
        delta: -0.8,
      },
    ]);
    expect(report.heldoutGate.accepted).toBe(false);
  });

  it('rejects non-run-artifact JSONL records', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-report-invalid-'));
    const baselinePath = join(tempDir, 'baseline.jsonl');
    const candidatePath = join(tempDir, 'candidate.jsonl');
    writeFileSync(baselinePath, '{"schemaVersion":"wrong"}\n', 'utf8');
    writeJsonl(candidatePath, []);

    expect(() =>
      compareRustRunArtifacts({
        baselinePath,
        candidatePath,
        modelFamilies: ['gpt-codex'],
      }),
    ).toThrow('invalid Rust run artifact');
  });
});

describe('runRustReportCli', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('writes a comparison report JSON file', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-report-cli-'));
    const baselinePath = join(tempDir, 'baseline.jsonl');
    const candidatePath = join(tempDir, 'candidate.jsonl');
    const reportPath = join(tempDir, 'report.json');
    const stdout: string[] = [];
    writeJsonl(baselinePath, [
      artifact({
        taskId: 'cargo-gpt-baseline',
        repositoryId: 'rust-lang/cargo',
        modelFamily: 'gpt-codex',
        split: 'heldout',
        candidateSkillId: 'no-skill',
        score: 0.75,
      }),
    ]);
    writeJsonl(candidatePath, [
      artifact({
        taskId: 'cargo-gpt-candidate',
        repositoryId: 'rust-lang/cargo',
        modelFamily: 'gpt-codex',
        split: 'heldout',
        candidateSkillId: 'human-seed-rust',
        score: 0.8,
      }),
    ]);

    const exitCode = await runRustReportCli(
      [
        '--baseline',
        baselinePath,
        '--candidate',
        candidatePath,
        '--model-family',
        'gpt-codex',
        '--output',
        reportPath,
      ],
      { stdout: line => stdout.push(line) },
    );

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain(`wrote report: ${reportPath}`);
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as RustMatrixComparisonReport;
    expect(report.heldoutGate.accepted).toBe(true);
    expect(report.deltas).toEqual([
      {
        repositoryId: 'rust-lang/cargo',
        modelFamily: 'gpt-codex',
        baselineScore: 0.75,
        candidateScore: 0.8,
        delta: 0.05,
      },
    ]);
  });
});

function writeJsonl(path: string, records: unknown[]): void {
  writeFileSync(path, records.map(record => JSON.stringify(record)).join('\n'), 'utf8');
}

function artifact(input: {
  taskId: string;
  repositoryId: string;
  modelFamily: RustModelFamily;
  split: 'train' | 'validation' | 'heldout';
  candidateSkillId: string;
  score: number;
}): Record<string, unknown> {
  return {
    schemaVersion: 'rust-language-skill-run/v0',
    taskId: input.taskId,
    repositoryId: input.repositoryId,
    split: input.split,
    modelFamily: input.modelFamily,
    candidateSkillId: input.candidateSkillId,
    evaluation: evaluation(input),
  };
}

function evaluation(input: {
  taskId: string;
  repositoryId: string;
  modelFamily: RustModelFamily;
  split: 'train' | 'validation' | 'heldout';
  candidateSkillId: string;
  score: number;
}): RustTaskEvaluation {
  return {
    score: input.score,
    acceptable: input.score >= 0.7,
    passedCorrectness: input.score > 0,
    failureReasons: [],
    scoreBreakdown: {
      correctness: input.score > 0 ? 1 : 0,
      diffSize: input.score,
      speed: input.score,
      lint: input.score,
      testQuality: input.score,
    },
    commandResults: [],
    sideInfo: {
      task: {
        id: input.taskId,
        prompt: 'Synthetic report fixture',
        repository: {
          id: input.repositoryId,
          url: `https://github.com/${input.repositoryId}`,
          ref: '0123456789abcdef0123456789abcdef01234567',
        },
        split: input.split,
      },
      modelFamily: input.modelFamily,
      candidateSkillId: input.candidateSkillId,
      agentTrace: '',
      patchSummary: '',
      timings: { totalMs: 1, commandMs: 1 },
      diagnostics: [],
    },
  };
}
