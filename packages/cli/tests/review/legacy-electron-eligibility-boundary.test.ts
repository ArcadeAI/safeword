import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

import { attestElectronRetrospectiveRow } from '../../src/review/retrospective-electron-gate.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';

it.each(['repository', 'ticket', 'fixed cutoff', 'ledger', 'feature', 'scenario'])(
  'refuses a changed historical %s despite current authenticated review records',
  async identity => {
    const fixture = await electronAuthorizationFixture();
    try {
      const claim = JSON.parse(
        readFileSync(path.join(fixture.root, fixture.eligibilityPath), 'utf8'),
      );
      switch (identity) {
        case 'repository': {
          fixture.git('remote', 'set-url', 'origin', 'https://github.com/Other/repository.git');
          break;
        }
        case 'ticket': {
          claim.ticketId = 'OTHER1';
          break;
        }
        case 'fixed cutoff': {
          claim.cutoff = fixture.baseline;
          break;
        }
        case 'ledger': {
          claim.ledgerPath = '.project/tickets/OTHER1/test-definitions.md';
          break;
        }
        case 'feature': {
          claim.featurePath = 'features/another.feature';
          break;
        }
        case 'scenario': {
          claim.scenarios[0].heading = 'Unenrolled historical behavior';
          break;
        }
      }
      fixture.write(fixture.eligibilityPath, JSON.stringify(claim));
      fixture.git('add', fixture.eligibilityPath);
      fixture.git('commit', '-qm', 'retain changed historical identity', '--allow-empty');
      const eligibilityId = await fixture.review('retrospective-eligibility');
      const proofId = await fixture.review('retrospective-proof');
      const executions = fixture.events().length;
      const result = await attestElectronRetrospectiveRow(fixture.root, {
        ticketId: policy.ticketId,
        ledger: policy.ledger,
        scenario: policy.scenarios[2],
        eligibilityId,
        proofId,
      });
      expect(result.state).toBe('action_required');
      expect(
        result.findings
          .map(finding => finding.message)
          .join('\n')
          .toLowerCase(),
      ).toContain(identity === 'fixed cutoff' ? 'cutoff' : identity);
      expect(fixture.events()).toHaveLength(executions);
    } finally {
      fixture.cleanup();
    }
  },
);

it.each([
  'unavailable baseline ancestry',
  'a cutoff outside HEAD ancestry',
  'no missing-history explanation',
])('refuses %s without treating an independent approval as historical proof', async defect => {
  const fixture = await electronAuthorizationFixture();
  try {
    const claim = JSON.parse(
      readFileSync(path.join(fixture.root, fixture.eligibilityPath), 'utf8'),
    );
    if (defect === 'unavailable baseline ancestry') claim.baseline = 'f'.repeat(40);
    else if (defect === 'no missing-history explanation') claim.rationale = '';
    else fixture.git('checkout', '-q', '--orphan', 'unrelated-current-history');
    fixture.write(fixture.eligibilityPath, JSON.stringify(claim));
    fixture.git('add', '.');
    fixture.git('commit', '-qm', 'retain invalid historical prerequisite', '--allow-empty');
    const eligibilityId = await fixture.review('retrospective-eligibility');
    const proofId = await fixture.review('retrospective-proof');
    const executions = fixture.events().length;
    const result = await attestElectronRetrospectiveRow(fixture.root, {
      ticketId: policy.ticketId,
      ledger: policy.ledger,
      scenario: policy.scenarios[2],
      eligibilityId,
      proofId,
    });
    expect(result.state).toBe('action_required');
    const reason = result.findings.map(finding => finding.message).join('\n');
    if (defect === 'unavailable baseline ancestry')
      expect(reason).toMatch(/baseline.*unavailable/iu);
    else if (defect === 'a cutoff outside HEAD ancestry')
      expect(reason).toMatch(/cutoff.*not reachable/iu);
    else expect(reason).toMatch(/explanation.*missing/iu);
    expect(fixture.events()).toHaveLength(executions);
  } finally {
    fixture.cleanup();
  }
});
