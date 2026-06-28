/**
 * Issue-first ticket creation (KKNFZA TB1.AC1 / child DGH59K). When a tracker is
 * connected, identity comes from the tracker (the issue key) and the folder is
 * keyed to it — minted BEFORE any folder exists, so a failed mint leaves no
 * orphan. @wiring: real ticket-writer + real fs; only the identity source (the
 * network boundary) is injected.
 */

import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveTicketsDirectory } from '../../src/utils/configured-paths.js';
import { createIssueFirstTicket } from '../../src/utils/ticket-writer.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

function ticketFolders(ticketsDirectory: string): string[] {
  try {
    return readdirSync(ticketsDirectory).filter(name => name !== 'completed' && name !== 'tmp');
  } catch {
    return [];
  }
}

describe('createIssueFirstTicket (tracker-identity-and-join.TB1.AC1)', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });
  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  // TB1.AC1.connected_mints_issue_before_any_folder (@wiring)
  it('mints the issue before any folder, then keys the folder to the issue key', async () => {
    const ticketsDirectory = resolveTicketsDirectory(cwd);
    const folderCountBefore = ticketFolders(ticketsDirectory).length;

    // The injected identity is the network boundary. It asserts no ticket folder
    // has appeared yet at the moment issue-create runs (no create-then-rename).
    const identity = vi.fn(() => {
      expect(ticketFolders(ticketsDirectory)).toHaveLength(folderCountBefore);
      return Promise.resolve({ id: 'ENG-45', ref: { provider: 'linear' as const, id: 'ENG-45' } });
    });

    const result = await createIssueFirstTicket(cwd, { slug: 'login-bug', type: 'task' }, identity);

    expect(identity).toHaveBeenCalledTimes(1);
    const folders = ticketFolders(ticketsDirectory);
    expect(folders).toHaveLength(folderCountBefore + 1);
    expect(nodePath.basename(result.folderPath)).toBe('ENG-45-login-bug');
    const frontmatter = readFileSync(result.ticketPath, 'utf8');
    expect(frontmatter).toContain('id: ENG-45');
  });

  // TB1.AC2.unreachable_fails_no_orphan — identity throws → nothing created
  it('creates no folder when the tracker mint fails', async () => {
    const ticketsDirectory = resolveTicketsDirectory(cwd);
    const before = ticketFolders(ticketsDirectory);
    const identity = vi.fn(() => Promise.reject(new Error('tracker unreachable')));

    await expect(
      createIssueFirstTicket(cwd, { slug: 'login-bug', type: 'task' }, identity),
    ).rejects.toThrow('tracker unreachable');

    expect(ticketFolders(ticketsDirectory)).toEqual(before);
  });
});
