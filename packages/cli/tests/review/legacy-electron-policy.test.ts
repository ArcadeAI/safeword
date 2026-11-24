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
