import type { RustTask } from '../src/dataset';
import { feedbackForGepa, scoreRustTaskRun, type RustTaskRun } from '../src/evaluator';

const rustTask = (overrides: Partial<RustTask> = {}): RustTask => ({
  id: 'fd-fix-hidden-files',
  repository: {
    id: 'sharkdp/fd',
    url: 'https://github.com/sharkdp/fd',
    ref: '0123456789abcdef0123456789abcdef01234567',
  },
  split: 'train',
  prompt: 'Fix the hidden-file traversal regression without changing public CLI semantics.',
  sandbox: {
    runner: {
      kind: 'docker',
      image: 'rust:1.96@sha256:1111111111111111111111111111111111111111111111111111111111111111',
    },
    timeoutSeconds: 900,
    resources: { cpus: 2, memoryMb: 4096 },
    network: 'none',
    mounts: [
      { purpose: 'repo', target: '/workspace/repo', mode: 'ro' },
      { purpose: 'scratch', target: '/workspace/scratch', mode: 'rw' },
    ],
    allowDockerSocket: false,
    privileged: false,
    userIsolation: 'non-root',
  },
  commands: ['cargo test --locked'],
  oracle: {
    kind: 'cargo-test',
    command: 'cargo test --locked',
  },
  ...overrides,
});

const successfulRun = (overrides: Partial<RustTaskRun> = {}): RustTaskRun => ({
  task: rustTask(),
  modelFamily: 'gpt-codex',
  candidateSkillId: 'optimized-rust-v3',
  agentTrace: 'Inspected a borrow checker error and adjusted iterator ownership.',
  patchSummary: 'Changed hidden-file traversal to avoid a borrowed iterator escaping.',
  commandResults: [
    {
      kind: 'cargo-test',
      command: 'cargo test --locked',
      exitCode: 0,
      stdout: 'test result: ok. 42 passed',
      stderr: '',
      durationMs: 1200,
      required: true,
    },
  ],
  timings: {
    totalMs: 4800,
    commandMs: 1200,
  },
  diagnostics: ['borrow checker error E0502 resolved'],
  secondaryMetrics: {
    diffLines: 12,
    durationMs: 4800,
    lintWarnings: 0,
    testQuality: 0.9,
  },
  ...overrides,
});

describe('scoreRustTaskRun', () => {
  it('blocks an otherwise clean candidate when the required oracle fails', () => {
    const evaluation = scoreRustTaskRun(
      successfulRun({
        commandResults: [
          {
            kind: 'cargo-test',
            command: 'cargo test --locked',
            exitCode: 101,
            stdout: '',
            stderr: 'thread panicked: assertion failed in hidden file traversal',
            durationMs: 900,
            required: true,
          },
        ],
        secondaryMetrics: {
          diffLines: 3,
          durationMs: 900,
          lintWarnings: 0,
          testQuality: 1,
        },
      }),
    );

    expect(evaluation.passedCorrectness).toBe(false);
    expect(evaluation.acceptable).toBe(false);
    expect(evaluation.score).toBe(0);
    expect(evaluation.failureReasons).toContain('required oracle failed: cargo test --locked');
    expect(evaluation.scoreBreakdown.correctness).toBe(0);
    expect(evaluation.scoreBreakdown.diffSize).toBeGreaterThan(0);
  });

  it('records rich side information for each evaluation', () => {
    const evaluation = scoreRustTaskRun(
      successfulRun({
        modelFamily: 'claude-opus',
        candidateSkillId: 'human-seed-rust',
      }),
    );

    expect(evaluation.sideInfo).toMatchObject({
      task: {
        id: 'fd-fix-hidden-files',
        prompt: 'Fix the hidden-file traversal regression without changing public CLI semantics.',
        repository: { id: 'sharkdp/fd' },
        split: 'train',
      },
      modelFamily: 'claude-opus',
      candidateSkillId: 'human-seed-rust',
      agentTrace: 'Inspected a borrow checker error and adjusted iterator ownership.',
      patchSummary: 'Changed hidden-file traversal to avoid a borrowed iterator escaping.',
      timings: {
        totalMs: 4800,
        commandMs: 1200,
      },
      diagnostics: ['borrow checker error E0502 resolved'],
    });
    expect(evaluation.commandResults[0]).toMatchObject({
      command: 'cargo test --locked',
      exitCode: 0,
      stdout: 'test result: ok. 42 passed',
      durationMs: 1200,
    });
    expect(evaluation.scoreBreakdown).toMatchObject({
      correctness: 1,
      diffSize: expect.any(Number),
      speed: expect.any(Number),
      lint: expect.any(Number),
      testQuality: 0.9,
    });
  });
});

describe('feedbackForGepa', () => {
  it('keeps actionable diagnostics while omitting exploitable eval structure', () => {
    const evaluation = scoreRustTaskRun(
      successfulRun({
        task: rustTask({ split: 'heldout' }),
        commandResults: [
          {
            kind: 'cargo-test',
            command: 'cargo test --locked',
            exitCode: 101,
            stdout: '',
            stderr: 'assertion failed in hidden file traversal',
            durationMs: 900,
            required: true,
          },
        ],
        diagnostics: [
          'heldout expected defect count 2 fixture regularity suggests validation optimizer mutation',
        ],
      }),
    );

    const feedback = feedbackForGepa(evaluation);

    expect(feedback).toContain('cargo test --locked failed');
    expect(feedback).toContain('assertion failed in hidden file traversal');
    expect(feedback).not.toMatch(/\b(train|validation|heldout)\b/i);
    expect(feedback).not.toMatch(/expected defect count/i);
    expect(feedback).not.toMatch(/fixture regularity/i);
    expect(feedback).not.toMatch(/\b(GEPA|optimizer|mutation|Pareto)\b/i);
  });
});
