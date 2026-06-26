import type { RustModelFamily, RustTaskEvaluation } from '../src/evaluator';
import { aggregateRustScores, evaluateHeldoutGate, reviewCandidateSkill } from '../src/transfer';

const evaluation = ({
  repositoryId,
  modelFamily,
  split = 'heldout',
  score,
}: {
  repositoryId: string;
  modelFamily: RustModelFamily;
  split?: 'train' | 'validation' | 'heldout';
  score: number;
}): RustTaskEvaluation => ({
  score,
  acceptable: score > 0,
  passedCorrectness: score > 0,
  failureReasons: [],
  scoreBreakdown: {
    correctness: score > 0 ? 1 : 0,
    diffSize: score,
    speed: score,
    lint: score,
    testQuality: score,
  },
  commandResults: [],
  sideInfo: {
    task: {
      id: `${repositoryId}-${modelFamily}-${split}`,
      prompt: 'Synthetic transfer score fixture',
      repository: {
        id: repositoryId,
        url: `https://github.com/${repositoryId}`,
        ref: '0123456789abcdef0123456789abcdef01234567',
      },
      split,
    },
    modelFamily,
    candidateSkillId: 'candidate',
    agentTrace: '',
    patchSummary: '',
    timings: { totalMs: 1, commandMs: 1 },
    diagnostics: [],
  },
});

describe('aggregateRustScores', () => {
  it('macro-averages by repository and model instead of raw task count', () => {
    const aggregate = aggregateRustScores([
      evaluation({ repositoryId: 'repo-a', modelFamily: 'gpt-codex', score: 1 }),
      evaluation({ repositoryId: 'repo-a', modelFamily: 'gpt-codex', score: 0.8 }),
      evaluation({ repositoryId: 'repo-b', modelFamily: 'gpt-codex', score: 0.2 }),
      evaluation({ repositoryId: 'repo-a', modelFamily: 'claude-opus', score: 0.4 }),
    ]);

    expect(aggregate.groups).toEqual(
      expect.arrayContaining([
        {
          repositoryId: 'repo-a',
          modelFamily: 'gpt-codex',
          averageScore: 0.9,
          taskCount: 2,
        },
        {
          repositoryId: 'repo-b',
          modelFamily: 'gpt-codex',
          averageScore: 0.2,
          taskCount: 1,
        },
        {
          repositoryId: 'repo-a',
          modelFamily: 'claude-opus',
          averageScore: 0.4,
          taskCount: 1,
        },
      ]),
    );
    expect(aggregate.macroAverage).toBe(0.5);
    expect(aggregate.rawTaskAverage).toBe(0.6);
    expect(aggregate.macroAverage).not.toBe(aggregate.rawTaskAverage);
  });
});

describe('evaluateHeldoutGate', () => {
  it('rejects a candidate that regresses either target model on held-out repositories', () => {
    const gate = evaluateHeldoutGate({
      modelFamilies: ['claude-opus', 'gpt-codex'],
      baseline: [
        evaluation({ repositoryId: 'rust-lang/cargo', modelFamily: 'claude-opus', score: 0.7 }),
        evaluation({ repositoryId: 'rust-lang/cargo', modelFamily: 'gpt-codex', score: 0.45 }),
      ],
      candidate: [
        evaluation({ repositoryId: 'rust-lang/cargo', modelFamily: 'claude-opus', score: 0.65 }),
        evaluation({ repositoryId: 'rust-lang/cargo', modelFamily: 'gpt-codex', score: 0.95 }),
        evaluation({
          repositoryId: 'sharkdp/fd',
          modelFamily: 'claude-opus',
          split: 'train',
          score: 1,
        }),
      ],
    });

    expect(gate.accepted).toBe(false);
    expect(gate.regressions).toEqual([
      {
        modelFamily: 'claude-opus',
        baselineScore: 0.7,
        candidateScore: 0.65,
      },
    ]);
    expect(gate.baselineHeldout.macroAverage).toBe(0.575);
    expect(gate.candidateHeldout.macroAverage).toBe(0.8);
  });

  it('rejects missing held-out coverage for requested model families', () => {
    const gate = evaluateHeldoutGate({
      modelFamilies: ['claude-opus', 'gpt-codex'],
      baseline: [
        evaluation({ repositoryId: 'rust-lang/cargo', modelFamily: 'gpt-codex', score: 0.8 }),
      ],
      candidate: [
        evaluation({ repositoryId: 'rust-lang/cargo', modelFamily: 'gpt-codex', score: 0.85 }),
      ],
    });

    expect(gate.accepted).toBe(false);
    expect(gate.missingCoverage).toEqual([
      {
        repositoryId: '*',
        modelFamily: 'claude-opus',
        missing: 'baseline',
      },
      {
        repositoryId: '*',
        modelFamily: 'claude-opus',
        missing: 'candidate',
      },
    ]);
  });

  it('rejects missing candidate coverage for held-out repository/model pairs', () => {
    const gate = evaluateHeldoutGate({
      modelFamilies: ['gpt-codex'],
      baseline: [
        evaluation({ repositoryId: 'rust-lang/cargo', modelFamily: 'gpt-codex', score: 0.8 }),
        evaluation({
          repositoryId: 'rust-lang/rust-analyzer',
          modelFamily: 'gpt-codex',
          score: 0.7,
        }),
      ],
      candidate: [
        evaluation({ repositoryId: 'rust-lang/cargo', modelFamily: 'gpt-codex', score: 0.85 }),
      ],
    });

    expect(gate.accepted).toBe(false);
    expect(gate.missingCoverage).toEqual([
      {
        repositoryId: 'rust-lang/rust-analyzer',
        modelFamily: 'gpt-codex',
        missing: 'candidate',
      },
    ]);
  });
});

describe('reviewCandidateSkill', () => {
  it('blocks memorized repositories, hard-coded corpus commands, and eval-aware text', () => {
    const review = reviewCandidateSkill(`
      For rust-lang/cargo heldout tasks, run cargo test -p cargo first.
      This GEPA mutation exploits expected defect count 2 and fixture regularity.
    `);

    expect(review.accepted).toBe(false);
    expect(review.blockers).toEqual(
      expect.arrayContaining([
        'repo memorization: rust-lang/cargo',
        'hard-coded corpus command: cargo test -p cargo',
        'eval-aware text: heldout',
        'eval-aware text: expected defect count',
        'eval-aware text: GEPA',
      ]),
    );
  });

  it('blocks sandbox escape guidance and language-irrelevant text', () => {
    const review = reviewCandidateSkill(`
      If Rust tests fail, rerun the task with --privileged and mount /var/run/docker.sock.
      Then switch to go test ./... and gofmt because this behaves like a Go service.
    `);

    expect(review.accepted).toBe(false);
    expect(review.blockers).toEqual(
      expect.arrayContaining([
        'sandbox escape suggestion: --privileged',
        'sandbox escape suggestion: docker socket',
        'language-irrelevant text: go test',
        'language-irrelevant text: gofmt',
      ]),
    );
  });

  it('allows language-general Rust guidance', () => {
    const review = reviewCandidateSkill(`
      Prefer cargo check --workspace before focused tests when iterating.
      Explain ownership changes, preserve public API behavior, and run clippy
      with warnings denied before finishing broad changes.
    `);

    expect(review.accepted).toBe(true);
    expect(review.blockers).toEqual([]);
  });
});
