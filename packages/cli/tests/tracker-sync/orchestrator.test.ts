import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RateLimitError } from '../../src/tracker-sync/backoff.js';
import { syncTracker, type SyncTrackerDependencies } from '../../src/tracker-sync/index.js';
import { CREDENTIAL_ENV_VAR } from '../../src/tracker-sync/secrets.js';
import { loadTrackerMap, TrackerMap } from '../../src/tracker-sync/tracker-map.js';
import type { Provider, TicketInput, TrackerReference } from '../../src/tracker-sync/types.js';
import type { TrackerWriter } from '../../src/tracker-sync/writers.js';

/** A programmable fake writer that records calls (and can fail create once). */
function fakeWriter(
  provider: Provider,
  options: { failCreateOnce?: boolean } = {},
): TrackerWriter & { creates: unknown[]; updates: unknown[] } {
  const creates: unknown[] = [];
  const updates: unknown[] = [];
  let attempts = 0;
  return {
    provider,
    creates,
    updates,
    create(payload) {
      creates.push(payload);
      attempts += 1;
      if (options.failCreateOnce === true && attempts === 1) {
        return Promise.reject(new RateLimitError('429'));
      }
      const ref: TrackerReference = { provider, id: String(attempts) };
      return Promise.resolve(ref);
    },
    update(ref, payload) {
      updates.push({ ref, payload });
      return Promise.resolve();
    },
  };
}

const ticket: TicketInput = {
  id: 'AB12CD',
  title: 'Wire it up',
  status: 'in_progress',
  type: 'feature',
  epic: 'bridge',
  ticketUrl: 'https://github.com/acme/repo/tree/main/.project/tickets/AB12CD-wire',
  bodyMarkdown: 'internal body',
};

