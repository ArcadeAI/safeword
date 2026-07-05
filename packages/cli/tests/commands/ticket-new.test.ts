/**
 * Integration test for `safeword ticket new` (ticket 158, slice 1; updated PR #160).
 *
 * Covers Rule 3 in test-definitions.md: folder = `{ID}-{slug}/ticket.md`. The ID
 * portion of the folder is the unique key (mirrored in frontmatter `id:`); the
 * slug suffix is for legibility when scanning `ls`. End-to-end via the built CLI.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
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

/** Absolute path of the single ticket folder created under the temp dir. */
function soleTicketFolder(temporaryDirectory: string): string {
  const ticketsDirectory = nodePath.join(temporaryDirectory, '.project', 'tickets');
  return nodePath.join(ticketsDirectory, readOnlyTicketFolderName(ticketsDirectory));
}

/** Contents of the single created ticket.md. */
function readSoleTicket(temporaryDirectory: string): string {
  return readFileSync(nodePath.join(soleTicketFolder(temporaryDirectory), 'ticket.md'), 'utf8');
}

/** Ticket folder whose slug suffix matches, when several tickets exist. */
function ticketFolderBySlug(temporaryDirectory: string, slug: string): string {
  const ticketsDirectory = nodePath.join(temporaryDirectory, '.project', 'tickets');
  const match = readdirSync(ticketsDirectory).find(entry => entry.endsWith(`-${slug}`));
  if (match === undefined) throw new Error(`no ticket folder for slug ${slug}`);
  return nodePath.join(ticketsDirectory, match);
}

function readTicketBySlug(temporaryDirectory: string, slug: string): string {
  return readFileSync(
    nodePath.join(ticketFolderBySlug(temporaryDirectory, slug), 'ticket.md'),
    'utf8',
  );
}

function idBySlug(temporaryDirectory: string, slug: string): string {
  const [id] = nodePath.basename(ticketFolderBySlug(temporaryDirectory, slug)).split('-');
  if (id === undefined) throw new Error(`no id in folder for slug ${slug}`);
  return id;
}

/** True if any ticket folder under the temp dir carries the given slug suffix. */
function ticketExistsForSlug(temporaryDirectory: string, slug: string): boolean {
  const ticketsDirectory = nodePath.join(temporaryDirectory, '.project', 'tickets');
  return (
    existsSync(ticketsDirectory) &&
    readdirSync(ticketsDirectory).some(entry => entry.endsWith(`-${slug}`))
  );
}

