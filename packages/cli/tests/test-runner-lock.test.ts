import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { defaultMaximumLockWaitMilliseconds } from '../scripts/lib/test-lock-config.mjs';
import {
  environmentPathKey,
  resolveTestRunnerInvocation,
  resolveWindowsVitest,
} from '../scripts/test-runner-executable.mjs';

const cliRoot = nodePath.resolve(import.meta.dirname, '..');
const runnerPath = nodePath.join(cliRoot, 'scripts/run-vitest-with-build-lock.mjs');
const githubLiveRunnerPath = nodePath.join(cliRoot, 'scripts/run-github-live-smokes.mjs');
const packageManifestPath = nodePath.join(cliRoot, 'package.json');
const runnerExecutablePath = nodePath.join(cliRoot, 'scripts/test-runner-executable.mjs');

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const directories = [...temporaryDirectories];
  temporaryDirectories.length = 0;
  await Promise.all(directories.map(directory => rm(directory, { force: true, recursive: true })));
});

function makeTemporaryDirectory(): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-test-runner-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function runNodeScript(scriptPath: string, args: string[], env: NodeJS.ProcessEnv) {
  return await new Promise<{ stderr: string; stdout: string; status: number | null }>(resolve => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: cliRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });
    child.on('close', status => {
      resolve({ stderr, stdout, status });
    });
  });
}

