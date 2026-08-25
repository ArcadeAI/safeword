import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

const children: ChildProcess[] = [];
const directories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  children.length = 0;
  for (const server of servers) {
    await new Promise<void>(resolve =>
      server.close(() => {
        resolve();
      }),
    );
  }
  servers.length = 0;
  for (const directory of directories) {
    rmSync(directory, { force: true, recursive: true });
  }
  directories.length = 0;
});

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('server did not bind');
  return `http://127.0.0.1:${address.port}`;
}

async function unusedPort(): Promise<number> {
  const server = createServer();
  const url = new URL(await listen(server));
  await new Promise<void>(resolve =>
    server.close(() => {
      resolve();
    }),
  );
  return Number(url.port);
}

async function startCollector(
  databasePath: string,
  githubUrl: string,
): Promise<{
  child: ChildProcess;
  url: string;
}> {
  const port = await unusedPort();
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      GITHUB_API_URL: githubUrl,
      HOST: '127.0.0.1',
      PORT: String(port),
      SAFEWORD_PUBLIC_RETRO_DATABASE_PATH: databasePath,
      SAFEWORD_PUBLIC_RETRO_OPERATOR_CREDENTIAL: 'operator-fixture-credential',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  const url = `http://127.0.0.1:${port}`;
  await expect
    .poll(
      async () => {
        if (child.exitCode !== null) return `exited:${child.exitCode}`;
        try {
          await fetch(`${url}/ready`);
          return 'ready';
        } catch {
          return 'waiting';
        }
      },
      { interval: 25, timeout: 1000 },
    )
    .toBe('ready');
  return { child, url };
}

async function stopCollector(child: ChildProcess): Promise<void> {
  child.kill('SIGTERM');
  const code = await new Promise<number | null>(resolve =>
    child.once('exit', exitCode => {
      resolve(exitCode);
    }),
  );
  expect(code).toBe(0);
}

function requestBody(): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      version: 'v1',
      finding: 'fixture finding',
      source: {
        harness: 'codex',
        hostClass: 'local',
        projectUUID: '018f0f2e-abcd-7def-8abc-def012345678',
        safewordCliVersion: '0.79.0',
      },
      sessionScope: '9'.repeat(64),
    }),
  );
}

async function submit(url: string): Promise<Response> {
  return fetch(`${url}/v1/public-retros`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-safeword-request-id': '01922222-2222-7333-8444-55555555555a',
    },
    body: requestBody(),
  });
}

it('persists a public retro in its own process without calling GitHub', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-packaged-collector-'));
  directories.push(directory);
  let githubCalls = 0;
  const github = createServer((_request, response) => {
    githubCalls += 1;
    response.writeHead(500).end();
  });
  servers.push(github);
  const githubUrl = await listen(github);
  const databasePath = path.join(directory, 'collector.sqlite');

  const firstRuntime = await startCollector(databasePath, githubUrl);
  const firstResponse = await submit(firstRuntime.url);
  const firstReceipt = await firstResponse.json();
  await stopCollector(firstRuntime.child);

  const restartedRuntime = await startCollector(databasePath, githubUrl);
  const retryResponse = await submit(restartedRuntime.url);
  const retryReceipt = await retryResponse.json();
  await stopCollector(restartedRuntime.child);

  expect(firstResponse.status).toBe(201);
  expect(retryResponse.status).toBe(200);
  expect(retryReceipt).toEqual(firstReceipt);
  expect(githubCalls).toBe(0);
});

it('ships without private filing authority', () => {
  const packageRoot = path.resolve(import.meta.dirname, '..');
  const manifest = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  const artifact = readdirSync(path.join(packageRoot, 'dist'))
    .filter(file => file.endsWith('.js'))
    .map(file => readFileSync(path.join(packageRoot, 'dist', file), 'utf8'))
    .join('\n');

  expect(manifest.dependencies ?? {}).toEqual({});
  expect(artifact).not.toMatch(/github|octokit|retro-relay|GITHUB_/iu);
});

it('grants correlation values no read or filing authority', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-packaged-collector-'));
  directories.push(directory);
  let githubCalls = 0;
  const github = createServer((_request, response) => {
    githubCalls += 1;
    response.writeHead(500).end();
  });
  servers.push(github);
  const runtime = await startCollector(
    path.join(directory, 'collector.sqlite'),
    await listen(github),
  );
  const accepted = await submit(runtime.url);
  const { receipt } = (await accepted.json()) as { receipt: string };
  const correlationValues = [
    '018f0f2e-abcd-7def-8abc-def012345678',
    '01922222-2222-7333-8444-55555555555a',
    receipt,
    'codex',
  ];

  const reads = await Promise.all(
    correlationValues.map(value =>
      fetch(`${runtime.url}/v1/public-retros/${receipt}`, {
        headers: { authorization: `Bearer ${value}` },
      }),
    ),
  );
  await stopCollector(runtime.child);

  expect(reads.map(response => response.status)).toEqual([404, 404, 404, 404]);
  expect(githubCalls).toBe(0);
});
