import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  cleanupDockerContainerForInvocation,
  createDryRunCommandRunner,
  createNodeCommandRunner,
  dockerCidFileForInvocation,
} from '../src/process-runner';

describe('createDryRunCommandRunner', () => {
  it('records a successful dry-run result without executing the command', async () => {
    const runner = createDryRunCommandRunner();

    const result = await runner.run({ argv: ['docker', 'run', 'rust:1.96@sha256:abc'] });

    expect(result).toMatchObject({
      exitCode: 0,
      stdout: 'dry-run: docker run rust:1.96@sha256:abc',
      stderr: '',
    });
    expect(result.durationMs).toBe(0);
  });
});

describe('createNodeCommandRunner', () => {
  it('captures stdout, stderr, exit code, and duration from a spawned command', async () => {
    const runner = createNodeCommandRunner();

    const result = await runner.run({
      argv: [
        process.execPath,
        '-e',
        'process.stdout.write("ok"); process.stderr.write("warn"); process.exit(7);',
      ],
    });

    expect(result.exitCode).toBe(7);
    expect(result.stdout).toBe('ok');
    expect(result.stderr).toBe('warn');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('terminates spawned commands when a timeout is provided', async () => {
    const runner = createNodeCommandRunner();

    const result = await runner.run({
      argv: [process.execPath, '-e', 'setTimeout(() => {}, 10_000);'],
      timeoutSeconds: 0.05,
    });

    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain('timed out after 0.05s');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('Docker timeout cleanup helpers', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('finds and cleans up Docker containers from cidfiles', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'safeword-rust-cid-'));
    const cidFile = join(tempDir, 'oracle.cid');
    writeFileSync(cidFile, 'container-123\n', 'utf8');
    const cleaned: string[] = [];
    const argv = ['docker', 'run', '--rm', '--cidfile', cidFile, 'rust:1.96'];

    expect(dockerCidFileForInvocation(argv)).toBe(cidFile);
    expect(
      cleanupDockerContainerForInvocation(argv, containerId => {
        cleaned.push(containerId);
      }),
    ).toBe('container-123');
    expect(cleaned).toEqual(['container-123']);
  });
});
