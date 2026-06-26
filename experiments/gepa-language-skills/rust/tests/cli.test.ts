import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runRustExperimentCli, type RustExperimentCliMode } from '../src/cli';
import type { RustCommandRunner, RustProcessInvocation } from '../src/runner';

const repoRoot = join(import.meta.dirname, '../../../..');
const pilotManifestPath = join(repoRoot, 'experiments/gepa-language-skills/rust/tasks/pilot.json');
const humanSeedSkillPath = join(
  repoRoot,
  'experiments/gepa-language-skills/rust/candidates/human-seed-rust/SKILL.md',
);

describe('runRustExperimentCli', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('dry-runs one pilot task and writes a JSONL artifact', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-cli-'));
    const artifactPath = join(tempDir, 'artifacts', 'runs.jsonl');
    const stdout: string[] = [];

    const exitCode = await runRustExperimentCli(
      [
        '--dry-run',
        '--manifest',
        pilotManifestPath,
        '--task-id',
        'fd-cli-filesystem-bugfix',
        '--patch-file',
        '/tmp/candidate.patch',
        '--run-root',
        join(tempDir, 'runs'),
        '--run-id',
        'run-001',
        '--artifact',
        artifactPath,
        '--model-family',
        'gpt-codex',
        '--candidate-skill-id',
        'no-skill',
      ],
      { stdout: line => stdout.push(line) },
    );

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain(`wrote artifact: ${artifactPath}`);

    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8').trim()) as Record<
      string,
      unknown
    >;
    expect(artifact).toMatchObject({
      schemaVersion: 'rust-language-skill-run/v0',
      taskId: 'fd-cli-filesystem-bugfix',
      repositoryId: 'sharkdp/fd',
      split: 'train',
      modelFamily: 'gpt-codex',
      candidateSkillId: 'no-skill',
      evaluation: {
        passedCorrectness: true,
      },
    });
    expect(JSON.stringify(artifact)).toContain('dry-run: docker run');
  });

  it('dry-runs the no-skill baseline without a patch file', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-cli-baseline-'));
    const artifactPath = join(tempDir, 'artifacts', 'baseline.jsonl');

    const exitCode = await runRustExperimentCli([
      '--dry-run',
      '--manifest',
      pilotManifestPath,
      '--task-id',
      'fd-cli-filesystem-bugfix',
      '--run-root',
      join(tempDir, 'runs'),
      '--run-id',
      'baseline-run',
      '--artifact',
      artifactPath,
      '--model-family',
      'gpt-codex',
      '--candidate-skill-id',
      'no-skill',
    ]);

    expect(exitCode).toBe(0);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8').trim()) as Record<
      string,
      unknown
    >;
    expect(artifact).toMatchObject({
      candidateSkillId: 'no-skill',
      plan: {
        patch: { kind: 'none' },
      },
      evaluation: {
        passedCorrectness: true,
      },
    });
    expect(JSON.stringify(artifact)).not.toContain('git apply');
  });

  it('rejects named candidates without a patch file', async () => {
    const stderr: string[] = [];

    const exitCode = await runRustExperimentCli(
      [
        '--dry-run',
        '--manifest',
        pilotManifestPath,
        '--task-id',
        'fd-cli-filesystem-bugfix',
        '--candidate-skill-id',
        'optimized-rust-v1',
      ],
      { stderr: line => stderr.push(line) },
    );

    expect(exitCode).toBe(1);
    expect(stderr.join('\n')).toContain('--patch-file is required for candidate skill runs');
  });

  it('reviews and records candidate skill files', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-cli-candidate-'));
    const artifactPath = join(tempDir, 'artifacts', 'candidate.jsonl');

    const exitCode = await runRustExperimentCli([
      '--dry-run',
      '--manifest',
      pilotManifestPath,
      '--task-id',
      'fd-cli-filesystem-bugfix',
      '--patch-file',
      '/tmp/candidate.patch',
      '--run-root',
      join(tempDir, 'runs'),
      '--run-id',
      'candidate-run',
      '--artifact',
      artifactPath,
      '--model-family',
      'gpt-codex',
      '--candidate-skill-id',
      'human-seed-rust',
      '--candidate-skill-file',
      humanSeedSkillPath,
    ]);

    expect(exitCode).toBe(0);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8').trim()) as Record<
      string,
      unknown
    >;
    expect(artifact).toMatchObject({
      candidateSkillId: 'human-seed-rust',
      candidateSkill: {
        id: 'human-seed-rust',
        path: humanSeedSkillPath,
      },
      evaluation: {
        passedCorrectness: true,
      },
    });
  });

  it('rejects candidate skill files whose id does not match --candidate-skill-id', async () => {
    const stderr: string[] = [];

    const exitCode = await runRustExperimentCli(
      [
        '--dry-run',
        '--manifest',
        pilotManifestPath,
        '--task-id',
        'fd-cli-filesystem-bugfix',
        '--patch-file',
        '/tmp/candidate.patch',
        '--candidate-skill-id',
        'optimized-rust-v1',
        '--candidate-skill-file',
        humanSeedSkillPath,
      ],
      { stderr: line => stderr.push(line) },
    );

    expect(exitCode).toBe(1);
    expect(stderr.join('\n')).toContain(
      '--candidate-skill-id must match candidate skill file name',
    );
  });

  it('uses the live command runner only when --live is explicit', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-cli-live-'));
    const artifactPath = join(tempDir, 'artifacts', 'runs.jsonl');
    const requestedModes: RustExperimentCliMode[] = [];
    const calls: RustProcessInvocation[] = [];
    const liveRunner: RustCommandRunner = {
      run: async invocation => {
        calls.push(invocation);
        return {
          exitCode: 0,
          stdout: calls.length === 13 ? 'live oracle ok' : '',
          stderr: '',
          durationMs: 1,
        };
      },
    };

    const exitCode = await runRustExperimentCli(
      [
        '--live',
        '--manifest',
        pilotManifestPath,
        '--task-id',
        'fd-cli-filesystem-bugfix',
        '--patch-file',
        '/tmp/candidate.patch',
        '--run-root',
        join(tempDir, 'runs'),
        '--run-id',
        'run-live',
        '--artifact',
        artifactPath,
      ],
      {
        commandRunnerFactory: mode => {
          requestedModes.push(mode);
          return liveRunner;
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(requestedModes).toEqual(['live']);
    expect(calls).toHaveLength(14);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8').trim()) as Record<
      string,
      unknown
    >;
    expect(artifact).toMatchObject({
      schemaVersion: 'rust-language-skill-run/v0',
      taskId: 'fd-cli-filesystem-bugfix',
      run: {
        commandResults: [{ stdout: 'live oracle ok' }],
      },
    });
  });
});
