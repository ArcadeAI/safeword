import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

import { approvedRetrospectiveReview } from '../../src/review/job.js';
import {
  attestElectronRetrospectiveRow,
  electronRetrospectiveGate,
} from '../../src/review/retrospective-electron-gate.js';
import { retrospectiveGate } from '../../src/review/retrospective-gate.js';
import {
  LEGACY_RETROSPECTIVE_POLICY as legacy,
  SOULLESS_RETROSPECTIVE_POLICY as policy,
} from '../../src/review/retrospective-policy.js';
import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';

it('authenticated SGWMBS review and row records cannot authorize CKWE2D', async () => {
  const fixture = await electronAuthorizationFixture();
  try {
    const request = {
      ticketId: policy.ticketId,
      ledger: policy.ledger,
      scenario: policy.scenarios[2],
      eligibilityId: await fixture.review('retrospective-eligibility'),
      proofId: await fixture.review('retrospective-proof'),
    };
    const initial = await attestElectronRetrospectiveRow(fixture.root, request);
    expect(initial.state).toBe('changed');
    expect(electronRetrospectiveGate(fixture.root, request).state).toBe('healthy');
    const executions = fixture.events().length;
    expect(
      retrospectiveGate(fixture.root, {
        ...request,
        ticketId: legacy.ticketId,
        ledger: legacy.ledger,
      }).state,
    ).toBe('action_required');
    expect(fixture.events()).toHaveLength(executions);
  } finally {
    fixture.cleanup();
  }
});

it('authenticated CKWE2D review records cannot enroll an Electron row', async () => {
  const fixture = await electronAuthorizationFixture();
  try {
    const claim = JSON.parse(
      readFileSync(path.join(fixture.root, fixture.eligibilityPath), 'utf8'),
    );
    fixture.write(
      fixture.eligibilityPath,
      JSON.stringify({
        ...claim,
        ticketId: legacy.ticketId,
        ledgerPath: legacy.ledger,
        featurePath: legacy.feature,
        cutoff: legacy.cutoff,
      }),
    );
    const requestBytes = JSON.parse(
      readFileSync(path.join(fixture.root, fixture.requestPath), 'utf8'),
    );
    fixture.write(
      fixture.requestPath,
      JSON.stringify({ ...requestBytes, ticketId: legacy.ticketId }),
    );
    fixture.git('add', fixture.eligibilityPath, fixture.requestPath);
    fixture.git('commit', '-qm', 'retain other-policy reviewed artifacts');
    const eligibilityId = await fixture.review('retrospective-eligibility');
    const proofId = await fixture.review('retrospective-proof');
    expect(
      approvedRetrospectiveReview(fixture.root, eligibilityId, 'retrospective-eligibility'),
    ).toBeDefined();
    expect(approvedRetrospectiveReview(fixture.root, proofId, 'retrospective-proof')).toBeDefined();
    const executions = fixture.events().length;
    const result = await attestElectronRetrospectiveRow(fixture.root, {
      ticketId: policy.ticketId,
      ledger: policy.ledger,
      scenario: policy.scenarios[2],
      eligibilityId,
      proofId,
    });
    expect(result.state).toBe('action_required');
    expect(fixture.events()).toHaveLength(executions);
  } finally {
    fixture.cleanup();
  }
});
