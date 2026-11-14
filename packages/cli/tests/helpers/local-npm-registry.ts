/**
 * A throwaway npm registry that publishes one `safeword` version, so tests can
 * run the real `bun x safeword@<version>` / `bunx safeword@<version>` route end
 * to end without the network (ticket 8VG20K).
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

const REGISTRY_SERVER = `import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
const version = process.env.PACKAGE_VERSION;
const tarball = readFileSync('safeword.tgz');
const delay = Number(process.env.DELAY_MS ?? 0);
const server = createServer(async (request, response) => {
  const base = 'http://127.0.0.1:' + server.address().port;
  const route = (request.url ?? '').split('?')[0];
  // A slow registry: only the first (metadata) request waits.
  if (route === '/safeword') await new Promise(resolve => setTimeout(resolve, delay));
  if (route.endsWith('.tgz')) {
    response.writeHead(200, { 'content-type': 'application/octet-stream' });
    response.end(tarball);
    return;
  }
  if (route === '/safeword') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      name: 'safeword',
      'dist-tags': { latest: version },
      versions: { [version]: {
        name: 'safeword', version, bin: { safeword: 'cli.js' },
        dist: { tarball: base + '/safeword/-/safeword-' + version + '.tgz' },
      } },
    }));
    return;
  }
  response.writeHead(404);
  response.end();
});
server.listen(0, '127.0.0.1', () => writeFileSync('port', String(server.address().port)));
`;

export interface PublishedSafeword {
  registry: string;
  cache: string;
  stop: () => void;
}

/**
 * Serve `safeword@<version>` from `root`. Its bin is `cliSource` behind a Node
 * shebang, like the real package.
 */
export function publishSafeword(options: {
  root: string;
  version: string;
  cliSource: string;
  delayMs?: number;
}): PublishedSafeword {
  const { root, version, cliSource, delayMs = 0 } = options;
  mkdirSync(nodePath.join(root, 'package'), { recursive: true });
  writeFileSync(
    nodePath.join(root, 'package/package.json'),
    JSON.stringify({ name: 'safeword', version, bin: { safeword: 'cli.js' } }),
  );
  writeFileSync(nodePath.join(root, 'package/cli.js'), `#!/usr/bin/env node\n${cliSource}`);
  execFileSync('tar', ['-czf', 'safeword.tgz', 'package'], { cwd: root });
  writeFileSync(nodePath.join(root, 'server.mjs'), REGISTRY_SERVER);
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, DELAY_MS: String(delayMs), PACKAGE_VERSION: version },
    stdio: 'ignore',
  });
  const portFile = nodePath.join(root, 'port');
  const deadline = Date.now() + 10_000;
  while (!existsSync(portFile) && Date.now() < deadline) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  }
  return {
    registry: `http://127.0.0.1:${readFileSync(portFile, 'utf8').trim()}`,
    cache: nodePath.join(root, 'cache'),
    stop: () => server.kill(),
  };
}
