import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

import { attestElectronRetrospectiveRow } from '../../src/review/retrospective-electron-gate.js';
import { runElectronProof } from '../../src/review/retrospective-electron-proof.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';
import { electronRequest } from './legacy-electron-runner.fixture.js';

it.each([
  ['implementation', electronRequest.implementationPath],
  ['selected test source', electronRequest.testFile],
  ['support file', 'packages/desktop/src/renderer/src/stores/state.ts'],
  ['runner configuration', 'packages/desktop/playwright-electron.config.ts'],
  ['dependency lockfile', 'pnpm-lock.yaml'],
])(
  'fresh successful execution cannot renew the old review after changed %s',
  async (_name, input) => {
    const fixture = await electronAuthorizationFixture();
    try {
      const request = {
        ticketId: policy.ticketId,
        ledger: policy.ledger,
        scenario: electronRequest.scenario,
        eligibilityId: await fixture.review('retrospective-eligibility'),
        proofId: await fixture.review('retrospective-proof'),
      };
      const original = readFileSync(path.join(fixture.root, input), 'utf8');
      const reviewedObservation = readFileSync(
        path.join(fixture.root, fixture.observationPath),
        'utf8',
      );
      fixture.write(input, `${original}\n// changed reviewed executable input\n`);
      fixture.git('add', input);
      fixture.git('commit', '-qm', 'change one bound executable input');
      if (input === electronRequest.implementationPath) {
        const claim = JSON.parse(
          readFileSync(path.join(fixture.root, fixture.eligibilityPath), 'utf8'),
        );
        claim.blobs[0].currentBlobSha = fixture.git('rev-parse', `HEAD:${input}`);
        fixture.write(fixture.eligibilityPath, JSON.stringify(claim));
        fixture.git('add', fixture.eligibilityPath);
        fixture.git('commit', '-qm', 'retain truthful current implementation eligibility');
        request.eligibilityId = await fixture.review('retrospective-eligibility');
      }
      const observed = await runElectronProof(fixture.root, electronRequest, fixture.requestPath);
      expect(observed.passing.passedTests).toBe(1);
      expect(observed.mutated.failedTests).toBe(1);
      const freshPath = 'fresh-success.observation.json';
      fixture.write(freshPath, JSON.stringify(observed));
      fixture.git('add', freshPath);
      fixture.git('commit', '-qm', 'retain fresh successful discrimination');
      const executions = fixture.events().length;
      const result = await attestElectronRetrospectiveRow(fixture.root, request);
      expect(result.state).toBe('action_required');
      expect(result.findings.map(finding => finding.message).join('\n')).toContain(input);
      expect(readFileSync(path.join(fixture.root, fixture.observationPath), 'utf8')).toBe(
        reviewedObservation,
      );
      expect(fixture.events()).toHaveLength(executions);
    } finally {
      fixture.cleanup();
    }
  },
);

it('a fresh proof review cannot replace eligibility review after its explanation changes', async () => {
  const fixture = await electronAuthorizationFixture();
  try {
    const eligibilityId = await fixture.review('retrospective-eligibility');
    const claim = JSON.parse(
      readFileSync(path.join(fixture.root, fixture.eligibilityPath), 'utf8'),
    );
    fixture.write(
      fixture.eligibilityPath,
      JSON.stringify({ ...claim, rationale: 'A changed historical explanation.' }),
    );
    fixture.git('add', fixture.eligibilityPath);
    fixture.git('commit', '-qm', 'change the independently reviewed historical explanation');
    const observed = await runElectronProof(fixture.root, electronRequest, fixture.requestPath);
    fixture.write(fixture.observationPath, JSON.stringify(observed));
    fixture.git('add', fixture.observationPath);
    fixture.git('commit', '-qm', 'retain fresh execution after explanation change');
    const proofId = await fixture.review('retrospective-proof');
    const executions = fixture.events().length;
    const result = await attestElectronRetrospectiveRow(fixture.root, {
      ticketId: policy.ticketId,
      ledger: policy.ledger,
      scenario: electronRequest.scenario,
      eligibilityId,
      proofId,
    });
    expect(result.state).toBe('action_required');
    expect(fixture.events()).toHaveLength(executions);
  } finally {
    fixture.cleanup();
  }
});

