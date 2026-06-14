/**
 * Namespace-surface test (ticket TAGWZ8, epic AQJ95G): a representative
 * surface (sync-tickets) reads and writes under the resolved namespace root,
 * with a decoy in the legacy directory making stray reads observable.
 *
 * Scenario lineage: namespace-root-resolver.SM1.AC2.surface_follows_resolved_root.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { syncTickets } from '../../src/ticket-sync/index.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

function writeTicket(root: string, folder: string, id: string, title: string): void {
  const directory = nodePath.join(root, 'tickets', folder);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    nodePath.join(directory, 'ticket.md'),
    `---\nid: ${id}\ntitle: '${title}'\ntype: task\nstatus: in_progress\n---\n\n# ${title}\n`,
  );
}

describe('sync-tickets follows the resolved namespace root (TAGWZ8)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('SM1.AC2.surface_follows_resolved_root', () => {
    writeTicket(nodePath.join(cwd, '.project'), 'AAA111-real-ticket', 'AAA111', 'Real ticket');
    writeTicket(
      nodePath.join(cwd, '.safeword-project'),
      'ZZZ999-decoy-ticket',
      'ZZZ999',
      'Decoy ticket',
    );
    const legacyTicketsDirectory = nodePath.join(cwd, '.safeword-project', 'tickets');
    const legacyBefore = readdirSync(legacyTicketsDirectory, { recursive: true });

    const result = syncTickets(cwd);

    expect(result.wrote).toBe(true);
    const indexPath = nodePath.join(cwd, '.project', 'tickets', 'INDEX.md');
    expect(existsSync(indexPath)).toBe(true);
    const index = readFileSync(indexPath, 'utf8');
    expect(index).toContain('AAA111');
    expect(index).not.toContain('ZZZ999');
    expect(index).toContain('.project/tickets/AAA111-real-ticket');
    // Legacy directory untouched — no INDEX.md written, nothing added or removed.
    expect(readdirSync(legacyTicketsDirectory, { recursive: true })).toEqual(legacyBefore);
  });
});
