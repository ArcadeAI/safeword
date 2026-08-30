import { describe, expect, it } from 'vitest';

import {
  type LocalRetroReadinessManifest,
  validateLocalRetroReadiness,
} from './local-retro-readiness.js';

const evidenceCommit = 'a'.repeat(40);
const buildCommit = 'b'.repeat(40);
const receipt = '11111111-2222-4333-8444-555555555555';
const harnessEvidence = {
  buildCommit: evidenceCommit,
  collectorReceipt: receipt,
  hostClass: 'local' as const,
  relayReceipt: receipt,
  terminal: 'filed' as const,
};

function readinessFixture(): {
  input: Parameters<typeof validateLocalRetroReadiness>[1];
  manifest: LocalRetroReadinessManifest;
} {
  return {
    manifest: {
      enabled: true,
      evidenceCommit,
      harnesses: {
        'claude-code': harnessEvidence,
        codex: harnessEvidence,
        cursor: harnessEvidence,
      },
      recoveredFaults: {
        ambiguousCreateMatch: '1'.repeat(64),
        ambiguousCreateNoMatch: '2'.repeat(64),
        claimCrash: '3'.repeat(64),
        retryExhaustion: '4'.repeat(64),
        workerOutage: '5'.repeat(64),
      },
      reviewedAt: '2026-08-29T00:00:00.000Z',
      version: 1,
    },
    input: {
      ancestorPairs: [{ ancestor: evidenceCommit, descendant: buildCommit }],
      buildCommit,
      now: new Date('2026-08-29T01:00:00.000Z'),
      relayReady: true,
    },
  };
}

describe('local retro readiness', () => {
  it('accepts complete local harness and recovered-fault evidence on a ready relay', () => {
    const { input, manifest } = readinessFixture();

    expect(validateLocalRetroReadiness(manifest, input)).toBe(true);
  });

  it.each(['managed', 'unknown'] as const)(
    'rejects Cursor evidence with %s host provenance',
    hostClass => {
      const { input, manifest } = readinessFixture();
      const malformed = {
        ...manifest,
        harnesses: {
          ...manifest.harnesses,
          cursor: { ...harnessEvidence, hostClass },
        },
      } as never;

      expect(validateLocalRetroReadiness(malformed, input)).toBe(false);
    },
  );

  it('rejects a disabled manifest', () => {
    const { input } = readinessFixture();

    expect(validateLocalRetroReadiness({ enabled: false, version: 1 }, input)).toBe(false);
  });

  it('rejects missing harness evidence', () => {
    const { input, manifest } = readinessFixture();
    const malformed = {
      ...manifest,
      harnesses: { codex: harnessEvidence, cursor: harnessEvidence },
    } as never;

    expect(validateLocalRetroReadiness(malformed, input)).toBe(false);
  });

  it('rejects harness evidence from a different build', () => {
    const { input, manifest } = readinessFixture();
    const mismatched = {
      ...manifest,
      harnesses: {
        ...manifest.harnesses,
        codex: { ...harnessEvidence, buildCommit: 'c'.repeat(40) },
      },
    };

    expect(validateLocalRetroReadiness(mismatched, input)).toBe(false);
  });

  it.each(Object.keys(readinessFixture().manifest.recoveredFaults))(
    'rejects a missing or malformed %s recovery artifact',
    fault => {
      const { input, manifest } = readinessFixture();
      const recoveredFaults = { ...manifest.recoveredFaults, [fault]: 'missing' };

      expect(validateLocalRetroReadiness({ ...manifest, recoveredFaults }, input)).toBe(false);
    },
  );

  it.each([
    ['relay is not ready', { relayReady: false }],
    ['build ancestry is missing', { ancestorPairs: [] }],
    ['review evidence is stale', { now: new Date('2026-09-29T00:00:00.001Z') }],
    ['review evidence is future-dated', { now: new Date('2026-08-28T23:59:59.999Z') }],
  ] as const)('rejects when %s', (_case, override) => {
    const { input, manifest } = readinessFixture();

    expect(validateLocalRetroReadiness(manifest, { ...input, ...override })).toBe(false);
  });
});
