import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  type LocalRetroReadinessManifest,
  validateLocalRetroReadiness,
} from './local-retro-readiness.js';

const evidenceCommit = 'a'.repeat(40);
const fabricatedEvidence = {
  ancestorPairs: [{ ancestor: evidenceCommit, descendant: 'b'.repeat(40) }],
  buildCommit: 'b'.repeat(40),
  now: new Date('2026-08-29T01:00:00.000Z'),
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

const harnessEvidence = (harness: 'claude-code' | 'codex' | 'cursor') => ({
  artifactDigest: createHash('sha256').update(`artifact:${harness}`).digest('hex'),
  buildCommit: evidenceCommit,
  collectorReceipt: `${harness}-collector-receipt`,
  hostClass: 'local' as const,
  relayReceipt: `${harness}-relay-receipt`,
  requestId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  sessionScope: createHash('sha256').update(`session:${harness}`).digest('hex'),
  terminal: 'filed' as const,
});

const completeManifest: LocalRetroReadinessManifest = {
  enabled: true,
  evidenceCommit,
  harnesses: {
    'claude-code': harnessEvidence('claude-code'),
    codex: harnessEvidence('codex'),
    cursor: harnessEvidence('cursor'),
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

describe('local retro readiness', () => {
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
    const staleEvidence = productionEvidence('cursor-desktop', {
      now: new Date('2026-10-01T00:00:00.000Z'),
    });

    expect(validateLocalRetroReadiness(completeManifest, staleEvidence)).toBe(true);
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
