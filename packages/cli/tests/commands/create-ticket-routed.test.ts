/**
 * End-to-end routing for `ticket new` (KKNFZA TB1.AC1/AC2). Real ticket-writer +
 * real fs + real tracker-map sidecar; only the writer factory (the network
 * boundary) is injected. Covers: provider:none stays local and builds no client;
 * a configured provider mints issue-first and records the ref; a credential
 * failure surfaces and leaves no orphan.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTicketRouted } from '../../src/commands/create-ticket-routed.js';
import type { TrackerWriter } from '../../src/tracker-sync/writers.js';
import { resolveTicketsDirectory } from '../../src/utils/configured-paths.js';
import type { IdMinter } from '../../src/utils/id-minter.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

function fixedMinter(id: string): IdMinter {
  return { mint: () => id };
}

function writerCreating(id: string): TrackerWriter {
  return {
    provider: 'github',
    create: vi.fn(() => Promise.resolve({ provider: 'github' as const, id, url: `u/${id}` })),
    update: vi.fn(() => Promise.resolve()),
    projectGraph: vi.fn(() => Promise.resolve()),
  };
}

function ticketFolders(directory: string): string[] {
  try {
    return readdirSync(directory).filter(name => name !== 'completed' && name !== 'tmp');
  } catch {
    return [];
  }
}

describe('createTicketRouted (tracker-identity-and-join.TB1)', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });
  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  // TB1.AC1.no_tracker_is_local_as_today — provider:none stays local, no client built
  it('routes provider:none to the local minter and constructs no tracker client', async () => {
    const buildWriter = vi.fn();
    const result = await createTicketRouted(
      cwd,
      { slug: 'login-bug', type: 'task' },
      { config: { provider: 'none', body: 'minimal' }, buildWriter, minter: fixedMinter('AB12CD') },
    );

    expect(buildWriter).not.toHaveBeenCalled();
    expect(nodePath.basename(result.folderPath)).toBe('AB12CD-login-bug');
    expect(existsSync(nodePath.join(cwd, '.safeword', 'tracker-map.json'))).toBe(false);
  });

  // TB1.AC1.successful_create_records_ref — issue-first create records the ref in the sidecar
  it('mints issue-first and records the ref in the tracker-map', async () => {
    const result = await createTicketRouted(
      cwd,
      { slug: 'login-bug', type: 'task' },
      {
        config: { provider: 'github', body: 'minimal', target: { repo: 'o/r' } },
        buildWriter: () => writerCreating('123'),
        minter: fixedMinter('UNUSED'),
      },
    );

    expect(nodePath.basename(result.folderPath)).toBe('123-login-bug');
    const sidecar = JSON.parse(
      readFileSync(nodePath.join(cwd, '.safeword', 'tracker-map.json'), 'utf8'),
    );
    expect(sidecar.issues['123']).toEqual({
      ref: { provider: 'github', id: '123', url: 'u/123' },
      status: 'recorded',
    });
  });

  // TB1.AC2.rejected_credential_fails_no_orphan — create rejects → no folder, no sidecar entry
  it('surfaces a tracker create failure and leaves no orphan', async () => {
    const failing: TrackerWriter = {
      provider: 'github',
      create: vi.fn(() => Promise.reject(new Error('HTTP 401: bad credentials'))),
      update: vi.fn(() => Promise.resolve()),
      projectGraph: vi.fn(() => Promise.resolve()),
    };

    await expect(
      createTicketRouted(
        cwd,
        { slug: 'login-bug', type: 'task' },
        {
          config: { provider: 'github', body: 'minimal', target: { repo: 'o/r' } },
          buildWriter: () => failing,
          minter: fixedMinter('UNUSED'),
        },
      ),
    ).rejects.toThrow('bad credentials');

    expect(ticketFolders(resolveTicketsDirectory(cwd))).toEqual([]);
    expect(existsSync(nodePath.join(cwd, '.safeword', 'tracker-map.json'))).toBe(false);
  });
});
