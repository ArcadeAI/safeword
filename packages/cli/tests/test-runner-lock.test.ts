import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const cliRoot = nodePath.resolve(import.meta.dirname, '..');
const runnerPath = nodePath.join(cliRoot, 'scripts/run-vitest-with-build-lock.mjs');

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

  writeFileSync(
    nodePath.join(binaryDirectory, 'bun'),
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const log = ${JSON.stringify(logPath)};
const parent = process.ppid;
appendFileSync(log, \`build:start:\${parent}\\n\`);
await new Promise(resolve => setTimeout(resolve, ${delayMilliseconds}));
appendFileSync(log, \`build:end:\${parent}\\n\`);
`,
    { mode: 0o755 },
  );

  writeFileSync(
    nodePath.join(binaryDirectory, 'vitest'),
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const log = ${JSON.stringify(logPath)};
const parent = process.ppid;
appendFileSync(log, \`vitest:start:\${parent}:\${process.argv.slice(2).join(',')}\\n\`);
await new Promise(resolve => setTimeout(resolve, ${delayMilliseconds}));
appendFileSync(log, \`vitest:end:\${parent}\\n\`);
`,
    { mode: 0o755 },
  );

  return { binaryDirectory, logPath };
}

async function copyRunnerToCheckout(temporaryDirectory: string, name: string) {
  const checkoutCliRoot = nodePath.join(temporaryDirectory, name, 'packages', 'cli');
  const scriptDirectory = nodePath.join(checkoutCliRoot, 'scripts');
  await mkdir(scriptDirectory, { recursive: true });
  const copiedRunnerPath = nodePath.join(scriptDirectory, 'run-vitest-with-build-lock.mjs');
  copyFileSync(runnerPath, copiedRunnerPath);
  return copiedRunnerPath;
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
    const parentEvents = events.filter(event => event.includes(`:${parentId}`));
    expect(parentEvents[0]).toBe(`build:start:${parentId}`);
    expect(parentEvents[1]).toBe(`build:end:${parentId}`);
    expect([
      `vitest:start:${parentId}:run,tests/first.test.ts`,
      `vitest:start:${parentId}:run,tests/second.test.ts`,
    ]).toContain(parentEvents[2]);
    expect(parentEvents[3]).toBe(`vitest:end:${parentId}`);
  }

  const firstParentEnd = events.findLastIndex(event => event.includes(`:${parentIds[0]}`));
  const secondParentStart = events.findIndex(event => event.includes(`:${parentIds[1]}`));
  expect(secondParentStart).toBeGreaterThan(firstParentEnd);
}

function expectSuccessfulSerializedRun(result: { stderr: string; status: number | null }) {
  expect(result.status).toBe(0);
  expect(
    result.stderr === '' || result.stderr.startsWith('Waiting for safeword package test lock'),
  ).toBe(true);
}

