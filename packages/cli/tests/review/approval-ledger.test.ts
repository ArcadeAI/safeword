import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { appendDesignDecision, currentDesignDecision } from '../../src/review/approval-ledger.js';

const roots: string[] = [];
const originalTimeout = process.env.SAFEWORD_APPROVAL_LOCK_TIMEOUT_MS;
const originalStaleFence = process.env.SAFEWORD_APPROVAL_TEST_STALE_FENCE;

function ledgerPath(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-approval-ledger-'));
  roots.push(root);
  return nodePath.join(root, 'skill-invocations.log');
}

function append(path: string, decision: 'approved' | 'declined', authorityReference = 'terminal') {
  return appendDesignDecision(path, {
    authorityRef: authorityReference,
    decision,
    planDigest: 'plan-digest',
    ticket: 'TICKET',
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
  if (originalTimeout === undefined) delete process.env.SAFEWORD_APPROVAL_LOCK_TIMEOUT_MS;
  else process.env.SAFEWORD_APPROVAL_LOCK_TIMEOUT_MS = originalTimeout;
  if (originalStaleFence === undefined) delete process.env.SAFEWORD_APPROVAL_TEST_STALE_FENCE;
  else process.env.SAFEWORD_APPROVAL_TEST_STALE_FENCE = originalStaleFence;
});

describe('approval ledger recovery matrix', () => {
  it('initializes the sidecar and first serialized authority event together', () => {
    const path = ledgerPath();

    expect(append(path, 'approved')).toEqual({ status: 'written' });
    expect(readFileSync(`${path}.approval-fence`, 'utf8')).toBe('1\n');
    expect(currentDesignDecision(path, 'TICKET', 'plan-digest')).toBe('approved');
  });

  it.each(['missing', 'malformed'])('%s fencing state after authority fails closed', state => {
    const path = ledgerPath();
    expect(append(path, 'approved')).toEqual({ status: 'written' });
    const before = readFileSync(path, 'utf8');
    if (state === 'missing') unlinkSync(`${path}.approval-fence`);
    else writeFileSync(`${path}.approval-fence`, 'not-a-generation\n');

    expect(append(path, 'declined')).toEqual({ status: 'pending' });
    expect(readFileSync(path, 'utf8')).toBe(before);
  });

  it('reclaims an expired lock only when its owner is definitively dead', () => {
    const path = ledgerPath();
    writeFileSync(
      `${path}.approval-lock`,
      `${JSON.stringify({ leaseExpiresAt: 0, pid: 2_147_483_647, token: 'dead-owner' })}\n`,
    );

    expect(append(path, 'approved')).toEqual({ status: 'written' });
  });

  it('refuses to reclaim an expired lock whose owner is still alive', () => {
    const path = ledgerPath();
    process.env.SAFEWORD_APPROVAL_LOCK_TIMEOUT_MS = '20';
    writeFileSync(
      `${path}.approval-lock`,
      `${JSON.stringify({ leaseExpiresAt: 0, pid: process.pid, token: 'live-owner' })}\n`,
    );

    expect(append(path, 'approved')).toEqual({ status: 'pending' });
    expect(() => readFileSync(path, 'utf8')).toThrow();
  });

  it('does not invent authority when the ledger cannot be replaced', () => {
    const path = ledgerPath();
    mkdirSync(path);

    expect(append(path, 'approved')).toEqual({ status: 'pending' });
    expect(currentDesignDecision(path, 'TICKET', 'plan-digest')).toBeUndefined();
  });

  it('does not commit after its fencing generation becomes stale', () => {
    const path = ledgerPath();
    expect(append(path, 'approved')).toEqual({ status: 'written' });
    const before = readFileSync(path, 'utf8');
    process.env.SAFEWORD_APPROVAL_TEST_STALE_FENCE = '1';

    expect(append(path, 'declined')).toEqual({ status: 'pending' });
    expect(readFileSync(path, 'utf8')).toBe(before);
    expect(currentDesignDecision(path, 'TICKET', 'plan-digest')).toBe('approved');
  });

  it('appends a new decision when an earlier identical decision was superseded', () => {
    const path = ledgerPath();

    expect(append(path, 'approved')).toEqual({ status: 'written' });
    expect(append(path, 'declined')).toEqual({ status: 'written' });
    expect(append(path, 'approved')).toEqual({ status: 'written' });
    expect(currentDesignDecision(path, 'TICKET', 'plan-digest')).toBe('approved');
  });

  it('fails closed when the highest append position has conflicting decisions', () => {
    const path = ledgerPath();
    const event = (decision: 'approved' | 'declined', generation: number) => ({
      appendPosition: 7,
      authorityRef: `authority-${generation}`,
      decision,
      fencingGeneration: generation,
      idempotencyKey: `key-${generation}`,
      kind: 'design-decision',
      phase: 'plan-implementation',
      planDigest: 'plan-digest',
      ticket: 'TICKET',
      timestamp: `2026-09-11T00:00:0${generation}.000Z`,
    });
    writeFileSync(
      path,
      [event('approved', 7), event('declined', 8)]
        .map(value => `2026-09-11 fixture design-decision:${JSON.stringify(value)}`)
        .join('\n'),
    );

    expect(currentDesignDecision(path, 'TICKET', 'plan-digest')).toBeUndefined();
  });
});
