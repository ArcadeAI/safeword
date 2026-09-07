import { createHash } from 'node:crypto';

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  digestLocalRetroReadinessManifest,
  isLocalRetroProductionAttestationFresh,
  type LocalRetroReadinessManifest,
  validateLocalRetroReadiness,
} from './local-retro-readiness.js';

const evidenceCommit = 'a'.repeat(40);
const fabricatedEvidence = {
  ancestorPairs: [{ ancestor: evidenceCommit, descendant: 'b'.repeat(40) }],
  buildCommit: 'b'.repeat(40),
  relayReady: true,
};

const fabricatedManifest = {
  enabled: true,
  evidenceCommit,
  harnesses: {},
  recoveredFaults: {},
  reviewedAt: '2026-08-29T00:00:00.000Z',
  version: 1,
} as LocalRetroReadinessManifest;

function testRequestId(index: number): string {
  const digit = String(index);
  return `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
}

const harnessEvidence = (harness: 'claude-code' | 'codex' | 'cursor', index: number) => ({
  artifactDigest: createHash('sha256').update(`artifact:${harness}`).digest('hex'),
  buildCommit: evidenceCommit,
  collectorReceipt: testRequestId(index + 3),
  hostClass: 'local' as const,
  relayReceipt: `${harness}-relay-receipt`,
  requestId: testRequestId(index),
  sessionScope: createHash('sha256').update(`session:${harness}`).digest('hex'),
  terminal: 'filed' as const,
});

const completeManifest: LocalRetroReadinessManifest = {
  enabled: true,
  evidenceCommit,
  harnesses: {
    'claude-code': harnessEvidence('claude-code', 1),
    codex: harnessEvidence('codex', 2),
    cursor: harnessEvidence('cursor', 3),
  },
  recoveredFaults: {
    ambiguousCreateMatch: 'a'.repeat(64),
    ambiguousCreateNoMatch: 'b'.repeat(64),
    claimCrash: 'c'.repeat(64),
    retryExhaustion: 'd'.repeat(64),
    workerOutage: 'e'.repeat(64),
  },
  reviewedAt: '2026-08-29T00:00:00.000Z',
  version: 1,
};

function productionEvidence(
  cursorLifecycle: string,
  overrides: Partial<typeof fabricatedEvidence> = {},
  manifest: LocalRetroReadinessManifest = completeManifest,
): Parameters<typeof validateLocalRetroReadiness>[1] {
  return {
    ...fabricatedEvidence,
    ...overrides,
    productionAttestation: {
      authority: 'retro-relay-production-v1',
      enabled: true,
      lifecycle: {
        'claude-code': 'claude-code-interactive',
        codex: 'codex-desktop',
        cursor: cursorLifecycle,
      },
      manifestSha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
      verifiedAt: '2026-08-29T00:30:00.000Z',
      version: 1,
    },
  } as unknown as Parameters<typeof validateLocalRetroReadiness>[1];
}

function reverseKeys(record: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).toReversed());
}

describe('local retro readiness', () => {
  it('binds attestation to manifest content without depending on key order', () => {
    const reordered = reverseKeys({
      ...completeManifest,
      harnesses: reverseKeys(completeManifest.harnesses),
      recoveredFaults: reverseKeys(completeManifest.recoveredFaults),
    });

    expect(digestLocalRetroReadinessManifest(reordered)).toBe(
      digestLocalRetroReadinessManifest(completeManifest),
    );
  });

  it('rejects a locally fabricated enabled manifest while production authority is unavailable', () => {
    expect(validateLocalRetroReadiness(fabricatedManifest, fabricatedEvidence)).toBe(false);
  });

  it('rejects the checked-in disabled state', () => {
    expect(validateLocalRetroReadiness({ enabled: false, version: 1 }, fabricatedEvidence)).toBe(
      false,
    );
  });

  it('requires positive host-bound Cursor Desktop lifecycle evidence', () => {
    expect(
      validateLocalRetroReadiness(completeManifest, productionEvidence('cursor-desktop')),
    ).toBe(true);
    expect(validateLocalRetroReadiness(completeManifest, productionEvidence('socket-absent'))).toBe(
      false,
    );
    expect(
      validateLocalRetroReadiness(completeManifest, productionEvidence('cursor-managed-cloud')),
    ).toBe(false);
  });

  it('requires the evidence commit to be an ancestor of the running build', () => {
    expect(
      validateLocalRetroReadiness(
        completeManifest,
        productionEvidence('cursor-desktop', { ancestorPairs: [] }),
      ),
    ).toBe(false);
  });

  it('does not expire a released cutover based on the customer clock', () => {
    expectTypeOf<Parameters<typeof validateLocalRetroReadiness>[1]>().not.toHaveProperty('now');
    expect(
      validateLocalRetroReadiness(completeManifest, productionEvidence('cursor-desktop')),
    ).toBe(true);
  });

  it('rejects stale evidence at the production release boundary', () => {
    const attestation = productionEvidence('cursor-desktop').productionAttestation;
    if (attestation === undefined) throw new Error('missing test attestation');

    expect(
      isLocalRetroProductionAttestationFresh(attestation, new Date('2026-10-01T00:00:00.000Z')),
    ).toBe(false);
  });

  it('requires evidence for every supported harness', () => {
    const incompleteManifest = {
      ...completeManifest,
      harnesses: {
        'claude-code': completeManifest.harnesses['claude-code'],
        codex: completeManifest.harnesses.codex,
      },
    } as unknown as LocalRetroReadinessManifest;

    expect(
      validateLocalRetroReadiness(
        incompleteManifest,
        productionEvidence('cursor-desktop', {}, incompleteManifest),
      ),
    ).toBe(false);
  });

  it.each(['requestId', 'collectorReceipt', 'relayReceipt', 'sessionScope'] as const)(
    'requires a distinct %s for every harness',
    field => {
      const duplicatedManifest = structuredClone(completeManifest);
      duplicatedManifest.harnesses.cursor[field] = duplicatedManifest.harnesses.codex[field];

      expect(
        validateLocalRetroReadiness(
          duplicatedManifest,
          productionEvidence('cursor-desktop', {}, duplicatedManifest),
        ),
      ).toBe(false);
    },
  );

  it('requires every production fault recovery artifact', () => {
    const incompleteManifest = {
      ...completeManifest,
      recoveredFaults: {
        ambiguousCreateMatch: completeManifest.recoveredFaults.ambiguousCreateMatch,
        ambiguousCreateNoMatch: completeManifest.recoveredFaults.ambiguousCreateNoMatch,
        claimCrash: completeManifest.recoveredFaults.claimCrash,
        retryExhaustion: completeManifest.recoveredFaults.retryExhaustion,
      },
    } as unknown as LocalRetroReadinessManifest;

    expect(
      validateLocalRetroReadiness(
        incompleteManifest,
        productionEvidence('cursor-desktop', {}, incompleteManifest),
      ),
    ).toBe(false);
  });
});
