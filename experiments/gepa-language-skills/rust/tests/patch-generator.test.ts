import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createCommandRustPatchAgentAdapter,
  createFakeRustPatchAgentAdapter,
  generateRustCandidatePatches,
  runRustPatchGeneratorCli,
  type RustPatchAgentRequest,
} from '../src/patch-generator';
import type { RustCommandRunner } from '../src/runner';

const repoRoot = join(import.meta.dirname, '../../../..');
const pilotManifestPath = join(repoRoot, 'experiments/gepa-language-skills/rust/tasks/pilot.json');
const distilledSkillPath = join(
  repoRoot,
  'experiments/gepa-language-skills/rust/candidates/distilled-rust-ownership-v1/SKILL.md',
);

const generatedPatch = [
  'diff --git a/src/lib.rs b/src/lib.rs',
  'index 1111111..2222222 100644',
  '--- a/src/lib.rs',
  '+++ b/src/lib.rs',
  '@@ -1,1 +1,1 @@',
  '-old',
  '+new',
  '',
].join('\n');

describe('generateRustCandidatePatches', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('writes matrix-ready patch files and a generation report', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-patch-generator-'));
    const patchDir = join(tempDir, 'patches');
    const reportPath = join(tempDir, 'patch-report.json');
    const requests: RustPatchAgentRequest[] = [];

    const result = await generateRustCandidatePatches({
      manifestPath: pilotManifestPath,
      taskIds: ['fd-cli-filesystem-bugfix', 'clap-parser-ergonomics-bugfix'],
      patchDir,
      reportPath,
      candidateSkillId: 'distilled-rust-ownership-v1',
      candidateSkillPath: distilledSkillPath,
      modelFamily: 'gpt-codex',
      adapter: createFakeRustPatchAgentAdapter(request => {
        requests.push(request);
        return {
          patch: generatedPatch,
          summary: `Generated patch for ${request.task.prompt}`,
          trace: 'Fake patch agent used distilled Rust ownership guidance.',
        };
      }),
    });

    expect(result).toMatchObject({
      schemaVersion: 'rust-language-skill-patches/v0',
      candidateSkillId: 'distilled-rust-ownership-v1',
      modelFamily: 'gpt-codex',
      patchCount: 2,
    });
    expect(readFileSync(join(patchDir, 'fd-cli-filesystem-bugfix.patch'), 'utf8')).toBe(
      generatedPatch,
    );
    expect(readFileSync(join(patchDir, 'clap-parser-ergonomics-bugfix.patch'), 'utf8')).toBe(
      generatedPatch,
    );
    expect(existsSync(reportPath)).toBe(true);

    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      patches: Array<{ patchFile: string; taskId: string }>;
    };
    expect(report.patches).toEqual([
      expect.objectContaining({
        taskId: 'fd-cli-filesystem-bugfix',
        patchFile: join(patchDir, 'fd-cli-filesystem-bugfix.patch'),
      }),
      expect.objectContaining({
        taskId: 'clap-parser-ergonomics-bugfix',
        patchFile: join(patchDir, 'clap-parser-ergonomics-bugfix.patch'),
      }),
    ]);

    expect(requests).toHaveLength(2);
    expect(requests[0].candidateSkill.id).toBe('distilled-rust-ownership-v1');
    expect(requests[0].candidateSkill.text).toContain('Resolving Borrow-Checker Errors');
    expect(requests[0].task).toMatchObject({
      prompt: expect.stringContaining('Fix a CLI filesystem traversal regression'),
      oracleCommand: 'cargo test --locked',
    });
    expect(JSON.stringify(requests)).not.toMatch(
      /\b(train|validation|heldout|GEPA|optimizer|mutation|sourceArtifact)\b/i,
    );
  });

  it('rejects invalid generated patches before writing a report', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-patch-generator-invalid-'));
    const patchDir = join(tempDir, 'patches');
    const reportPath = join(tempDir, 'patch-report.json');

    await expect(
      generateRustCandidatePatches({
        manifestPath: pilotManifestPath,
        taskIds: ['fd-cli-filesystem-bugfix'],
        patchDir,
        reportPath,
        candidateSkillId: 'distilled-rust-ownership-v1',
        candidateSkillPath: distilledSkillPath,
        modelFamily: 'gpt-codex',
        adapter: createFakeRustPatchAgentAdapter({
          patch: 'not a unified diff',
          summary: 'Invalid patch.',
          trace: 'Invalid patch agent output.',
        }),
      }),
    ).rejects.toThrow(/generated patch for task fd-cli-filesystem-bugfix is not a unified diff/);
    expect(existsSync(reportPath)).toBe(false);
  });
});