async function createFakeTestBinaries(temporaryDirectory: string, delayMilliseconds = 120) {
  const binaryDirectory = nodePath.join(temporaryDirectory, 'bin');
  await mkdir(binaryDirectory, { recursive: true });
  const logPath = nodePath.join(temporaryDirectory, 'events.log');
  const snapshotLogPath = nodePath.join(temporaryDirectory, 'snapshot.log');

  writeFileSync(
    nodePath.join(binaryDirectory, 'bun'),
    `#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const log = ${JSON.stringify(logPath)};
const parent = process.ppid;
appendFileSync(log, \`build:start:\${parent}\\n\`);
if (process.cwd() !== ${JSON.stringify(cliRoot)}) {
  mkdirSync(path.join(process.cwd(), 'dist'), { recursive: true });
  writeFileSync(path.join(process.cwd(), 'dist', 'cli.js'), 'built-cli');
}
await new Promise(resolve => setTimeout(resolve, ${delayMilliseconds}));
appendFileSync(log, \`build:end:\${parent}\\n\`);
process.exitCode = Number(process.env.SAFEWORD_FAKE_BUILD_EXIT_CODE ?? 0);
`,
    { mode: 0o755 },
  );

  writeFileSync(
    nodePath.join(binaryDirectory, 'vitest'),
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const log = ${JSON.stringify(logPath)};
const snapshotLog = ${JSON.stringify(snapshotLogPath)};
const parent = process.ppid;
const snapshotRoot = process.env.SAFEWORD_TEST_CLI_ROOT;
if (snapshotRoot) {
  const { existsSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  appendFileSync(snapshotLog, JSON.stringify({
    root: snapshotRoot,
    cli: readFileSync(join(snapshotRoot, 'dist', 'cli.js'), 'utf8'),
    hasPackageJson: existsSync(join(snapshotRoot, 'package.json')),
    hasSchemas: existsSync(join(snapshotRoot, 'schemas')),
  }) + '\\n');
}
appendFileSync(log, \`vitest:start:\${parent}:\${process.argv.slice(2).join(',')}\\n\`);
await new Promise(resolve => setTimeout(resolve, ${delayMilliseconds}));
appendFileSync(log, \`vitest:end:\${parent}\\n\`);
process.exitCode = Number(process.env.SAFEWORD_FAKE_VITEST_EXIT_CODE ?? 0);
`,
    { mode: 0o755 },
  );

  return { binaryDirectory, logPath, snapshotLogPath };
}

async function copyRunnerToCheckout(temporaryDirectory: string, name: string) {
  const checkoutCliRoot = nodePath.join(temporaryDirectory, name, 'packages', 'cli');
  const scriptDirectory = nodePath.join(checkoutCliRoot, 'scripts');
  await mkdir(scriptDirectory, { recursive: true });
  const copiedRunnerPath = nodePath.join(scriptDirectory, 'run-vitest-with-build-lock.mjs');
  copyFileSync(runnerPath, copiedRunnerPath);
  copyFileSync(runnerExecutablePath, nodePath.join(scriptDirectory, 'test-runner-executable.mjs'));
  writeFileSync(
    nodePath.join(checkoutCliRoot, 'package.json'),
    `${JSON.stringify({ files: ['dist'] })}\n`,
  );
  const copiedConfigDirectory = nodePath.join(scriptDirectory, 'lib');
  await mkdir(copiedConfigDirectory, { recursive: true });
  copyFileSync(
    nodePath.join(cliRoot, 'scripts', 'lib', 'test-lock-config.mjs'),
    nodePath.join(copiedConfigDirectory, 'test-lock-config.mjs'),
  );
  return copiedRunnerPath;
}

function checkoutCliRootForRunner(copiedRunner: string): string {
  return nodePath.resolve(nodePath.dirname(copiedRunner), '..');
}

function readEvents(logPath: string): string[] {
  return readFileSync(logPath, 'utf8').trim().split('\n');
}

async function waitForPath(path: string): Promise<void> {
  await expect.poll(() => existsSync(path), { interval: 5, timeout: 2000 }).toBe(true);
}

function expectSerializedByRunner(events: string[]) {
  const parentIds = [...new Set(events.map(event => event.split(':', 3)[2]))];
  expect(parentIds).toHaveLength(2);

  for (const parentId of parentIds) {
    const parentEvents = events.filter(event => event.split(':', 3)[2] === parentId);
    expect(parentEvents[0]).toBe(`build:start:${parentId}`);
    expect(parentEvents[1]).toBe(`build:end:${parentId}`);
    expect([
      `vitest:start:${parentId}:run,tests/first.test.ts`,
      `vitest:start:${parentId}:run,tests/second.test.ts`,
    ]).toContain(parentEvents[2]);
    expect(parentEvents[3]).toBe(`vitest:end:${parentId}`);
  }

  const firstParentEnd = events.findLastIndex(event => event.split(':', 3)[2] === parentIds[0]);
  const secondParentStart = events.findIndex(event => event.split(':', 3)[2] === parentIds[1]);
  expect(secondParentStart).toBeGreaterThan(firstParentEnd);
}

function expectSuccessfulSerializedRun(result: { stderr: string; status: number | null }) {
  expect(result.status).toBe(0);
  expect(
    result.stderr === '' || result.stderr.startsWith('Waiting for safeword package test lock'),
  ).toBe(true);
}

function waitStatusLines(stderr: string): string[] {
  return stderr
    .split('\n')
    .filter(line => line.startsWith('Waiting for safeword package test lock'));
}

async function seedOwnerFile(lockDirectory: string, owner: unknown) {
  await mkdir(lockDirectory, { recursive: true });
  const markedOwner =
    typeof owner === 'object' && owner !== null && !Array.isArray(owner)
      ? { kind: 'safeword-package-test-lock', ...owner }
      : owner;
  writeFileSync(nodePath.join(lockDirectory, 'owner.json'), `${JSON.stringify(markedOwner)}\n`);
}

async function seedLegacyOwnerFile(lockDirectory: string, owner: Record<string, unknown>) {
  await mkdir(lockDirectory, { recursive: true });
  writeFileSync(nodePath.join(lockDirectory, 'owner.json'), `${JSON.stringify(owner)}\n`);
}

async function expectSimultaneousRecoveryIsSerialized(
  owner: Record<string, unknown>,
  seed: typeof seedOwnerFile | typeof seedLegacyOwnerFile,
) {
  const temporaryDirectory = makeTemporaryDirectory();
  const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory, 80);
  const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
  await seed(lockDirectory, owner);
  const env = {
    ...process.env,
    PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
    SAFEWORD_TEST_LOCK_DIR: lockDirectory,
    SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '10000',
  };

  const contenderCount = 4;
  const results = await Promise.all(
    Array.from({ length: contenderCount }, (_, index) =>
      runNodeScript(runnerPath, [`tests/stale-${index}.test.ts`], env),
    ),
  );

  expect(
    results.map(result => result.status),
    JSON.stringify(results),
  ).toEqual(Array.from({ length: contenderCount }, () => 0));
  const events = readEvents(logPath);
  let activeCommands = 0;
  let maximumActiveCommands = 0;
  for (const event of events) {
    activeCommands += event.includes(':start:') ? 1 : -1;
    maximumActiveCommands = Math.max(maximumActiveCommands, activeCommands);
  }
  expect(events).toHaveLength(contenderCount * 4);
  expect(activeCommands).toBe(0);
  expect(maximumActiveCommands).toBe(1);
}

describe('package test runner lock (379)', () => {
  it('runs the real packaged CLI from the isolated snapshot', () => {
    const snapshotRoot = process.env.SAFEWORD_TEST_CLI_ROOT;
    if (!snapshotRoot) throw new Error('Package test snapshot was not provided.');
    const result = spawnSync(
      process.execPath,
      [nodePath.join(snapshotRoot, 'dist', 'cli.js'), '--version'],
      { encoding: 'utf8' },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/u);
  });

  it('keeps the GitHub provenance smokes outside the package lock (#1484)', () => {
    const manifest = JSON.parse(readFileSync(packageManifestPath, 'utf8')) as {
      scripts?: Record<string, unknown>;
    };
    const command = manifest.scripts?.['test:smoke:live:github'];

    expect(command).toBe('node scripts/run-github-live-smokes.mjs');
    expect(command).not.toContain('run-vitest-with-build-lock');
    expect(command).not.toContain('build');
  });

  it('rejects arguments to the bounded GitHub provenance live lane (#1484)', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const result = await runNodeScript(githubLiveRunnerPath, ['tests/other.live.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('test:smoke:live:github accepts no arguments.');
    expect(existsSync(logPath)).toBe(false);
  });

  it('runs only the fixed GitHub provenance live-smoke arguments without the package lock (#1484)', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'held-package-test-lock');
    await seedOwnerFile(lockDirectory, { pid: process.pid });
    const result = await runNodeScript(githubLiveRunnerPath, [], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
    });

    expect(result.status).toBe(0);
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(
        /^vitest:start:\d+:run,--config,vitest\.live\.config\.ts,--maxWorkers=1,--no-file-parallelism,tests\/smoke\/retro-dedup\.live\.test\.ts,tests\/smoke\/reconcile\.live\.test\.ts$/,
      ),
      expect.stringMatching(/^vitest:end:\d+$/),
    ]);
  });

  it('resolves a Windows npm Vitest shim without selecting the POSIX shim', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const moduleDirectory = nodePath.join(temporaryDirectory, 'node_modules', 'vitest');
    const binaryDirectory = nodePath.join(temporaryDirectory, 'node_modules', '.bin');
    await mkdir(moduleDirectory, { recursive: true });
    await mkdir(binaryDirectory, { recursive: true });
    writeFileSync(nodePath.join(binaryDirectory, 'vitest'), '#!/bin/sh\n');
    writeFileSync(nodePath.join(binaryDirectory, 'vitest.cmd'), '@echo off\r\n');
    const moduleEntry = nodePath.join(moduleDirectory, 'vitest.mjs');
    writeFileSync(moduleEntry, 'export {};\n');

    expect(resolveWindowsVitest(binaryDirectory, cliRoot, 'node.exe')).toEqual({
      arguments: [moduleEntry],
      executable: 'node.exe',
    });
    expect(resolveWindowsVitest(binaryDirectory, cliRoot)).toEqual({
      arguments: [moduleEntry],
      executable: process.execPath,
    });
    expect(environmentPathKey({ Path: binaryDirectory })).toBe('Path');
    expect(environmentPathKey({ OTHER: 'value' })).toBe('PATH');
    expect(
      resolveTestRunnerInvocation(
        'vitest',
        ['run', 'tests/example.test.ts'],
        { Path: binaryDirectory },
        cliRoot,
        'win32',
      ),
    ).toEqual({
      arguments: [moduleEntry, 'run', 'tests/example.test.ts'],
      executable: process.execPath,
    });
    expect(
      resolveTestRunnerInvocation(
        'bun',
        ['run', 'build'],
        { Path: binaryDirectory },
        cliRoot,
        'win32',
      ),
    ).toEqual({ arguments: ['run', 'build'], executable: 'bun' });
  });

  it('falls back to the package-local Vitest when PATH has no Vitest (#715)', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const copiedRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout');
    const localBinDirectory = nodePath.join(
      checkoutCliRootForRunner(copiedRunner),
      'node_modules',
      '.bin',
    );
    await mkdir(localBinDirectory, { recursive: true });
    copyFileSync(
      nodePath.join(binaryDirectory, 'vitest'),
      nodePath.join(localBinDirectory, 'vitest'),
    );
    await rm(nodePath.join(binaryDirectory, 'vitest'));

    const result = await runNodeScript(copiedRunner, ['tests/local-vitest.test.ts'], {
      ...process.env,
      PATH: [binaryDirectory, nodePath.dirname(process.execPath), '/usr/bin', '/bin'].join(
        nodePath.delimiter,
      ),
      SAFEWORD_TEST_LOCK_DIR: nodePath.join(temporaryDirectory, 'lock'),
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(/^build:start:/),
      expect.stringMatching(/^build:end:/),
      expect.stringMatching(/^vitest:start:.*:run,tests\/local-vitest\.test\.ts$/),
      expect.stringMatching(/^vitest:end:/),
    ]);
  });

  it('runs tests against a private built-package snapshot (#1823)', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, snapshotLogPath } = await createFakeTestBinaries(temporaryDirectory);
    const copiedRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout');
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');

    const result = await runNodeScript(copiedRunner, ['tests/first.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    const snapshot = JSON.parse(readFileSync(snapshotLogPath, 'utf8')) as {
      cli: string;
      root: string;
    };
    expect(snapshot.cli).toBe('built-cli');
    expect(snapshot.root).not.toBe(cliRoot);
    expect(existsSync(snapshot.root)).toBe(false);
  });

  it('removes an aged orphaned package snapshot before creating the next one', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory } = await createFakeTestBinaries(temporaryDirectory);
    const copiedRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout');
    const orphan = nodePath.join(
      checkoutCliRootForRunner(copiedRunner),
      'node_modules',
      '.cache',
      'safeword-test-package-orphan',
    );
    await mkdir(orphan, { recursive: true });
    writeFileSync(nodePath.join(orphan, 'residue'), 'old snapshot');
    const staleSnapshotTime = new Date(Date.now() - 7 * 60 * 60 * 1000);
    utimesSync(orphan, staleSnapshotTime, staleSnapshotTime);
    const activeSnapshot = nodePath.join(
      checkoutCliRootForRunner(copiedRunner),
      'node_modules',
      '.cache',
      'safeword-test-package-active',
    );
    await mkdir(nodePath.join(activeSnapshot, 'dist'), { recursive: true });
    writeFileSync(nodePath.join(activeSnapshot, 'dist', 'cli.js'), 'active snapshot');

    const result = await runNodeScript(copiedRunner, ['tests/snapshot-reaping.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_CLI_ROOT: activeSnapshot,
      SAFEWORD_TEST_LOCK_DIR: nodePath.join(temporaryDirectory, 'lock'),
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(existsSync(orphan)).toBe(false);
    expect(readFileSync(nodePath.join(activeSnapshot, 'dist', 'cli.js'), 'utf8')).toBe(
      'active snapshot',
    );
  });

  it('skips tests and propagates a failed build', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const copiedRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout');

    const result = await runNodeScript(copiedRunner, ['tests/not-started.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_FAKE_BUILD_EXIT_CODE: '23',
      SAFEWORD_TEST_LOCK_DIR: nodePath.join(temporaryDirectory, 'lock'),
    });

    expect(result.status).toBe(23);
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(/^build:start:/),
      expect.stringMatching(/^build:end:/),
    ]);
  });

  it('propagates a failed test run', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const copiedRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout');

    const result = await runNodeScript(copiedRunner, ['tests/failing.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_FAKE_VITEST_EXIT_CODE: '24',
      SAFEWORD_TEST_LOCK_DIR: nodePath.join(temporaryDirectory, 'lock'),
    });

    expect(result.status).toBe(24);
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(/^build:start:/),
      expect.stringMatching(/^build:end:/),
      expect.stringMatching(/^vitest:start:.*:run,tests\/failing\.test\.ts$/),
      expect.stringMatching(/^vitest:end:/),
    ]);
  });

  it('copies every literal entry from a package snapshot manifest', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, snapshotLogPath } = await createFakeTestBinaries(temporaryDirectory);
    const copiedRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout');
    const checkoutCliRoot = checkoutCliRootForRunner(copiedRunner);
    await mkdir(nodePath.join(checkoutCliRoot, 'schemas'));
    writeFileSync(nodePath.join(checkoutCliRoot, 'schemas', 'proof.json'), '{}\n');
    writeFileSync(
      nodePath.join(checkoutCliRoot, 'package.json'),
      `${JSON.stringify({ files: ['dist', 'schemas'] })}\n`,
    );

    const result = await runNodeScript(copiedRunner, ['tests/snapshot-entries.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: nodePath.join(temporaryDirectory, 'lock'),
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    const snapshot = JSON.parse(readFileSync(snapshotLogPath, 'utf8')) as {
      hasPackageJson: boolean;
      hasSchemas: boolean;
    };
    expect(snapshot).toMatchObject({ hasPackageJson: true, hasSchemas: true });
  });

  it.each(['..', '.'])('rejects publish entry %s outside the snapshot boundary', async entry => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory } = await createFakeTestBinaries(temporaryDirectory);
    const copiedRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout');
    writeFileSync(
      nodePath.join(checkoutCliRootForRunner(copiedRunner), 'package.json'),
      `${JSON.stringify({ files: [entry] })}\n`,
    );

    const result = await runNodeScript(copiedRunner, ['tests/escape.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: nodePath.join(temporaryDirectory, 'lock'),
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Package snapshot entry escapes the CLI package: ${entry}`);
  });

  it.each(['dist/**', '!dist/debug'])(
    'rejects unsupported package snapshot pattern %s',
    async entry => {
      const temporaryDirectory = makeTemporaryDirectory();
      const { binaryDirectory } = await createFakeTestBinaries(temporaryDirectory);
      const copiedRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout');
      writeFileSync(
        nodePath.join(checkoutCliRootForRunner(copiedRunner), 'package.json'),
        `${JSON.stringify({ files: [entry] })}\n`,
      );

      const result = await runNodeScript(copiedRunner, ['tests/pattern.test.ts'], {
        ...process.env,
        PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
        SAFEWORD_TEST_LOCK_DIR: nodePath.join(temporaryDirectory, 'lock'),
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `Package snapshot does not support package.json files patterns: ${entry}`,
      );
    },
  );

  it('reports a missing package snapshot files contract directly', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory } = await createFakeTestBinaries(temporaryDirectory);
    const copiedRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout');
    writeFileSync(nodePath.join(checkoutCliRootForRunner(copiedRunner), 'package.json'), '{}\n');

    const result = await runNodeScript(copiedRunner, ['tests/missing-files.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: nodePath.join(temporaryDirectory, 'lock'),
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Package snapshot requires a non-empty package.json files array.',
    );
  });

  it('requires the package snapshot manifest to exist', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory } = await createFakeTestBinaries(temporaryDirectory);
    const copiedRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout');
    await rm(nodePath.join(checkoutCliRootForRunner(copiedRunner), 'package.json'));

    const result = await runNodeScript(copiedRunner, ['tests/missing-manifest.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: nodePath.join(temporaryDirectory, 'lock'),
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('package.json');
  });

  it.runIf(process.platform !== 'win32')(
    'rejects symbolic links inside publishable snapshot entries',
    async () => {
      const temporaryDirectory = makeTemporaryDirectory();
      const { binaryDirectory } = await createFakeTestBinaries(temporaryDirectory);
      const copiedRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout');
      const checkoutCliRoot = checkoutCliRootForRunner(copiedRunner);
      const publishDirectory = nodePath.join(checkoutCliRoot, 'publish');
      await mkdir(publishDirectory);
      symlinkSync(
        nodePath.join(temporaryDirectory, 'outside'),
        nodePath.join(publishDirectory, 'link'),
      );
      writeFileSync(
        nodePath.join(checkoutCliRoot, 'package.json'),
        `${JSON.stringify({ files: ['publish'] })}\n`,
      );

      const result = await runNodeScript(copiedRunner, ['tests/symlink.test.ts'], {
        ...process.env,
        PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
        SAFEWORD_TEST_LOCK_DIR: nodePath.join(temporaryDirectory, 'lock'),
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Package snapshot entry contains a symbolic link: publish');
    },
  );

  it('limits the default wait so locked focused verification stays actionable', () => {
    expect(defaultMaximumLockWaitMilliseconds).toBe(60_000);
  });

  it('serializes build and vitest for concurrent focused test commands', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');

    const env = {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
    };

    const [first, second] = await Promise.all([
      runNodeScript(runnerPath, ['tests/first.test.ts'], env),
      runNodeScript(runnerPath, ['tests/second.test.ts'], env),
    ]);

    expectSuccessfulSerializedRun(first);
    expectSuccessfulSerializedRun(second);

    expectSerializedByRunner(readEvents(logPath));
  });

  it('serializes default package test locks across checkout roots', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const firstRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout-a');
    const secondRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout-b');

    const env = {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      TEMP: temporaryDirectory,
      TMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
      SAFEWORD_TEST_LOCK_DIR: undefined,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '2000',
    };

    const [first, second] = await Promise.all([
      runNodeScript(firstRunner, ['tests/first.test.ts'], env),
      runNodeScript(secondRunner, ['tests/second.test.ts'], env),
    ]);

    expectSuccessfulSerializedRun(first);
    expectSuccessfulSerializedRun(second);
    expectSerializedByRunner(readEvents(logPath));
  });

  it('uses the default maximum wait when configured with a negative or blank value', async () => {
    for (const maximumWait of ['-5', '', ' '.repeat(3)]) {
      const temporaryDirectory = makeTemporaryDirectory();
      const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
      const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
      const ownerPath = nodePath.join(lockDirectory, 'owner.json');
      const env = {
        ...process.env,
        PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
        SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      };

      const ownerRun = runNodeScript(runnerPath, ['tests/first.test.ts'], env);
      await waitForPath(ownerPath);
      const waiterRun = runNodeScript(runnerPath, ['tests/second.test.ts'], {
        ...env,
        SAFEWORD_TEST_LOCK_MAX_WAIT_MS: maximumWait,
      });
      const [ownerResult, waiterResult] = await Promise.all([ownerRun, waiterRun]);

      expectSuccessfulSerializedRun(ownerResult);
      expectSuccessfulSerializedRun(waiterResult);
      expectSerializedByRunner(readEvents(logPath));
    }
  });

  it('reports the complete bounded periodic status sequence before failing', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory } = await createFakeTestBinaries(temporaryDirectory, 2000);
    const firstRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout-a');
    const secondRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout-b');
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    const ownerPath = nodePath.join(lockDirectory, 'owner.json');
    const env = {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '250',
      SAFEWORD_TEST_LOCK_STATUS_INTERVAL_MS: '50',
    };

    const ownerRun = runNodeScript(firstRunner, ['tests/first.test.ts'], env);
    await waitForPath(ownerPath);
    const owner = JSON.parse(readFileSync(ownerPath, 'utf8')) as {
      checkoutRoot: string;
      pid: number;
    };
    const waiterRun = runNodeScript(secondRunner, ['tests/second.test.ts'], env);
    const [ownerResult, waiterResult] = await Promise.all([ownerRun, waiterRun]);

    expect(ownerResult.status).toBe(0);
    expect(waiterResult.status).toBe(1);
    const waitStatuses = waitStatusLines(waiterResult.stderr);
    expect(owner.checkoutRoot).toMatch(/checkout-a$/);
    expect(waitStatuses).toEqual([
      `Waiting for safeword package test lock (50ms elapsed; owner PID ${owner.pid}; checkout ${owner.checkoutRoot}).`,
      `Waiting for safeword package test lock (100ms elapsed; owner PID ${owner.pid}; checkout ${owner.checkoutRoot}).`,
      `Waiting for safeword package test lock (150ms elapsed; owner PID ${owner.pid}; checkout ${owner.checkoutRoot}).`,
      `Waiting for safeword package test lock (200ms elapsed; owner PID ${owner.pid}; checkout ${owner.checkoutRoot}).`,
    ]);
    expect(waiterResult.stderr).toContain(
      `Could not acquire safeword package test lock at ${lockDirectory} after waiting 250ms; no test was started.`,
    );
  });

  it('reports available fields when incomplete owner metadata has a usable staleness signal', async () => {
    for (const [owner, expectedOwnerDetail] of [
      [{ pid: process.pid }, `owner PID ${process.pid}`],
      [{ createdAt: new Date().toISOString() }, 'owner PID unavailable'],
    ]) {
      const temporaryDirectory = makeTemporaryDirectory();
      const { binaryDirectory } = await createFakeTestBinaries(temporaryDirectory);
      const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
      await seedOwnerFile(lockDirectory, owner);

      const result = await runNodeScript(runnerPath, ['tests/incomplete-owner.test.ts'], {
        ...process.env,
        PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
        SAFEWORD_TEST_LOCK_DIR: lockDirectory,
        SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '220',
        SAFEWORD_TEST_LOCK_STATUS_INTERVAL_MS: '100',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(expectedOwnerDetail);
      expect(result.stderr).toContain('checkout unavailable');
      expect(result.stderr).toContain('after waiting 220ms; no test was started.');
    }
  });

  it('reaps marked stale locks when owner metadata is incomplete or expired', async () => {
    for (const owner of [{}, { createdAt: new Date(0).toISOString() }]) {
      const temporaryDirectory = makeTemporaryDirectory();
      const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
      const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
      await seedOwnerFile(lockDirectory, owner);
      const staleTime = new Date(Date.now() - 31_000);
      utimesSync(lockDirectory, staleTime, staleTime);

      const result = await runNodeScript(runnerPath, ['tests/non-object-owner.test.ts'], {
        ...process.env,
        PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
        SAFEWORD_TEST_LOCK_DIR: lockDirectory,
        SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '0',
      });

      expect(result).toMatchObject({ status: 0, stderr: '' });
      expect(readEvents(logPath)).toEqual([
        expect.stringMatching(/^build:start:/),
        expect.stringMatching(/^build:end:/),
        expect.stringMatching(/^vitest:start:.*:run,tests\/non-object-owner\.test\.ts$/),
        expect.stringMatching(/^vitest:end:/),
      ]);
    }
  });

  it.each([
    ['empty', false],
    ['non-empty', true],
  ])(
    'does not delete an unmarked %s directory selected as the lock path',
    async (_name, seeded) => {
      const temporaryDirectory = makeTemporaryDirectory();
      const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
      const lockDirectory = nodePath.join(temporaryDirectory, 'unrelated');
      await mkdir(lockDirectory);
      const sentinel = nodePath.join(lockDirectory, 'keep.txt');
      if (seeded) writeFileSync(sentinel, 'user data');
      const staleTime = new Date(Date.now() - 31_000);
      utimesSync(lockDirectory, staleTime, staleTime);

      const result = await runNodeScript(runnerPath, ['tests/unmarked.test.ts'], {
        ...process.env,
        PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
        SAFEWORD_TEST_LOCK_DIR: lockDirectory,
        SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '0',
      });

      expect(result.status).toBe(1);
      expect(existsSync(lockDirectory)).toBe(true);
      if (seeded) expect(readFileSync(sentinel, 'utf8')).toBe('user data');
      expect(existsSync(logPath)).toBe(false);
    },
  );

  it('clamps unsafe status intervals and ignores malformed settings', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    const owner = { createdAt: new Date().toISOString(), pid: process.pid };

    await seedOwnerFile(lockDirectory, owner);
    const unsafeInterval = await runNodeScript(runnerPath, ['tests/unsafe-interval.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '120',
      SAFEWORD_TEST_LOCK_STATUS_INTERVAL_MS: '1',
    });

    const unsafeStatuses = waitStatusLines(unsafeInterval.stderr);
    expect(unsafeInterval.status).toBe(1);
    expect(unsafeStatuses).toHaveLength(2);

    await seedOwnerFile(lockDirectory, owner);
    const malformedInterval = await runNodeScript(
      runnerPath,
      ['tests/malformed-interval.test.ts'],
      {
        ...process.env,
        PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
        SAFEWORD_TEST_LOCK_DIR: lockDirectory,
        SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '120',
        SAFEWORD_TEST_LOCK_STATUS_INTERVAL_MS: 'not-a-number',
      },
    );

    expect(malformedInterval.status).toBe(1);
    expect(waitStatusLines(malformedInterval.stderr)).toHaveLength(0);

    await seedOwnerFile(lockDirectory, owner);
    const zeroInterval = await runNodeScript(runnerPath, ['tests/zero-interval.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '120',
      SAFEWORD_TEST_LOCK_STATUS_INTERVAL_MS: '0',
    });

    expect(zeroInterval.status).toBe(1);
    expect(waitStatusLines(zeroInterval.stderr)).toHaveLength(0);
  });

  it('reaps dead-owner stale locks before acquiring', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    await seedOwnerFile(lockDirectory, {
      createdAt: new Date().toISOString(),
      pid: 2_147_483_647,
    });

    const result = await runNodeScript(runnerPath, ['tests/stale.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(/^build:start:/),
      expect.stringMatching(/^build:end:/),
      expect.stringMatching(/^vitest:start:.*:run,tests\/stale\.test\.ts$/),
      expect.stringMatching(/^vitest:end:/),
    ]);
  });

  it('recovers a dead owner written by the preceding lock format', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    await seedLegacyOwnerFile(lockDirectory, {
      checkoutRoot: cliRoot,
      createdAt: new Date().toISOString(),
      pid: 2_147_483_647,
      token: '00000000-0000-4000-8000-000000000001',
    });

    const result = await runNodeScript(runnerPath, ['tests/legacy-stale.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '0',
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(/^build:start:/),
      expect.stringMatching(/^build:end:/),
      expect.stringMatching(/^vitest:start:.*:run,tests\/legacy-stale\.test\.ts$/),
      expect.stringMatching(/^vitest:end:/),
    ]);
  });

  it('keeps a live owner written by the preceding lock format', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    await seedLegacyOwnerFile(lockDirectory, {
      checkoutRoot: cliRoot,
      createdAt: new Date(0).toISOString(),
      pid: process.pid,
      token: '00000000-0000-4000-8000-000000000002',
    });

    const result = await runNodeScript(runnerPath, ['tests/legacy-live.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '0',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('after waiting 0ms; no test was started.');
    expect(existsSync(logPath)).toBe(false);
    expect(existsSync(lockDirectory)).toBe(true);
  });

  it('does not recover foreign owner metadata with a dead process', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    await seedLegacyOwnerFile(lockDirectory, {
      checkoutRoot: cliRoot,
      createdAt: new Date().toISOString(),
      kind: 'another-tool-lock',
      pid: 2_147_483_647,
      token: 'foreign-owner',
    });

    const result = await runNodeScript(runnerPath, ['tests/foreign-owner.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '0',
    });

    expect(result.status).toBe(1);
    expect(existsSync(logPath)).toBe(false);
    expect(existsSync(lockDirectory)).toBe(true);
  });

  it.each([
    [
      'relative checkout root',
      { checkoutRoot: 'relative', token: '00000000-0000-4000-8000-000000000004' },
    ],
    ['malformed token', { checkoutRoot: cliRoot, token: 'not-a-uuid' }],
    [
      'unknown field',
      {
        checkoutRoot: cliRoot,
        extra: true,
        token: '00000000-0000-4000-8000-000000000005',
      },
    ],
  ])('does not recover legacy-shaped metadata with a %s', async (_name, fields) => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    await seedLegacyOwnerFile(lockDirectory, {
      createdAt: new Date().toISOString(),
      pid: 2_147_483_647,
      ...fields,
    });

    const result = await runNodeScript(runnerPath, ['tests/malformed-legacy-owner.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '0',
    });

    expect(result.status).toBe(1);
    expect(existsSync(logPath)).toBe(false);
    expect(existsSync(lockDirectory)).toBe(true);
  });

  it('reaps an abandoned transition mutex before acquiring', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    await seedLegacyOwnerFile(`${lockDirectory}.transition`, {
      createdAt: new Date().toISOString(),
      pid: 2_147_483_647,
    });

    const result = await runNodeScript(runnerPath, ['tests/abandoned-transition.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(/^build:start:/),
      expect.stringMatching(/^build:end:/),
      expect.stringMatching(/^vitest:start:.*:run,tests\/abandoned-transition\.test\.ts$/),
      expect.stringMatching(/^vitest:end:/),
    ]);
    expect(existsSync(`${lockDirectory}.transition`)).toBe(false);
  });

  it('reaps an abandoned empty transition mutex before acquiring', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(
      temporaryDirectory,
      'safeword-test-locks',
      'safeword-package-test.lock',
    );
    const transitionDirectory = `${lockDirectory}.transition`;
    await mkdir(transitionDirectory, { recursive: true });
    const staleTime = new Date(Date.now() - 31_000);
    utimesSync(transitionDirectory, staleTime, staleTime);

    const result = await runNodeScript(runnerPath, ['tests/empty-transition.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      TEMP: temporaryDirectory,
      TMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
      SAFEWORD_TEST_LOCK_DIR: undefined,
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(/^build:start:/),
      expect.stringMatching(/^build:end:/),
      expect.stringMatching(/^vitest:start:.*:run,tests\/empty-transition\.test\.ts$/),
      expect.stringMatching(/^vitest:end:/),
    ]);
    expect(existsSync(transitionDirectory)).toBe(false);
  });

  it('reaps an abandoned transition with a truncated owner in the default tmp namespace', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(
      temporaryDirectory,
      'safeword-test-locks',
      'safeword-package-test.lock',
    );
    const transitionDirectory = `${lockDirectory}.transition`;
    await mkdir(transitionDirectory, { recursive: true });
    writeFileSync(nodePath.join(transitionDirectory, 'owner.json'), '{');
    const staleTime = new Date(Date.now() - 31_000);
    utimesSync(transitionDirectory, staleTime, staleTime);

    const result = await runNodeScript(runnerPath, ['tests/truncated-transition.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      TEMP: temporaryDirectory,
      TMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
      SAFEWORD_TEST_LOCK_DIR: undefined,
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(readEvents(logPath)).toContainEqual(
      expect.stringMatching(/^vitest:start:.*:run,tests\/truncated-transition\.test\.ts$/),
    );
    expect(existsSync(transitionDirectory)).toBe(false);
  });

  it('reaps an interrupted transition and its abandoned recovery marker', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(
      temporaryDirectory,
      'safeword-test-locks',
      'safeword-package-test.lock',
    );
    const transitionDirectory = `${lockDirectory}.transition`;
    const recoveryDirectory = nodePath.join(transitionDirectory, 'recovery');
    await mkdir(recoveryDirectory, { recursive: true });
    writeFileSync(nodePath.join(transitionDirectory, 'owner.json'), '{');
    writeFileSync(nodePath.join(recoveryDirectory, 'owner.json'), '{');
    const staleTime = new Date(Date.now() - 31_000);
    utimesSync(transitionDirectory, staleTime, staleTime);
    utimesSync(recoveryDirectory, staleTime, staleTime);

    const result = await runNodeScript(runnerPath, ['tests/interrupted-recovery.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      TEMP: temporaryDirectory,
      TMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
      SAFEWORD_TEST_LOCK_DIR: undefined,
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(readEvents(logPath)).toContainEqual(
      expect.stringMatching(/^vitest:start:.*:run,tests\/interrupted-recovery\.test\.ts$/),
    );
    expect(existsSync(transitionDirectory)).toBe(false);
  });

  it('reaps an abandoned empty lock in the default tmp namespace', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(
      temporaryDirectory,
      'safeword-test-locks',
      'safeword-package-test.lock',
    );
    await mkdir(lockDirectory, { recursive: true });
    const staleTime = new Date(Date.now() - 31_000);
    utimesSync(lockDirectory, staleTime, staleTime);

    const result = await runNodeScript(runnerPath, ['tests/empty-lock.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      TEMP: temporaryDirectory,
      TMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
      SAFEWORD_TEST_LOCK_DIR: undefined,
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(/^build:start:/),
      expect.stringMatching(/^build:end:/),
      expect.stringMatching(/^vitest:start:.*:run,tests\/empty-lock\.test\.ts$/),
      expect.stringMatching(/^vitest:end:/),
    ]);
    expect(existsSync(lockDirectory)).toBe(false);
  });

  it.each([
    ['empty', false],
    ['non-empty', true],
  ])(
    'does not adopt an unmarked %s transition beside a custom lock path',
    async (_name, seeded) => {
      const temporaryDirectory = makeTemporaryDirectory();
      const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
      const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
      const transitionDirectory = `${lockDirectory}.transition`;
      await mkdir(transitionDirectory);
      const sentinel = nodePath.join(transitionDirectory, 'keep.txt');
      if (seeded) writeFileSync(sentinel, 'user data');
      const staleTime = new Date(Date.now() - 31_000);
      utimesSync(transitionDirectory, staleTime, staleTime);

      const result = await runNodeScript(runnerPath, ['tests/foreign-transition.test.ts'], {
        ...process.env,
        PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
        SAFEWORD_TEST_LOCK_DIR: lockDirectory,
        SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '0',
      });

      expect(result.status).toBe(1);
      if (seeded) expect(readFileSync(sentinel, 'utf8')).toBe('user data');
      expect(existsSync(transitionDirectory)).toBe(true);
      expect(existsSync(logPath)).toBe(false);
    },
  );

  it('reaps an abandoned transition recovery marker before acquiring', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    const transitionDirectory = `${lockDirectory}.transition`;
    const recoveryDirectory = nodePath.join(transitionDirectory, 'recovery');
    await seedLegacyOwnerFile(transitionDirectory, {
      createdAt: new Date().toISOString(),
      pid: 2_147_483_647,
    });
    await mkdir(recoveryDirectory);
    const staleTime = new Date(Date.now() - 31_000);
    utimesSync(recoveryDirectory, staleTime, staleTime);

    const result = await runNodeScript(runnerPath, ['tests/recovery-marker.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
    });

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(/^build:start:/),
      expect.stringMatching(/^build:end:/),
      expect.stringMatching(/^vitest:start:.*:run,tests\/recovery-marker\.test\.ts$/),
      expect.stringMatching(/^vitest:end:/),
    ]);
    expect(existsSync(transitionDirectory)).toBe(false);
  });

  it('does not reap an aged transition recovery marker owned by a live process', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    const transitionDirectory = `${lockDirectory}.transition`;
    const recoveryDirectory = nodePath.join(transitionDirectory, 'recovery');
    await seedLegacyOwnerFile(transitionDirectory, {
      createdAt: new Date().toISOString(),
      pid: 2_147_483_647,
    });
    await seedLegacyOwnerFile(recoveryDirectory, {
      createdAt: new Date(0).toISOString(),
      kind: 'safeword-package-test-transition-recovery',
      pid: process.pid,
      token: 'live-recovery',
    });
    const staleTime = new Date(Date.now() - 31_000);
    utimesSync(recoveryDirectory, staleTime, staleTime);

    const result = await runNodeScript(runnerPath, ['tests/live-recovery-marker.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '0',
    });

    expect(result.status).toBe(1);
    expect(existsSync(recoveryDirectory)).toBe(true);
    expect(existsSync(logPath)).toBe(false);
  });

  it('does not reap an aged lock while its owner process is alive', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    await seedOwnerFile(lockDirectory, {
      createdAt: new Date(0).toISOString(),
      pid: process.pid,
    });

    const result = await runNodeScript(runnerPath, ['tests/live-aged-owner.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '0',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('after waiting 0ms; no test was started.');
    expect(existsSync(logPath)).toBe(false);
    expect(existsSync(lockDirectory)).toBe(true);
  });

  it('serializes simultaneous recovery from a dead-owner lock', async () => {
    await expectSimultaneousRecoveryIsSerialized(
      {
        createdAt: new Date().toISOString(),
        pid: 2_147_483_647,
      },
      seedOwnerFile,
    );
  });

  it('serializes simultaneous recovery from a dead owner written by the preceding format', async () => {
    await expectSimultaneousRecoveryIsSerialized(
      {
        checkoutRoot: cliRoot,
        createdAt: new Date().toISOString(),
        pid: 2_147_483_647,
        token: '00000000-0000-4000-8000-000000000003',
      },
      seedLegacyOwnerFile,
    );
  });

  it('rebases repo-root-relative test paths onto the package root (#723)', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');

    const result = await runNodeScript(
      runnerPath,
      ['packages/cli/tests/first.test.ts', '--config=packages/cli/vitest.live.config.ts'],
      {
        ...process.env,
        PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
        SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      },
    );

    expect(result).toMatchObject({ status: 0, stderr: '' });
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(/^build:start:/),
      expect.stringMatching(/^build:end:/),
      expect.stringMatching(
        /^vitest:start:.*:run,tests\/first\.test\.ts,--config=vitest\.live\.config\.ts$/,
      ),
      expect.stringMatching(/^vitest:end:/),
    ]);
  });

  it('every vitest test script builds before running (no stale dist — #352)', () => {
    const pkg = JSON.parse(readFileSync(nodePath.join(cliRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const { scripts } = pkg;

    const vitestWrapperScripts = new Set(['node scripts/run-github-live-smokes.mjs']);
    const buildExemptVitestScripts = new Set([
      // This fixed, source-only, network-billed provenance lane deliberately
      // avoids the package build and serialization path (#1484).
      'test:smoke:live:github',
    ]);
    const invokesVitest = (command: string): boolean =>
      /(?:^|[;&|]\s*|\s)(?:bunx\s+)?vitest(?:\s|$)/u.test(command);
    const vitestScripts = Object.entries(scripts).filter(
      ([name, command]) =>
        name.startsWith('test') &&
        !name.startsWith('pretest') &&
        (invokesVitest(command) ||
          command.includes('run-vitest-with-build-lock.mjs') ||
          vitestWrapperScripts.has(command)),
    );
    // Guard against a vacuous pass: there must be vitest-running scripts to check.
    expect(vitestScripts.length).toBeGreaterThan(3);

    for (const [name, command] of vitestScripts) {
      if (buildExemptVitestScripts.has(name)) {
        expect(command).toBe('node scripts/run-github-live-smokes.mjs');
        continue;
      }
      const usesRunner = command.includes('run-vitest-with-build-lock.mjs');
      const buildsFirst = scripts[`pre${name}`] === 'tsup' || command.includes('tsup &&');
      expect(
        usesRunner || buildsFirst,
        `${name} runs vitest without a preceding build — a stale dist/cli.js would produce spurious failures or false greens (#352). Route it through scripts/run-vitest-with-build-lock.mjs or add a pre-build.`,
      ).toBe(true);
    }
  });

  it('names the active owner and recovery when the wait cap expires', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    await seedOwnerFile(lockDirectory, {
      checkoutRoot: '/worktrees/full-suite',
      createdAt: new Date().toISOString(),
      pid: process.pid,
    });

    const result = await runNodeScript(runnerPath, ['tests/wait-cap.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '0',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Could not acquire safeword package test lock');
    expect(result.stderr).toContain(
      `The active owner is PID ${process.pid} in /worktrees/full-suite.`,
    );
    expect(existsSync(logPath)).toBe(false);
  });
});
