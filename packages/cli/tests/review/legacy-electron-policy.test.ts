import type { SpawnSyncReturns } from 'node:child_process';

import { expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  spawnSync: (_command: string, args: readonly string[]): SpawnSyncReturns<string> => {
    const last = args.at(-1) ?? '';
    let stdout = '';
    if (args.includes('config')) stdout = 'git@github.com:ArcadeAI/soulless-monorepo.git\n';
    else if (args.includes('rev-parse')) stdout = `${last.replace(/\^\{commit\}$/u, '')}\n`;
    // eslint-disable-next-line unicorn/no-null -- Node's subprocess contract uses null for no signal and stdin.
    return { status: 0, signal: null, stdout, stderr: '', output: [null, stdout, ''], pid: 1 };
  },
}));

import { checkRetrospectiveHistory } from '../../src/review/retrospective-history.js';
import { retrospectivePolicy } from '../../src/review/retrospective-policy.js';

const cutoff = '4990ae4158d3e2744a8c5934089a8e1d5d2b19b1';

it('admits the authorized Soulless history only after its real Git prerequisites', () => {
  // Only the external Git process is simulated. Production policy selection and
  // history validation must cooperate; this is not real-host ancestry evidence.
  expect(
    checkRetrospectiveHistory('/approved-repository', {
      ticketId: 'SGWMBS',
      cutoff,
      baseline: cutoff,
      rationale: 'The behavior existed at this cutoff; its original failing run is unavailable.',
    }),
  ).toEqual({ eligibleForReview: true });
});

it('limits Soulless migration credit to its exact disclosed historical scenarios', () => {
  expect(retrospectivePolicy('SGWMBS')).toMatchObject({
    scenarios: [
      'Explorer presents package roots and aliases as documents',
      'Package path variants share one tab',
      'A differently cased soul suffix opens as a package',
      'Ordinary folders remain folders',
      'A regular soul text file retains plain-text saves',
      'Creating a soul document over a regular file is refused',
      'Creating a soul document over a directory is refused',
      'Closing immediately after a package edit asks to preserve it',
      'Switching immediately after a package edit preserves a rejected save',
      'Saving package Markdown preserves existing review state',
      'An ordinary Markdown document keeps its file workflow',
      'A trailing blank paragraph marks reopened Markdown unsaved',
      'Ordinary Markdown reopens its review sidecars',
      'Package drift discovered at save refuses the edit',
      'External Markdown drift opens a blocking repair tab',
      'A blocked package can be revealed',
      'A blocked package can be closed without writing',
    ],
  });
});
