/**
 * Integration proof for F9W3JP AC1: a link built through the real
 * `ticket new --parent` command is walkable by the hierarchy navigation
 * contract — `findNextWork` reaches the linked child. This exercises the new
 * feature end-to-end (the Given builds the link via the command, not by
 * hand-writing frontmatter), per the scenario-gate strengthen.
 */

import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findNextWork } from '../../templates/hooks/lib/hierarchy.js';
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  runCli,
  ticketFolderBySlug,
  ticketIdBySlug as idBySlug,
  TIMEOUT_QUICK,
} from '../helpers.js';

function ticketsDirectoryOf(temporaryDirectory: string): string {
  return nodePath.join(temporaryDirectory, '.project', 'tickets');
}

describe('epic-child --parent navigation (F9W3JP AC1)', () => {
  let temporaryDirectory: string;
  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });
  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  // epic-child-linker.TB1.AC1.navigation_from_epic_reaches_child
  it(
    'findNextWork reaches a child linked through ticket new --parent',
    async () => {
      await runCli(['ticket', 'new', 'the-epic', '--type', 'epic'], { cwd: temporaryDirectory });
      const epicId = idBySlug(temporaryDirectory, 'the-epic');
      await runCli(['ticket', 'new', 'the-child', '--parent', epicId], {
        cwd: temporaryDirectory,
      });

      const childFolder = ticketFolderBySlug(temporaryDirectory, 'the-child');
      const childId = idBySlug(temporaryDirectory, 'the-child');

      // From the child (in-progress), the epic's children[] link makes it the
      // next undone work — proving the reverse index the command wrote is walked.
      const action = findNextWork(childFolder, ticketsDirectoryOf(temporaryDirectory));
      expect(action.type).toBe('navigate');
      if (action.type === 'navigate') expect(action.ticketId).toBe(childId);
    },
    TIMEOUT_QUICK,
  );
});