it.each(['test selection', 'mutation definition', 'declared assertion'])(
  'fresh successful execution cannot renew the old review after changed %s request bytes',
  async input => {
    const fixture = await electronAuthorizationFixture();
    try {
      const eligibilityId = await fixture.review('retrospective-eligibility');
      const proofId = await fixture.review('retrospective-proof');
      const changed = { ...electronRequest, mutation: { ...electronRequest.mutation } };
      if (input === 'test selection') changed.testLine += 1;
      else if (input === 'mutation definition')
        changed.mutation.after += ' /* different removal */';
      else
        changed.mutation.assertionLocation = changed.mutation.assertionLocation.replace(
          ':39',
          ':40',
        );
      fixture.write(fixture.requestPath, JSON.stringify(changed));
      fixture.git('add', fixture.requestPath);
      fixture.git('commit', '-qm', 'change the exact reviewed request');
      const fresh = await runElectronProof(fixture.root, changed, fixture.requestPath);
      const freshPath = fixture.observationPath.replace('.json', '.fresh.json');
      fixture.write(freshPath, JSON.stringify(fresh));
      fixture.git('add', freshPath);
      fixture.git('commit', '-qm', 'retain fresh request execution separately');
      const executions = fixture.events().length;
      const result = await attestElectronRetrospectiveRow(fixture.root, {
        ticketId: policy.ticketId,
        ledger: policy.ledger,
        scenario: electronRequest.scenario,
        eligibilityId,
        proofId,
      });
      expect(result.state).toBe('action_required');
      expect(fixture.events()).toHaveLength(executions);
    } finally {
      fixture.cleanup();
    }
  },
);

it.each(['eligibility receipt', 'proof receipt'])(
  'fresh successful execution cannot replace a changed %s',
  async input => {
    const fixture = await electronAuthorizationFixture();
    try {
      const eligibilityId = await fixture.review('retrospective-eligibility');
      const proofId = await fixture.review('retrospective-proof');
      const fresh = await runElectronProof(fixture.root, electronRequest, fixture.requestPath);
      expect(fresh.passing.passedTests).toBe(1);
      expect(fresh.mutated.failedTests).toBe(1);
      const id = input === 'eligibility receipt' ? eligibilityId : proofId;
      // Corrupt only this fixture's ignored authentic record, not a live receipt.
      writeFileSync(path.join(fixture.root, '.safeword/state/reviews', `${id}.json`), '{}');
      const executions = fixture.events().length;
      const result = await attestElectronRetrospectiveRow(fixture.root, {
        ticketId: policy.ticketId,
        ledger: policy.ledger,
        scenario: electronRequest.scenario,
        eligibilityId,
        proofId,
      });
      expect(result.state).toBe('action_required');
      expect(fixture.events()).toHaveLength(executions);
    } finally {
      fixture.cleanup();
    }
  },
);

it('refuses changed observed policy identity despite fresh successful execution and a current proof review', async () => {
  const fixture = await electronAuthorizationFixture();
  try {
    const eligibilityId = await fixture.review('retrospective-eligibility');
    const fresh = await runElectronProof(fixture.root, electronRequest, fixture.requestPath);
    expect(fresh.passing.passedTests).toBe(1);
    expect(fresh.mutated.failedTests).toBe(1);
    fixture.write(
      fixture.observationPath,
      JSON.stringify({ ...fresh, policyId: 'untrusted-policy' }),
    );
    fixture.git('add', fixture.observationPath);
    fixture.git('commit', '-qm', 'retain a foreign-policy observation');
    const proofId = await fixture.review('retrospective-proof');
    const executions = fixture.events().length;
    const result = await attestElectronRetrospectiveRow(fixture.root, {
      ticketId: policy.ticketId,
      ledger: policy.ledger,
      scenario: electronRequest.scenario,
      eligibilityId,
      proofId,
    });
    expect(result.state).toBe('action_required');
    expect(result.findings[0]?.message).toContain('different policy');
    expect(fixture.events()).toHaveLength(executions);
  } finally {
    fixture.cleanup();
  }
});