function extractIdFromFolder(folderName: string): string {
  const match = FOLDER_PATTERN.exec(folderName);
  const id = match?.[1];
  if (id === undefined) {
    // eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation -- {ID}-{slug} is literal placeholder text in the message, not interpolation
    throw new Error(`folder "${folderName}" did not match {ID}-{slug} shape`);
  }
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

      const folderName = nodePath.basename(soleTicketFolder(temporaryDirectory));
      const id = extractIdFromFolder(folderName);
      const ticketContent = readSoleTicket(temporaryDirectory);

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

      const ticketContent = readSoleTicket(temporaryDirectory);
      expect(ticketContent).toMatch(/^type:\s*feature$/m);
    },
    TIMEOUT_QUICK,
  );

  it(
    'feature tickets scaffold scenario-gate prerequisite frontmatter',
    async () => {
      await runCli(['ticket', 'new', 'auth-flow', '--type', 'feature'], {
        cwd: temporaryDirectory,
      });

      const ticketContent = readSoleTicket(temporaryDirectory);

      expect(ticketContent).toMatch(/^scope:\s*$/m);
      expect(ticketContent).toMatch(/^out_of_scope:\s*$/m);
      expect(ticketContent).toMatch(/^done_when:\s*$/m);
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

      const ticketContent = readSoleTicket(temporaryDirectory);
      expect(ticketContent).toMatch(/^slug:\s*login-bug$/m);
    },
    TIMEOUT_QUICK,
  );

  it(
    'collapses non-alphanumeric runs in a messy slug',
    async () => {
      await runCli(['ticket', 'new', 'fix/auth-flow!'], { cwd: temporaryDirectory });

      const ticketContent = readSoleTicket(temporaryDirectory);
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

  // #699 — epic is a first-class type; the CLI scaffolds a container ticket.
  it(
    'accepts --type=epic and scaffolds an empty children list, no spec.md (#699)',
    async () => {
      const result = await runCli(['ticket', 'new', 'big-rollout', '--type', 'epic'], {
        cwd: temporaryDirectory,
      });
      expect(result.exitCode).toBe(0);

      const folder = soleTicketFolder(temporaryDirectory);
      const ticketContent = readFileSync(nodePath.join(folder, 'ticket.md'), 'utf8');
      expect(ticketContent).toMatch(/^type:\s*epic$/m);
      expect(ticketContent).toMatch(/^children:\s*\[\]$/m);
      // epics keep the inline **Goal:** shape (index-visible), not a ## Goal section
      expect(ticketContent).toMatch(/^\*\*Goal:\*\*/m);
      // container, not a feature: no spec.md and no scenario-gate readiness fields
      expect(existsSync(nodePath.join(folder, 'spec.md'))).toBe(false);
      expect(ticketContent).not.toMatch(/^scope:/m);
    },
    TIMEOUT_QUICK,
  );

  // #724 — --goal fills the Goal field instead of leaving a {placeholder}.
  it(
    'fills the Goal field from --goal, leaving no placeholder (#724)',
    async () => {
      await runCli(['ticket', 'new', 'auth-flow', '--goal', 'Ship SSO for admins'], {
        cwd: temporaryDirectory,
      });

      const ticketContent = readSoleTicket(temporaryDirectory);
      expect(ticketContent).toMatch(/^\*\*Goal:\*\* Ship SSO for admins$/m);
      expect(ticketContent).not.toMatch(/\{One sentence: what/);
    },
    TIMEOUT_QUICK,
  );

  it(
    'fills the Why field from --why for a task',
    async () => {
      await runCli(['ticket', 'new', 'auth-flow', '--why', 'Customers keep asking'], {
        cwd: temporaryDirectory,
      });

      const ticketContent = readSoleTicket(temporaryDirectory);
      expect(ticketContent).toMatch(/^\*\*Why:\*\* Customers keep asking$/m);
    },
    TIMEOUT_QUICK,
  );

  // Features keep motivation in spec.md, so --why has no target there — fail loud.
  it(
    'rejects --why on a feature with exit code 1',
    async () => {
      const result = await runCli(
        ['ticket', 'new', 'auth-flow', '--type', 'feature', '--why', 'nope'],
        { cwd: temporaryDirectory },
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/spec\.md/);
    },
    TIMEOUT_QUICK,
  );

  // The epic + --goal/--why interaction is the novel path: epics render the same
  // inline **Goal:**/**Why:** fields as tasks, so both flags must land there.
  it(
    'fills Goal and Why from flags on an epic',
    async () => {
      await runCli(
        [
          'ticket',
          'new',
          'big-rollout',
          '--type',
          'epic',
          '--goal',
          'Coordinate rollout',
          '--why',
          'Too many moving parts',
        ],
        { cwd: temporaryDirectory },
      );

      const ticketContent = readSoleTicket(temporaryDirectory);
      expect(ticketContent).toMatch(/^\*\*Goal:\*\* Coordinate rollout$/m);
      expect(ticketContent).toMatch(/^\*\*Why:\*\* Too many moving parts$/m);
    },
    TIMEOUT_QUICK,
  );

  // A blank flag value keeps the placeholder rather than an empty, content-less field.
  it(
    'keeps the Goal placeholder when --goal is blank',
    async () => {
      await runCli(['ticket', 'new', 'auth-flow', '--goal', ' '.repeat(3)], {
        cwd: temporaryDirectory,
      });

      const ticketContent = readSoleTicket(temporaryDirectory);
      expect(ticketContent).toMatch(/^\*\*Goal:\*\* \{One sentence/m);
    },
    TIMEOUT_QUICK,
  );

  // F9W3JP — epic-child-linker.TB1.AC1.linking_records_parent_and_appends_to_epic (S1)
  it(
    'links a child to its epic both ways with --parent',
    async () => {
      await runCli(['ticket', 'new', 'the-epic', '--type', 'epic'], { cwd: temporaryDirectory });
      const epicId = idBySlug(temporaryDirectory, 'the-epic');

      const result = await runCli(['ticket', 'new', 'the-child', '--parent', epicId], {
        cwd: temporaryDirectory,
      });
      expect(result.exitCode).toBe(0);

      const childId = idBySlug(temporaryDirectory, 'the-child');
      expect(readTicketBySlug(temporaryDirectory, 'the-child')).toContain(`parent: ${epicId}`);
      expect(readTicketBySlug(temporaryDirectory, 'the-epic')).toContain(childId);
    },
    TIMEOUT_QUICK,
  );

  // epic-child-linker.TB1.AC3.missing_parent_rejected (S4)
  it(
    'rejects --parent naming no existing ticket and creates no child',
    async () => {
      const result = await runCli(['ticket', 'new', 'orphan', '--parent', 'ZZZZZZ'], {
        cwd: temporaryDirectory,
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/not found|ZZZZZZ/);
      expect(ticketExistsForSlug(temporaryDirectory, 'orphan')).toBe(false);
    },
    TIMEOUT_QUICK,
  );

  // epic-child-linker.TB1.AC3.non_epic_parent_rejected (S5)
  it(
    'rejects --parent naming a non-epic ticket, leaving it unchanged and creating no child',
    async () => {
      await runCli(['ticket', 'new', 'a-task', '--type', 'task'], { cwd: temporaryDirectory });
      const taskId = idBySlug(temporaryDirectory, 'a-task');
      const taskBefore = readTicketBySlug(temporaryDirectory, 'a-task');

      const result = await runCli(['ticket', 'new', 'the-child', '--parent', taskId], {
        cwd: temporaryDirectory,
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/not an epic/);
      expect(readTicketBySlug(temporaryDirectory, 'a-task')).toBe(taskBefore);
      expect(ticketExistsForSlug(temporaryDirectory, 'the-child')).toBe(false);
    },
    TIMEOUT_QUICK,
  );

  // Quality-review edge: `completed/` is a real tickets-dir entry, so
  // `--parent completed` resolves a folder with no ticket.md — must reject
  // cleanly (exit 1, reasoned message), not crash with a raw ENOENT.
  it(
    'rejects --parent naming the completed archive dir with a clean error',
    async () => {
      await runCli(['ticket', 'new', 'the-epic', '--type', 'epic'], { cwd: temporaryDirectory });
      mkdirSync(nodePath.join(temporaryDirectory, '.project', 'tickets', 'completed'), {
        recursive: true,
      });

      const result = await runCli(['ticket', 'new', 'the-child', '--parent', 'completed'], {
        cwd: temporaryDirectory,
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/no readable ticket\.md/);
      expect(result.stderr).not.toMatch(/ENOENT/);
      expect(ticketExistsForSlug(temporaryDirectory, 'the-child')).toBe(false);
    },
    TIMEOUT_QUICK,
  );

  // Regression (no AC): --parent logic must not leak into the default create path.
  it(
    'ticket new without --parent writes no parent: and touches no other ticket',
    async () => {
      await runCli(['ticket', 'new', 'the-epic', '--type', 'epic'], { cwd: temporaryDirectory });
      const epicBefore = readTicketBySlug(temporaryDirectory, 'the-epic');

      await runCli(['ticket', 'new', 'standalone'], { cwd: temporaryDirectory });

      expect(readTicketBySlug(temporaryDirectory, 'standalone')).not.toMatch(/^parent:/m);
      expect(readTicketBySlug(temporaryDirectory, 'the-epic')).toBe(epicBefore);
    },
    TIMEOUT_QUICK,
  );
});
