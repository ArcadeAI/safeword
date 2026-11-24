import { cpSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

import {
  attestElectronRetrospectiveRow,
  electronRetrospectiveGate,
} from '../../src/review/retrospective-electron-gate.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';

it.each([
  'another repository',
  'another ticket',
  'another scenario',
  'a missing authentic signature',
])('refuses genuine row records offered for %s', async defect => {
  const fixture = await electronAuthorizationFixture();
  try {
    const request = {
      ticketId: policy.ticketId as string,
      ledger: policy.ledger,
      scenario: policy.scenarios[2] as string,
      eligibilityId: await fixture.review('retrospective-eligibility'),
      proofId: await fixture.review('retrospective-proof'),
    };
    const initial = await attestElectronRetrospectiveRow(fixture.root, request);
    expect(initial.state).toBe('changed');
    let root = fixture.root;
    switch (defect) {
      case 'another repository': {
        root = path.join(fixture.temporary, 'different-repository');
        cpSync(fixture.root, root, { recursive: true });

        break;
      }
      case 'another ticket': {
        request.ticketId = 'OTHER1';
        break;
      }
      case 'another scenario': {
        request.scenario = policy.scenarios[3];
        break;
      }
      default: {
        const directory = path.join(root, '.safeword/state/reviews');
        const file = readdirSync(directory).find(name => /^electron-row-.*\.tag$/u.test(name));
        if (file === undefined) throw new Error('The real row attestation produced no signature.');
        writeFileSync(path.join(directory, file), '0'.repeat(64));
      }
    }
    const executions = fixture.events().length;
    expect(electronRetrospectiveGate(root, request).state).toBe('action_required');
    expect(fixture.events()).toHaveLength(executions);
  } finally {
    fixture.cleanup();
  }
});
