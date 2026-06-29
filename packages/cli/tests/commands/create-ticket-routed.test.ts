/**
 * End-to-end routing for `ticket new` (KKNFZA TB1.AC1/AC2). Real ticket-writer +
 * real fs + real tracker-map sidecar; only the writer factory (the network
 * boundary) is injected. Covers: provider:none stays local and builds no client;
 * a configured provider mints issue-first and records the ref; a credential
 * failure surfaces and leaves no orphan.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTicketRouted } from '../../src/ticket-create/index.js';
import { resolveFolderByTrackerKey } from '../../src/tracker-sync/resolve-by-key.js';
import { loadTrackerMap } from '../../src/tracker-sync/tracker-map.js';
import type { TrackerWriter } from '../../src/tracker-sync/writers.js';
import { resolveTicketsDirectory } from '../../src/utils/configured-paths.js';
import type { IdMinter } from '../../src/utils/id-minter.js';
import { createTemporaryDirectory, removeTemporaryDirectory, ticketFolders } from '../helpers.js';

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

  // TB1.AC1.existing_issue_is_adopted — --issue keys the folder to the given key,
  // makes no create call, and records the adopted ref (routed end-to-end).
  it('adopts an existing issue: no create call, folder + ref keyed to the given key', async () => {
    const create = vi.fn(() => Promise.resolve({ provider: 'github' as const, id: 'NOPE' }));
    const writer: TrackerWriter = {
      provider: 'github',
      create,
      update: vi.fn(() => Promise.resolve()),
      projectGraph: vi.fn(() => Promise.resolve()),
    };

    const result = await createTicketRouted(
      cwd,
      { slug: 'login-bug', type: 'task', issue: 'ENG-45' },
      {
        config: { provider: 'github', body: 'minimal', target: { repo: 'o/r' } },
        buildWriter: () => writer,
        minter: fixedMinter('UNUSED'),
      },
    );

    expect(create).not.toHaveBeenCalled();
    expect(nodePath.basename(result.folderPath)).toBe('ENG-45-login-bug');
    const sidecar = JSON.parse(
      readFileSync(nodePath.join(cwd, '.safeword', 'tracker-map.json'), 'utf8'),
    );
    expect(sidecar.issues['ENG-45']).toEqual({
      ref: { provider: 'github', id: 'ENG-45' },
      status: 'recorded',
    });
  });

  // TB1.AC1 — adopting a GitHub "#123" stores a BARE ref id and a bare-keyed folder,
  // so the SM1.AC1 join reader resolves it. Guards the adopt↔reader normalization seam.
  it('adopts "#123" as bare "123" and the join reader resolves the folder', async () => {
    const result = await createTicketRouted(
      cwd,
      { slug: 'login-bug', type: 'task', issue: '#123' },
      {
        config: { provider: 'github', body: 'minimal', target: { repo: 'o/r' } },
        buildWriter: () => writerCreating('NOPE'),
        minter: fixedMinter('UNUSED'),
      },
    );

    expect(nodePath.basename(result.folderPath)).toBe('123-login-bug');
    const sidecar = JSON.parse(
      readFileSync(nodePath.join(cwd, '.safeword', 'tracker-map.json'), 'utf8'),
    );
    expect(sidecar.issues['123']).toEqual({
      ref: { provider: 'github', id: '123' },
      status: 'recorded',
    });

    const loaded = loadTrackerMap(nodePath.join(cwd, '.safeword', 'tracker-map.json'));
    expect(loaded.ok).toBe(true);
    const ticketsDirectory = resolveTicketsDirectory(cwd);
    // Resolvable by both the bare key and the original "#"-prefixed form.
    if (loaded.ok) {
      expect(resolveFolderByTrackerKey(ticketsDirectory, loaded.map, '123')).toBe(
        result.folderPath,
      );
      expect(resolveFolderByTrackerKey(ticketsDirectory, loaded.map, '#123')).toBe(
        result.folderPath,
      );
    }
  });

  // Re-adopting the same key+slug hits an existing folder (EEXIST) — the prior
  // `recorded` entry must NOT be downgraded to `pending` (adopt writes no pending).
  it('an adopt-collision leaves the existing recorded entry intact', async () => {
    const githubAdopt = {
      config: { provider: 'github', body: 'minimal' as const, target: { repo: 'o/r' } },
      buildWriter: () => writerCreating('NOPE'),
      minter: fixedMinter('UNUSED'),
    };
    await createTicketRouted(
      cwd,
      { slug: 'login-bug', type: 'task', issue: 'ENG-45' },
      githubAdopt,
    );

    await expect(
      createTicketRouted(cwd, { slug: 'login-bug', type: 'task', issue: 'ENG-45' }, githubAdopt),
    ).rejects.toThrow(/already exists/);

    const sidecar = JSON.parse(
      readFileSync(nodePath.join(cwd, '.safeword', 'tracker-map.json'), 'utf8'),
    );
    expect(sidecar.issues['ENG-45'].status).toBe('recorded');
  });

  // A corrupt sidecar holds other tickets' refs — `ticket new` must refuse BEFORE
  // minting an issue and must not overwrite the file.
  it('refuses to create against a corrupt tracker-map and leaves it untouched', async () => {
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    const sidecarPath = nodePath.join(cwd, '.safeword', 'tracker-map.json');
    writeFileSync(sidecarPath, '{ corrupt not json');
    const create = vi.fn(() => Promise.resolve({ provider: 'github' as const, id: '123' }));
    const writer: TrackerWriter = {
      provider: 'github',
      create,
      update: vi.fn(() => Promise.resolve()),
      projectGraph: vi.fn(() => Promise.resolve()),
    };

    await expect(
      createTicketRouted(
        cwd,
        { slug: 'login-bug', type: 'task' },
        {
          config: { provider: 'github', body: 'minimal', target: { repo: 'o/r' } },
          buildWriter: () => writer,
          minter: fixedMinter('UNUSED'),
        },
      ),
    ).rejects.toThrow(/corrupt/);

    expect(create).not.toHaveBeenCalled();
    expect(readFileSync(sidecarPath, 'utf8')).toBe('{ corrupt not json');
    expect(ticketFolders(resolveTicketsDirectory(cwd))).toEqual([]);
  });
});
