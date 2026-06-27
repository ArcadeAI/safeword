import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncTrackerCommand } from '../../src/commands/sync-tracker.js';
import { readTicketBridgeConfig } from '../../src/tracker-sync/config.js';
import { readCorpus } from '../../src/tracker-sync/corpus.js';
import { syncTracker } from '../../src/tracker-sync/index.js';
import { loadTrackerMap, TrackerMap } from '../../src/tracker-sync/tracker-map.js';
import type { Provider, TrackerReference } from '../../src/tracker-sync/types.js';
import type { TrackerWriter } from '../../src/tracker-sync/writers.js';

/**
 * Wiring tests — the seam the unit tests missed. The orchestrator tests hand-build
 * `tickets`/`config`; this drives the REAL readTicketBridgeConfig + readCorpus into
 * the orchestrator, faking only the writer (the external boundary). A regression in
 * the config read or corpus walk (e.g. scanning the wrong directory) fails here even
 * though every fake-injected unit test would still pass.
 */
function recordingWriter(provider: Provider): TrackerWriter & { creates: unknown[] } {
  const creates: unknown[] = [];
  return {
    provider,
    creates,
    create(payload) {
      creates.push(payload);
      return Promise.resolve({ provider, id: String(creates.length) } satisfies TrackerReference);
    },
    update() {
      return Promise.resolve();
    },
    projectGraph() {
      return Promise.resolve();
    },
  };
}

describe('sync-tracker wiring (real config + corpus → orchestrator)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'sync-wire-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({
        ticketBridge: { provider: 'github', body: 'minimal', target: { repo: 'acme/demo' } },
      }),
    );
    const dir = nodePath.join(cwd, '.project', 'tickets', 'TEST01-wiring');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      nodePath.join(dir, 'ticket.md'),
      ['---', 'id: TEST01', 'type: task', 'status: in_progress', 'title: Probe', '---', ''].join(
        '\n',
      ),
    );
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('projects a real on-disk ticket through config read + corpus walk to the writer', async () => {
    const config = readTicketBridgeConfig(cwd);
    const tickets = readCorpus(cwd, config.target?.repo);
    const sidecarPath = nodePath.join(cwd, '.safeword', 'tracker-map.json');
    new TrackerMap().save(sidecarPath);
    const github = recordingWriter('github');

    const result = await syncTracker({
      config,
      tickets,
      sidecarPath,
      writers: { linear: recordingWriter('linear'), github },
      env: { GITHUB_TOKEN: 'token' },
      sleep: () => Promise.resolve(),
      log: () => {},
    });

    expect(result.exitCode).toBe(0);
    // The corpus walk must have found the real ticket and driven a create — a
    // wrong-directory regression would leave `tickets` empty and `creates` at 0.
    expect(github.creates).toHaveLength(1);
    expect((github.creates[0] as { title: string }).title).toBe('Probe');
    expect((github.creates[0] as { labels: string[] }).labels).toContain('type:task');
    const reloaded = loadTrackerMap(sidecarPath);
    expect(reloaded.ok && reloaded.map.lookup('TEST01') !== undefined).toBe(true);
  });
});

describe('sync-tracker command wiring (real syncTrackerCommand)', () => {
  let cwd: string;
  let logs: string[];
  let errs: string[];

  function seedProject(provider: string): void {
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ ticketBridge: { provider, target: { repo: 'acme/demo' } } }),
    );
  }

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'sync-cmd-wire-'));
    logs = [];
    errs = [];
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.spyOn(console, 'log').mockImplementation(m => {
      logs.push(String(m));
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      errs.push(String(chunk));
      return true;
    });
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
    rmSync(cwd, { recursive: true, force: true });
  });

  it('fails loudly when a provider is configured but no credential resolves (AC2)', async () => {
    seedProject('github');
    const previous = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    try {
      await syncTrackerCommand();
    } finally {
      if (previous !== undefined) process.env.GITHUB_TOKEN = previous;
    }
    expect(`${logs.join('\n')}${errs.join('\n')}`).toMatch(/credential/i);
    expect(process.exitCode).not.toBe(0);
  });

  it('refuses on a missing sidecar instead of blind-recreating (AC9)', async () => {
    seedProject('github');
    process.env.GITHUB_TOKEN = 'token';
    try {
      await syncTrackerCommand();
    } finally {
      delete process.env.GITHUB_TOKEN;
    }
    expect(logs.join('\n')).toMatch(/--reset-tracker-map/);
    expect(process.exitCode).not.toBe(0);
  });
});
