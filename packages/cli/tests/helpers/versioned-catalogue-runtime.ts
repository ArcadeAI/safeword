import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import nodePath from 'node:path';
import { promisify } from 'node:util';

import { assertMatchingTree } from './codex-plugin-package.js';

const execute = promisify(execFile);

/** Let the real version-qualified bunx install an actual candidate in an owned cache. */
export async function prepareVersionedCatalogueRuntime(
  packageRoot: string,
  directory: string,
  environment: NodeJS.ProcessEnv,
): Promise<{ packageRoot: string; environment: NodeJS.ProcessEnv }> {
  const registryRoot = nodePath.join(directory, 'registry');
  const candidate = nodePath.join(registryRoot, 'package');
  mkdirSync(registryRoot);
  cpSync(packageRoot, candidate, { recursive: true });
  const metadata = JSON.parse(readFileSync(nodePath.join(candidate, 'package.json'), 'utf8')) as {
    version: string;
  };
  const manifest = {
    name: 'safeword',
    version: metadata.version,
    bin: { safeword: 'runtime/cli.js' },
  };
  writeFileSync(nodePath.join(candidate, 'package.json'), JSON.stringify(manifest));
  chmodSync(nodePath.join(candidate, 'runtime/cli.js'), 0o755);
  const tarball = nodePath.join(registryRoot, 'candidate.tgz');
  await execute('tar', ['-czf', tarball, '-C', registryRoot, 'package']);
  const temporary = nodePath.join(registryRoot, 'tmp');
  const cache = nodePath.join(registryRoot, 'cache');
  const install = nodePath.join(registryRoot, 'install');
  const client = nodePath.join(registryRoot, 'client');
  for (const path of [temporary, cache, install, client]) mkdirSync(path);
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? '');
    if (request.url === '/candidate.tgz') {
      response.end(readFileSync(tarball));
      return;
    }
    if (request.url !== '/safeword') {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        name: manifest.name,
        versions: {
          [manifest.version]: { ...manifest, dist: { tarball: `${registry}/candidate.tgz` } },
        },
        'dist-tags': { latest: manifest.version },
      }),
    );
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const registry = `http://127.0.0.1:${address.port}`;
  const isolated = {
    ...environment,
    TMPDIR: temporary,
    BUN_INSTALL: install,
    BUN_INSTALL_CACHE_DIR: cache,
  };
  writeFileSync(nodePath.join(client, '.npmrc'), `registry=${registry}\n`);
  try {
    const result = await execute(
      'bun',
      ['x', '--bun', `safeword@${manifest.version}`, '--version'],
      {
        cwd: client,
        env: { ...isolated, npm_config_registry: registry },
        timeout: 120_000,
      },
    );
    assert.ok(result.stdout.includes(manifest.version));
  } finally {
    server.closeAllConnections();
    server.close();
  }
  assert.ok(requests.includes('/safeword') && requests.includes('/candidate.tgz'));
  const installed = readdirSync(temporary).filter(name => name.startsWith('bunx-'));
  assert.equal(installed.length, 1, 'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous owned bunx cache');
  const entry = installed[0];
  assert.ok(entry);
  const installedRoot = nodePath.join(temporary, entry, 'node_modules/safeword');
  assert.deepEqual(
    readFileSync(nodePath.join(installedRoot, 'runtime/cli.js')),
    readFileSync(nodePath.join(packageRoot, 'runtime/cli.js')),
  );
  assertMatchingTree(
    nodePath.join(packageRoot, 'templates'),
    nodePath.join(installedRoot, 'templates'),
  );
  writeFileSync(
    nodePath.join(registryRoot, 'installation.json'),
    JSON.stringify({ requests, installedRoot, manifest }, undefined, 2),
  );
  return { packageRoot: installedRoot, environment: isolated };
}