function parseElapsedWaitMilliseconds(line: string): number {
  const start = line.indexOf('(');
  const end = line.indexOf(' elapsed;', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const elapsed = line.slice(start + 1, end);

  if (elapsed.endsWith('ms')) {
    return Number(elapsed.slice(0, -'ms'.length));
  }

  const minuteSeparator = elapsed.indexOf('m ');
  const minutes = minuteSeparator === -1 ? 0 : Number(elapsed.slice(0, minuteSeparator));
  const seconds = Number(
    elapsed.slice(minuteSeparator === -1 ? 0 : minuteSeparator + 2, -'s'.length),
  );
  return (minutes * 60 + seconds) * 1000;
}

async function seedOwnerFile(lockDirectory: string, owner: Record<string, unknown>) {
  await mkdir(lockDirectory, { recursive: true });
  writeFileSync(nodePath.join(lockDirectory, 'owner.json'), `${JSON.stringify(owner)}\n`);
}

describe('package test runner lock (379)', () => {
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
      TMPDIR: temporaryDirectory,
      SAFEWORD_TEST_LOCK_DIR: undefined,
    };

    const [first, second] = await Promise.all([
      runNodeScript(firstRunner, ['tests/first.test.ts'], env),
      runNodeScript(secondRunner, ['tests/second.test.ts'], env),
    ]);

    expectSuccessfulSerializedRun(first);
    expectSuccessfulSerializedRun(second);
    expectSerializedByRunner(readEvents(logPath));
  });

  it('reports the owning checkout and increasing elapsed wait periodically', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory } = await createFakeTestBinaries(temporaryDirectory, 250);
    const firstRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout-a');
    const secondRunner = await copyRunnerToCheckout(temporaryDirectory, 'checkout-b');
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    const ownerPath = nodePath.join(lockDirectory, 'owner.json');
    const env = {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
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
    expect(waiterResult.status).toBe(0);
    const waitStatuses = waiterResult.stderr
      .split('\n')
      .filter(line => line.startsWith('Waiting for safeword package test lock'));
    expect(waitStatuses.length).toBeGreaterThan(1);
    expect(waitStatuses[0]).toContain(`owner PID ${owner.pid}`);
    expect(owner.checkoutRoot).toMatch(/checkout-a$/);
    expect(waitStatuses[0]).toContain(`checkout ${owner.checkoutRoot}`);
    const elapsedMilliseconds = waitStatuses.map(parseElapsedWaitMilliseconds);
    expect(elapsedMilliseconds).toEqual(
      elapsedMilliseconds.toSorted((left, right) => left - right),
    );
    expect(new Set(elapsedMilliseconds).size).toBe(elapsedMilliseconds.length);
  });

  it('reports available fields when owner metadata is incomplete', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    await seedOwnerFile(lockDirectory, { createdAt: new Date().toISOString(), pid: process.pid });

    const result = await runNodeScript(runnerPath, ['tests/incomplete-owner.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '220',
      SAFEWORD_TEST_LOCK_STATUS_INTERVAL_MS: '100',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(`owner PID ${process.pid}`);
    expect(result.stderr).toContain('checkout unavailable');
    expect(result.stderr).toContain(
      'Proceeding without safeword package test lock after waiting 220ms.',
    );
  });

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

    const unsafeStatuses = unsafeInterval.stderr
      .split('\n')
      .filter(line => line.startsWith('Waiting for safeword package test lock'));
    expect(unsafeInterval.status).toBe(0);
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

    expect(malformedInterval.status).toBe(0);
    expect(malformedInterval.stderr).not.toContain('Waiting for safeword package test lock');
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

  it('rebases repo-root-relative test paths onto the package root (#723)', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');

    const result = await runNodeScript(
      runnerPath,
      ['packages/cli/tests/first.test.ts', '--config', 'vitest.live.config.ts'],
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
      // The path arg is rebased; the flag value is left untouched.
      expect.stringMatching(
        /^vitest:start:.*:run,tests\/first\.test\.ts,--config,vitest\.live\.config\.ts$/,
      ),
      expect.stringMatching(/^vitest:end:/),
    ]);
  });

  it('every vitest test script builds before running (no stale dist — #352)', () => {
    const pkg = JSON.parse(readFileSync(nodePath.join(cliRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const { scripts } = pkg;

    const vitestScripts = Object.entries(scripts).filter(
      ([name, command]) =>
        name.startsWith('test') && !name.startsWith('pretest') && /\bvitest\b/.test(command),
    );
    // Guard against a vacuous pass: there must be vitest-running scripts to check.
    expect(vitestScripts.length).toBeGreaterThan(3);

    for (const [name, command] of vitestScripts) {
      const usesRunner = command.includes('run-vitest-with-build-lock.mjs');
      const buildsFirst = scripts[`pre${name}`] === 'tsup' || command.includes('tsup &&');
      expect(
        usesRunner || buildsFirst,
        `${name} runs vitest without a preceding build — a stale dist/cli.js would produce spurious failures or false greens (#352). Route it through scripts/run-vitest-with-build-lock.mjs or add a pre-build.`,
      ).toBe(true);
    }
  });

  it('proceeds with a warning after the configured wait cap', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const { binaryDirectory, logPath } = await createFakeTestBinaries(temporaryDirectory);
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');
    await seedOwnerFile(lockDirectory, { createdAt: new Date().toISOString(), pid: process.pid });

    const result = await runNodeScript(runnerPath, ['tests/wait-cap.test.ts'], {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
      SAFEWORD_TEST_LOCK_MAX_WAIT_MS: '0',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      'Proceeding without safeword package test lock after waiting 0ms.',
    );
    expect(readEvents(logPath)).toEqual([
      expect.stringMatching(/^build:start:/),
      expect.stringMatching(/^build:end:/),
      expect.stringMatching(/^vitest:start:.*:run,tests\/wait-cap\.test\.ts$/),
      expect.stringMatching(/^vitest:end:/),
    ]);
  });
});
