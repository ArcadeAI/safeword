import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { executeReconciliationActions } from '../../src/reconcile.js';
import { createProjectContext } from '../../src/utils/context.js';
import { createTemporaryDirectory } from '../helpers.js';

describe('production reconciliation effect accounting', () => {
  it('carries completed mutations when a later real action fails', () => {
    const directory = createTemporaryDirectory();
    writeFileSync(nodePath.join(directory, 'first.txt'), 'remove me');
    writeFileSync(nodePath.join(directory, 'blocked-parent'), 'not a directory');
    mkdirSync(nodePath.join(directory, '.git'));

    let caught: unknown;
    try {
      executeReconciliationActions(
        [
          { type: 'rm', path: 'first.txt' },
          { type: 'write', path: 'blocked-parent/second.txt', content: 'never written' },
        ],
        createProjectContext(directory),
      );
    } catch (executionError) {
      caught = executionError;
    }

    expect(caught).toEqual(
      expect.objectContaining({
        name: 'ReconcileExecutionError',
        partial: expect.objectContaining({ removed: ['first.txt'] }),
        completedActions: [{ type: 'rm', path: 'first.txt' }],
      }),
    );
  });
});
