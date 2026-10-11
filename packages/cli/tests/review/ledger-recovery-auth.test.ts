import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ledgerRecoveryObservationTag,
  retrospectiveCloseTag,
  validLedgerRecoveryObservationTag,
  validRetrospectiveCloseTag,
} from '../../src/review/job.js';
import { ledgerRecoveryProfileIdentity } from '../../src/review/ledger-recovery-profile.js';

const fixture = { temporary: '', root: '', state: '' };

beforeEach(() => {
  fixture.temporary = mkdtempSync(nodePath.join(tmpdir(), 'safeword-recovery-auth-'));
  fixture.root = nodePath.join(fixture.temporary, 'project');
  fixture.state = nodePath.join(fixture.temporary, 'state');
  mkdirSync(fixture.root);
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', fixture.state);
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(fixture.temporary, { recursive: true, force: true });
});
function observation() {
  return JSON.stringify({
    kind: 'ledger-recovery-observation:v1',
    ticket: '5F5ZZA',
    profile: ledgerRecoveryProfileIdentity(),
    report_sha256: 'a'.repeat(64),
  });
}
describe('recovery observation authentication', () => {
  it('authenticates its own exact observation and rejects changed bytes or another root', () => {
    const content = observation();
    const tag = ledgerRecoveryObservationTag(fixture.root, content);
    expect(
      validLedgerRecoveryObservationTag(fixture.root, content, tag),
      'Authentic recovery observations must verify in their own domain',
    ).toBe(true);
    const altered = JSON.stringify({ ...JSON.parse(content), report_sha256: 'b'.repeat(64) });
    expect(validLedgerRecoveryObservationTag(fixture.root, altered, tag)).toBe(false);
    const other = nodePath.join(fixture.temporary, 'other');
    mkdirSync(other);
    expect(validLedgerRecoveryObservationTag(other, content, tag)).toBe(false);
  });
  it('rejects borrowing CKWE2D tags in either direction', () => {
    const content = observation();
    const old = retrospectiveCloseTag(fixture.root, content);
    expect(validRetrospectiveCloseTag(fixture.root, content, old)).toBe(true);
    expect(validLedgerRecoveryObservationTag(fixture.root, content, old)).toBe(false);
    const tag = ledgerRecoveryObservationTag(fixture.root, content);
    expect(validLedgerRecoveryObservationTag(fixture.root, content, tag)).toBe(true);
    expect(validRetrospectiveCloseTag(fixture.root, content, tag)).toBe(false);
  });
  it('refuses another kind, ticket or profile before signing', () => {
    for (const field of [
      { kind: 'retrospective-close' },
      { ticket: 'CKWE2D' },
      { profile: 'unreviewed' },
    ]) {
      const content = JSON.stringify({ ...JSON.parse(observation()), ...field });
      expect(() => ledgerRecoveryObservationTag(fixture.root, content)).toThrow(
        'Recovery observation identity does not match the installed profile.',
      );
      expect(validLedgerRecoveryObservationTag(fixture.root, content, '0'.repeat(64))).toBe(false);
    }
    expect(existsSync(fixture.state)).toBe(false);
  });
  it('does not create an integrity key while rejecting an unauthenticated record', () => {
    expect(validLedgerRecoveryObservationTag(fixture.root, observation(), '0'.repeat(64))).toBe(
      false,
    );
    expect(readdirSync(fixture.temporary)).toEqual(['project']);
  });
});
