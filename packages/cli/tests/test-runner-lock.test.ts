import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

describe('package test runner lock (379)', () => {
  it('serializes build and vitest for concurrent focused test commands', async () => {
    const temporaryDirectory = makeTemporaryDirectory();
    const binaryDirectory = nodePath.join(temporaryDirectory, 'bin');
    await mkdir(binaryDirectory, { recursive: true });
    const logPath = nodePath.join(temporaryDirectory, 'events.log');
    const lockDirectory = nodePath.join(temporaryDirectory, 'lock');

    writeFileSync(
      nodePath.join(binaryDirectory, 'bun'),
      `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const log = ${JSON.stringify(logPath)};
const parent = process.ppid;
appendFileSync(log, \`build:start:\${parent}\\n\`);
await new Promise(resolve => setTimeout(resolve, 120));
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
await new Promise(resolve => setTimeout(resolve, 120));
appendFileSync(log, \`vitest:end:\${parent}\\n\`);
`,
      { mode: 0o755 },
    );

    const env = {
      ...process.env,
      PATH: `${binaryDirectory}${nodePath.delimiter}${process.env.PATH ?? ''}`,
      SAFEWORD_TEST_LOCK_DIR: lockDirectory,
    };

    const [first, second] = await Promise.all([
      runNodeScript(runnerPath, ['tests/first.test.ts'], env),
      runNodeScript(runnerPath, ['tests/second.test.ts'], env),
    ]);

    expect(first).toMatchObject({ status: 0, stderr: '' });
    expect(second).toMatchObject({ status: 0, stderr: '' });

    const events = readFileSync(logPath, 'utf8').trim().split('\n');
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
  });
});
