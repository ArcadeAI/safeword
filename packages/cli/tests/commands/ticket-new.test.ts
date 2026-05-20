/**
 * Integration test for `safeword ticket new` (ticket 158, slice 1).
 *
 * Covers Rule 3 in test-definitions.md: folder = `{ID}/ticket.md`, slug only
 * in frontmatter, no `{ID}-{slug}/` artifact. End-to-end via the built CLI.
 */

import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
  TIMEOUT_QUICK,
} from '../helpers.js';

const ID_PATTERN = /^[\dA-HJ-NP-TV-Z]{6}$/;

function readOnlyTicketFolderName(ticketsDirectory: string): string {
  const entries = readdirSync(ticketsDirectory);
  expect(entries).toHaveLength(1);
  const [folderName] = entries;
  if (folderName === undefined) throw new Error('no ticket folder created');
  return folderName;
}

describe('safeword ticket new', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  it(
    'creates a folder named exactly the minted ID (no slug in path)',
    async () => {
      const result = await runCli(['ticket', 'new', 'login-bug'], {
        cwd: temporaryDirectory,
      });
      expect(result.exitCode).toBe(0);

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.safeword-project', 'tickets');
      const folderName = readOnlyTicketFolderName(ticketsDirectory);
      expect(folderName).toMatch(ID_PATTERN);
      expect(folderName).not.toContain('login-bug');
    },
    TIMEOUT_QUICK,
  );

  it(
    'writes ticket.md with id and slug both in frontmatter',
    async () => {
      await runCli(['ticket', 'new', 'login-bug'], { cwd: temporaryDirectory });

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.safeword-project', 'tickets');
      const folderName = readOnlyTicketFolderName(ticketsDirectory);
      const ticketContent = readFileSync(
        nodePath.join(ticketsDirectory, folderName, 'ticket.md'),
        'utf8',
      );

      expect(ticketContent).toContain(`id: ${folderName}`);
      expect(ticketContent).toMatch(/^slug:\s*login-bug$/m);
      expect(ticketContent).toMatch(/^type:\s*task$/m);
      expect(ticketContent).toMatch(/^phase:\s*intake$/m);
      expect(ticketContent).toMatch(/^status:\s*in_progress$/m);
    },
    TIMEOUT_QUICK,
  );

  it(
    'creates no folder containing the slug anywhere under .safeword-project/tickets/',
    async () => {
      await runCli(['ticket', 'new', 'login-bug'], { cwd: temporaryDirectory });

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.safeword-project', 'tickets');
      const entries = readdirSync(ticketsDirectory);
      for (const entry of entries) {
        expect(entry).not.toContain('login-bug');
      }
    },
    TIMEOUT_QUICK,
  );

  it(
    'accepts --type and writes it to frontmatter',
    async () => {
      await runCli(['ticket', 'new', 'auth-flow', '--type', 'feature'], {
        cwd: temporaryDirectory,
      });

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.safeword-project', 'tickets');
      const folderName = readOnlyTicketFolderName(ticketsDirectory);
      const ticketContent = readFileSync(
        nodePath.join(ticketsDirectory, folderName, 'ticket.md'),
        'utf8',
      );
      expect(ticketContent).toMatch(/^type:\s*feature$/m);
    },
    TIMEOUT_QUICK,
  );

  it(
    'rejects invalid --type values with exit code 1',
    async () => {
      const result = await runCli(['ticket', 'new', 'foo', '--type', 'bogus'], {
        cwd: temporaryDirectory,
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/bogus/);
    },
    TIMEOUT_QUICK,
  );

  it(
    'normalizes a messy slug to lowercase kebab-case in frontmatter',
    async () => {
      await runCli(['ticket', 'new', 'Login Bug'], { cwd: temporaryDirectory });

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.safeword-project', 'tickets');
      const folderName = readOnlyTicketFolderName(ticketsDirectory);
      const ticketContent = readFileSync(
        nodePath.join(ticketsDirectory, folderName, 'ticket.md'),
        'utf8',
      );
      expect(ticketContent).toMatch(/^slug:\s*login-bug$/m);
    },
    TIMEOUT_QUICK,
  );

  it(
    'collapses non-alphanumeric runs in a messy slug',
    async () => {
      await runCli(['ticket', 'new', 'fix/auth-flow!'], { cwd: temporaryDirectory });

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.safeword-project', 'tickets');
      const folderName = readOnlyTicketFolderName(ticketsDirectory);
      const ticketContent = readFileSync(
        nodePath.join(ticketsDirectory, folderName, 'ticket.md'),
        'utf8',
      );
      expect(ticketContent).toMatch(/^slug:\s*fix-auth-flow$/m);
    },
    TIMEOUT_QUICK,
  );

  it(
    'rejects an empty slug with exit code 1',
    async () => {
      const result = await runCli(['ticket', 'new', ''], { cwd: temporaryDirectory });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/slug/i);
    },
    TIMEOUT_QUICK,
  );
});
