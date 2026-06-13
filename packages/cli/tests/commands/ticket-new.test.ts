/**
 * Integration test for `safeword ticket new` (ticket 158, slice 1; updated PR #160).
 *
 * Covers Rule 3 in test-definitions.md: folder = `{ID}-{slug}/ticket.md`. The ID
 * portion of the folder is the unique key (mirrored in frontmatter `id:`); the
 * slug suffix is for legibility when scanning `ls`. End-to-end via the built CLI.
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
const FOLDER_PATTERN = /^([\dA-HJ-NP-TV-Z]{6})-[a-z0-9-]+$/;

function readOnlyTicketFolderName(ticketsDirectory: string): string {
  const entries = readdirSync(ticketsDirectory);
  expect(entries).toHaveLength(1);
  const [folderName] = entries;
  if (folderName === undefined) throw new Error('no ticket folder created');
  return folderName;
}

function extractIdFromFolder(folderName: string): string {
  const match = FOLDER_PATTERN.exec(folderName);
  const id = match?.[1];
  if (id === undefined) throw new Error(`folder "${folderName}" did not match {ID}-{slug} shape`);
  return id;
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
    'creates a folder named {ID}-{slug} (slug suffix for legibility, PR #160)',
    async () => {
      const result = await runCli(['ticket', 'new', 'login-bug'], {
        cwd: temporaryDirectory,
      });
      expect(result.exitCode).toBe(0);

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.project', 'tickets');
      const folderName = readOnlyTicketFolderName(ticketsDirectory);
      expect(folderName).toMatch(FOLDER_PATTERN);
      expect(folderName).toMatch(/-login-bug$/);
    },
    TIMEOUT_QUICK,
  );

  it(
    'writes ticket.md with id (ID portion only) and slug both in frontmatter',
    async () => {
      await runCli(['ticket', 'new', 'login-bug'], { cwd: temporaryDirectory });

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.project', 'tickets');
      const folderName = readOnlyTicketFolderName(ticketsDirectory);
      const id = extractIdFromFolder(folderName);
      const ticketContent = readFileSync(
        nodePath.join(ticketsDirectory, folderName, 'ticket.md'),
        'utf8',
      );

      expect(id).toMatch(ID_PATTERN);
      expect(ticketContent).toContain(`id: ${id}`);
      expect(ticketContent).toMatch(/^slug:\s*login-bug$/m);
      expect(ticketContent).toMatch(/^type:\s*task$/m);
      expect(ticketContent).toMatch(/^phase:\s*intake$/m);
      expect(ticketContent).toMatch(/^status:\s*in_progress$/m);
    },
    TIMEOUT_QUICK,
  );

  it(
    'creates exactly one folder and its name contains the slug as a suffix',
    async () => {
      await runCli(['ticket', 'new', 'login-bug'], { cwd: temporaryDirectory });

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.project', 'tickets');
      const entries = readdirSync(ticketsDirectory);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatch(/-login-bug$/);
    },
    TIMEOUT_QUICK,
  );

  it(
    'accepts --type and writes it to frontmatter',
    async () => {
      await runCli(['ticket', 'new', 'auth-flow', '--type', 'feature'], {
        cwd: temporaryDirectory,
      });

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.project', 'tickets');
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

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.project', 'tickets');
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

      const ticketsDirectory = nodePath.join(temporaryDirectory, '.project', 'tickets');
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
