import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { loadRustTaskManifest } from '../src/dataset';
import { scoreRustTaskRun, type RustTaskRun } from '../src/evaluator';
import {
  createFakeRustSkillMutationAdapter,
  optimizeRustSkillCandidate,
  runRustOptimizerCli,
  type RustSkillMutationRequest,
} from '../src/optimize';
import type { RustRunArtifact } from '../src/runner';

const repoRoot = join(import.meta.dirname, '../../../..');
const pilotManifestPath = join(repoRoot, 'experiments/gepa-language-skills/rust/tasks/pilot.json');
const humanSeedSkillPath = join(
  repoRoot,
  'experiments/gepa-language-skills/rust/candidates/human-seed-rust/SKILL.md',
);

const candidateSkillText = (
  name: string,
  body = 'Use Rust compiler diagnostics to guide small, local fixes.',
): string =>
  [
    '---',
    `name: ${name}`,
    'description: Candidate Rust guidance for general code changes.',
    '---',
    '',
    '# Rust',
    '',
    body,
    '',
  ].join('\n');

describe('optimizeRustSkillCandidate', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('writes a reviewed candidate skill from sanitized failed run feedback', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-optimizer-'));
    const artifactPath = join(tempDir, 'artifacts', 'failed.jsonl');
    writeJsonl(artifactPath, [failedArtifact()]);
    const requests: RustSkillMutationRequest[] = [];

    const result = await optimizeRustSkillCandidate({
      baseSkillPath: humanSeedSkillPath,
      artifactPath,
      outputRoot: join(tempDir, 'candidates'),
      candidateId: 'optimized-rust-v1',
      adapter: createFakeRustSkillMutationAdapter(request => {
        requests.push(request);
        return {
          skillMarkdown: candidateSkillText('optimized-rust-v1'),
          rationale:
            'Group recurring borrow and command-failure diagnostics into reusable guidance.',
        };
      }),
    });

    expect(result).toMatchObject({
      schemaVersion: 'rust-language-skill-optimization/v0',
      candidateId: 'optimized-rust-v1',
      accepted: true,
      blockers: [],
      failureCount: 1,
      modelFamilies: ['gpt-codex'],
    });
    expect(readFileSync(result.outputSkillPath, 'utf8')).toContain('name: optimized-rust-v1');
    expect(existsSync(result.reportPath)).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      candidateId: 'optimized-rust-v1',
      baseSkill: {
        id: 'human-seed-rust',
      },
      modelFamilies: ['gpt-codex'],
    });
    expect(requests[0].baseSkill.description).toContain('Rust coding guidance');
    const feedback = requests[0].failedRuns[0].feedback;
    expect(feedback).toContain('cargo test --locked failed with exit 1');
    expect(feedback).not.toMatch(/\b(train|validation|heldout|GEPA|optimizer|mutation)\b/i);
    expect(feedback).not.toContain('expected defect count');
    expect(feedback).not.toContain('fixture regularity');

    const report = JSON.parse(readFileSync(result.reportPath, 'utf8')) as Record<string, unknown>;
    expect(report).toMatchObject({
      accepted: true,
      rationale: 'Group recurring borrow and command-failure diagnostics into reusable guidance.',
      failureCount: 1,
    });
  });

  it('persists rejected candidate proposals with blocker reasons', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-optimizer-reject-'));
    const artifactPath = join(tempDir, 'artifacts', 'failed.jsonl');
    writeJsonl(artifactPath, [failedArtifact()]);

    const result = await optimizeRustSkillCandidate({
      baseSkillPath: humanSeedSkillPath,
      artifactPath,
      outputRoot: join(tempDir, 'candidates'),
      candidateId: 'optimized-rust-v2',
      adapter: createFakeRustSkillMutationAdapter({
        skillMarkdown: candidateSkillText(
          'optimized-rust-v2',
          'For train failures in sharkdp/fd, hard-code the known cargo command.',
        ),
        rationale: 'Unsafe proposal kept for audit.',
      }),
    });

    expect(result.accepted).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining(['repo memorization: sharkdp/fd', 'eval-aware text: train']),
    );
    expect(readFileSync(result.outputSkillPath, 'utf8')).toContain('sharkdp/fd');
    const report = JSON.parse(readFileSync(result.reportPath, 'utf8')) as {
      blockers?: string[];
    };
    expect(report.blockers).toEqual(result.blockers);
  });

  it('skips candidate generation when no failed runs are available', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-optimizer-skip-'));
    const artifactPath = join(tempDir, 'artifacts', 'accepted.jsonl');
    writeJsonl(artifactPath, [acceptedArtifact()]);
    let called = false;

    const result = await optimizeRustSkillCandidate({
      baseSkillPath: humanSeedSkillPath,
      artifactPath,
      outputRoot: join(tempDir, 'candidates'),
      candidateId: 'optimized-rust-v3',
      adapter: createFakeRustSkillMutationAdapter(() => {
        called = true;
        return {
          skillMarkdown: candidateSkillText('optimized-rust-v3'),
          rationale: 'Should not be used.',
        };
      }),
    });

    expect(called).toBe(false);
    expect(result).toMatchObject({
      accepted: false,
      failureCount: 0,
      skippedReason: 'no failed runs',
    });
    expect(existsSync(result.outputSkillPath)).toBe(false);
    const report = JSON.parse(readFileSync(result.reportPath, 'utf8')) as Record<string, unknown>;
    expect(report).toMatchObject({ skippedReason: 'no failed runs' });
  });

  it('rejects malformed run artifacts before feedback generation', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-optimizer-invalid-'));
    const artifactPath = join(tempDir, 'artifacts', 'invalid.jsonl');
    writeJsonl(artifactPath, [
      {
        schemaVersion: 'rust-language-skill-run/v0',
        taskId: 'fd-cli-filesystem-bugfix',
        repositoryId: 'sharkdp/fd',
        modelFamily: 'gpt-codex',
        candidateSkillId: 'human-seed-rust',
        evaluation: {
          score: 0,
          acceptable: false,
          failureReasons: ['required oracle failed'],
        },
      },
    ]);

    await expect(
      optimizeRustSkillCandidate({
        baseSkillPath: humanSeedSkillPath,
        artifactPath,
        outputRoot: join(tempDir, 'candidates'),
        candidateId: 'optimized-rust-invalid',
        adapter: createFakeRustSkillMutationAdapter({
          skillMarkdown: candidateSkillText('optimized-rust-invalid'),
          rationale: 'Should not be used.',
        }),
      }),
    ).rejects.toThrow(/invalid Rust run artifact .*invalid\.jsonl:1/);
  });
});

