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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CredentialRegistry } from '../src/auth.js';
import { GitHubRestClient } from '../src/github.js';
import { startRelayServer } from '../src/http-server.js';
import { ProcessLock } from '../src/process-lock.js';
import { RelayStore } from '../src/store.js';

const directories: string[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
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

function serverDependencies(store: RelayStore): {
  credentials: CredentialRegistry;
  github: GitHubRestClient;
  host: string;
  maintenanceIntervalMs: number;
  payloadKey: Buffer;
  store: RelayStore;
} {
  return {
    credentials: new CredentialRegistry('pepper'),
    github: offlineGitHub(),
    host: '127.0.0.1',
    maintenanceIntervalMs: 10,
    payloadKey: Buffer.alloc(32, 7),
    store,
  };
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
  return new Promise((resolve, reject) => {
    const blocker = createServer();
    blocker.once('error', reject);
    blocker.listen(0, '127.0.0.1', () => {
      blocker.off('error', reject);
      const address = blocker.address();
      if (address === null || typeof address === 'string') {
        blocker.close(() => {
          reject(new Error('blocker did not bind a TCP port'));
        });
        return;
      }
      resolve({ port: address.port, release: () => closeServer(blocker) });
    });
  });
}

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
      port: 0,
      ...serverDependencies(store),
    });

    try {
      await vi.advanceTimersByTimeAsync(10);
      expect(sweeps()).toBeGreaterThan(0);
    } finally {
      await closeServer(started.server);
      store.close();
    }
  });

  it('releases its interval and process lock when the server closes', async () => {
    const { store, sweeps } = countingStore();
    const lockPath = path.join(scratchDirectory(), 'relay.lock');
    const started = await startRelayServer({
      lockPath,
      port: 0,
      ...serverDependencies(store),
    });

    try {
      await vi.advanceTimersByTimeAsync(10);
      expect(sweeps()).toBeGreaterThan(0);

      await closeServer(started.server);
      const settled = sweeps();
      await started.maintain();
      await vi.advanceTimersByTimeAsync(80);
      expect(sweeps()).toBe(settled);
      ProcessLock.acquire(lockPath).release();
    } finally {
      if (started.server.listening) await closeServer(started.server);
      store.close();
    }
  });
});

describe('relay startup listeners', () => {
  it('replaces the startup error listener with runtime error reporting', async () => {
    const store = RelayStore.open(databasePath());
    const started = await startRelayServer({
      allowUnlockedForTests: true,
      mode: 'spike',
      port: 0,
      ...serverDependencies(store),
    });

    try {
      expect(started.server.listenerCount('error')).toBe(1);
      started.server.emit('error', new Error('accept failed'));
      expect(started.observability.logs).toContainEqual({
        event: 'retro_server_error',
        message: 'accept failed',
      });
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
          port: blocked.port,
          ...serverDependencies(store),
        }),
      ).rejects.toThrow();

      // Whatever ran before the rejection is fine; nothing may run after it.
      const settled = sweeps();
      await vi.advanceTimersByTimeAsync(80);
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
          lockPath,
          port: blocked.port,
          ...serverDependencies(store),
        }),
      ).rejects.toThrow();

      const reacquired = ProcessLock.acquire(lockPath);
      reacquired.release();
    } finally {
      await blocked.release();
      store.close();
    }
  });

  it('keeps a caller-owned process lock held when the port is taken', async () => {
    const blocked = await occupiedPort();
    const store = RelayStore.open(databasePath());
    const lockPath = path.join(scratchDirectory(), 'relay.lock');
    const processLock = ProcessLock.acquire(lockPath);

    try {
      await expect(
        startRelayServer({
          port: blocked.port,
          processLock,
          ...serverDependencies(store),
        }),
      ).rejects.toThrow();

      expect(() => ProcessLock.acquire(lockPath)).toThrow('already locked');
    } finally {
      processLock.release();
      await blocked.release();
      store.close();
    }
  });

  // The control for the case above. Reacquiring proves a release only if
  // acquiring while held would have failed — otherwise the assertion passes
  // whether or not anything was ever released.
  it('refuses to acquire a lock this process already holds', () => {
    const lockPath = path.join(scratchDirectory(), 'relay.lock');
    const held = ProcessLock.acquire(lockPath);

    try {
      expect(() => ProcessLock.acquire(lockPath)).toThrow('already locked');
    } finally {
      held.release();
    }

    // And releasing makes it available again, so the failure above is the lock
    // being held rather than the path being unusable.
    ProcessLock.acquire(lockPath).release();
  });
});
