import { createHash } from 'node:crypto';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  CHECKED_IN_LOCAL_RETRO_PRODUCTION_ATTESTATION,
  CHECKED_IN_LOCAL_RETRO_READINESS,
  digestLocalRetroReadinessManifest,
  isLocalRetroProductionAttestationFresh,
  type LocalRetroProductionAttestation,
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
  const lifecycle = {
    'claude-code': 'claude-code-interactive',
    codex: 'codex-desktop',
    cursor: cursorLifecycle,
  } as LocalRetroProductionAttestation['lifecycle'];

  return {
    ...fabricatedEvidence,
    ...overrides,
    productionAttestation: {
      authority: 'retro-relay-production-v1',
      enabled: true,
      lifecycle,
      manifestSha256: digestLocalRetroReadinessManifest(manifest),
      verifiedAt: '2026-08-29T00:30:00.000Z',
      version: 1,
    },
  };
}

function setHarnessField(
  manifest: LocalRetroReadinessManifest,
  field: keyof LocalRetroReadinessManifest['harnesses']['cursor'],
  value: string,
): void {
  (manifest.harnesses.cursor as unknown as Record<string, string>)[field] = value;
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

  it('rejects a modified manifest under an earlier production attestation', () => {
    const attestedEvidence = productionEvidence('cursor-desktop');
    const modifiedManifest = structuredClone(completeManifest);
    modifiedManifest.recoveredFaults.workerOutage = 'f'.repeat(64);

    expect(validateLocalRetroReadiness(modifiedManifest, attestedEvidence)).toBe(false);
  });

  it('rejects an incomplete locally fabricated manifest', () => {
    expect(validateLocalRetroReadiness(fabricatedManifest, fabricatedEvidence)).toBe(false);
  });

  it('rejects complete evidence while production authority is unavailable', () => {
    const evidence = productionEvidence('cursor-desktop');
    delete evidence.productionAttestation;

    expect(validateLocalRetroReadiness(completeManifest, evidence)).toBe(false);
  });

  it.each([
    ['authority', 'not-production'],
    ['version', 2],
  ] as const)('rejects a production attestation with the wrong %s', (field, value) => {
    const evidence = productionEvidence('cursor-desktop');
    const attestation = evidence.productionAttestation;
    if (attestation === undefined) throw new Error('missing test attestation');
    (attestation as unknown as Record<string, unknown>)[field] = value;

    expect(validateLocalRetroReadiness(completeManifest, evidence)).toBe(false);
  });

  it('rejects an explicitly disabled production attestation', () => {
    const evidence = productionEvidence('cursor-desktop');
    evidence.productionAttestation = { enabled: false, version: 1 };

    expect(validateLocalRetroReadiness(completeManifest, evidence)).toBe(false);
  });

  it('rejects the checked-in disabled state', () => {
    expect(CHECKED_IN_LOCAL_RETRO_READINESS.enabled).toBe(false);
    expect(CHECKED_IN_LOCAL_RETRO_PRODUCTION_ATTESTATION.enabled).toBe(false);
    expect(validateLocalRetroReadiness(CHECKED_IN_LOCAL_RETRO_READINESS, fabricatedEvidence)).toBe(
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

  it.each([
    ['claude-code', 'claude-code-cloud'],
    ['codex', 'codex-cloud'],
    ['cursor', 'cursor-managed-cloud'],
  ] as const)('rejects the wrong %s lifecycle evidence', (harness, lifecycle) => {
    const evidence = productionEvidence('cursor-desktop');
    const attestation = evidence.productionAttestation;
    if (!attestation?.enabled) {
      throw new Error('missing test attestation');
    }
    (attestation.lifecycle as unknown as Record<string, string>)[harness] = lifecycle;

    expect(validateLocalRetroReadiness(completeManifest, evidence)).toBe(false);
  });

  it('requires the evidence commit to be an ancestor of the running build', () => {
    expect(
      validateLocalRetroReadiness(
        completeManifest,
        productionEvidence('cursor-desktop', { ancestorPairs: [] }),
      ),
    ).toBe(false);
  });

  it.each([
    ['manifest evidence commit', 'manifest'],
    ['running build commit', 'build'],
  ] as const)('rejects a malformed %s', (_label, target) => {
    const manifest = structuredClone(completeManifest);
    const overrides: Partial<typeof fabricatedEvidence> = {};
    if (target === 'manifest') {
      manifest.evidenceCommit = 'not-a-commit';
      overrides.ancestorPairs = [
        { ancestor: 'not-a-commit', descendant: fabricatedEvidence.buildCommit },
        { ancestor: evidenceCommit, descendant: 'not-a-commit' },
      ];
    } else {
      overrides.buildCommit = 'not-a-commit';
      overrides.ancestorPairs = [{ ancestor: evidenceCommit, descendant: 'not-a-commit' }];
    }

    expect(
      validateLocalRetroReadiness(
        manifest,
        productionEvidence('cursor-desktop', overrides, manifest),
      ),
    ).toBe(false);
  });

  it.each(['not-a-date', '2026-08-29T00:00:00Z', '2026-08-29T01:00:00.000Z'])(
    'rejects invalid or unverified manifest review time %s',
    reviewedAt => {
      const manifest = structuredClone(completeManifest);
      manifest.reviewedAt = reviewedAt;

      expect(
        validateLocalRetroReadiness(manifest, productionEvidence('cursor-desktop', {}, manifest)),
      ).toBe(false);
    },
  );

  it('requires every harness build to be in the evidence ancestry', () => {
    const harnessBuildCommit = 'c'.repeat(40);
    const manifest = structuredClone(completeManifest);
    manifest.harnesses.cursor.buildCommit = harnessBuildCommit;

    expect(
      validateLocalRetroReadiness(manifest, productionEvidence('cursor-desktop', {}, manifest)),
    ).toBe(false);
    expect(
      validateLocalRetroReadiness(
        manifest,
        productionEvidence(
          'cursor-desktop',
          {
            ancestorPairs: [
              ...fabricatedEvidence.ancestorPairs,
              { ancestor: harnessBuildCommit, descendant: evidenceCommit },
            ],
          },
          manifest,
        ),
      ),
    ).toBe(true);
  });

  it('requires relay readiness before local cutover', () => {
    expect(
      validateLocalRetroReadiness(
        completeManifest,
        productionEvidence('cursor-desktop', { relayReady: false }),
      ),
    ).toBe(false);
  });

  it('rejects an unsupported manifest version without throwing', () => {
    const manifest = structuredClone(completeManifest);
    (manifest as unknown as { version: number }).version = 2;

    expect(
      validateLocalRetroReadiness(manifest, productionEvidence('cursor-desktop', {}, manifest)),
    ).toBe(false);
  });

  it('fails closed when an enabled manifest is structurally incomplete', () => {
    const manifest = structuredClone(completeManifest);
    delete (manifest as unknown as { harnesses?: unknown }).harnesses;

    expect(
      validateLocalRetroReadiness(manifest, productionEvidence('cursor-desktop', {}, manifest)),
    ).toBe(false);
  });

  it('does not expire a released cutover based on the customer clock', () => {
    expectTypeOf<Parameters<typeof validateLocalRetroReadiness>[1]>().not.toHaveProperty('now');
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
      expect(
        validateLocalRetroReadiness(completeManifest, productionEvidence('cursor-desktop')),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects stale evidence at the production release boundary', () => {
    const attestation = productionEvidence('cursor-desktop').productionAttestation;
    if (!attestation?.enabled) throw new Error('missing test attestation');

    expect(
      isLocalRetroProductionAttestationFresh(attestation, new Date('2026-09-28T00:30:00.000Z')),
    ).toBe(true);
    expect(
      isLocalRetroProductionAttestationFresh(attestation, new Date('2026-09-28T00:30:00.001Z')),
    ).toBe(false);
    expect(
      isLocalRetroProductionAttestationFresh(attestation, new Date('2026-08-28T00:30:00.000Z')),
    ).toBe(false);

    const nonCanonical = structuredClone(attestation);
    nonCanonical.verifiedAt = '2026-08-29T00:30:00Z';
    expect(
      isLocalRetroProductionAttestationFresh(nonCanonical, new Date('2026-08-29T00:30:00.000Z')),
    ).toBe(false);
    expect(
      isLocalRetroProductionAttestationFresh(
        { enabled: false, version: 1 },
        new Date('2026-08-29T00:30:00.000Z'),
      ),
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

  it('rejects an unexpected harness', () => {
    const manifest = structuredClone(completeManifest);
    (manifest.harnesses as unknown as Record<string, unknown>).other = {
      ...harnessEvidence('cursor', 4),
      relayReceipt: 'other-relay-receipt',
      sessionScope: createHash('sha256').update('session:other').digest('hex'),
    };

    expect(
      validateLocalRetroReadiness(manifest, productionEvidence('cursor-desktop', {}, manifest)),
    ).toBe(false);
  });

  it.each([
    ['artifactDigest', 'not-a-digest'],
    ['buildCommit', 'not-a-commit'],
    ['collectorReceipt', 'not-a-request-id'],
    ['hostClass', 'managed-cloud'],
    ['relayReceipt', 'not a receipt'],
    ['requestId', 'not-a-request-id'],
    ['sessionScope', 'not-a-session-scope'],
    ['terminal', 'abandoned'],
  ] as const)('rejects invalid harness %s evidence', (field, value) => {
    const manifest = structuredClone(completeManifest);
    setHarnessField(manifest, field, value);
    const overrides =
      field === 'buildCommit'
        ? {
            ancestorPairs: [
              ...fabricatedEvidence.ancestorPairs,
              { ancestor: value, descendant: evidenceCommit },
            ],
          }
        : {};

    expect(
      validateLocalRetroReadiness(
        manifest,
        productionEvidence('cursor-desktop', overrides, manifest),
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

  it('rejects an unexpected production fault artifact', () => {
    const manifest = structuredClone(completeManifest);
    (manifest.recoveredFaults as unknown as Record<string, string>).other = 'f'.repeat(64);

    expect(
      validateLocalRetroReadiness(manifest, productionEvidence('cursor-desktop', {}, manifest)),
    ).toBe(false);
  });

  it('rejects an invalid production fault artifact digest', () => {
    const manifest = structuredClone(completeManifest);
    manifest.recoveredFaults.workerOutage = 'not-a-digest';

    expect(
      validateLocalRetroReadiness(manifest, productionEvidence('cursor-desktop', {}, manifest)),
    ).toBe(false);
  });
});
