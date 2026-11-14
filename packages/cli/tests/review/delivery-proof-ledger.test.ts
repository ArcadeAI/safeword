import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appendDeliveryCompatibility,
  appendDeliveryProof,
  appendDesignDecision,
  readDeliveryCompatibility,
  readDeliveryProof,
} from '../../src/review/approval-ledger.js';

function ledgerPath(): string {
  const prefix = nodePath.join(tmpdir(), 'safeword-delivery-ledger-');
  return nodePath.join(mkdtempSync(prefix), 'ledger');
}

function proofIdentity() {
  return {
    ticket: 'A639WN',
    itemId: 'testing',
    proofId: 'delivery-cli',
    method: 'command' as const,
    scope: 'E2E' as const,
    boundary: 'public delivery CLI',
    qualification: 'real_boundary' as const,
    producingRevision: 'a'.repeat(40),
    definitionDigest: 'e'.repeat(64),
    invocationDigest: 'b'.repeat(64),
    outcome: 'passed' as const,
    stdout: { bytes: 0, sha256: 'c'.repeat(64) },
    stderr: { bytes: 0, sha256: 'd'.repeat(64) },
  };
}

function compatibilityIdentity() {
  return {
    ticket: 'A639WN',
    itemId: 'testing',
    proofId: 'delivery-cli',
    definitionDigest: 'e'.repeat(64),
    deliveryReceiptId: 'delivery-receipt',
    reasonDigest: '1'.repeat(64),
    producingRevision: 'a'.repeat(40),
    reviewedRevision: 'b'.repeat(40),
    requestDigest: '2'.repeat(64),
    sourceReviewId: 'review-id',
  };
}

describe('delivery proof ledger', () => {
  it('appends one idempotent item-bound receipt and reads it by retained id', () => {
    const path = ledgerPath();
    const first = appendDeliveryProof(path, proofIdentity());
    const retry = appendDeliveryProof(path, proofIdentity());

    expect(first).toMatchObject({ status: 'written', receiptId: expect.any(String) });
    expect(retry).toEqual({ status: 'existing', receiptId: first.receiptId });
    expect(readDeliveryProof(path, first.receiptId ?? '')).toMatchObject({
      kind: 'delivery-proof:v1',
      ticket: 'A639WN',
      itemId: 'testing',
      proofId: 'delivery-cli',
      outcome: 'passed',
    });
  });

  it('shares fencing positions with approvals and preserves unknown event lines', () => {
    const path = ledgerPath();
    const unknown = 'future event bytes must survive\n';
    writeFileSync(path, unknown);

    expect(
      appendDesignDecision(path, {
        ticket: 'A639WN',
        planDigest: 'plan-digest',
        decision: 'approved',
        authorityRef: 'human:test',
      }),
    ).toEqual({ status: 'written' });
    expect(appendDeliveryProof(path, proofIdentity())).toMatchObject({ status: 'written' });

    const content = readFileSync(path, 'utf8');
    expect(content.startsWith(unknown)).toBe(true);
    const positions = Array.from(content.matchAll(/"appendPosition":(\d+)/gu), match =>
      Number(match[1]),
    );
    expect(positions).toEqual([1, 2]);
  });

  it('reuses a receipt across repeated output while separating reviewed definitions', () => {
    const path = ledgerPath();
    const identity = proofIdentity();
    const first = appendDeliveryProof(path, identity);
    const retry = appendDeliveryProof(path, {
      ...identity,
      stdout: { bytes: 1, sha256: 'f'.repeat(64) },
    });
    const changedDefinition = appendDeliveryProof(path, {
      ...identity,
      definitionDigest: '0'.repeat(64),
    });

    expect(retry).toEqual({ status: 'existing', receiptId: first.receiptId });
    expect(changedDefinition).toMatchObject({ status: 'written', receiptId: expect.any(String) });
    expect(changedDefinition.receiptId).not.toBe(first.receiptId);
  });

  it('retains one idempotent compatibility acceptance with exact bindings', () => {
    const path = ledgerPath();
    const identity = compatibilityIdentity();
    const first = appendDeliveryCompatibility(path, identity);
    const retry = appendDeliveryCompatibility(path, identity);

    expect(first).toEqual({ status: 'written' });
    expect(retry).toEqual({ status: 'existing' });
    expect(readDeliveryCompatibility(path, identity)).toMatchObject({
      kind: 'delivery-compatibility:v1',
      ...identity,
    });
    expect(
      readDeliveryCompatibility(path, { ...identity, reasonDigest: '3'.repeat(64) }),
    ).toBeUndefined();
  });

  it('shares one ordered ledger across approvals, proofs, and compatibility acceptance', () => {
    const path = ledgerPath();

    expect(
      appendDesignDecision(path, {
        ticket: 'A639WN',
        planDigest: 'plan-digest',
        decision: 'approved',
        authorityRef: 'human:test',
      }),
    ).toEqual({ status: 'written' });
    expect(appendDeliveryProof(path, proofIdentity())).toMatchObject({ status: 'written' });
    expect(appendDeliveryCompatibility(path, compatibilityIdentity())).toEqual({
      status: 'written',
    });

    const positions = Array.from(
      readFileSync(path, 'utf8').matchAll(/"appendPosition":(\d+)/gu),
      match => Number(match[1]),
    );
    expect(positions).toEqual([1, 2, 3]);
  });
});
