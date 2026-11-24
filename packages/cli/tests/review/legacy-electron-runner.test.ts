import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { executeNoShellCommand } from '../../src/review/red-execution.js';
import { runElectronProof } from '../../src/review/retrospective-electron-proof.js';
import { electronRequest, electronRunnerFixture } from './legacy-electron-runner.fixture.js';

afterEach(() => vi.unstubAllEnvs());

it('identifies an untracked declared support input before installation', async () => {
  const fixture = electronRunnerFixture();
  const support = 'packages/desktop/untracked-support.ts';
  const request = { ...electronRequest, supportFiles: [...electronRequest.supportFiles, support] };
  try {
    fixture.write(fixture.requestPath, JSON.stringify(request));
    fixture.git('add', fixture.requestPath);
    fixture.git('commit', '-qm', 'declare support without committing it');
    fixture.write(support, 'untracked runtime input');
    await expect(runElectronProof(fixture.root, request, fixture.requestPath)).rejects.toThrow(
      `Could not verify committed Electron input: ${support}`,
    );
  } finally {
    fixture.cleanup();
  }
});

it('passes owned Electron isolation to a real child without changing the host environment', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-electron-environment-'));
  const previousPort = process.env.SOULLESS_ELECTRON_TEST_PORT;
  try {
    const result = await executeNoShellCommand({
      projectRoot: root,
      cwd: '.',
      argv: [
        process.execPath,
        '-e',
        'console.log(JSON.stringify({port:process.env.SOULLESS_ELECTRON_TEST_PORT,profile:process.env.TMPDIR,secret:process.env.SAFEWORD_REVIEW_JOB_ID}))',
      ],
      timeoutMs: 10_000,
      environment: {
        ...process.env,
        SOULLESS_ELECTRON_TEST_PORT: '6499',
        TMPDIR: path.join(root, 'owned-profile'),
        SAFEWORD_REVIEW_JOB_ID: 'must-not-reach-electron',
      },
    });
    expect(result.termination).toMatchObject({ exitCode: 0, timedOut: false });
    expect(JSON.parse(result.stdout.excerpt)).toEqual({
      port: '6499',
      profile: path.join(root, 'owned-profile'),
    });
    expect(process.env.SOULLESS_ELECTRON_TEST_PORT).toBe(previousPort);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

it.runIf(process.platform !== 'win32')(
  'builds committed original and mutant snapshots with independent frozen installs',
  async () => {
    const fixture = electronRunnerFixture();
    for (const [name, value] of Object.entries(fixture.environment)) vi.stubEnv(name, value);
    fixture.write('untracked-poison', 'must not enter an archive');
    fixture.write('node_modules/poison', 'live dependencies must not enter an archive');
    try {
      const observation = await runElectronProof(
        fixture.root,
        electronRequest,
        fixture.requestPath,
      );
      expect(observation.commit).toBe(fixture.git('rev-parse', 'HEAD'));
      expect(observation.request).toEqual(electronRequest);
      expect(observation.passing).toMatchObject({ exitCode: 0, passedTests: 1, failedTests: 0 });
      expect(observation.mutated).toMatchObject({ exitCode: 1, passedTests: 0, failedTests: 1 });
      const events = fixture.events();
      expect(events.map(event => event.event)).toEqual([
        'install',
        'build',
        'test',
        'install',
        'build',
        'test',
      ]);
      const installations = events.filter(event => event.event === 'install');
      expect(new Set(installations.map(event => event.root)).size).toBe(2);
      expect(installations.every(event => event.root !== fixture.root)).toBe(true);
      const executions = events.filter(event => event.event === 'test');
      expect(executions.map(event => event.source)).toEqual([
        'export const behavior = true;\n',
        'export const behavior = false;\n',
      ]);
      expect(new Set(executions.map(event => event.port)).size).toBe(2);
      expect(new Set(executions.map(event => event.profile)).size).toBe(2);
      expect(
        readFileSync(path.join(fixture.root, electronRequest.implementationPath), 'utf8'),
      ).toBe('export const behavior = true;\n');
      expect(existsSync(path.join(fixture.root, 'node_modules/installed-for'))).toBe(false);
      expect(observation.mutatedSupportSha256).toEqual({
        ...observation.supportSha256,
        [electronRequest.implementationPath]: observation.mutantSha256,
      });
      expect(existsSync(observation.isolation.original.snapshot)).toBe(false);
      expect(existsSync(observation.isolation.mutated.snapshot)).toBe(false);
    } finally {
      fixture.cleanup();
    }
  },
);
