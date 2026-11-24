import { expect, it } from 'vitest';

import { electronLedgerClaims } from '../../src/review/retrospective-electron-admission.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';

it.runIf(process.platform !== 'win32')(
  'parses separate VERIFIED credit beneath a newline-terminated historical heading',
  async () => {
    const fixture = await electronAuthorizationFixture();
    const eligibilityId = '11111111-1111-4111-8111-111111111111';
    const proofId = '22222222-2222-4222-8222-222222222222';
    try {
      fixture.write(
        policy.ledger,
        `${fixture.ledger}- [x] VERIFIED eligibility=${eligibilityId} proof=${proofId}\n`,
      );
      fixture.git('add', policy.ledger);
      fixture.git('commit', '-qm', 'append structural verified annotation fixture');
      // Parsing claims does not authenticate these placeholder IDs or grant credit.
      expect(electronLedgerClaims(fixture.root)).toEqual([
        {
          ticketId: policy.ticketId,
          ledger: policy.ledger,
          scenario: policy.scenarios[2],
          eligibilityId,
          proofId,
        },
      ]);
    } finally {
      fixture.cleanup();
    }
  },
);
