/**
 * Wiring test for the real `ticket new` entry point (KKNFZA TB1.AC1). Drives
 * `ticketNew` end-to-end through the actual config read + routing + real fs (no
 * injected application seams). The connected-provider case replaces only the
 * `gh` executable at the process boundary, preserving real config loading,
 * writer selection, command arguments, sidecar persistence, and filesystem
 * creation.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ticketNew } from '../../src/commands/ticket-new.js';
import { resolveTicketsDirectory } from '../../src/utils/configured-paths.js';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

describe('ticketNew real-entry wiring (tracker-identity-and-join.TB1.AC1)', () => {
  let cwd: string;
  let originalPath: string | undefined;
  beforeEach(() => {
    cwd = createTemporaryDirectory();
    originalPath = process.env.PATH;
  });
  afterEach(() => {
    process.env.PATH = originalPath;
    delete process.env.SAFEWORD_FAKE_GH_LOG;
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

  it('crosses the real connected GitHub entry point with only gh replaced', async () => {
    const safewordDirectory = nodePath.join(cwd, '.safeword');
    const binDirectory = nodePath.join(cwd, 'fake-bin');
    const ghLog = nodePath.join(cwd, 'gh-arguments.json');
    mkdirSync(safewordDirectory, { recursive: true });
    mkdirSync(binDirectory, { recursive: true });
    writeFileSync(
      nodePath.join(safewordDirectory, 'config.json'),
      JSON.stringify({
        ticketBridge: {
          provider: 'github',
          body: 'minimal',
          target: { repo: 'acme/demo' },
        },
      }),
    );
    const fakeGh = nodePath.join(binDirectory, 'gh');
    writeFileSync(
      fakeGh,
      [
        '#!/usr/bin/env node',
        "const fs = require('node:fs');",
        'fs.writeFileSync(process.env.SAFEWORD_FAKE_GH_LOG, JSON.stringify(process.argv.slice(2)));',
        String.raw`process.stdout.write('https://github.com/acme/demo/issues/123\n');`,
        '',
      ].join('\n'),
    );
    chmodSync(fakeGh, 0o755);
    process.env.PATH = `${binDirectory}${nodePath.delimiter}${originalPath ?? ''}`;
    process.env.SAFEWORD_FAKE_GH_LOG = ghLog;

    await ticketNew('login-bug', { type: 'task', title: 'Fix login bug' }, cwd);

    const ticketsDirectory = resolveTicketsDirectory(cwd);
    expect(readdirSync(ticketsDirectory)).toEqual(['123-login-bug']);
    expect(JSON.parse(readFileSync(ghLog, 'utf8'))).toEqual([
      'issue',
      'create',
      '--title',
      'Fix login bug',
      '--body',
      'safeword ticket: login-bug',
      '--label',
      'type:task',
      '--repo',
      'acme/demo',
    ]);
    const trackerMapPath = nodePath.join(safewordDirectory, 'tracker-map.json');
    const trackerMap = JSON.parse(readFileSync(trackerMapPath, 'utf8'));
    expect(trackerMap).toMatchObject({
      issues: {
        '123': {
          ref: {
            provider: 'github',
            id: '123',
            url: 'https://github.com/acme/demo/issues/123',
          },
          status: 'recorded',
        },
      },
    });
    expect(existsSync(nodePath.join(ticketsDirectory, '123-login-bug', 'ticket.md'))).toBe(true);
  });
});
