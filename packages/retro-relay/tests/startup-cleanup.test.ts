/**
 * What `startRelayServer` owns when it rejects.
 *
 * A failed startup must leave nothing running. The maintenance interval calls
 * `service.maintain()` against the real store and GitHub client, so an interval
 * that survives a rejected startup keeps mutating a relay the caller believes
 * never came up — and every retried start adds another. `unref()` keeps it from
 * holding the process open; it does not stop it firing.
 *
 * The process lock is the other half: when startup acquires it from `lockPath`,
 * a rejection that keeps it makes every retry fail as "already locked".
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CredentialRegistry } from '../src/auth.js';
import { GitHubRestClient } from '../src/github.js';
import { startRelayServer } from '../src/http-server.js';
import { ProcessLock } from '../src/process-lock.js';
import { RelayStore } from '../src/store.js';

const directories: string[] = [];

afterEach(() => {
  const used = [...directories];
  directories.length = 0;
  for (const directory of used) rmSync(directory, { force: true, recursive: true });
});

function scratchDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'safeword-relay-startup-'));
  directories.push(directory);
  return directory;
}

function databasePath(): string {
  return path.join(scratchDirectory(), 'relay.sqlite');
}

/** A never-usable GitHub client: maintenance must not reach the network here. */
function offlineGitHub(): GitHubRestClient {
  return new GitHubRestClient({
    baseUrl: 'https://github.invalid',
    installationToken: () => Promise.reject(new Error('must not call GitHub')),
  });
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

describe('relay maintenance interval', () => {
  // Positive control for the counter the failure tests below read. A sweep
  // count that stops growing proves nothing unless it grows when the interval
  // is genuinely running, so this pins the probe to observable behaviour: if
  // `pendingAlerts` ever stops being the sweep's witness, this fails first and
  // the failure tests do not quietly go vacuous.
  it('advances the sweep counter while the server is up', async () => {
    const { store, sweeps } = countingStore();
    const started = await startRelayServer({
      allowUnlockedForTests: true,
      credentials: new CredentialRegistry('pepper'),
      github: offlineGitHub(),
      host: '127.0.0.1',
      maintenanceIntervalMs: 10,
      payloadKey: Buffer.alloc(32, 7),
      port: 0,
      store,
    });

    try {
      await vi.waitFor(() => {
        expect(sweeps()).toBeGreaterThan(0);
      }, 2000);
    } finally {
      await closeServer(started.server);
      store.close();
    }
  });
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
          github: offlineGitHub(),
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

  // The interval is only half of what a failed startup holds. `lockPath` makes
  // the server the lock's owner, and a lock that outlives the rejection makes
  // every retry fail as "already locked" — a relay that can never start again
  // without a restart. Reacquiring the same path is the only proof the release
  // actually ran; `allowUnlockedForTests` never exercises it.
  it('releases the process lock it acquired when the port is taken', async () => {
    const blocked = await occupiedPort();
    const store = RelayStore.open(databasePath());
    const lockPath = path.join(scratchDirectory(), 'relay.lock');

    try {
      await expect(
        startRelayServer({
          credentials: new CredentialRegistry('pepper'),
          github: offlineGitHub(),
          host: '127.0.0.1',
          lockPath,
          maintenanceIntervalMs: 10,
          payloadKey: Buffer.alloc(32, 7),
          port: blocked.port,
          store,
        }),
      ).rejects.toThrow();

      const reacquired = ProcessLock.acquire(lockPath);
      reacquired.release();
    } finally {
      await blocked.release();
      store.close();
    }
  });
});
