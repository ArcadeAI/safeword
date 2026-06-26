import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runRustMatrixCli, type RustMatrixCliMode } from '../src/matrix';
import type { RustCommandRunner } from '../src/runner';

const repoRoot = join(import.meta.dirname, '../../../..');
const pilotManifestPath = join(repoRoot, 'experiments/gepa-language-skills/rust/tasks/pilot.json');
const humanSeedSkillPath = join(
  repoRoot,
  'experiments/gepa-language-skills/rust/candidates/human-seed-rust/SKILL.md',
);
const validPatch = [
  'diff --git a/src/lib.rs b/src/lib.rs',
  'index 1111111..2222222 100644',
  '--- a/src/lib.rs',
  '+++ b/src/lib.rs',
  '@@ -1,1 +1,1 @@',
  '-old',
  '+new',
  '',
].join('\n');

describe('runRustMatrixCli', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('dry-runs selected pilot tasks and writes one JSONL artifact per task', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-matrix-'));
    const patchDir = join(tempDir, 'patches');
    const artifactPath = join(tempDir, 'artifacts', 'matrix.jsonl');
    const stdout: string[] = [];
    mkdirSync(patchDir, { recursive: true });
    writeFileSync(join(patchDir, 'fd-cli-filesystem-bugfix.patch'), validPatch, 'utf8');
    writeFileSync(join(patchDir, 'clap-parser-ergonomics-bugfix.patch'), validPatch, 'utf8');

    const exitCode = await runRustMatrixCli(
      [
        '--dry-run',
        '--manifest',
        pilotManifestPath,
        '--task-id',
        'fd-cli-filesystem-bugfix',
        '--task-id',
        'clap-parser-ergonomics-bugfix',
        '--patch-dir',
        patchDir,
        '--run-root',
        join(tempDir, 'runs'),
        '--run-prefix',
        'human-seed',
        '--artifact',
        artifactPath,
        '--model-family',
        'gpt-codex',
        '--candidate-skill-id',
        'human-seed-rust',
        '--candidate-skill-file',
        humanSeedSkillPath,
      ],
      { stdout: line => stdout.push(line) },
    );

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('tasks: 2');

    const artifacts = readFileSync(artifactPath, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as Record<string, unknown>);
    expect(artifacts).toHaveLength(2);
    expect(artifacts[0]).toMatchObject({
      taskId: 'fd-cli-filesystem-bugfix',
      candidateSkillId: 'human-seed-rust',
      candidateSkill: {
        id: 'human-seed-rust',
        path: humanSeedSkillPath,
      },
      plan: {
        patch: { kind: 'file', path: join(patchDir, 'fd-cli-filesystem-bugfix.patch') },
      },
      evaluation: {
        passedCorrectness: true,
      },
    });
    expect(artifacts[1]).toMatchObject({
      taskId: 'clap-parser-ergonomics-bugfix',
      plan: {
        patch: {
          kind: 'file',
          path: join(patchDir, 'clap-parser-ergonomics-bugfix.patch'),
        },
      },
    });
  });

  it('rejects missing task patches before creating a command runner', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-matrix-missing-'));
    const patchDir = join(tempDir, 'patches');
    const stderr: string[] = [];
    const requestedModes: RustMatrixCliMode[] = [];
    const runner: RustCommandRunner = {
      run: async () => {
        throw new Error('runner should not be called');
      },
    };
    mkdirSync(patchDir, { recursive: true });
    writeFileSync(join(patchDir, 'fd-cli-filesystem-bugfix.patch'), validPatch, 'utf8');

    const exitCode = await runRustMatrixCli(
      [
        '--dry-run',
        '--manifest',
        pilotManifestPath,
        '--task-id',
        'fd-cli-filesystem-bugfix',
        '--task-id',
        'clap-parser-ergonomics-bugfix',
        '--patch-dir',
        patchDir,
        '--run-root',
        join(tempDir, 'runs'),
        '--artifact',
        join(tempDir, 'artifacts', 'matrix.jsonl'),
        '--candidate-skill-id',
        'human-seed-rust',
        '--candidate-skill-file',
        humanSeedSkillPath,
      ],
      {
        stderr: line => stderr.push(line),
        commandRunnerFactory: mode => {
          requestedModes.push(mode);
          return runner;
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stderr.join('\n')).toContain('missing patch for task clap-parser-ergonomics-bugfix');
    expect(requestedModes).toEqual([]);
  });

  it('rejects empty task patches before creating a command runner', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-matrix-empty-'));
    const patchDir = join(tempDir, 'patches');
    const stderr: string[] = [];
    const requestedModes: RustMatrixCliMode[] = [];
    const runner: RustCommandRunner = {
      run: async () => {
        throw new Error('runner should not be called');
      },
    };
    mkdirSync(patchDir, { recursive: true });
    writeFileSync(join(patchDir, 'fd-cli-filesystem-bugfix.patch'), '', 'utf8');

    const exitCode = await runRustMatrixCli(
      [
        '--dry-run',
        '--manifest',
        pilotManifestPath,
        '--task-id',
        'fd-cli-filesystem-bugfix',
        '--patch-dir',
        patchDir,
        '--run-root',
        join(tempDir, 'runs'),
        '--artifact',
        join(tempDir, 'artifacts', 'matrix.jsonl'),
        '--candidate-skill-id',
        'human-seed-rust',
        '--candidate-skill-file',
        humanSeedSkillPath,
      ],
      {
        stderr: line => stderr.push(line),
        commandRunnerFactory: mode => {
          requestedModes.push(mode);
          return runner;
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stderr.join('\n')).toContain('empty patch for task fd-cli-filesystem-bugfix');
    expect(requestedModes).toEqual([]);
  });

  it('rejects candidate skill files whose id does not match --candidate-skill-id', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-matrix-id-'));
    const patchDir = join(tempDir, 'patches');
    const stderr: string[] = [];
    mkdirSync(patchDir, { recursive: true });
    writeFileSync(join(patchDir, 'fd-cli-filesystem-bugfix.patch'), validPatch, 'utf8');

    const exitCode = await runRustMatrixCli(
      [
        '--dry-run',
        '--manifest',
        pilotManifestPath,
        '--task-id',
        'fd-cli-filesystem-bugfix',
        '--patch-dir',
        patchDir,
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
});