describe('runRustPatchGeneratorCli', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('runs the fake patch agent through the CLI entrypoint', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-patch-generator-cli-'));
    const patchDir = join(tempDir, 'patches');
    const reportPath = join(tempDir, 'patch-report.json');
    const stdout: string[] = [];

    const exitCode = await runRustPatchGeneratorCli(
      [
        '--manifest',
        pilotManifestPath,
        '--task-id',
        'fd-cli-filesystem-bugfix',
        '--patch-dir',
        patchDir,
        '--report',
        reportPath,
        '--candidate-skill-id',
        'distilled-rust-ownership-v1',
        '--candidate-skill-file',
        distilledSkillPath,
        '--model-family',
        'gpt-codex',
        '--fake-agent',
      ],
      { stdout: line => stdout.push(line) },
    );

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('patches: 1');
    expect(stdout.join('\n')).toContain(`wrote patches: ${patchDir}`);
    expect(readFileSync(join(patchDir, 'fd-cli-filesystem-bugfix.patch'), 'utf8')).toContain(
      'diff --git',
    );
    expect(existsSync(reportPath)).toBe(true);
  });

  it('keeps bare agent commands PATH-resolvable', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-patch-generator-command-'));
    const patchDir = join(tempDir, 'patches');
    const reportPath = join(tempDir, 'patch-report.json');
    const calls: string[][] = [];
    const runner: RustCommandRunner = {
      run: async invocation => {
        calls.push(invocation.argv);
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            patch: generatedPatch,
            summary: 'Command adapter generated a patch.',
            trace: 'Command adapter trace.',
          }),
          stderr: '',
          durationMs: 1,
        };
      },
    };

    const exitCode = await runRustPatchGeneratorCli(
      [
        '--manifest',
        pilotManifestPath,
        '--task-id',
        'fd-cli-filesystem-bugfix',
        '--patch-dir',
        patchDir,
        '--report',
        reportPath,
        '--candidate-skill-id',
        'distilled-rust-ownership-v1',
        '--candidate-skill-file',
        distilledSkillPath,
        '--agent-request-dir',
        join(tempDir, 'requests'),
        '--agent-command',
        'rust-patch-agent',
      ],
      { commandRunner: runner },
    );

    expect(exitCode).toBe(0);
    expect(calls[0][0]).toBe('rust-patch-agent');
    expect(readFileSync(join(patchDir, 'fd-cli-filesystem-bugfix.patch'), 'utf8')).toBe(
      generatedPatch,
    );
  });
});

describe('createCommandRustPatchAgentAdapter', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('passes patch-agent requests through a JSON file and parses JSON output', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-patch-command-'));
    const calls: string[][] = [];
    const runner: RustCommandRunner = {
      run: async invocation => {
        calls.push(invocation.argv);
        const requestPath = invocation.argv.at(-1);
        expect(requestPath).toContain('patch-request-');
        const request = JSON.parse(readFileSync(String(requestPath), 'utf8')) as {
          candidateSkill: { id: string };
          task: { oracleCommand: string };
        };
        expect(request).toMatchObject({
          candidateSkill: { id: 'distilled-rust-ownership-v1' },
          task: { oracleCommand: 'cargo test --locked' },
        });
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            patch: generatedPatch,
            summary: 'Command adapter generated a patch.',
            trace: 'Command adapter trace.',
          }),
          stderr: '',
          durationMs: 1,
        };
      },
    };

    const adapter = createCommandRustPatchAgentAdapter({
      command: '/usr/local/bin/rust-patch-agent',
      args: ['--json'],
      requestDir: join(tempDir, 'requests'),
      runner,
    });

    await expect(
      adapter.generatePatch({
        candidateSkill: {
          id: 'distilled-rust-ownership-v1',
          description: 'Rust guidance',
          text: 'Prefer compiler diagnostics.',
        },
        modelFamily: 'gpt-codex',
        task: {
          prompt: 'Fix a Rust task.',
          repositoryUrl: 'https://github.com/example/repo',
          checkoutRef: '1111111111111111111111111111111111111111',
          allowedCommands: ['cargo test --locked'],
          oracleCommand: 'cargo test --locked',
        },
      }),
    ).resolves.toEqual({
      patch: generatedPatch,
      summary: 'Command adapter generated a patch.',
      trace: 'Command adapter trace.',
    });
    expect(calls[0].slice(0, 2)).toEqual(['/usr/local/bin/rust-patch-agent', '--json']);
  });
});
