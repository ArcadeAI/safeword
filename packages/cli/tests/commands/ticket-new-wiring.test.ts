/**
 * Wiring test for the real `ticket new` entry point (KKNFZA TB1.AC1). Drives
 * `ticketNew` end-to-end through the actual config read + routing + real fs (no
 * injected seams) on the provider:none path — proving the command glue
 * (readTicketBridgeConfig → resolveCreationMode → createTicket) is connected,
 * not just the orchestrator unit. The issue-first writer-build glue can't run in
 * a unit test (it shells `gh`); it is covered by createTicketRouted's injected
 * writer + this glue proving the routing wrapper.
 */

import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ticketNew } from '../../src/commands/ticket-new.js';
import { resolveTicketsDirectory } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

describe('ticketNew real-entry wiring (tracker-identity-and-join.TB1.AC1)', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });
  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('provider:none routes through the real command to the local path', async () => {
    await ticketNew('login-bug', { type: 'task' }, cwd);

    const ticketsDirectory = resolveTicketsDirectory(cwd);
    const [folder] = readdirSync(ticketsDirectory);
    expect(folder).toMatch(/-login-bug$/);
    const ticketPath = nodePath.join(ticketsDirectory, String(folder), 'ticket.md');
    expect(existsSync(ticketPath)).toBe(true);
    // provider:none builds no tracker client and writes no sidecar.
    expect(existsSync(nodePath.join(cwd, '.safeword', 'tracker-map.json'))).toBe(false);
  });
});
