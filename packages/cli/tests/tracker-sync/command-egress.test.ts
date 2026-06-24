import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ClientsModule from '../../src/tracker-sync/clients.js';

// Keep the real clients module (buildWriterRegistry) but make repo-visibility
// resolution controllable, so we can prove the command wires it through to the
// orchestrator's egress warning without invoking real `gh`.
vi.mock('../../src/tracker-sync/clients.js', async importOriginal => {
  const actual = await importOriginal<typeof ClientsModule>();
  return { ...actual, resolveRepoVisibility: vi.fn() };
});

import { syncTrackerCommand } from '../../src/commands/sync-tracker.js';
import { resolveRepoVisibility } from '../../src/tracker-sync/clients.js';

/**
 * Command-level egress wiring (JS5K5G AC10). The orchestrator unit tests inject
 * repoVisibility directly; this drives `body: full` + github through the real
 * syncTrackerCommand to prove egressVisibility → resolveRepoVisibility actually
 * feeds the warning. The load-bearing case is private → NO warning: if the
 * command stopped calling egressVisibility, repoVisibility would be undefined and
 * the fail-safe would warn — so this test fails if that wiring is removed.
 */
const mockVisibility = vi.mocked(resolveRepoVisibility);

describe('sync-tracker command egress wiring', () => {
  let cwd: string;
  let logs: string[];

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'sync-egress-'));
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({
        ticketBridge: { provider: 'github', body: 'full', target: { repo: 'acme/demo' } },
      }),
    );
    logs = [];
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.spyOn(console, 'log').mockImplementation(m => {
      logs.push(String(m));
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.env.GITHUB_TOKEN = 'token';
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockVisibility.mockReset();
    delete process.env.GITHUB_TOKEN;
    process.exitCode = 0;
    rmSync(cwd, { recursive: true, force: true });
  });

  it('suppresses the egress warning when the repo resolves as private', async () => {
    mockVisibility.mockReturnValue('private');
    await syncTrackerCommand();
    expect(mockVisibility).toHaveBeenCalledWith('acme/demo');
    expect(logs.join('\n')).not.toMatch(/egress/i);
  });

  it('emits the egress warning when the repo resolves as public', async () => {
    mockVisibility.mockReturnValue('public');
    await syncTrackerCommand();
    expect(logs.join('\n')).toMatch(/egress/i);
  });
});