describe('runRustOptimizerCli', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('runs the fake adapter through the CLI entrypoint', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-optimizer-cli-'));
    const artifactPath = join(tempDir, 'artifacts', 'failed.jsonl');
    writeJsonl(artifactPath, [failedArtifact({ modelFamily: 'claude-opus' })]);
    const stdout: string[] = [];

    const exitCode = await runRustOptimizerCli(
      [
        '--base-skill-file',
        humanSeedSkillPath,
        '--artifact',
        artifactPath,
        '--output-root',
        join(tempDir, 'candidates'),
        '--candidate-id',
        'optimized-rust-v4',
        '--fake-adapter',
      ],
      { stdout: line => stdout.push(line) },
    );

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('candidate: optimized-rust-v4');
    expect(stdout.join('\n')).toContain('accepted: true');
    expect(existsSync(join(tempDir, 'candidates', 'optimized-rust-v4', 'SKILL.md'))).toBe(true);
  });
});

function writeJsonl(path: string, records: unknown[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${records.map(record => JSON.stringify(record)).join('\n')}\n`, 'utf8');
}

function failedArtifact(
  overrides: { modelFamily?: 'claude-opus' | 'gpt-codex' } = {},
): RustRunArtifact {
  return artifactFromRun({
    exitCode: 1,
    stderr:
      'borrow checker failure in heldout case; GEPA expected defect count: 3; fixture regularity found',
    diagnostics: ['validation split optimizer mutation detail should be redacted'],
    modelFamily: overrides.modelFamily ?? 'gpt-codex',
  });
}

function acceptedArtifact(): RustRunArtifact {
  return artifactFromRun({
    exitCode: 0,
    stderr: '',
    diagnostics: [],
    modelFamily: 'gpt-codex',
  });
}

function artifactFromRun(input: {
  exitCode: number;
  stderr: string;
  diagnostics: string[];
  modelFamily: 'claude-opus' | 'gpt-codex';
}): RustRunArtifact {
  const task = loadRustTaskManifest(pilotManifestPath)[0];
  const run: RustTaskRun = {
    task,
    modelFamily: input.modelFamily,
    candidateSkillId: 'human-seed-rust',
    agentTrace: 'Agent trace body.',
    patchSummary: 'Patch summary body.',
    commandResults: [
      {
        kind: task.oracle.kind,
        command: task.oracle.command,
        exitCode: input.exitCode,
        stdout: '',
        stderr: input.stderr,
        durationMs: 100,
        required: true,
      },
    ],
    timings: {
      totalMs: 100,
      commandMs: 100,
    },
    diagnostics: input.diagnostics,
    secondaryMetrics: {
      diffLines: 5,
      durationMs: 100,
      lintWarnings: 0,
      testQuality: 0.9,
    },
  };
  const evaluation = scoreRustTaskRun(run);

  return {
    schemaVersion: 'rust-language-skill-run/v0',
    createdAt: '2026-06-26T00:00:00.000Z',
    taskId: task.id,
    repositoryId: task.repository.id,
    split: task.split,
    modelFamily: input.modelFamily,
    candidateSkillId: 'human-seed-rust',
    plan: {
      taskId: task.id,
      paths: {
        source: '/tmp/source',
        worktree: '/tmp/worktree',
        cache: '/tmp/cache',
      },
      cache: {
        kind: 'docker-volume',
        name: 'safeword-rust-test-cache',
        target: '/workspace/cache',
      },
      steps: [],
      patch: { kind: 'none' },
      docker: {
        argv: ['docker', 'run'],
        timeoutSeconds: 900,
        networkPolicy: task.sandbox.network,
      },
      oracleCommands: [task.oracle.command],
    },
    setupResults: [],
    run,
    evaluation,
  };
}