describe('sync-tracker orchestrator', () => {
  let directory: string;
  let sidecarPath: string;
  let messages: string[];
  let writers: Record<Provider, ReturnType<typeof fakeWriter>>;

  beforeEach(() => {
    directory = mkdtempSync(nodePath.join(tmpdir(), 'sync-orch-'));
    sidecarPath = nodePath.join(directory, 'tracker-map.json');
    messages = [];
    writers = { linear: fakeWriter('linear'), github: fakeWriter('github') };
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function makeDependencies(
    overrides: Partial<SyncTrackerDependencies> = {},
  ): SyncTrackerDependencies {
    return {
      config: { provider: 'github', body: 'minimal' },
      tickets: [ticket],
      sidecarPath,
      writers,
      env: { [CREDENTIAL_ENV_VAR.github]: 'tok' },
      sleep: () => Promise.resolve(),
      log: message => {
        messages.push(message);
      },
      ...overrides,
    };
  }

  const seedEmptySidecar = (): void => {
    new TrackerMap().save(sidecarPath);
  };

  // AC1 — no-tracker base case
  it('is a friendly no-op when provider is none', async () => {
    const result = await syncTracker(makeDependencies({ config: { provider: 'none' } }));
    expect(result.exitCode).toBe(0);
    expect(messages.join('\n')).toMatch(/safeword setup/);
    expect(writers.github.creates).toHaveLength(0);
  });

  it('treats an unsupported provider as none', async () => {
    const result = await syncTracker(makeDependencies({ config: { provider: 'asana' } }));
    expect(result.exitCode).toBe(0);
    expect(writers.github.creates).toHaveLength(0);
  });

  // AC2 — configured but no credential fails loudly
  it('fails loudly and writes nothing when no credential resolves', async () => {
    const result = await syncTracker(makeDependencies({ env: {} }));
    expect(result.exitCode).not.toBe(0);
    expect(messages.join('\n')).toMatch(/credential|token|GITHUB_TOKEN/i);
    expect(writers.github.creates).toHaveLength(0);
  });

  // AC5 — first sync creates + records
  it('creates an absent ticket and records its ref', async () => {
    seedEmptySidecar();
    const result = await syncTracker(makeDependencies());
    expect(result.exitCode).toBe(0);
    expect(writers.github.creates).toHaveLength(1);
    const reloaded = loadTrackerMap(sidecarPath);
    expect(reloaded.ok && reloaded.map.lookup('AB12CD')?.ref.provider).toBe('github');
  });

  // AC6 — re-run updates, never duplicates
  it('updates a recorded ticket without creating', async () => {
    const map = new TrackerMap();
    map.record('AB12CD', { provider: 'github', id: '7' });
    map.save(sidecarPath);

    await syncTracker(makeDependencies());
    expect(writers.github.updates).toHaveLength(1);
    expect(writers.github.creates).toHaveLength(0);
  });

  // AC8 — per-ticket persistence: an earlier create survives a later failure,
  // so a re-run reconciles the finished one and never double-creates it.
  it('persists an earlier create before a later ticket fails', async () => {
    seedEmptySidecar();
    const first: TicketInput = { ...ticket, id: 'AAA111' };
    const second: TicketInput = { ...ticket, id: 'BBB222' };
    let calls = 0;
    const flaky: ReturnType<typeof fakeWriter> = {
      provider: 'github',
      creates: [],
      updates: [],
      create(payload) {
        calls += 1;
        flaky.creates.push(payload);
        if (calls === 2) return Promise.reject(new Error('boom'));
        const ref: TrackerReference = { provider: 'github', id: String(calls) };
        return Promise.resolve(ref);
      },
      update() {
        return Promise.resolve();
      },
    };

    const dependencies = makeDependencies({
      tickets: [first, second],
      writers: { linear: fakeWriter('linear'), github: flaky },
    });
    await expect(syncTracker(dependencies)).rejects.toThrow('boom');

    const reloaded = loadTrackerMap(sidecarPath);
    expect(reloaded.ok && reloaded.map.lookup('AAA111')?.status).toBe('recorded');
    expect(reloaded.ok && reloaded.map.lookup('BBB222')).toBeUndefined();
  });

  // AC8 — pending entry reconciles, never double-creates
  it('reconciles a pending ticket instead of creating again', async () => {
    const map = new TrackerMap();
    map.markPending('AB12CD', { provider: 'github', id: '7' });
    map.save(sidecarPath);

    await syncTracker(makeDependencies());
    expect(writers.github.creates).toHaveLength(0);
    expect(writers.github.updates).toHaveLength(1);
  });

  // AC9 — corrupt / missing sidecar refuses
  it('refuses on a corrupt sidecar pending an explicit reset', async () => {
    writeFileSync(sidecarPath, '{ not json');
    const result = await syncTracker(makeDependencies());
    expect(result.exitCode).not.toBe(0);
    expect(messages.join('\n')).toMatch(/--reset-tracker-map/);
    expect(writers.github.creates).toHaveLength(0);
  });

  it('refuses on a missing sidecar pending an explicit reset', async () => {
    const result = await syncTracker(makeDependencies());
    expect(result.exitCode).not.toBe(0);
    expect(messages.join('\n')).toMatch(/--reset-tracker-map/);
    expect(writers.github.creates).toHaveLength(0);
  });

  it('proceeds from a clean slate when --reset-tracker-map is passed', async () => {
    const result = await syncTracker(makeDependencies({ resetTrackerMap: true }));
    expect(result.exitCode).toBe(0);
    expect(writers.github.creates).toHaveLength(1);
  });

  // AC10 — body full to a public github repo warns before any create
  it('warns about egress before creating when body full hits a public repo', async () => {
    seedEmptySidecar();
    const ordered: string[] = [];
    const trackingWriter = fakeWriter('github');
    const originalCreate = trackingWriter.create.bind(trackingWriter);
    trackingWriter.create = payload => {
      ordered.push('create');
      return originalCreate(payload);
    };
    await syncTracker(
      makeDependencies({
        config: { provider: 'github', body: 'full', target: { repo: 'acme/repo' } },
        repoVisibility: 'public',
        writers: { linear: fakeWriter('linear'), github: trackingWriter },
        log: message => {
          if (/egress|public/i.test(message)) ordered.push('warning');
          messages.push(message);
        },
      }),
    );
    expect(messages.join('\n')).toMatch(/egress|public/i);
    expect(ordered.indexOf('warning')).toBeLessThan(ordered.indexOf('create'));
  });

  // AC11 — the token never appears in output
  it('never prints the resolved token', async () => {
    seedEmptySidecar();
    await syncTracker(
      makeDependencies({ env: { [CREDENTIAL_ENV_VAR.github]: 'SENTINEL-TOKEN-abc123' } }),
    );
    expect(messages.join('\n')).not.toContain('SENTINEL-TOKEN-abc123');
  });

  // AC12 — CI on an Arcade user identity is warned
  it('warns about the Arcade user-identity silent-failure mode in CI', async () => {
    seedEmptySidecar();
    await syncTracker(makeDependencies({ nonInteractive: true, arcadeUserId: 'user_123' }));
    expect(messages.join('\n')).toMatch(/Arcade-User-ID|user identity|silently/i);
  });

  // AC13 — a rate-limited write is retried and ultimately projected
  it('retries a rate-limited create and ultimately projects the ticket', async () => {
    seedEmptySidecar();
    const flaky = fakeWriter('github', { failCreateOnce: true });
    await syncTracker(
      makeDependencies({ writers: { linear: fakeWriter('linear'), github: flaky } }),
    );
    expect(flaky.creates).toHaveLength(2);
    const reloaded = loadTrackerMap(sidecarPath);
    expect(reloaded.ok && reloaded.map.lookup('AB12CD') !== undefined).toBe(true);
  });
});
