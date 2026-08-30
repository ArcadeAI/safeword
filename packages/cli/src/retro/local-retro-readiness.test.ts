import { expect, it } from 'vitest';

import { validateLocalRetroReadiness } from './local-retro-readiness.js';

it('enables only complete local harness and recovered-fault evidence on a ready relay', () => {
  const evidenceCommit = 'a'.repeat(40);
  const buildCommit = 'b'.repeat(40);
  const receipt = '11111111-2222-4333-8444-555555555555';
  const evidence = {
    buildCommit: evidenceCommit,
    collectorReceipt: receipt,
    hostClass: 'local' as const,
    relayReceipt: receipt,
    terminal: 'filed' as const,
  };
  const manifest = {
    enabled: true as const,
    evidenceCommit,
    harnesses: { 'claude-code': evidence, codex: evidence, cursor: evidence },
    recoveredFaults: {
      ambiguousCreateMatch: '1'.repeat(64),
      ambiguousCreateNoMatch: '2'.repeat(64),
      claimCrash: '3'.repeat(64),
      retryExhaustion: '4'.repeat(64),
      workerOutage: '5'.repeat(64),
    },
    reviewedAt: '2026-08-29T00:00:00.000Z',
    version: 1 as const,
  };
  const input = {
    ancestorPairs: [{ ancestor: evidenceCommit, descendant: buildCommit }],
    buildCommit,
    now: new Date('2026-08-29T01:00:00.000Z'),
    relayReady: true,
  };

  expect(validateLocalRetroReadiness(manifest, input)).toBe(true);
  expect(
    validateLocalRetroReadiness(
      {
        ...manifest,
        harnesses: { ...manifest.harnesses, cursor: { ...evidence, hostClass: 'managed' } },
      } as never,
      input,
    ),
  ).toBe(false);
  expect(
    validateLocalRetroReadiness(
      { ...manifest, harnesses: { codex: evidence, cursor: evidence } } as never,
      input,
    ),
  ).toBe(false);
  expect(
    validateLocalRetroReadiness(
      {
        ...manifest,
        harnesses: {
          ...manifest.harnesses,
          codex: { ...evidence, buildCommit: 'c'.repeat(40) },
        },
      },
      input,
    ),
  ).toBe(false);
  expect(
    validateLocalRetroReadiness(
      { ...manifest, recoveredFaults: { ...manifest.recoveredFaults, workerOutage: 'missing' } },
      input,
    ),
  ).toBe(false);
  expect(validateLocalRetroReadiness(manifest, { ...input, relayReady: false })).toBe(false);
  expect(
    validateLocalRetroReadiness(manifest, {
      ...input,
      ancestorPairs: [],
    }),
  ).toBe(false);
  expect(
    validateLocalRetroReadiness(manifest, {
      ...input,
      now: new Date('2026-09-29T00:00:00.001Z'),
    }),
  ).toBe(false);
  expect(
    validateLocalRetroReadiness(manifest, {
      ...input,
      now: new Date('2026-08-28T23:59:59.999Z'),
    }),
  ).toBe(false);
});
