import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  attestElectronRetrospectiveClose,
  electronRetrospectiveCloseGate,
} from '../../src/review/retrospective-electron-close.js';
import { SOULLESS_RETROSPECTIVE_POLICY as policy } from '../../src/review/retrospective-policy.js';
import { electronAuthorizationFixture } from './legacy-electron-authorization.fixture.js';

// Expensive setup is shared, but each case restores its owned Git view and the
// exact signed records. Cases cannot inherit a previous case's corruption.
describe('current signed Electron closing view', () => {
  let fixture: Awaited<ReturnType<typeof electronAuthorizationFixture>>;
  let head: string;
  let closingFile: string;
  let closingBytes: string;
  let rowFile: string;
  let rowBytes: string;
  let rowScenario: string;

  beforeAll(async () => {
    fixture = await electronAuthorizationFixture(true);
    const claims = await fixture.completeRows();
    const signed = await attestElectronRetrospectiveClose(
      fixture.root,
      policy.ticketId,
      policy.ledger,
    );
    expect(signed.state, JSON.stringify(signed)).toBe('changed');
    head = fixture.git('rev-parse', 'HEAD');
    const directory = path.join(fixture.root, '.safeword/state/reviews');
    closingFile = path.join(directory, 'electron-retrospective-close-v1.json');
    closingBytes = readFileSync(closingFile, 'utf8');
    const first = claims[0];
    if (first === undefined) throw new Error('Fresh all-row closing produced no claim.');
    rowScenario = first.scenario;
    const identity = JSON.stringify([
      first.ticketId,
      first.ledger,
      first.scenario,
      first.eligibilityId,
      first.proofId,
    ]);
    const digest = createHash('sha256').update(identity).digest('hex');
    rowFile = path.join(directory, `electron-row-${digest}.tag`);
    rowBytes = readFileSync(rowFile, 'utf8');
  }, 600_000);

  beforeEach(() => {
    // This is exclusively the disposable fixture checkout, never a user repo.
    fixture.git('reset', '--hard', head);
    writeFileSync(closingFile, closingBytes);
    writeFileSync(rowFile, rowBytes);
    expect(electronRetrospectiveCloseGate(fixture.root, policy.ticketId, policy.ledger).state).toBe(
      'healthy',
    );
  });

  afterAll(() => {
    fixture?.cleanup();
  });

  it.each([
    'a forged row authorization',
    'dirty tracked ticket metadata',
    'a changed view after signing',
    'an author-written closing JSON',
  ])('refuses %s against an otherwise valid complete signed view', async defect => {
    const before = fixture.events().length;
    switch (defect) {
      case 'a forged row authorization': {
        writeFileSync(rowFile, '0'.repeat(64));
        break;
      }
      case 'dirty tracked ticket metadata': {
        const original = readFileSync(path.join(fixture.root, fixture.ticketPath), 'utf8');
        fixture.write(fixture.ticketPath, `${original}\nChanged uncommitted ticket metadata\n`);

        break;
      }
      case 'a changed view after signing': {
        fixture.write('metadata.md', 'A later committed view\n');
        fixture.git('add', 'metadata.md');
        fixture.git('commit', '-qm', 'move the committed closing view');

        break;
      }
      default: {
        const record = JSON.parse(closingBytes);
        writeFileSync(closingFile, JSON.stringify({ ...record, integrity: '0'.repeat(64) }));
      }
    }
    const gate = electronRetrospectiveCloseGate(fixture.root, policy.ticketId, policy.ledger);
    expect(gate.state).toBe('action_required');
    const reason = gate.findings.map(finding => finding.message).join('\n');
    switch (defect) {
      case 'a forged row authorization': {
        expect(reason).toContain(rowScenario);
        expect(reason).toMatch(/row.*not current/iu);

        break;
      }
      case 'dirty tracked ticket metadata': {
        expect(reason).toMatch(/commit.*tracked changes/iu);
        break;
      }
      case 'a changed view after signing': {
        expect(reason).toMatch(/current committed view/iu);
        break;
      }
      default: {
        expect(reason).toMatch(/authentic signature/iu);
      }
    }
    expect(fixture.events()).toHaveLength(before);
    if (defect === 'dirty tracked ticket metadata') {
      const attest = await attestElectronRetrospectiveClose(
        fixture.root,
        policy.ticketId,
        policy.ledger,
      );
      expect(attest.state).toBe('action_required');
      expect(fixture.events()).toHaveLength(before);
      expect(readFileSync(closingFile, 'utf8')).toBe(closingBytes);
    }
  });
});
