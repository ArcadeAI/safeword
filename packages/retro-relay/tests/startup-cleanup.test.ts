/**
 * What `startRelayServer` owns when it rejects.
 *
 * A failed startup must leave nothing running. The maintenance interval calls
 * `service.maintain()` against the real store and GitHub client, so an interval
 * that survives a rejected startup keeps mutating a relay the caller believes
 * never came up — and every retried start adds another. `unref()` keeps it from
 * holding the process open; it does not stop it firing.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CredentialRegistry } from '../src/auth.js';
import { GitHubRestClient } from '../src/github.js';
import { startRelayServer } from '../src/http-server.js';
import { RelayStore } from '../src/store.js';

const directories: string[] = [];

afterEach(() => {
  const used = [...directories];
  directories.length = 0;
  for (const directory of used) rmSync(directory, { force: true, recursive: true });
});

function databasePath(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-relay-startup-'));
  directories.push(directory);
  return path.join(directory, 'relay.sqlite');
}

/** A store that counts the maintenance sweeps the interval drives. */
function countingStore(): { store: RelayStore; sweeps: () => number } {
  const store = RelayStore.open(databasePath());
  let sweeps = 0;
  const pendingAlerts = store.pendingAlerts.bind(store);
  store.pendingAlerts = () => {
    sweeps += 1;
    return pendingAlerts();
  };
  return { store, sweeps: () => sweeps };
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise(resolve => {
    server.close(() => {
      resolve();
    });
  });
}

function occupiedPort(): Promise<{ port: number; release: () => Promise<void> }> {
  return new Promise(resolve => {
    const blocker = createServer();
    blocker.listen(0, '127.0.0.1', () => {
      const address = blocker.address();
      if (address === null || typeof address === 'string') throw new Error('no port');
      resolve({ port: address.port, release: () => closeServer(blocker) });
    });
  });
}

const idle = (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

describe('relay startup failure', () => {
  it('leaves no maintenance interval running when the port is taken', async () => {
    const blocked = await occupiedPort();
    const { store, sweeps } = countingStore();

    try {
      await expect(
        startRelayServer({
          allowUnlockedForTests: true,
          credentials: new CredentialRegistry('pepper'),
          github: new GitHubRestClient({
            baseUrl: 'https://github.invalid',
            installationToken: () => Promise.reject(new Error('must not call GitHub')),
          }),
          host: '127.0.0.1',
          maintenanceIntervalMs: 10,
          payloadKey: Buffer.alloc(32, 7),
          port: blocked.port,
          store,
        }),
      ).rejects.toThrow();

      // Whatever ran before the rejection is fine; nothing may run after it.
      const settled = sweeps();
      await idle(80);
      expect(sweeps()).toBe(settled);
    } finally {
      await blocked.release();
      store.close();
    }
  });
});
